# 시스템 아키텍처

## 아키텍처 개요

```
Client (React UI / Claude Desktop / 외부 MCP)
    ↓ SSE or stdio
MCP Server (Express + MCP SDK, :7777)
    ├── Tool Layer (14 도메인 모듈, 60+ 도구)
    ├── Service Layer (prisma, jwt, authorization, pdf, queue)
    └── Worker (pdfWorker.ts → Puppeteer)
         ↓                ↓
    PostgreSQL          Redis (BullMQ)
```

## 핵심 구성 요소

**MCP 서버** — 모든 비즈니스 로직 진입점. Transport: SSE(웹), stdio(Claude Desktop). 인증: JWT 24h.

**Tool 모듈 (14개)**

| 모듈 | 역할 | 주요 도구 |
|------|------|----------|
| user | 인증, 사용자 관리 | register, login, logout, get, list |
| course | 코스 CRUD, 공유 | upsert, get, list, share*, delete |
| lecture | 강의 관리 | upsert, map, delete, grant* |
| instructor | 강사 프로필 | upsert, get, list, byUser |
| schedule | 일정 관리 | upsert, list, delete |
| template | 템플릿 CRUD | create, get, list, previewHtml |
| render | PDF 생성 트리거 | coursePdf, schedulePdf, instructorProfilePdf |
| document | 생성 문서 관리 | list, delete, share, revokeShare |
| group | 그룹/팀 관리 | upsert, addMember, list |
| message | 알림 메시지 | send, list, markRead |
| dashboard | 대시보드 통계 | bootstrap |
| siteSetting | 사이트 설정 | get, upsert |
| tableConfig | 테이블 컬럼 설정 | get, upsert |
| test | 에코 테스트 | echo |

**Service 레이어**

| 서비스 | 역할 |
|--------|------|
| prisma.ts | Prisma Client 싱글턴 |
| jwt.ts | JWT 생성/검증 |
| authorization.ts | RBAC 권한 평가 |
| pdf.ts | Puppeteer HTML→PDF |
| queue.ts | BullMQ 큐 인스턴스 |
| toolResponse.ts | 표준 응답 포맷 |

## 데이터 흐름

**일반 CRUD:** Client → MCP Tool → JWT 검증 → 권한 체크 → Prisma → PostgreSQL → 응답

**PDF 생성 (비동기):** Client → render Tool → RenderJob(pending) + BullMQ Job → 즉시 응답(jobId) → Worker가 처리 → Puppeteer PDF → /public/pdf/ 저장 → RenderJob(done) + UserDocument 생성

**인증:** user.login → bcrypt 검증 → JWT 발급 → 이후 요청에 token 포함 → verifyAndGetActor → requirePermission

## 디렉터리 구조

```
edux/
├── src/tools/          # MCP Tool 핸들러 (14 파일)
├── src/services/       # 공유 서비스 (8 파일)
├── src/workers/        # PDF Worker
├── ui/src/pages/       # 페이지 (17개)
├── ui/src/components/  # 공통 컴포넌트 (9개)
├── ui/src/hooks/       # 커스텀 훅
├── ui/src/api/         # MCP SSE 클라이언트
├── prisma/schema.prisma
├── scripts/            # 유틸리티 (18개)
├── public/pdf/         # 생성된 PDF
└── public/uploads/     # 업로드 파일
```

## 기술 선택 근거

| 선택 | 이유 |
|------|------|
| MCP SDK | AI 도구 통합 표준, Claude Desktop 직접 연동 |
| Express | SSE Transport + 파일 업로드/서빙 |
| Prisma | 타입 안전 ORM + 마이그레이션 |
| BullMQ + Redis | PDF 비동기 처리, 동시성 제어 |
| Puppeteer | HTML→PDF 품질, 한글 폰트 지원 |
| Handlebars | 보안 안전 템플릿 (스크립트 실행 불가) |
| React + Vite | 빠른 개발 서버, React 19 |
| Ant Design | 관리자 대시보드에 적합 |
| TanStack Query | 서버 상태 캐시, 자동 리페치 |
