# HR Course MVP — MCP SDK 기반 문서 세트

**최종 업데이트:** 2026-02-09 KST

이 문서 세트는 **MCP SDK**(`@modelcontextprotocol/sdk`) 기반의 "강의 계획서 → DB → 템플릿 → PDF" 플랫폼
기능 정의 및 사용 가이드를 제공합니다.
MCP 표준 프로토콜(stdio / SSE)을 통해 **Claude Desktop**, **Claude CLI** 등에서 직접 연동할 수 있습니다.

## 문서 목록 (폴더 구조)

### 00_START_HERE

- `00_START_HERE/01_README.md` — 문서 전체 안내
- `00_START_HERE/02_WORKFLOW.md` — 단계별 절차(한 단계 = 한 툴 호출), 에러 처리 규칙
- `00_START_HERE/03_TROUBLESHOOTING.md` — 장애 대응 및 트러블슈팅

### 01_ARCHITECTURE

- `01_ARCHITECTURE/01_ARCHITECTURE.md` — 시스템 개요, 컴포넌트 구조, 전송 모드(stdio/SSE), PDF 렌더 큐, 인증 아키텍처
- `01_ARCHITECTURE/02_DATA_MODEL.md` — Prisma 스키마 (테이블/enum 정의)

### 02_API_MCP

- `02_API_MCP/01_MCP_TOOLS.md` — MCP 툴 목록, Zod 파라미터 스키마, 응답/에러 형식
- `02_API_MCP/02_API_REFERENCE.md` — MCP 전송 방식, JWT 인증, 정적 파일, 프로토콜 메시지 예시

### 03_FRONTEND

- `03_FRONTEND/01_FRONTEND_GUIDE.md` — 프론트엔드 기술 스택/구조/상태 관리
- `03_FRONTEND/02_COLUMN_SETTINGS_APPLY.md` — 컬럼 설정 적용 방식 정의
- `03_FRONTEND/03_SITE_SETTINGS.md` — 사이트 관리(공통 설정) 정의

### 04_TEMPLATES_PDF

- `04_TEMPLATES_PDF/01_TEMPLATES.md` — Handlebars 템플릿 규칙과 플레이스홀더
- `04_TEMPLATES_PDF/02_TEMPLATE_GUIDE.md` — 템플릿 변수 가이드
- `04_TEMPLATES_PDF/03_PDF_RENDER_GUIDE.md` — PDF 렌더 흐름, 파일명 규칙

### 05_OPERATIONS

- `05_OPERATIONS/01_SETUP_WINDOWS.md` — Windows 개발 환경 설정
- `05_OPERATIONS/02_DEPLOYMENT_GUIDE.md` — 배포 환경, CI/CD, 모니터링
- `05_OPERATIONS/03_MIGRATION_RUNBOOK.md` — 운영 마이그레이션 절차
- `05_OPERATIONS/04_SEED_SCRIPTS.md` — 샘플/템플릿 시드 스크립트

### 06_SECURITY_POLICY

- `06_SECURITY_POLICY/01_SECURITY.md` — JWT 인증, RBAC, 샌드박스 정책
- `06_SECURITY_POLICY/02_USER_POLICY.md` — 사용자 정책
- `06_SECURITY_POLICY/03_USER_SCHEMA_AND_PLAN.md` — 회원/권한 스키마 및 계획

### 07_TESTING

- `07_TESTING/01_TESTING_GUIDE.md` — 테스트 작성 및 실행 가이드

### 08_ML

- `08_ML/01_ML_LABELING_GUIDE.md` — 머신러닝 라벨링 가이드

### 09_PROGRESS

- `09_PROGRESS/01_PROGRESS_REPORT.md` — 최신 프로젝트 진행 상황
- `09_PROGRESS/02_PROGRESS_UPDATE_2026-02-09.md` — 특정 진행 기록

### 10_HANDOFF

- `10_HANDOFF/01_to_claude.md` — Claude 전달용 작업 지시
- `10_HANDOFF/02_to_gemini.md` — Gemini 전달용 작업 지시

### 11_PRODUCT

- `11_PRODUCT/01_MEMBER_PLAN.md` — 회원관리 기능 설계 계획

## 빠른 시작

1. `SETUP_WINDOWS.md`를 따라 실행 환경을 준비합니다 (Node.js, Docker, TypeScript).
2. `DATA_MODEL.md`의 Prisma 스키마로 DB 마이그레이션을 실행합니다.
3. `MCP_TOOLS.md`를 참고하여 MCP 서버에 툴을 등록합니다.
4. Claude Desktop 설정에 서버를 등록하거나, SSE 모드로 기동합니다.
5. `WORKFLOW.md`를 따라 단계별로 MCP 툴을 호출합니다.
