# 프로젝트 진행 상황 보고서

**최종 업데이트:** 2026년 2월 13일 금요일

---

## 1. 개요

HR 강의 계획서를 관리하고 PDF로 출력하는 MCP(Model Context Protocol) SDK 기반 플랫폼 개발 프로젝트의 현재 진행 상황을 요약합니다.

---

## 변경 이력

- 2026-02-10: 문서 정합성 정리(PDF 렌더 흐름/템플릿 가이드/업로드/시드 스크립트) 업데이트
- 2026-02-11: 연락처 단일화(User.phone/website), 강사/코스 내보내기 흐름 보강, 코스 공유/권한 제어 1차 반영
- 2026-02-13: 코스 삭제(소프트) MCP 도구 추가, 코스/강사/템플릿/회원 헤더에서 목차관리 바로가기 UI 추가, 모바일 레이아웃(햄버거 메뉴) 적용, 강의 공유/재공유 정책 DM 문서 추가

---

## 13. 2026-02-13 작업 내역

### 완료
- 코스 삭제(소프트 삭제) 도구 추가
  - `src/tools/course.ts`: `course.delete` 스키마/핸들러 추가
  - `src/transport.ts`, `src/mcp-server.ts`: 도구 등록
  - `ui/src/api/mcpClient.ts`: `courseDelete` API 추가
  - `ui/src/pages/CoursesPage.tsx`: 삭제 액션 + 권한 툴팁 UX 추가
- 모바일 레이아웃 적용 (좌측 메뉴 → Drawer)
  - `ui/src/components/Layout.tsx`
- 목차관리(테이블 헤더 설정) 빠른 이동 UI
  - 코스/강사/템플릿/회원 헤더에 관리자 전용 아이콘 추가
  - 사이트 관리 탭/테이블키 쿼리 파라미터 반영 (`tab`, `tableKey`)
- 정책 문서 추가
  - `document/06_SECURITY_POLICY/LECTURE_SHARE_POLICY_DM.md`

### 진행 중
- 강의/코스 다대다 구조(B안) 설계 및 마이그레이션 계획 수립
  - 공유/재공유 권한 누적 정책 반영

---

## 2. 완료된 작업 현황

