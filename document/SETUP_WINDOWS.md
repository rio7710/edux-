# SETUP (Windows 11 + VS Code)

## 필수 소프트웨어

- **Node.js** 18+ (LTS 권장)
- **Docker Desktop** (로컬 PostgreSQL + Redis 용)
- **VS Code**

## 빠른 실행 (이미 설치된 환경)

```bash
# 1. Docker 컨테이너 시작
docker start edux-postgres

# 2. 백엔드 빌드 & 실행
cd d:\workSpace\edux
npm run build && node dist/transport.js

# 3. 프론트엔드 실행 (별도 터미널)
cd d:\workSpace\edux\ui
npm run dev
```

- 백엔드: <http://localhost:7777>
- 프론트엔드: <http://localhost:5173>

---

## 최초 설치

## 1. PostgreSQL 실행 (Docker)

```bash
docker run -d --name edux-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hrdb -p 5432:5432 postgres:16-alpine
```

## 2. Redis 실행 (Docker, PDF 렌더 큐용 - 선택)

```bash
docker run -d --name edux-redis -p 6379:6379 redis:7-alpine
```

> Redis가 없어도 코스/강사/템플릿/회원 관리 기능은 정상 동작합니다. PDF 렌더링 큐만 영향받습니다.

## 3. 환경 변수

프로젝트 루트에 `.env` 파일 생성:

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hrdb?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PDF_CONCURRENCY=2
```

> `.env`는 절대 저장소에 커밋하지 마세요. `.gitignore`에 포함시키세요.

## 4. 프로젝트 초기화

```bash
npm init -y
```

## 5. 의존성 설치

```bash
npm i @modelcontextprotocol/sdk zod express cors handlebars handlebars-helpers puppeteer prisma @prisma/client bullmq jsonwebtoken bcryptjs
npm i -D typescript tsx @types/node @types/express @types/cors @types/jsonwebtoken @types/bcryptjs
```

## 6. TypeScript 설정

`tsconfig.json` 생성:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

## 7. Prisma 초기화

```bash
npx prisma init
```

`prisma/schema.prisma`에 `DATA_MODEL.md`의 스키마를 복사한 뒤:

```bash
npx prisma migrate dev --name init
```

## 8. MCP 서버 실행

### stdio 모드 (Claude Desktop / CLI 연동)

```bash
npx tsx src/mcp-server.ts
```

### SSE 모드 (웹 클라이언트용)

```bash
npx tsx src/transport.ts
# SSE: http://localhost:7777/sse
# Messages: http://localhost:7777/messages
# PDF: http://localhost:7777/pdf/*
```

## 9. Claude Desktop 연동

Claude Desktop 설정 파일에 서버를 등록합니다.

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "edux": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "cwd": "D:\\workSpace\\edux",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/hrdb?schema=public",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

등록 후 Claude Desktop을 재시작하면 edux 툴을 사용할 수 있습니다.

## 10. UI (선택)

```bash
npm create vite@latest ui -- --template react
cd ui
npm i antd @tanstack/react-query react-router-dom
npm run dev
```

---

## 크로스 플랫폼 참고

### Linux / Mac

- Docker 명령은 동일
- Claude Desktop 설정 경로:
  - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- `npx tsx` 명령은 OS 무관하게 동일
- `.env` 경로 구분자: `/` 사용 (Windows의 `\`와 다름)
