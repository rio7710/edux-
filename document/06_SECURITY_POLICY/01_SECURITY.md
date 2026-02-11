# SECURITY

## 인증 체계 (JWT)

### 토큰 발급 흐름

1. 클라이언트가 `user.login` 툴을 호출하여 `{ email, password }` 전송
2. 서버가 `User` 테이블에서 이메일로 조회
3. `bcryptjs`로 비밀번호 해시 비교
4. 검증 성공 시 JWT 발급 (페이로드: `{ userId, role }`, 유효기간: 24h)
5. 이후 MCP 툴 호출 시 `token` 파라미터로 JWT 전달

### 토큰 검증

- SSE 모드: Express 서버에서 `GET /sse` + `POST /messages` 제공, 툴 핸들러 내부에서 토큰 검증
- stdio 모드: 로컬 환경이므로 인증 생략 가능 (개발/로컬 전용)
- 토큰 검증 유틸: `src/services/jwt.ts` — `verifyToken(token)` → `{ userId, role }`

### 환경 변수

- `JWT_SECRET`: 토큰 서명 키 (운영 환경에서는 시크릿 매니저 사용)

## 역할 기반 접근 제어 (RBAC)

### 역할(Role) 정의

| 역할 | 설명 | 주요 권한 |
|------|------|-----------|
| **admin** | 시스템 전체 제어 | 모든 데이터/설정/사용자 관리 |
| **operator** | 운영 업무 담당 | 코스/일정 관리, 사용자 조회/통계 |
| **editor** | 콘텐츠 편집 | 코스/강의/템플릿/스케줄 생성/수정 |
| **instructor** | 강의자 전용 | 자신 소유 코스/강의/일정 CRUD |
| **viewer** | 읽기 전용 | `*.get`, `*.list` 호출만 허용 |
| **guest** | 최소 권한 (신규 회원 기본값) | 인증 전용 뷰/체험용 |

> 역할은 `User.role` 필드(`Role` enum)로 관리하며, 툴 핸들러 내부에서 레벨별 접근 제어를 수행합니다.

### 로그인 및 인증 정책

- **비밀번호 정책**
  - 최소 길이: 8자
  - 필수 조합: 영문 + 숫자 (정규식: `/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/`)
  - 이전 비밀번호 재사용 제한(최근 3회) — 향후 구현

- **세션 및 토큰**
  - 액세스 JWT 토큰 기본 만료: 24시간
  - 리프레시 토큰: 별도 발급 (장기 만료)
  - 로그아웃 시 클라이언트 토큰 제거 (localStorage)

- **계정 잠금 및 rate limiting** — 향후 구현
  - 실패 로그인 시도 5회 초과 시 계정 잠금(기본 15분)
  - IP/계정별 요청 비율 제한

### 강사 신청/승인 플로우

1. 회원가입 시 `isInstructorRequested: true` 또는 `user.requestInstructor` 호출
2. `InstructorProfile` 생성 (`isPending: true`, `isApproved: false`)
3. 관리자가 `user.approveInstructor` 호출
4. `InstructorProfile.isApproved = true`, `isPending = false`
5. `Instructor` 레코드 자동 생성, 사용자 역할 `instructor`로 변경

> 강사는 반드시 `User`와 연결되어야 하며, `User` 없이 Instructor 단독 생성은 허용하지 않습니다.

---

### 툴별 권한 매트릭스

#### 코스/강의 도메인

| 툴 | admin | operator | editor | instructor | viewer | guest |
|----|-------|----------|--------|------------|--------|-------|
| `course.upsert` | O | O | O | O (자기 것) | X | X |
| `course.get` | O | O | O | O | O | X |
| `course.list` | O | O | O | O | O | X |
| `lecture.upsert` | O | O | O | O (자기 것) | X | X |
| `lecture.get` | O | O | O | O | O | X |
| `lecture.list` | O | O | O | O | O | X |
| `lecture.delete` | O | O | O | O (자기 것) | X | X |

#### 강사/일정 도메인

| 툴 | admin | operator | editor | instructor | viewer | guest |
|----|-------|----------|--------|------------|--------|-------|
| `instructor.upsert` | O | O | O | X | X | X |
| `instructor.get` | O | O | O | O | O | X |
| `instructor.list` | O | O | O | O | O | X |
| `schedule.upsert` | O | O | O | O (자기 것) | X | X |
| `schedule.get` | O | O | O | O | O | X |
| `schedule.list` | O | O | O | O | O | X |

#### 템플릿/렌더 도메인

| 툴 | admin | operator | editor | instructor | viewer | guest |
|----|-------|----------|--------|------------|--------|-------|
| `template.create` | O | O | O | X | X | X |
| `template.get` | O | O | O | O | O | X |
| `template.list` | O | O | O | O | O | X |
| `template.previewHtml` | O | O | O | O | O | X |
| `render.coursePdf` | O | O | O | O | X | X |
| `render.schedulePdf` | O | O | O | O | X | X |

