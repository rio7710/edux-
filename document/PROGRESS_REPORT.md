# 프로젝트 진행 상황 보고서

**최종 업데이트:** 2026년 2월 5일 목요일

---

## 1. 개요

HR 강의 계획서를 관리하고 PDF로 출력하는 MCP(Model Context Protocol) SDK 기반 플랫폼 개발 프로젝트의 현재 진행 상황을 요약합니다.

---

## 2. 완료된 작업 현황

| 항목                        | 상태     | 비고                                     |
| :-------------------------- | :------- | :--------------------------------------- |
| 문서 (13개)                 | ✅ 완료  | 초기 설정 시 확인                       |
| 프로젝트 초기화             | ✅ 완료  | `package.json`, `tsconfig.json`, `src/` 등 기본 구조 |
| Prisma 스키마 + DB 마이그레이션 | ✅ 완료  | `prisma/schema.prisma` 반영 및 DB 연동 확인 |
| MCP 서버 기본 구조 구현     | ✅ 완료  | `src/mcp-server.ts` (stdio), `src/transport.ts` (SSE) |
| **Phase 3: 툴 핸들러 구현** | ✅ 완료 | 모든 13개 MCP 툴 구현 및 등록 완료           |
| **Phase 4: PDF 렌더 큐**    | ✅ 완료 | BullMQ 워커 + Puppeteer PDF 생성 구현 완료   |
| React UI                    | ❌ 미완료 | 다음 단계 (Phase 5)                      |

---

## 3. 현재 프로젝트 구조

```
edux/
├── document/           # 문서 (ARCHITECTURE.md, DATA_MODEL.md, MCP_TOOLS.md 등)
├── prisma/
│   └── schema.prisma   # DB 스키마 (8개 테이블, 2개 enum)
├── public/
│   └── pdf/            # 생성된 PDF 파일 저장
├── src/
│   ├── services/
│   │   ├── prisma.ts   # Prisma 클라이언트 싱글톤
│   │   ├── queue.ts    # BullMQ 큐 설정
│   │   └── pdf.ts      # Puppeteer PDF 변환 서비스
│   ├── tools/
│   │   ├── course.ts   # course.upsert, course.get
│   │   ├── instructor.ts # instructor.upsert, instructor.get
│   │   ├── module.ts   # module.batchSet
│   │   ├── schedule.ts # schedule.upsert, schedule.get
│   │   ├── template.ts # template.create, template.get, template.list, template.previewHtml
│   │   └── render.ts   # render.coursePdf, render.schedulePdf
│   ├── workers/
│   │   └── pdfWorker.ts # BullMQ PDF 렌더 워커
│   ├── mcp-server.ts   # stdio 모드 MCP 서버 진입점
│   └── transport.ts    # SSE 모드 Express 서버 진입점
├── .env                # 환경 변수 (DATABASE_URL, REDIS_HOST 등)
├── package.json        # 프로젝트 의존성 및 스크립트
└── tsconfig.json       # TypeScript 설정 (ESM)
```

---

## 4. 기술 스택 (백엔드)

*   **Runtime**: Node.js 18+ / TypeScript (ESM)
*   **MCP**: `@modelcontextprotocol/sdk` (stdio + SSE 이중 전송)
*   **DB**: PostgreSQL 16 + Prisma ORM
*   **큐**: BullMQ (Redis) - PDF 렌더링 비동기 처리
*   **PDF**: Puppeteer (Headless Chrome)
*   **템플릿**: Handlebars
*   **인증**: JWT + bcrypt

---

## 5. 핵심 설정 확인

### `package.json`
*   `"type": "module"` (ESM 지원)
*   `@modelcontextprotocol/sdk: ^1.26.0`
*   모든 의존성 설치 완료

### npm 스크립트

```json
{
  "dev": "tsx watch src/transport.ts",        // SSE 모드 개발
  "dev:stdio": "tsx src/mcp-server.ts",       // stdio 모드 개발
  "dev:worker": "tsx watch src/workers/pdfWorker.ts",  // PDF 워커 개발
  "build": "tsc",
  "start": "node dist/transport.js",          // SSE 모드 프로덕션
  "start:stdio": "node dist/mcp-server.js",   // stdio 모드 프로덕션
  "start:worker": "node dist/workers/pdfWorker.js"    // PDF 워커 프로덕션
}
```

### `tsconfig.json`
*   `"module": "NodeNext"`
*   `"moduleResolution": "NodeNext"`
*   `"rootDir": "src"`

---

## 6. Docker 컨테이너 상태

