# ARCHITECTURE

본 시스템은 **MCP SDK**(`@modelcontextprotocol/sdk`) 기반의 **표준 MCP 서버**로 구축됩니다.
"강의 계획서 → DB → 템플릿 → PDF" 파이프라인을 **MCP 툴**로 노출하여,
Claude Desktop·CLI 등 MCP 클라이언트에서 **한 단계씩 안전하게** 작업합니다.

## 구성요소

- **MCP 서버**: `@modelcontextprotocol/sdk` + TypeScript — stdio / SSE 이중 전송
- **DB**: PostgreSQL 16 + Prisma ORM
- **템플릿 엔진**: Handlebars (고정) — `handlebars` + `handlebars-helpers`
- **PDF 렌더**: Puppeteer (Headless Chrome) — BullMQ 큐를 통한 비동기 처리
- **인증**: JWT (jsonwebtoken) + bcrypt — 역할 기반 접근 제어 (RBAC)
- **UI**: Vite + React + Ant Design + TanStack Query — 관리자 대시보드

## 디렉터리 구조

```text
edux/
├── document/                  # 프로젝트 문서 (19개)
├── scripts/                   # 유틸리티 스크립트 (샘플 데이터, 일괄 매핑 등)
├── prisma/
│   └── schema.prisma          # 데이터 모델 정의 (11개 테이블, 2개 enum)
├── public/
│   ├── pdf/                   # 생성된 PDF 정적 서빙
│   └── uploads/               # 업로드 파일 정적 서빙
├── src/
│   ├── mcp-server.ts          # StreamableHTTP 모드 MCP 서버 진입점
│   ├── transport.ts           # SSE 모드 Express 서버 진입점 (port 7777)
│   ├── tools/                 # 도메인별 툴 핸들러
│   │   ├── course.ts          #   course.upsert, course.get, course.list
│   │   ├── lecture.ts         #   lecture.upsert, lecture.get, lecture.list, lecture.delete
│   │   ├── instructor.ts      #   instructor.upsert, instructor.get, instructor.list
│   │   ├── schedule.ts        #   schedule.upsert, schedule.get, schedule.list
│   │   ├── template.ts        #   template.create, template.get, template.list, template.previewHtml
│   │   ├── render.ts          #   render.coursePdf, render.schedulePdf
│   │   ├── user.ts            #   user.register, user.login, user.me, 외 10개
│   │   └── test.ts            #   test.echo
│   ├── services/              # 공용 서비스
│   │   ├── prisma.ts          #   Prisma 클라이언트 싱글톤
│   │   ├── jwt.ts             #   JWT 토큰 생성/검증
│   │   ├── queue.ts           #   BullMQ 큐 인스턴스
│   │   └── pdf.ts             #   Puppeteer HTML→PDF 변환
│   └── workers/               # 비동기 워커
│       └── pdfWorker.ts       #   BullMQ PDF 렌더 워커
├── ui/                        # React 기반 관리자 대시보드
│   ├── src/
│   │   ├── api/mcpClient.ts   #   MCP SSE 클라이언트 + API 함수
│   │   ├── components/        #   Layout 등 공통 컴포넌트
│   │   ├── contexts/          #   AuthContext (인증 상태 관리)
│   │   └── pages/             #   CoursesPage, InstructorsPage, LoginPage 등
│   └── vite.config.ts         #   백엔드 프록시 설정
├── .env                       # 환경 변수 (저장소 제외)
├── package.json
└── tsconfig.json
```

## 데이터 흐름 (MCP 프로토콜 표준)

```text
MCP 클라이언트                        MCP 서버 (edux)
     │                                     │
     │── initialize ──────────────────────▶│  서버 정보·기능 교환
     │◀─ initialize response ─────────────│
     │                                     │
     │── tools/list ──────────────────────▶│  등록된 툴 목록 + JSON Schema 반환
     │◀─ tools/list response ─────────────│
     │                                     │
     │── tools/call (course.upsert) ─────▶│  DB 저장 → 결과 반환
     │◀─ tool result ─────────────────────│
     │                                     │
     │── tools/call (render.coursePdf) ──▶│  큐 등록 → Puppeteer PDF 생성
     │◀─ tool result (jobId, pending) ────│  RenderJob 생성
     │                                     │
     │ (백그라운드)                         │  워커 처리 → /pdf/course-<id>.pdf
```

## 전송 모드

- **stdio**: Claude Desktop, Claude CLI — 프로세스 stdin/stdout으로 JSON-RPC 통신
- **SSE**: 웹 브라우저, 커스텀 클라이언트 — Express 서버에서 `GET /sse` + `POST /messages` 제공

SSE 모드에서는 Express가 PDF 정적 파일도 함께 서빙합니다 (`/pdf/*`).

## PDF 렌더 큐

Puppeteer는 Headless Chrome을 실행하므로 동시 요청 시 메모리 부담이 큽니다.
**BullMQ**(Redis 기반)로 비동기 큐를 구성하여 동시 실행 수를 제한합니다.

- `render.coursePdf` / `render.schedulePdf` 호출 시 RenderJob을 `pending` 상태로 생성
- 워커(`src/workers/pdfWorker.ts`)가 큐에서 작업을 꺼내 `processing` → `done` / `failed`로 상태 전이
- 기본 동시 실행 제한: **2** (`PDF_CONCURRENCY` 환경 변수로 조정 가능)

### 렌더 데이터 구조 (현재 구현)

- 코스 PDF: `course` 객체(포함: `Lectures`, `Schedules`)
- 일정 PDF: `schedule` 객체(포함: `Course`, `Instructor`)

### 실행 방법

```bash
# MCP 서버와 별도 프로세스로 워커 실행
npm run dev:worker      # 개발 모드
npm run start:worker    # 프로덕션 모드
```

## 인증 아키텍처

- **JWT 기반**: Access Token (24h) + Refresh Token
- **역할 (Role)**: admin, operator, editor, instructor, viewer, guest
- **등록자 추적**: `createdBy` 필드에 JWT userId 저장, 조회 시 이름으로 변환
- **강사 신청/승인**: InstructorProfile → 관리자 승인 → Instructor 레코드 생성
- **강사 매핑**: Instructor ↔ User(1:1), Course ↔ Instructor(M:N, CourseInstructor)