#### 사용자 인증/관리 도메인

| 툴 | admin | operator | editor | instructor | viewer | guest |
|----|-------|----------|--------|------------|--------|-------|
| `user.register` | - | - | - | - | - | - |
| `user.login` | - | - | - | - | - | - |
| `user.me` | O | O | O | O | O | O |
| `user.get` | O | X | X | X | X | X |
| `user.update` | O | O | O | O | O | O |
| `user.delete` | O | O | O | O | O | O |
| `user.list` | O | X | X | X | X | X |
| `user.updateRole` | O | X | X | X | X | X |
| `user.updateByAdmin` | O | X | X | X | X | X |
| `user.requestInstructor` | O | O | O | O | O | O |
| `user.approveInstructor` | O | X | X | X | X | X |
| `user.updateInstructorProfile` | O | O | O | O | O | O |

> `-` = 인증 불필요 (공개 API), `O` = 허용, `X` = 거부

---

## 입력 검증

- **Zod 스키마**: MCP SDK의 `server.tool()` 등록 시 Zod로 파라미터 검증
- MCP SDK가 스키마 위반 시 자동으로 에러 응답 반환
- 추가 비즈니스 규칙 검증은 툴 핸들러 내부에서 처리

## 템플릿 샌드박스

- Handlebars는 로직 최소화 엔진으로 기본적으로 안전
- **금지 사항**:
  - `<script>` 태그 삽입
  - 외부 URL 리소스 참조 (`<link href="http://...">`, `<img src="http://...">`)
  - 인라인 이벤트 핸들러 (`onclick`, `onerror` 등)
- 템플릿 저장 시 위 패턴을 서버에서 검증/차단

## Puppeteer 리소스 보호

- **동시 실행 제한**: BullMQ 큐로 동시 PDF 생성 수 제한 (기본: 2, `PDF_CONCURRENCY` 환경 변수)
- **타임아웃**: 단일 PDF 생성 최대 30초, 초과 시 `failed` 처리
- **샌드박스**: 운영 환경에서는 `--sandbox` 모드 사용 (Docker 컨테이너 권장)
- `--no-sandbox`는 로컬 개발 환경에서만 허용

## PDF 저장소 관리

- **저장 경로**: `public/pdf/` 디렉토리
- **정리 정책**: 30일 이상 된 PDF 자동 삭제 (크론 작업 또는 BullMQ 반복 작업)
- **디스크 모니터링**: 저장소 사용량이 임계치(기본 1GB) 초과 시 경고 로그
- **향후 확장**: S3 호환 스토리지로 전환 시 `pdf.ts` 서비스만 교체

## PDF 링크 접근 정책

- 기본 구현은 `/pdf/*` 정적 파일 제공 (인증 없음)
- 민감 정보가 포함될 경우 서명 URL(만료 포함) 적용 권장
- 민감 정보가 포함될 경우 토큰 검증 미들웨어 후 파일 스트리밍 권장
- 민감 정보가 포함될 경우 내부 전용 네트워크에서만 접근 허용 권장

## 템플릿 내 이미지 정책

- 템플릿 샌드박스 정책상 외부 URL 리소스는 차단됨
- 프로필 이미지 등을 사용하려면 내부 저장소 URL만 허용하도록 정책 명시 필요
- 프로필 이미지 등을 사용하려면 base64/data URI만 허용하도록 정책 명시 필요

## 파일 업로드 정책

- 업로드 엔드포인트: `POST /api/upload`
- 정적 제공 경로: `/uploads/*`
- 허용 타입: 이미지, PDF
- 최대 크기: 10MB

## 비밀 관리

- `.env`는 `.gitignore`에 포함 (저장소 제외)
- 운영 환경: AWS Secrets Manager, Azure Key Vault 등 시크릿 매니저 사용
- `JWT_SECRET`, `DATABASE_URL` 등 민감 정보는 환경 변수로만 전달

## 위협 모델

| 위협 | 대응 |
|------|------|
| 악의적 템플릿/데이터 삽입 (XSS) | 템플릿 샌드박스 검증, Handlebars 자동 이스케이핑 |
| 과도한 PDF 생성 (리소스 고갈) | BullMQ 큐 + 동시 실행 제한 + 타임아웃 |
| SSRF | Puppeteer에서 외부 URL 요청 차단 |
| 인증 우회 | JWT 검증, 역할 기반 접근 제어 (RBAC) |
| 비밀번호 탈취 | bcrypt 해싱, HTTPS 필수 (운영) |
| 권한 상승 | 툴별 권한 매트릭스 + 토큰 페이로드 검증 |
| 소프트 삭제 우회 | `deletedAt IS NULL` 필터 일관 적용 |

## 로깅

- 모든 MCP 툴 호출 이력은 서버 로그에 기록
- `RenderJob` 테이블로 PDF 생성 이력 추적
- 실패 시 `errorMessage` 필드에 원인 기록
