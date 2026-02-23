# 개발 환경 설정

Windows 11 기준. macOS/Linux도 Docker 부분은 동일.

## 사전 요구사항

| 소프트웨어 | 버전 | 용도 |
|-----------|------|------|
| Node.js | 22+ | 런타임 |
| Docker Desktop | 최신 | PostgreSQL, Redis |
| Git | 최신 | 버전 관리 |

## Docker 컨테이너

```bash
# PostgreSQL
docker run -d --name edux-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hrdb -p 5432:5432 postgres:16

# Redis
docker run -d --name edux-redis -p 6379:6379 redis:7
```

## 프로젝트 설치

```bash
git clone <repo-url> edux && cd edux
npm install
cd ui && npm install && cd ..
```

## 환경변수 (.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hrdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key-change-in-production
PDF_CONCURRENCY=2
PORT=7777
NODE_ENV=development
```

## DB 초기화

```bash
npx prisma generate
npx prisma migrate dev
npx tsx scripts/seed-templates.ts          # (선택) 템플릿
npx tsx scripts/create-users-by-role.ts    # (선택) 테스트 사용자
```

## 서버 실행 (3개 터미널)

```bash
npm run dev           # MCP 서버 (SSE, :7777)
npm run dev:worker    # PDF Worker
cd ui && npm run dev  # React UI (:5173)
```

## Claude Desktop 연동 (stdio)

`npm run build` 후 Claude Desktop 설정에 추가:
```json
{
  "mcpServers": {
    "edux": {
      "command": "node",
      "args": ["d:/workSpace/edux/dist/mcp-server.js"],
      "env": { "DATABASE_URL": "...", "REDIS_URL": "...", "JWT_SECRET": "..." }
    }
  }
}
```

## 셋업 체크리스트

- [ ] Docker 컨테이너 2개 Running (pg, redis)
- [ ] `.env` 생성
- [ ] `prisma generate` + `migrate dev` 성공
- [ ] MCP 서버 실행 확인
- [ ] React UI 접속 확인 (http://localhost:5173)