| 컨테이너 | 이미지 | 포트 | 상태 |
|---------|--------|------|------|
| edux-pg | postgres:16 | 5432 | ✅ 실행 중 |
| edux-redis | redis:7-alpine | 6379 | ✅ 실행 중 |

---

## 7. 테스트 결과

*   **PostgreSQL 연결**: Prisma CRUD 테스트 성공
*   **Redis 연결**: BullMQ 워커 연결 성공
*   **SSE 서버**: `http://localhost:7777/health` → `{"status":"ok"}`
*   **stdio 서버**: `npm run dev:stdio` → `[edux] MCP server started (stdio mode)`
*   **PDF 워커**: `npm run dev:worker` → `[pdfWorker] Worker started (concurrency: 2)`
*   **TypeScript 빌드**: `npm run build` → 오류 없음

---

## 8. 구현된 MCP 툴 (13개)

| 툴 그룹 | 툴 이름                  | 설명                        | 상태     |
| :------ | :----------------------- | :-------------------------- | :------- |
| DB      | `course.upsert`          | 코스 생성/수정              | ✅ 완료 |
| DB      | `course.get`             | 코스 조회 (모듈, 스케줄 포함) | ✅ 완료 |
| DB      | `instructor.upsert`      | 강사 생성/수정              | ✅ 완료 |
| DB      | `instructor.get`         | 강사 단건 조회              | ✅ 완료 |
| DB      | `module.batchSet`        | 코스 모듈 일괄 교체         | ✅ 완료 |
| DB      | `schedule.upsert`        | 수업 일정 생성/수정         | ✅ 완료 |
| DB      | `schedule.get`           | 일정 단건 조회              | ✅ 완료 |
| 템플릿  | `template.create`        | 새 템플릿 생성              | ✅ 완료 |
| 템플릿  | `template.get`           | 템플릿 단건 조회            | ✅ 완료 |
| 템플릿  | `template.list`          | 템플릿 목록 조회            | ✅ 완료 |
| 템플릿  | `template.previewHtml`   | Handlebars HTML 미리보기    | ✅ 완료 |
| 렌더    | `render.coursePdf`       | 코스 PDF 생성 (비동기)      | ✅ 완료 |
| 렌더    | `render.schedulePdf`     | 일정 PDF 생성 (비동기)      | ✅ 완료 |

---

## 9. Phase 4 완료 내역 (PDF 렌더 큐)

### 생성된 파일

| 파일 | 설명 |
|------|------|
| `src/services/pdf.ts` | Puppeteer PDF 변환 서비스 |
| `src/workers/pdfWorker.ts` | BullMQ 워커 (큐 작업 처리) |

### PDF 렌더 워커 흐름

```
1. render.coursePdf / render.schedulePdf 호출
   → RenderJob 생성 (status: pending)
   → BullMQ 큐에 작업 추가

2. pdfWorker가 큐에서 작업 수신
   → RenderJob status: processing

3. 템플릿 + 데이터 조회
   → Handlebars 렌더링
   → Puppeteer PDF 생성

4. 결과 저장
   → 성공: status: done, pdfUrl: /pdf/xxx.pdf
   → 실패: status: failed, errorMessage: ...
```

### 환경 변수

```env
# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # 선택

# PDF 워커 동시 실행 제한
PDF_CONCURRENCY=2
```

---

## 10. 다음 단계 (Phase 5)

### React UI 구현

*   **기술 스택**: Vite + React + Ant Design + TanStack Query
*   **주요 화면**:
    *   코스 CRUD
    *   강사 관리
    *   템플릿 편집기 (HTML/CSS)
    *   PDF 미리보기 및 다운로드
    *   렌더 작업 상태 조회

### 선택적 추가 작업

*   인증 시스템 (JWT 로그인)
*   E2E 테스트 (Playwright)
*   CI/CD 파이프라인

---

## 11. 실행 명령어 요약

```bash
# 1. Docker 컨테이너 시작
docker start edux-pg edux-redis

# 2. MCP 서버 실행 (택 1)
npm run dev          # SSE 모드 (포트 7777)
npm run dev:stdio    # stdio 모드

# 3. PDF 워커 실행 (별도 터미널)
npm run dev:worker

# 4. 빌드
npm run build

# 5. 프로덕션 실행
npm run start        # SSE 모드
npm run start:stdio  # stdio 모드
npm run start:worker # PDF 워커
```

---

## 12. 주의사항

*   MCP SDK 1.26.0에서 `server.tool()` 시그니처가 deprecated 경고를 발생시킬 수 있으나, 동작에는 문제없습니다.
*   PDF 워커는 MCP 서버와 별도 프로세스로 실행해야 합니다.
*   Puppeteer 첫 실행 시 Chromium 다운로드가 필요할 수 있습니다.

---
