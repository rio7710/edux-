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
| **Phase 5: React UI**       | ✅ 완료 | Vite + Ant Design + TanStack Query 기본 구현 |
| **GitHub 푸시**             | ✅ 완료 | https://github.com/rio7710/edux-           |

---

## 3. 현재 프로젝트 구조

```
edux/
├── document/           # 문서 (13개)
├── prisma/
│   └── schema.prisma   # DB 스키마 (8개 테이블, 2개 enum)
├── public/
│   └── pdf/            # 생성된 PDF 파일 저장
├── src/                # 백엔드
│   ├── services/
│   │   ├── prisma.ts   # Prisma 클라이언트 싱글톤
│   │   ├── queue.ts    # BullMQ 큐 설정
│   │   └── pdf.ts      # Puppeteer PDF 변환 서비스
│   ├── tools/          # 13개 MCP 툴 핸들러
│   ├── workers/
│   │   └── pdfWorker.ts
│   ├── mcp-server.ts   # stdio 모드
│   └── transport.ts    # SSE 모드
├── ui/                 # 프론트엔드 (React)
│   ├── src/
│   │   ├── api/mcpClient.ts      # MCP SSE 클라이언트
│   │   ├── components/Layout.tsx # Ant Design 레이아웃
│   │   ├── pages/
│   │   │   ├── CoursesPage.tsx
│   │   │   ├── InstructorsPage.tsx
│   │   │   ├── TemplatesPage.tsx
│   │   │   └── RenderPage.tsx
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
- **큐**: BullMQ (Redis)
- **PDF**: Puppeteer (Headless Chrome)
- **템플릿**: Handlebars

### 프론트엔드
- **빌드**: Vite
- **UI**: React 19 + Ant Design
- **상태관리**: TanStack Query (React Query)
- **라우팅**: React Router v6

---

## 5. Phase 5 완료 내역 (React UI)

### 생성된 파일

| 파일 | 설명 |
|------|------|
| `ui/src/api/mcpClient.ts` | MCP over SSE 클라이언트 |
| `ui/src/components/Layout.tsx` | Ant Design 사이드바 레이아웃 |
| `ui/src/pages/CoursesPage.tsx` | 코스 CRUD |
| `ui/src/pages/InstructorsPage.tsx` | 강사 관리 |
| `ui/src/pages/TemplatesPage.tsx` | 템플릿 편집기 |
| `ui/src/pages/RenderPage.tsx` | PDF 생성 |
| `ui/vite.config.ts` | 백엔드 프록시 설정 |

### UI 접속 방법

```bash
# 터미널 1: 백엔드
cd d:\workSpace\edux
npm run dev

# 터미널 2: 프론트엔드
cd d:\workSpace\edux\ui
npm run dev
```

- 백엔드: http://localhost:7777
- 프론트엔드: http://localhost:5173

---

## 6. GitHub 리포지토리

- **URL**: https://github.com/rio7710/edux-
- **커밋 ID**: `a8fd2c3` (Phase 1-5 완료 시점)
- **롤백 방법**: `git checkout a8fd2c3`

---

## 7. 다음 단계 (Phase 6) - 2026년 2월 6일 예정

### 필드 커스터마이징

| 화면 | 작업 내용 |
|------|----------|
| 코스 | 필드 추가/수정, 유효성 검사 강화 |
| 강사 | 프로필 이미지, 자격증/수상 이력 |
| 템플릿 | 코드 에디터 (Monaco Editor) 적용 |
| 일정 | 캘린더 뷰, 시간 선택기 |

### 회원가입/로그인 구현

- [ ] 회원가입 페이지 (`/register`)
- [ ] 로그인 페이지 (`/login`)
- [ ] JWT 토큰 발급 API (`auth.register`, `auth.login`)
- [ ] 인증 미들웨어 적용
- [ ] 역할 기반 접근 제어 (admin, editor, viewer)

### 추가 개선

- [ ] 목록 조회 API 추가 (`course.list`, `instructor.list`)
- [ ] 페이지네이션 구현
- [ ] 검색 기능
- [ ] 소프트 삭제 UI (삭제된 항목 복원)

---

## 8. 실행 명령어 요약

```bash
# 1. Docker 컨테이너 시작
docker start edux-pg edux-redis

# 2. 백엔드 실행
npm run dev          # SSE 모드 (포트 7777)
npm run dev:worker   # PDF 워커 (별도 터미널)

# 3. 프론트엔드 실행
cd ui && npm run dev # 포트 5173

# 4. 빌드
npm run build        # 백엔드
cd ui && npm run build  # 프론트엔드
```

---

## 9. 주의사항

- MCP SDK 1.26.0에서 deprecated 경고 발생 가능 (동작에는 문제없음)
- PDF 워커는 MCP 서버와 별도 프로세스로 실행 필요
- 프론트엔드와 백엔드가 모두 실행되어야 UI가 정상 동작

---
