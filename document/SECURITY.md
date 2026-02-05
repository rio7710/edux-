# SECURITY

## 인증 체계 (JWT)

### 토큰 발급 흐름

1. 클라이언트가 `POST /auth/login`에 `{ email, password }` 전송
2. 서버가 `User` 테이블에서 이메일로 조회
3. `bcryptjs`로 비밀번호 해시 비교
4. 검증 성공 시 JWT 발급 (페이로드: `{ userId, role }`, 유효기간: 24h)
5. 이후 요청에 `Authorization: Bearer <token>` 헤더 포함

### 토큰 검증

- SSE 모드: Express 미들웨어에서 `/sse`, `/messages` 요청 시 검증
- stdio 모드: 로컬 환경이므로 인증 생략 가능 (개발/로컬 전용)

### 환경 변수

- `JWT_SECRET`: 토큰 서명 키 (운영 환경에서는 시크릿 매니저 사용)

## 역할 기반 접근 제어 (RBAC)

### 역할 정의

- **admin**: 모든 툴 실행 + 사용자 관리
- **editor**: 코스/강사/템플릿/스케줄 CRUD + PDF 렌더
- **viewer**: 읽기 전용 (`*.get`, `*.list` 툴만 허용)

### 툴별 권한 매트릭스

| 툴 | admin | editor | viewer |
| --- | --- | --- | --- |
| `course.upsert` | O | O | X |
| `course.get` | O | O | O |
| `instructor.upsert` | O | O | X |
| `instructor.get` | O | O | O |
| `module.batchSet` | O | O | X |
| `schedule.upsert` | O | O | X |
| `schedule.get` | O | O | O |
| `template.create` | O | O | X |
| `template.get` | O | O | O |
| `template.list` | O | O | O |
| `template.previewHtml` | O | O | O |
| `render.coursePdf` | O | O | X |
| `render.schedulePdf` | O | O | X |

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

## 비밀 관리

- `.env`는 `.gitignore`에 포함 (저장소 제외)
- 운영 환경: AWS Secrets Manager, Azure Key Vault 등 시크릿 매니저 사용
- `JWT_SECRET`, `DATABASE_URL` 등 민감 정보는 환경 변수로만 전달

## 위협 모델

| 위협 | 대응 |
| --- | --- |
| 악의적 템플릿/데이터 삽입 (XSS) | 템플릿 샌드박스 검증, Handlebars 자동 이스케이핑 |
| 과도한 PDF 생성 (리소스 고갈) | BullMQ 큐 + 동시 실행 제한 + 타임아웃 |
| SSRF | Puppeteer에서 외부 URL 요청 차단 |
| 인증 우회 | JWT 검증 미들웨어, 역할 기반 접근 제어 |
| 비밀번호 탈취 | bcrypt 해싱, HTTPS 필수 (운영) |

## 로깅

- 모든 MCP 툴 호출 이력은 서버 로그에 기록
- `RenderJob` 테이블로 PDF 생성 이력 추적
- 실패 시 `errorMessage` 필드에 원인 기록