| 항목 | 상태 | 비고 |
| :--- | :--- | :--- |
| 문서 (19개) | 완료 | 설계/운영 문서 + 문제 해결 가이드 |
| 프로젝트 초기화 | 완료 | `package.json`, `tsconfig.json`, `src/` 등 기본 구조 |
| Prisma 스키마 + DB 마이그레이션 | 완료 | `prisma/schema.prisma` 반영 및 DB 연동 확인 |
| MCP 서버 기본 구조 구현 | 완료 | `src/mcp-server.ts` (stdio), `src/transport.ts` (SSE) |
| Phase 3: 툴 핸들러 구현 | 완료 | 26개 MCP 툴 구현 및 등록 완료 |
| Phase 4: PDF 렌더 큐 | 완료 | BullMQ 워커 + Puppeteer PDF 생성 구현 완료 |
| Phase 5: React UI | 완료 | Vite + Ant Design + TanStack Query 기본 구현 |
| GitHub 푸시 | 완료 | [edux repo](https://github.com/rio7710/edux-) |
| Phase 6: 회원관리 백엔드 | 완료 | JWT 인증, 13개 User Tools 구현 |
| Phase 7: 회원관리 UI | 완료 | 로그인/가입/프로필 페이지, AuthContext |
| Phase 8: createdBy 추적 | 완료 | 전 엔티티 등록자 추적 + 이름 변환 표시 |
| Phase 9: 회원관리 고도화 | 완료 | 역할 확장(6개), InstructorProfile, 승인 플로우 |
| Phase 10: 과정 저장 오류 해결 | 완료 | null 처리, UI 개선, 샘플 데이터 생성 |
| Phase 11: Lecture(강의) 엔티티 | 완료 | Course→Lecture 1:N 계층, CRUD 4개 툴 |

---

## 3. 현재 프로젝트 구조

```text
edux/
├── document/           # 문서 (19개: 설계, 운영, 정책, 가이드)
├── scripts/            # 유틸리티 스크립트 (샘플 데이터 생성 등)
├── prisma/
│   └── schema.prisma   # DB 스키마 (11개 테이블, 2개 enum)
├── public/
│   └── pdf/            # 생성된 PDF 파일 저장
├── src/                # 백엔드
│   ├── services/
│   │   ├── prisma.ts   # Prisma 클라이언트 싱글톤
│   │   ├── jwt.ts      # JWT 토큰 생성/검증
│   │   ├── queue.ts    # BullMQ 큐 설정
│   │   └── pdf.ts      # Puppeteer PDF 변환 서비스
│   ├── tools/          # MCP 툴 핸들러
│   │   ├── course.ts   # 코스 CRUD (3개 툴) + createdBy
│   │   ├── lecture.ts  # 강의 CRUD (4개 툴) + createdBy
│   │   ├── instructor.ts # 강사 CRUD (3개 툴) + createdBy
│   │   ├── schedule.ts # 일정 CRUD (3개 툴) + createdBy
│   │   ├── template.ts # 템플릿 CRUD (4개 툴) + createdBy
│   │   ├── render.ts   # PDF 렌더 (2개 툴)
│   │   ├── user.ts     # 회원 인증/관리 (13개 Tools)
│   │   └── test.ts     # 에코 테스트 (1개 툴)
│   ├── workers/
│   │   └── pdfWorker.ts
│   ├── mcp-server.ts   # StreamableHTTP 모드
│   └── transport.ts    # SSE 모드 (port 7777)
├── ui/                 # 프론트엔드 (React)
│   ├── src/
│   │   ├── api/mcpClient.ts        # MCP SSE 클라이언트
│   │   ├── components/Layout.tsx   # Ant Design 레이아웃
│   │   ├── contexts/AuthContext.tsx # 인증 상태 관리
│   │   ├── pages/
│   │   │   ├── CoursesPage.tsx     # 코스 + 강의 관리
│   │   │   ├── InstructorsPage.tsx
│   │   │   ├── TemplatesPage.tsx
│   │   │   ├── RenderPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   └── App.tsx
│   ├── vite.config.ts  # 백엔드 프록시 설정
│   └── package.json
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 4. 기술 스택

### 백엔드

- **Runtime**: Node.js 18+ / TypeScript (ESM)
- **MCP**: `@modelcontextprotocol/sdk` (stdio + SSE 이중 전송)
- **DB**: PostgreSQL 16 + Prisma ORM
- **인증**: JWT (jsonwebtoken) + bcrypt
- **큐**: BullMQ (Redis)
- **PDF**: Puppeteer (Headless Chrome)
- **템플릿**: Handlebars

### 프론트엔드

- **빌드**: Vite
- **UI**: React 19 + Ant Design
- **상태관리**: TanStack Query (React Query)
- **인증**: AuthContext (localStorage 기반)
- **라우팅**: React Router v6

---

## 5. Phase 별 완료 내역

### Phase 5: React UI

| 파일 | 설명 |
| :--- | :--- |
| `ui/src/api/mcpClient.ts` | MCP over SSE 클라이언트 |
| `ui/src/components/Layout.tsx` | Ant Design 사이드바 레이아웃 |
| `ui/src/pages/CoursesPage.tsx` | 코스 + 강의 CRUD |
| `ui/src/pages/InstructorsPage.tsx` | 강사 관리 |
| `ui/src/pages/TemplatesPage.tsx` | 템플릿 편집기 |
| `ui/src/pages/RenderPage.tsx` | PDF 생성 |
| `ui/vite.config.ts` | 백엔드 프록시 설정 |

### Phase 6: 회원관리 백엔드

| 파일 | 설명 |
| :--- | :--- |
| `src/services/jwt.ts` | JWT 토큰 생성/검증 유틸리티 |
| `src/tools/user.ts` | 13개 User MCP Tools |
| `prisma/migrations/20260206053646_*` | User 스키마 마이그레이션 |

### Phase 7-8: 회원관리 UI + createdBy

- AuthContext (인증 상태 관리)
- 로그인/회원가입/프로필 페이지
- Layout 헤더 사용자 정보 표시
- 전 엔티티 `createdBy` 필드 → 가입 아이디(이름) 변환 표시
- 중첩 엔티티(Lectures, Schedules, Instructor) createdBy 재귀 변환

### Phase 9: 회원관리 고도화

**역할(Role) 확장**: `admin`, `operator`, `editor`, `instructor`, `viewer`, `guest` (6개)

**강사 프로파일 기능**:
- `InstructorProfile` 모델 (신청/승인 워크플로우)
- `user.requestInstructor`, `user.approveInstructor`, `user.updateInstructorProfile` 툴
- RegisterPage 강사 신청 옵션, ProfilePage 강사 프로파일 섹션

### Phase 10: 과정 저장 오류 해결

- Zod `.optional()` vs `.nullable()` 처리
- Handler 파라미터 타입 동기화 (`number | null`)
- Frontend form null → undefined 변환
- 테이블 헤더 순서 재정렬 (No, 코스명, 시간, 온라인, 등록자, ID, 액션)
- 샘플 데이터 11개 코스 생성

### Phase 11: Lecture(강의) 엔티티 추가

**변경 내역**:
- `CourseModule` 모델 → `Lecture` 모델로 대체
- `Course → Lecture` 1:N 관계 구성
- `src/tools/lecture.ts` 신규 생성 (4개 MCP 툴)
  - `lecture.upsert`: 강의 생성/수정 (courseId 필수)
  - `lecture.get`: 강의 단건 조회
  - `lecture.list`: 코스별 강의 목록 (order 오름차순)
  - `lecture.delete`: 강의 소프트 삭제
- CoursesPage 코스 상세 모달 내 강의 목록/등록/수정/삭제 UI 임베드
- `mcpClient.ts`에 lecture API 메서드 추가
- 코스 상세 조회 시 강의 시간 합계 우선 표시

### Phase 12: 강사 매핑 고도화 + 코스 다중 강사

**변경 내역**:
- `Instructor.userId` 추가 (User ↔ Instructor 1:1 매핑)
- `CourseInstructor` 조인 테이블 추가 (Course ↔ Instructor M:N)
- 코스 수정 모달에 강사 다중 선택/추가/삭제 UI 반영
- 강사 상세에 등록된 코스 목록 표시
- 강사 계정 일괄 생성·매핑 스크립트 추가 (`scripts/backfill-instructor-users.ts`)

### Phase 13: 프로필/문서화 정비 + 코스 공유 접근 제어 (2026-02-11)

**변경 내역**:
- 연락처 단일 소스 전환
  - `User.phone`, `User.website` 기준으로 동기화
  - `Instructor.phone`, `InstructorProfile.phone/website` 레거시 컬럼 제거
  - 백필 스크립트 추가: `scripts/backfill-user-contact.ts`
- 내 정보/강사 상세 동기화 개선
  - ProfilePage에서 이름/전화/웹사이트 직접 관리
  - 강사 상세 저장 시 `User.phone` 동기화 보장
- 공유 링크 개선
  - Vite 프록시에 `/share` 추가하여 공유 URL 접속 시 백엔드 `/share/:token` 정상 라우팅
- 강사 소개 템플릿 확장
  - `ALL_강사소개_샘플` 템플릿 추가(사진 포함, 전체 필드 렌더)
  - 시드 스크립트: `scripts/seed-all-instructor-template.ts`
- 코스 공유 모델 도입 (1차)
  - `CourseShare` 모델 + 상태(`pending/accepted/rejected`) 추가
  - 코스 목록/조회/내보내기 접근: 본인 생성 + 수락 공유, 관리자/운영자 전체 허용
  - 코스 모달 공유 체크 UX + 공유 요청함(수락/거절) 추가
- 권한 강화
  - 코스/강의/일정 수정은 본인 코스만 허용
  - 관리자/운영자는 예외적으로 전체 수정 허용
- PDF 누락 수정
  - 코스 PDF 워커 payload를 미리보기 payload와 동일 키셋으로 정렬(`instructors`, `lectures`, `modules`, `schedules` 등)

---

## 6. 등록된 MCP 툴 요약 (총 26개)

| 도메인 | 툴 | 인증 |
| :--- | :--- | :--- |
| Course | `course.upsert`, `course.get`, `course.list` | token (선택) |
| Lecture | `lecture.upsert`, `lecture.get`, `lecture.list`, `lecture.delete` | token (선택) |
| Instructor | `instructor.upsert`, `instructor.get`, `instructor.list` | token (선택) |
| Schedule | `schedule.upsert`, `schedule.get`, `schedule.list` | token (선택) |
| Template | `template.create`, `template.get`, `template.list`, `template.previewHtml` | token (선택) |
| Render | `render.coursePdf`, `render.schedulePdf` | - |
| Test | `test.echo` | - |
| User | `user.register`, `user.login` | No |
| User | `user.me`, `user.get`, `user.update`, `user.delete` | Yes |
| User | `user.list`, `user.updateRole`, `user.updateByAdmin` | Admin |
| User | `user.requestInstructor`, `user.approveInstructor`, `user.updateInstructorProfile` | Yes/Admin |

---

## 7. GitHub 리포지토리

- **URL**: [rio7710/edux-](https://github.com/rio7710/edux-)
- **최신 커밋**: `c46e702` (list API 추가 + SSE 세션 관리)
- **롤백 방법**: `git checkout <commit-hash>`

---

## 8. 실행 명령어 요약

```bash
# 1. Docker 컨테이너 시작
docker start edux-postgres

# 2. 백엔드 빌드 & 실행
cd d:\workSpace\edux
npm run build && node dist/transport.js

# 3. 프론트엔드 실행 (별도 터미널)
cd d:\workSpace\edux\ui
npm run dev

# (선택) PDF 워커 실행 - Redis 필요
npm run dev:worker
```

- 백엔드: <http://localhost:7777>
- 프론트엔드: <http://localhost:5173>

---

## 9. 테스트 계정

- 이메일: `sample@example.com`
- 비밀번호: `Password123!`
- 역할: `instructor`

---

## 10. 다음 단계 (예정)

- [ ] 템플릿 타입별 렌더 API 분리 (강사/과정 PDF 생성 흐름 정리)
- [ ] 템플릿 미리보기: 인쇄 버튼/미리보기 대상 선택 UX 개선
- [ ] 템플릿 타입 필터/권한 정책 확정 (admin/editor/instructor)
- [ ] 강사 프로필 템플릿: 스케줄/경력/자격증 섹션 확장
- [ ] 과정 소개 템플릿: 강의/일정/자료 섹션 표준화
- [ ] 회원가입 → 강사 신청 → 강사 승인 플로우 완전 테스트
- [ ] 페이지네이션/검색 UI 개선 (코스/강사/템플릿/회원)
- [ ] 소프트 삭제 UI (복원 포함)
- [ ] RBAC 강화 (툴 핸들러 내 역할 검증)
- [ ] 이메일 검증/비밀번호 재설정 (선택)
- [ ] 문제은행 MCP (퀴즈/과제 - Lecture 매핑)
- [ ] 진도 추적 MCP (사용자별 수강 현황)
- [ ] ML 라벨링 우선 작업 적용 (EventLog + 추천 라벨)
- [ ] ML 조건 입력(정부사업/기관/지역/대상) UI/DB 반영

---

## 12. 작업 예정서 (2026-02-10 기준)

1. ML 데이터 최소 스키마 적용
2. ProgramContext(사업/기관 조건) 입력 폼 초안
3. 추천 로그/라벨 저장 플로우 연결 (used/accepted)

---

## 11. 주의사항

- Docker Desktop이 실행 중이어야 PostgreSQL 접근 가능
- Redis가 없어도 코스/강사/템플릿/회원 관리 기능은 정상 동작 (PDF 렌더링 큐만 영향)
- MCP SDK 1.26.0에서 deprecated 경고 발생 가능 (동작에는 문제없음)
- 프론트엔드와 백엔드가 모두 실행되어야 UI가 정상 동작
- `read_AI.md` 파일에서 개발 시 반복 실수 항목 확인 가능
