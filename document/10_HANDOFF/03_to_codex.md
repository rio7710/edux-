# InstructorProfile 확장 — 최종 검토 의견

> 검토일: 2026-02-11 (3차 업데이트)
> 검토 기준: 현재 코드베이스 전체 조사 + 프로덕트 오너 논의 반영

---

## 0. 목적

강사 프로필이나 강의 정보를 **PDF 또는 사이트 링크로 외부에 제공**하는 것이 최종 목표.
같은 강사가 용도별로 다른 양식(템플릿)을 적용한 결과물을 여러 개 만들어 공유할 수 있어야 한다.

---

## 1. 방향 변경 — InstructorProfile 1:N 불필요

### 기존 제안

- InstructorProfile을 1:N으로 확장하여 프로필마다 다른 templateId 지정

### 변경 사유

논의 결과, "프로필 데이터 자체를 여러 벌 만드는 것"과 "같은 데이터에 템플릿을 여러 개 적용하는 것"은 사용자 입장에서 구분이 없다. 그리고 **현재 RenderJob이 이미 1:N 구조를 제공하고 있다.**

같은 targetId에 다른 templateId로 RenderJob을 여러 개 생성하면 = 이미 1:N.

### 최종 방향

**InstructorProfile은 1:1(@unique) 유지.** 템플릿 적용 결과물은 UserDocument로 관리.

---

## 2. Instructor 유지 — 변경 없음

- Instructor는 `CourseSchedule`, `CourseInstructor` 등 운영 데이터와 강하게 결합
- 건드리면 파급 범위가 큼, 그대로 유지

---

## 3. RenderJob / UserDocument 역할 분리

### 왜 분리하는가

RenderJob은 **작업 큐**(pending → processing → done/failed)이다.
여기에 사용자 문서 관리(공유, 라벨, 만료 등)까지 태우면 역할이 비대해진다.
RenderJob에 필드를 추가해서 단점을 처리하면 결국 분리한 것과 비슷한 복잡도가 된다.
처음부터 분리하는 게 낫다.

### 역할 정의

| 모델 | 역할 | 성격 |
|------|------|------|
| **RenderJob** | 렌더 작업 처리 | 요청 → 큐 → 완료/실패 (작업 로그) |
| **UserDocument** | 사용자 문서 관리 | 완료된 결과물의 소유, 공유, 라벨링 (사용자 자산) |

### 흐름

```text
사용자가 내보내기 요청
  → RenderJob 생성 (pending → processing → done)
  → 완료 시 UserDocument 생성 (사용자 자산으로 등록)
```

### 분리의 장점

- 렌더 로직 수정 시 문서 관리 코드에 영향 없음
- 공유/만료/권한 기능 추가 시 RenderJob 건드릴 필요 없음
- 실패한 Job과 사용자 문서가 섞이지 않음
- 미리보기용 렌더와 저장된 문서가 자연스럽게 분리됨

---

## 4. 스키마 변경 사항

### InstructorProfile — 변경 없음

- `@unique` 유지 (1:1 그대로)
- `templateId` 추가하지 않음

### RenderJob — 최소 변경

- `targetType`에 `'instructor_profile'` 값 추가 (기존 `'course'`, `'schedule'`에 추가)

### UserDocument — 신규 모델

```prisma
model UserDocument {
  id          String    @id @default(cuid())
  userId      String
  renderJobId String
  templateId  String
  targetType  String    // 'course' | 'schedule' | 'instructor_profile'
  targetId    String
  label       String?   // "IT과정 강의계획서", "리더십 강사소개서" 등
  pdfUrl      String
  shareToken  String?   @unique
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  User      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  RenderJob RenderJob @relation(fields: [renderJobId], references: [id])

  @@index([userId])
  @@index([shareToken])
}
```

### User, Template — 변경 없음

- `User.defaultInstructorProfileId` 불필요 (1:1 유지이므로)
- `Template`은 기존 `type = 'instructor_profile'` 템플릿이 이미 seed에 존재

---

## 5. 렌더 파이프라인 확장

