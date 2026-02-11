# InstructorProfile 1:N 확장 분석 검토 의견

> 검토일: 2026-02-11
> 검토 기준: 현재 코드베이스 전체 조사 (schema, API tools, UI, 렌더링 파이프라인)

---

## 1. 전체 방향 — 동의

- **Instructor 유지, InstructorProfile만 1:N 확장**은 리스크 최소 방향으로 적절함
- Instructor는 `CourseSchedule`, `CourseInstructor` 등 운영 데이터와 강하게 결합되어 있어 건드리면 파급 범위가 큼
- InstructorProfile은 신청/승인 흐름 전용이라 확장 영향 범위가 좁음

---

## 2. User.defaultInstructorProfileId — 동의

- `isDefault` 플래그 방식보다 FK 포인터가 안전한 판단 맞음
- 단, 현재 InstructorProfile 조회 코드가 **모두 `where: { userId }` + `findUnique` 패턴**임
  - `src/tools/user.ts` — `requestInstructorHandler`, `approveInstructorHandler`, `updateInstructorProfileHandler` 세 곳
- `@unique` 제거 시 `findUnique` → `findFirst` 또는 `findMany`로 **모두 변경 필요**
- 기본 프로필 조회는 `User.defaultInstructorProfileId`를 통해 처리하면 됨

---

## 3. InstructorProfile.templateId — 재검토 필요

현재 렌더링 파이프라인 구조상 **templateId 위치를 재고해야 함**:

- 렌더링 대상 데이터는 `Instructor` (승인 완료 후의 운영 데이터)
- InstructorProfile은 "신청/임시 저장" 용도이고, 승인 시 데이터가 Instructor로 **단방향 복사**됨
- templateId를 InstructorProfile에 두면:
  - 신청 단계에서 템플릿 선택 → 승인 후에도 유지해야 함
  - Instructor 쪽과 동기화 이슈 발생
- **대안**: `Instructor.templateId`에 두는 것이 렌더 흐름상 더 자연스러움
- 또는 양쪽 다 두되, 승인 시 InstructorProfile.templateId → Instructor.templateId로 복사하는 방식

---

## 4. 승인 플로우 보완 필요

분석에서 다루지 않은 부분:

- 현재 `approveInstructorHandler`는 `userId`로 InstructorProfile을 찾아 Instructor로 변환
- 1:N이 되면 **"어떤 프로필을 기반으로 승인할 것인지"** 지정이 필요
- `userApproveInstructorSchema`에 `profileId` 파라미터 추가 권장
- 승인 대상 프로필을 명시하지 않으면 기본 프로필(defaultInstructorProfileId)을 사용하는 fallback도 고려

---

## 5. 변경 영향 범위 정리

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | InstructorProfile.userId `@unique` 제거, User.defaultInstructorProfileId 추가, templateId FK 위치 결정 |
| `src/tools/user.ts` | findUnique → findFirst/findMany 변경 (3곳), approveInstructor에 profileId 파라미터 추가 |
| `src/mcp-server.ts` | approveInstructor 스키마 변경 반영 |
| `ui/src/api/mcpClient.ts` | approveInstructor 호출부 profileId 추가 |
| `ui/src/pages/ProfilePage.tsx` | 프로필 목록 UI, 기본 프로필 지정 UI 추가 |
| `ui/src/pages/UsersPage.tsx` | 관리자 승인 시 프로필 선택 UI 추가 (선택적) |

---

## 6. 결론

| 항목 | 판정 | 비고 |
|------|------|------|
| Instructor 유지 | 적절 | |
| InstructorProfile 1:N | 적절 | findUnique 패턴 변경 필수 |
| User.defaultInstructorProfileId | 적절 | isDefault 방식보다 안전 |
| InstructorProfile.templateId | 재검토 | Instructor에 두는 것이 렌더 흐름상 자연스러움 |
| 승인 플로우 | 보완 필요 | profileId 파라미터 추가, 기본 프로필 fallback |

전체 방향은 맞으니 위 2가지(templateId 위치, 승인 시 profileId 지정)만 보완하면 진행 가능.
