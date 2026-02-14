# InstructorProfile 확장 — 최종 검토 의견

> 검토일: 2026-02-11 (4차 업데이트)
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

---

## 9. 발견된 이슈 및 수정 사항

### 9.1. Prisma 역방향 관계 누락 (수정 완료)

`prisma generate` 시 5개 validation error 발생. 원인: RenderJob과 UserDocument에 FK를 추가했지만, 참조 대상 모델에 역방향 relation 필드가 없었음.

**수정 내용:**

| 모델        | 추가된 필드                                              |
| ----------- | ------------------------------------------------------- |
| `User`      | `RenderJobs RenderJob[]`, `UserDocuments UserDocument[]` |
| `Template`  | `RenderJobs RenderJob[]`, `UserDocuments UserDocument[]` |
| `RenderJob` | `UserDocuments UserDocument[]`                           |

### 9.2. render.ts 기존 핸들러 Breaking Change (주의 필요)

기존 `renderCoursePdfHandler`, `renderSchedulePdfHandler`에 `token` 파라미터가 필수로 추가됨. 기존에 이 핸들러를 호출하던 프론트엔드 코드가 token을 보내지 않으면 즉시 실패한다.

**확인 사항:**
- `ui/src/pages/RenderPage.tsx` 등 기존 렌더 호출부에서 token을 전달하는지 확인
- MCP 클라이언트의 기존 tool 호출 스키마에 token이 포함되었는지 확인

### 9.3. RenderJob.userId nullable 불일치

스키마에서 `userId String?` (nullable)이지만, 현재 render.ts의 모든 핸들러는 인증된 사용자의 ID를 항상 전달한다. pdfWorker에서 `userId || completedJob.userId` fallback이 있지만, userId가 null인 경우는 현재 발생하지 않는다.

**권장:** 향후 비인증 렌더(미리보기 등)를 지원할 계획이 아니라면 `userId String` (non-nullable)로 변경 검토.

---

## 10. 개발 테스트 — 역할별 계정 전환

### 배경

현재 시스템에 admin, operator, editor, instructor, viewer, guest 6개 역할이 있다. 개발/QA 시 역할별 UX를 확인하려면 매번 로그아웃 → 다른 계정으로 로그인해야 한다.

### 권장: Dev Toolbar

개발 환경(`NODE_ENV !== 'production'`)에서만 표시되는 Dev Toolbar를 구현한다.

```text
┌──────────────────────────────────────────────────┐
│ [🔧 Dev] 현재: admin@test.com (admin)            │
│ [admin] [operator] [editor] [instructor] [viewer]│
└──────────────────────────────────────────────────┘
```

**구현 방식:**

1. **시드 데이터**: 각 역할별 테스트 계정을 seed로 생성
   ```
   admin@test.com     → role: admin
   operator@test.com  → role: operator
   editor@test.com    → role: editor
   instructor@test.com → role: instructor
   viewer@test.com    → role: viewer
   ```

2. **Dev 전용 API**: `POST /dev/switch-account` — email을 받아 해당 계정의 JWT를 반환 (비밀번호 불필요, 개발 환경만)

3. **프론트엔드 Dev Toolbar**: 역할 버튼 클릭 → switch API 호출 → 새 토큰으로 전환

### 계정 전환 시 주의 사항

역할을 전환한 후 다시 원래 계정으로 돌아올 때, 아래 상태들이 꼬일 수 있다:

| 문제 | 설명 | 해결 |
|------|------|------|
| **SSE 연결** | 기존 계정의 SSE 세션이 살아있으면 서버에서 이전 사용자로 인식 | 전환 시 SSE 연결 끊고 새 토큰으로 재연결 |
| **React Query 캐시** | 이전 역할의 데이터가 캐시에 남아있음 (관리자 전용 데이터 등) | `queryClient.clear()` 호출 |
| **localStorage 토큰** | 이전 토큰이 남아있으면 새 토큰과 충돌 | 토큰 교체 후 AuthContext 상태 갱신 |
| **컴포넌트 상태** | 이전 역할 기준으로 렌더링된 컴포넌트가 남아있음 | 전환 시 전체 리렌더링 트리거 |

### switchAccount 함수 패턴

```typescript
async function switchAccount(email: string) {
  // 1. SSE 연결 종료
  sseClient.disconnect();

  // 2. 새 토큰 발급
  const { token } = await fetch('/dev/switch-account', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }).then(r => r.json());

  // 3. 토큰 교체
  localStorage.setItem('token', token);

  // 4. React Query 캐시 전체 클리어
  queryClient.clear();

  // 5. Auth 상태 갱신 (새 토큰 파싱)
  setAuth(parseToken(token));

  // 6. SSE 재연결 (새 토큰으로)
  sseClient.connect(token);
}
```

**핵심:** 전환 시 반드시 SSE 끊기 → 토큰 교체 → 캐시 클리어 → SSE 재연결 순서를 지켜야 한다.
