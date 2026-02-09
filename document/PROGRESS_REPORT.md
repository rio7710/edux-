# 프로젝트 진행 상황 보고서

**최종 업데이트:** 2026년 2월 9일 일요일 (업데이트: createdBy 이름 변환 개선)

---

## 1. 개요

HR 강의 계획서를 관리하고 PDF로 출력하는 MCP(Model Context Protocol) SDK 기반 플랫폼 개발 프로젝트의 현재 진행 상황을 요약합니다.

---

## 2. 완료된 작업 현황

| 항목                            | 상태    | 비고                                                  |
| :------------------------------ | :------ | :---------------------------------------------------- |
| 문서 (13개)                     | ✅ 완료 | 초기 설정 시 확인                                     |
| 프로젝트 초기화                 | ✅ 완료 | `package.json`, `tsconfig.json`, `src/` 등 기본 구조  |
| Prisma 스키마 + DB 마이그레이션 | ✅ 완료 | `prisma/schema.prisma` 반영 및 DB 연동 확인           |
| MCP 서버 기본 구조 구현         | ✅ 완료 | `src/mcp-server.ts` (stdio), `src/transport.ts` (SSE) |
| Phase 3: 툴 핸들러 구현         | ✅ 완료 | 모든 13개 MCP 툴 구현 및 등록 완료                    |
| Phase 4: PDF 렌더 큐            | ✅ 완료 | BullMQ 워커 + Puppeteer PDF 생성 구현 완료            |
| Phase 5: React UI               | ✅ 완료 | Vite + Ant Design + TanStack Query 기본 구현          |
| GitHub 푸시                     | ✅ 완료 | [edux repo](https://github.com/rio7710/edux-)         |
| Phase 6: 회원관리 백엔드        | ✅ 완료 | JWT 인증, 7개 User Tools 구현                         |
| Phase 7: 회원관리 UI            | ✅ 완료 | 로그인/가입/프로필 페이지, AuthContext                |
| Phase 8: createdBy 추적         | ✅ 완료 | 전 엔티티 등록자 추적 + 이름 변환 표시                |

---

## 3. 현재 프로젝트 구조

```text
edux/
├── document/           # 문서 (13개)
├── prisma/
│   └── schema.prisma   # DB 스키마 (8개 테이블, 2개 enum)
├── public/
│   └── pdf/            # 생성된 PDF 파일 저장
├── src/                # 백엔드
│   ├── services/
│   │   ├── prisma.ts   # Prisma 클라이언트 싱글톤
│   │   ├── jwt.ts      # JWT 토큰 생성/검증
│   │   ├── queue.ts    # BullMQ 큐 설정
│   │   └── pdf.ts      # Puppeteer PDF 변환 서비스
│   ├── tools/          # MCP 툴 핸들러
│   │   ├── course.ts   # 코스 CRUD + createdBy
│   │   ├── instructor.ts # 강사 CRUD + createdBy
│   │   ├── schedule.ts # 일정 CRUD + createdBy
│   │   ├── template.ts # 템플릿 CRUD + createdBy
│   │   └── user.ts     # 회원 인증/관리 (7개 Tools)
│   ├── workers/
│   │   └── pdfWorker.ts
│   ├── mcp-server.ts   # stdio 모드
│   └── transport.ts    # SSE 모드
├── ui/                 # 프론트엔드 (React)
│   ├── src/
│   │   ├── api/mcpClient.ts        # MCP SSE 클라이언트
│   │   ├── components/Layout.tsx   # Ant Design 레이아웃
│   │   ├── contexts/AuthContext.tsx # 인증 상태 관리
│   │   ├── pages/
│   │   │   ├── CoursesPage.tsx
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

## 5. Phase 5 완료 내역 (React UI)

### 생성된 파일

| 파일                               | 설명                         |
| :--------------------------------- | :--------------------------- |
| `ui/src/api/mcpClient.ts`          | MCP over SSE 클라이언트      |
| `ui/src/components/Layout.tsx`     | Ant Design 사이드바 레이아웃 |
| `ui/src/pages/CoursesPage.tsx`     | 코스 CRUD                    |
| `ui/src/pages/InstructorsPage.tsx` | 강사 관리                    |
| `ui/src/pages/TemplatesPage.tsx`   | 템플릿 편집기                |
| `ui/src/pages/RenderPage.tsx`      | PDF 생성                     |
| `ui/vite.config.ts`                | 백엔드 프록시 설정           |

---

## 6. GitHub 리포지토리

- **URL**: [rio7710/edux-](https://github.com/rio7710/edux-)
- **커밋 ID**: `a8fd2c3` (Phase 1-5 완료 시점)
- **롤백 방법**: `git checkout a8fd2c3`

---

## 7. Phase 6 완료 내역 (회원관리 백엔드)

### 생성된 파일

| 파일                                 | 설명                        |
| :----------------------------------- | :-------------------------- |
| `src/services/jwt.ts`                | JWT 토큰 생성/검증 유틸리티 |
| `src/tools/user.ts`                  | 7개 User MCP Tools          |
| `prisma/migrations/20260206053646_*` | User 스키마 마이그레이션    |

### User 스키마 확장

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String
  role           Role      @default(viewer)
  hashedPassword String?   // nullable for social login
  provider       String?   // 'local' | 'google' | 'kakao'
  providerId     String?
  isActive       Boolean   @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime? // soft delete
}
```

### 구현된 MCP Tools

| Tool              | 설명                 | 인증  |
| :---------------- | :------------------- | :---- |
| `user.register`   | 회원가입             | No    |
| `user.login`      | 로그인 (토큰 발급)   | No    |
| `user.me`         | 내 정보 조회         | Yes   |
| `user.update`     | 내 정보 수정         | Yes   |
| `user.delete`     | 회원 탈퇴 (비활성화) | Yes   |
| `user.list`       | 회원 목록            | Admin |
| `user.updateRole` | 역할 변경            | Admin |

---

## 8. Phase 7-8 완료 내역 (회원관리 UI + createdBy)

### 회원관리 UI

- [x] AuthContext (인증 상태 관리)
- [x] 로그인 페이지 (`/login`)
- [x] 회원가입 페이지 (`/register`)
- [x] 프로필 페이지 (`/profile`)
- [x] Layout 헤더 수정 (사용자 정보 표시)
- [x] 회원관리 사이드바 메뉴

### createdBy 등록자 추적

- [x] Course, Instructor, Template, Schedule에 `createdBy` 필드 추가
- [x] 등록 시 JWT 토큰에서 사용자 ID 자동 추출
- [x] 목록/상세 조회 시 사용자 ID를 이름으로 변환하여 표시
- [x] 기존 null 데이터는 'admin'으로 기본 설정
- [x] **[개선] 중첩된 엔티티 createdBy 변환** (2026-02-09)
  - `courseGetHandler`에서 Lectures의 `createdBy`도 가입아이디(이름)로 변환
  - 모든 리스트, 상세 조회 시 등록자는 가입 아이디로 표시

---

## 9. Phase 8-1: createdBy 이름 변환 개선 (2026-02-09)

### 문제

- `courseGetHandler`에서 코스의 강의(Lectures)를 포함해서 조회할 때, 강의의 `createdBy` 필드가 CUID로 표시되는 이슈 발생

### 해결

- [x] 강의, 강사 등 중첩된 엔티티의 `createdBy`도 사용자 이름으로 변환하는 로직 추가
- [x] `src/tools/course.ts` 내 `courseGetHandler` 함수 개선:
  ```typescript
  // 강의들의 등록자도 이름으로 변환
  if (enrichedCourse.Lectures && enrichedCourse.Lectures.length > 0) {
    enrichedCourse.Lectures = await resolveCreatorNames(
      enrichedCourse.Lectures,
    );
  }
  ```

### 원칙

**모든 리스트 조회 및 상세 조회에서 `createdBy` 필드는 가입 아이디(이름)로 표시됩니다.**

- Course, Lecture, Instructor, Schedule, Template 등 모든 엔티티 동일하게 적용
- 중첩된 관계를 따라 재귀적으로 변환 처리

---

## 10. 실행 명령어 요약

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

## 11. 다음 단계 (예정)

- [ ] Lecture (강의) 엔티티 추가 (Course 하위)
- [ ] 페이지네이션 UI 개선
- [ ] 검색 기능
- [ ] 소프트 삭제 UI (삭제된 항목 복원)
- [ ] 문제은행 MCP (퀴즈/과제 - Lecture 매핑)
- [ ] 진도 추적 MCP (사용자별 수강 현황)

---

## 12. 주의사항

- Docker Desktop이 실행 중이어야 PostgreSQL 접근 가능
- Redis가 없어도 코스/강사/템플릿/회원 관리 기능은 정상 동작 (PDF 렌더링 큐만 영향)
- MCP SDK 1.26.0에서 deprecated 경고 발생 가능 (동작에는 문제없음)
- 프론트엔드와 백엔드가 모두 실행되어야 UI가 정상 동작

---