### pdfWorker 분기 추가

현재 `courseId | scheduleId` 분기에 `profileId` 추가:

```text
if (courseId)        → Course 데이터 로드
else if (scheduleId) → Schedule 데이터 로드
else if (profileId)  → InstructorProfile + Instructor 데이터 조인 로드
```

프로필 렌더 시 InstructorProfile 기본 정보 + Instructor 풍부한 정보(specialties, degrees, careers 등)를 합쳐서 템플릿에 주입.

### pdfWorker 완료 후 UserDocument 생성

렌더 완료 시 자동으로 UserDocument 레코드 생성:

```text
RenderJob status = 'done'
  → UserDocument.create({
       userId, renderJobId, templateId,
       targetType, targetId, pdfUrl
     })
```

### 신규 핸들러

- `renderInstructorProfilePdf` (render.ts) — 프로필 ID + 템플릿 ID를 받아 RenderJob 생성

### 외부 공유

- UserDocument.shareToken으로 공유 링크 생성
- 공유 엔드포인트: `/share/:shareToken` → pdfUrl 반환 또는 리다이렉트

---

## 6. UX 흐름

### 강사 입장

```text
프로필 페이지
├─ 내 정보 편집 (프로필 원본 — 여기서만 관리)
└─ [내보내기] 버튼
    ├─ 템플릿 선택
    ├─ 미리보기
    └─ PDF 다운로드 / 공유 링크 생성 → UserDocument로 저장
```

### 내 문서함

```text
내 문서함 (UserDocument 목록)
├─ IT과정 강의계획서 (템플릿A)     [PDF] [공유링크] [재생성] [삭제]
├─ 리더십 강의계획서 (템플릿B)      [PDF] [공유링크] [재생성] [삭제]
└─ 강사 소개서 (템플릿C)           [PDF] [공유링크] [재생성] [삭제]
```

- 프로필은 하나만 관리
- 내보내기할 때 템플릿을 고르면 문서함에 자동 저장
- "원본 vs 복제본" 혼란 없음

---

## 7. 변경 영향 범위 (최종)

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | UserDocument 모델 신규, RenderJob.targetType에 'instructor_profile' 추가 |
| `src/tools/render.ts` | `renderInstructorProfilePdf` 핸들러 신규 |
| `src/tools/document.ts` | UserDocument CRUD 핸들러 신규 (목록, 삭제, 공유토큰 생성) |
| `src/workers/pdfWorker.ts` | `profileId` 분기 추가 + 완료 시 UserDocument 자동 생성 |
| `src/mcp-server.ts` | `render.instructorProfilePdf`, `document.*` 도구 등록 |
| `src/transport.ts` | `/share/:shareToken` 공유 엔드포인트 추가 |
| `ui/src/api/mcpClient.ts` | `renderInstructorProfilePdf`, document 클라이언트 추가 |
| `ui/src/pages/ProfilePage.tsx` | 내보내기 버튼 + 템플릿 선택 UI |
| `ui/src/pages/MyDocumentsPage.tsx` | 내 문서함 페이지 신규 |
| `ui/src/pages/RenderPage.tsx` | "강사 프로필" 렌더 타입 추가 |

---

## 8. 결론

| 항목 | 판정 | 비고 |
|------|------|------|
| Instructor 유지 | 유지 | 운영 데이터 결합, 변경 없음 |
| InstructorProfile 1:1 유지 | 유지 | 1:N 확장 불필요, @unique 유지 |
| RenderJob | 유지 | 작업 처리 전용, targetType에 'instructor_profile' 추가만 |
| UserDocument 신규 | 채택 | 사용자 문서 관리 (소유, 공유, 라벨) |
| 렌더 파이프라인 확장 | 추가 | profileId 분기 + 완료 시 UserDocument 자동 생성 |

**RenderJob = 작업 처리, UserDocument = 사용자 자산.**
역할 분리로 각각 독립적으로 확장 가능.
InstructorProfile은 1:1 유지, 템플릿 적용(1:N)은 UserDocument가 담당.
