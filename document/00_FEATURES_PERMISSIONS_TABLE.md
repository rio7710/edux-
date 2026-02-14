# EduX 기능 정의 및 권한 정의 테이블 (document 기반)

본 문서는 `document/` 폴더의 기존 문서를 근거로 **기능 정의**와 **권한 정의**를 표로 정리한 통합 문서입니다.

## 근거 문서

- `document/00_SITE_FEATURES.md`
- `document/06_SECURITY_POLICY/01_SECURITY.md`
- `document/06_SECURITY_POLICY/02_USER_POLICY.md`
- `document/11_PRODUCT/01_MEMBER_PLAN.md`
- `document/03_FRONTEND/03_SITE_SETTINGS.md`
- `document/02_API_MCP/01_MCP_TOOLS.md`
- `document/02_API_MCP/02_API_REFERENCE.md`
- `document/01_ARCHITECTURE/01_ARCHITECTURE.md`
- `document/01_ARCHITECTURE/02_DATA_MODEL.md`

---

## 역할(Role) 정의

| 역할 | 설명 | 주요 권한 요약 |
|---|---|---|
| `admin` | 시스템 전체 제어 | 모든 데이터/설정/사용자 관리 |
| `operator` | 운영 업무 담당 | 코스/일정 관리, 사용자 조회/통계 |
| `editor` | 콘텐츠 편집 | 코스/강의/템플릿/스케줄 생성/수정 |
| `instructor` | 강사 전용 | 자신 소유 코스/강의/일정 CRUD |
| `viewer` | 읽기 전용 | `*.get`, `*.list` 호출 중심 |
| `guest` | 최소 권한 | 인증 전용 뷰/체험용 |

---

## 기능 정의 (메뉴/페이지)

| 메뉴 (Page) | 접근 권한 | 기능 정의 | 비고 |
|---|---|---|---|
| 로그인 (Login) | All | 로그인 페이지 | `document/00_SITE_FEATURES.md` |
| 회원가입 (Register) | All | 회원 가입 페이지 | `document/00_SITE_FEATURES.md` |
| 대시보드 (Dashboard) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 로그인 후 개인화 정보 요약 | `document/00_SITE_FEATURES.md` |
| 사용자 관리 (Users) | `admin`, `operator` | 사용자 목록/관리(생성, 수정, 삭제) | `document/00_SITE_FEATURES.md` |
| 그룹 관리 (Groups) | `admin`, `operator` | 사용자 그룹 생성/관리 | `document/00_SITE_FEATURES.md` |
| 권한 설정 (Permissions) | `admin` | 그룹/사용자별 기능 접근 권한 설정 | `document/00_SITE_FEATURES.md` |
| 강사 관리 (Instructors) | `admin`, `operator` | 강사 목록/관리 | `document/00_SITE_FEATURES.md` |
| 과정 관리 (Courses) | `admin`, `operator`, `editor`, `instructor` | 교육 과정 생성/관리 | 강사는 자기 과정만 관리 (`document/00_SITE_FEATURES.md`) |
| 템플릿 허브 (Templates Hub) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 공용 템플릿 조회/가져오기 | `document/00_SITE_FEATURES.md` |
| 내 템플릿 (My Templates) | `editor`, `instructor` | 개인 템플릿 생성/관리 | `document/00_SITE_FEATURES.md` |
| 내 문서 (My Documents) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 사용자 문서 목록 | `document/00_SITE_FEATURES.md` |
| 기능 공유 (Feature Shares) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 공유받은 코스/강의 목록 조회 및 본인 공유 해제 | `document/COURSE_GUIDE.md` |
| PDF 렌더링 (Render) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 템플릿 기반 PDF 생성 | `document/00_SITE_FEATURES.md` |
| 사이트 설정 (Site Settings) | `admin` | 사이트 로고/이름 등 설정 | `document/00_SITE_FEATURES.md` |
| 사이트 관리 → 테이블 설정 | `admin`, `operator` | 테이블 컬럼 표시/순서 설정 | `document/03_FRONTEND/03_SITE_SETTINGS.md` |
| 프로필 (Profile) | `admin`, `operator`, `editor`, `instructor`, `viewer` | 계정 정보 수정 | `document/00_SITE_FEATURES.md` |
| 테스트 (Test Echo) | `admin` | 개발/테스트용 페이지 | `document/00_SITE_FEATURES.md` |

---

## MCP 툴 기능 정의 및 권한 매트릭스

아래 권한은 `document/06_SECURITY_POLICY/01_SECURITY.md`의 RBAC 매트릭스를 기준으로 정리했습니다.

### 코스/강의 도메인

| 툴 | 기능 정의 | admin | operator | editor | instructor | viewer | guest |
|---|---|---|---|---|---|---|---|
| `course.upsert` | 코스 생성/수정 | O | O | O | O (자기 것) | X | X |
| `course.get` | 코스 단건 조회 | O | O | O | O | O | X |
| `course.list` | 코스 목록 조회 | O | O | O | O | O | X |
| `lecture.upsert` | 강의 생성/수정 | O | O | O | O (자기 것) | X | X |
| `lecture.map` | 기존 강의를 코스에 연결 | O | O | O | O (권한 보유 강의) | X | X |
| `lecture.get` | 강의 단건 조회 | O | O | O | O | O | X |
| `lecture.list` | 강의 목록 조회 | O | O | O | O | O | X |
| `lecture.delete` | 강의 삭제(소프트) | O | O | O | O (자기 것) | X | X |

