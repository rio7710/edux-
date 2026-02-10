# HR Course MVP — MCP SDK 기반 문서 세트

**최종 업데이트:** 2026-02-09 KST

이 문서 세트는 **MCP SDK**(`@modelcontextprotocol/sdk`) 기반의 "강의 계획서 → DB → 템플릿 → PDF" 플랫폼
기능 정의 및 사용 가이드를 제공합니다.
MCP 표준 프로토콜(stdio / SSE)을 통해 **Claude Desktop**, **Claude CLI** 등에서 직접 연동할 수 있습니다.

## 문서 목록

### 설계 문서

- `ARCHITECTURE.md` — 시스템 개요, 컴포넌트 구조, 전송 모드(stdio/SSE), PDF 렌더 큐, 인증 아키텍처
- `DATA_MODEL.md` — Prisma 스키마 (11개 테이블, 2개 enum: User, InstructorProfile, Course, CourseInstructor, Lecture 등)
- `MCP_TOOLS.md` — MCP 툴 목록 (26개), Zod 파라미터 스키마, 응답/에러 형식
- `API_REFERENCE.md` — MCP 전송 방식, JWT 인증, 정적 파일, 프로토콜 메시지 예시
- `TEMPLATES.md` — Handlebars 템플릿 규칙과 플레이스홀더 (Course, Lecture 데이터 주입)
- `TEMPLATE_GUIDE.md` — 템플릿 변수 가이드 (course/instructor 데이터 키)
- `PDF_RENDER_GUIDE.md` — PDF 렌더 흐름, 파일명 규칙, 다운로드 정책
- `SEED_SCRIPTS.md` — 샘플/템플릿 시드 스크립트 목록
- `WORKFLOW.md` — 단계별 절차(한 단계 = 한 툴 호출), 에러 처리 규칙

### 운영/정책 문서

- `SETUP_WINDOWS.md` — Windows 11 + VS Code 설치, TypeScript 설정, Claude Desktop 연동
- `SECURITY.md` — JWT 인증, RBAC (6개 역할), 툴별 권한 매트릭스, 템플릿 샌드박스, Puppeteer 보호
- `FRONTEND_GUIDE.md` — 프론트엔드 기술 스택, 구조, 컴포넌트 개발 및 상태 관리 규칙
- `TESTING_GUIDE.md` — 테스트 철학, 종류별(단위, 통합, E2E) 테스트 작성 및 실행 가이드
- `DEPLOYMENT_GUIDE.md` — 배포 환경, CI/CD 파이프라인, 환경 변수 관리 및 모니터링 정책

### 참고 문서

- `to_claude.md` — Claude에게 전달할 작업 지시 및 참고 사항
- `to_gemini.md` — Gemini에게 전달할 작업 지시 및 참고 사항
- `read_AI.md` — AI 개발 시 반복 실수 및 참고사항 (Zod, Prisma, Form 처리 등)
- `MEMBER_PLAN.md` — 회원관리 기능 설계 계획

### 프로젝트 진행

- `PROGRESS_REPORT.md` — 최신 프로젝트 진행 상황 및 완료된 작업 현황 (Phase 1-11)

## 빠른 시작

1. `SETUP_WINDOWS.md`를 따라 실행 환경을 준비합니다 (Node.js, Docker, TypeScript).
2. `DATA_MODEL.md`의 Prisma 스키마로 DB 마이그레이션을 실행합니다.
3. `MCP_TOOLS.md`를 참고하여 MCP 서버에 툴을 등록합니다.
4. Claude Desktop 설정에 서버를 등록하거나, SSE 모드로 기동합니다.
5. `WORKFLOW.md`를 따라 단계별로 MCP 툴을 호출합니다.
