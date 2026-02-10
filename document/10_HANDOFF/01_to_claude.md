# To Claude

This file contains messages and instructions for Claude for continuous work.

---
## Gemini 작업 업데이트 (2026-02-06)

안녕하세요 Claude,

Gemini 에이전트가 이어서 작업할 수 있도록 현재까지의 진행 상황을 공유합니다.

### 1. 완료된 작업

- **문제점:** UI에서 템플릿 목록 조회가 실패하는 문제를 발견했습니다.
- **원인 분석:**
    1. 처음에는 DB에 데이터가 없다고 가정하고 `prisma/seed_template.ts` 스크립트를 작성하여 샘플 템플릿 데이터를 추가했습니다.
    2. 그럼에도 문제가 지속되어 백엔드 로그를 확인한 결과, 클라이언트가 SSE 엔드포인트에 연결할 때마다 서버가 다운되는 것을 확인했습니다.
    3. 근본 원인은 `src/transport.ts`에서 단일 `McpServer` 인스턴스를 여러 클라이언트 연결에 공유하여 발생한 `Already connected to a transport` 오류였습니다.
- **해결:**
    - 각 SSE 클라이언트 연결마다 새로운 `McpServer` 인스턴스를 생성하도록 `src/transport.ts`의 아키텍처를 리팩터링했습니다.
    - 리팩터링 과정에서 `tsx watch`가 포트를 계속 점유하여 발생한 `EADDRINUSE` (Address already in use) 오류를 `netstat`으로 프로세스를 찾아 해결했습니다.

### 2. 생성/수정된 파일

- **수정:** `src/transport.ts` (주요 로직 변경)
- **생성 (임시):** `prisma/seed_template.ts` (문제 해결을 위해 임시로 생성한 샘플 데이터 주입 스크립트)

### 3. 다음에 이어서 할 작업

- 리팩터링된 백엔드 서버를 재시작하여 템플릿 목록이 UI에서 정상적으로 조회되는지 확인해야 합니다.
- 정상 동작이 확인되면, 임시로 생성된 `prisma/seed_template.ts` 파일은 삭제하는 것을 고려해볼 수 있습니다.

### 4. 주의사항

- `tsx watch`가 간혹 포트를 제대로 해제하지 못해 `EADDRINUSE` 오류를 일으킬 수 있습니다. 서버 재시작 시 이 오류가 발생하면 관련 프로세스를 직접 종료해야 할 수 있습니다.

감사합니다.

---
## 문서 정리 업데이트 (2026-02-10)

안녕하세요 Claude,

문서 정합성 검토 후 아래와 같이 정리/업데이트했습니다. 개발 변경은 없고 **문서만** 수정했습니다.

### 1. 주요 정리 내용

- 템플릿 데이터 구조를 실제 렌더러(`src/workers/pdfWorker.ts`) 기준으로 통일
- `render.*` 응답은 **큐 등록만**(status: pending) 반환하도록 문서 수정
- `/pdf/*` 정적 링크 **기본 인증 없음** 주의사항 명시
- SSE 인증 흐름을 `user.login` MCP 툴 기반으로 정정
- PDF 렌더 흐름 전용 문서 추가

### 2. 수정/추가된 문서

- 수정: `document/04_TEMPLATES_PDF/01_TEMPLATES.md`
- 수정: `document/04_TEMPLATES_PDF/02_TEMPLATE_GUIDE.md`
- 수정: `document/02_API_MCP/01_MCP_TOOLS.md`
- 수정: `document/00_START_HERE/02_WORKFLOW.md`
- 수정: `document/01_ARCHITECTURE/01_ARCHITECTURE.md`
- 수정: `document/02_API_MCP/02_API_REFERENCE.md`
- 수정: `document/06_SECURITY_POLICY/01_SECURITY.md`
- 수정: `document/03_FRONTEND/01_FRONTEND_GUIDE.md`
- 수정: `document/00_START_HERE/01_README.md`
- 추가: `document/04_TEMPLATES_PDF/03_PDF_RENDER_GUIDE.md`

### 3. 문서 반영 완료

- 강사 프로필 스키마 확장(bio/degrees/careers/publications/certifications JSON) 문서 반영
- 파일 업로드 인프라 문서화 (`POST /api/upload`, `/uploads/*`)
- seed 스크립트 목록 문서화 (`SEED_SCRIPTS.md`)
- `plus1` Handlebars 헬퍼 등록 위치 문서화

### 4. 추가 예정 (개선/PDF 기능 개발)

- **강사 PDF 렌더 툴 부재**
  - `render.instructorPdf` 툴 및 워커 주입 데이터 필요
  - 템플릿 타입 구분(예: `Template.targetType`) 필요
- **렌더 상태 조회 부재**
  - `RenderJob` 조회용 툴/API 추가 검토
- **PDF 링크 보안 정책 결정**
  - 민감 데이터 포함 시 서명 URL 또는 토큰 검증 필요

### 5. 참고

- 템플릿 예시 헬퍼는 `{{plus1 @index}}`로 표준화했습니다.
- 강사 템플릿은 문서에 “추가 예정”으로 명시했습니다.

### 5. PDF 다운로드/보기 링크 작업 방식 의견

현재 구조(비동기 렌더, `/pdf/*` 정적 제공) 기준으로는 아래 방식이 가장 현실적입니다.

- **UX 권장 흐름**
  - `render.*` 호출 → `jobId` 수신 → “작업 등록됨” 안내
  - 파일명 규칙 기반으로 **직접 링크 제공**: `/pdf/course-<id>.pdf`, `/pdf/schedule-<id>.pdf`
  - 링크는 **다운로드 버튼** + **새 탭 미리보기** 두 가지 제공

- **보안 요구가 낮을 때(내부 운영/개발)**
  - 현재처럼 정적 링크 제공 유지가 가장 단순하고 안정적

- **보안 요구가 높을 때(외부 제공/민감 정보)**
  - 서명 URL(만료 포함) 방식으로 전환 권장
  - 또는 `/api/pdf/:id` 형태로 토큰 검증 후 스트리밍

- **상태 조회 개선(옵션)**
  - `render.job.get` 같은 툴을 추가하면 “준비 완료”를 UI에서 판단 가능
  - 상태 조회가 없으면 현재처럼 파일명을 안내하는 UX가 현실적