### 강사/일정 도메인

| 툴 | 기능 정의 | admin | operator | editor | instructor | viewer | guest |
|---|---|---|---|---|---|---|---|
| `instructor.upsert` | 강사 생성/수정 | O | O | O | X | X | X |
| `instructor.get` | 강사 단건 조회 | O | O | O | O | O | X |
| `instructor.list` | 강사 목록 조회 | O | O | O | O | O | X |
| `schedule.upsert` | 일정 생성/수정 | O | O | O | O (자기 것) | X | X |
| `schedule.get` | 일정 단건 조회 | O | O | O | O | O | X |
| `schedule.list` | 일정 목록 조회 | O | O | O | O | O | X |

### 템플릿/렌더 도메인

| 툴 | 기능 정의 | admin | operator | editor | instructor | viewer | guest |
|---|---|---|---|---|---|---|---|
| `template.create` | 템플릿 생성 | O | O | O | X | X | X |
| `template.get` | 템플릿 단건 조회 | O | O | O | O | O | X |
| `template.list` | 템플릿 목록 조회 | O | O | O | O | O | X |
| `template.previewHtml` | 템플릿 미리보기 | O | O | O | O | O | X |
| `render.coursePdf` | 코스 PDF 렌더 | O | O | O | O | X | X |
| `render.schedulePdf` | 일정 PDF 렌더 | O | O | O | O | X | X |

### 사용자 인증/관리 도메인

| 툴 | 기능 정의 | admin | operator | editor | instructor | viewer | guest |
|---|---|---|---|---|---|---|---|
| `user.register` | 회원가입 | - | - | - | - | - | - |
| `user.login` | 로그인 | - | - | - | - | - | - |
| `user.me` | 내 정보 조회 | O | O | O | O | O | O |
| `user.get` | 사용자 단건 조회 | O | X | X | X | X | X |
| `user.update` | 사용자 정보 수정 | O | O | O | O | O | O |
| `user.delete` | 회원 탈퇴 | O | O | O | O | O | O |
| `user.list` | 사용자 목록 조회 | O | X | X | X | X | X |
| `user.updateRole` | 사용자 역할 변경 | O | X | X | X | X | X |
| `user.updateByAdmin` | 관리자 전용 사용자 수정 | O | X | X | X | X | X |
| `user.requestInstructor` | 강사 요청 | O | O | O | O | O | O |
| `user.approveInstructor` | 강사 승인 | O | X | X | X | X | X |
| `user.updateInstructorProfile` | 강사 프로필 수정 | O | O | O | O | O | O |

> `-` = 인증 불필요(공개), `O` = 허용, `X` = 거부

---

## 권한 정책/규칙 요약

| 항목 | 정의 | 근거 |
|---|---|---|
| 인증 방식 | JWT 기반, 페이로드 `{ userId, role }` | `document/06_SECURITY_POLICY/01_SECURITY.md` |
| 역할 관리 | `User.role` (Role enum) 기반 RBAC | `document/06_SECURITY_POLICY/01_SECURITY.md` |
| 강사 승인 | 관리자 승인 후 `instructor`로 승격 | `document/06_SECURITY_POLICY/01_SECURITY.md` |
| 민감 기능 제한 | 역할 변경/계정 삭제/시스템 설정은 `admin` 전용 권장 | `document/06_SECURITY_POLICY/02_USER_POLICY.md` |

---

## 문서 간 불일치/결정 필요 항목

| 항목 | 문서 A | 문서 B | 정리 필요 |
|---|---|---|---|
| 사이트 설정 권한 | `admin`만 접근 (`document/00_SITE_FEATURES.md`) | `admin`, `operator` 가능 (`document/03_FRONTEND/03_SITE_SETTINGS.md`) | 실제 정책 확정 필요 |
| 사용자 삭제 권한 | 모든 역할 가능 (`document/06_SECURITY_POLICY/01_SECURITY.md`의 `user.delete`) | 관리자 기능으로 분류 (`document/11_PRODUCT/01_MEMBER_PLAN.md`) | 자기 계정 삭제 vs 관리자 삭제 구분 필요 |

---

## 참고: MCP 툴 목록 (정의 위치)

전체 툴 정의는 `document/02_API_MCP/01_MCP_TOOLS.md`에 기술되어 있습니다.

- 코스: `course.upsert`, `course.get`, `course.list`
- 강의: `lecture.upsert`, `lecture.get`, `lecture.list`, `lecture.delete`
- 강사: `instructor.upsert`, `instructor.get`, `instructor.list`
- 일정: `schedule.upsert`, `schedule.get`, `schedule.list`
- 템플릿: `template.create`, `template.get`, `template.list`, `template.previewHtml`
- 렌더: `render.coursePdf`, `render.schedulePdf`
- 테스트: `test.echo`
- 사용자: `user.register`, `user.login`, `user.me`, `user.get`, `user.update`, `user.delete`, `user.list`, `user.updateRole`, `user.updateByAdmin`, `user.requestInstructor`, `user.approveInstructor`, `user.updateInstructorProfile`
