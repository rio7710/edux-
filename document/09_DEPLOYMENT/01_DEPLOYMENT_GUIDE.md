# 배포 가이드

## 1. 배포 아키텍처

```
Nginx → React SPA (/) + MCP SSE (/sse) + Static (/pdf, /uploads)
         ↓
    MCP Server (:7777) ← PostgreSQL + Redis + PDF Worker
```

## 2. 실행 프로세스 (5개)

| 프로세스 | 설명 | 포트 |
|---------|------|------|
| MCP Server | Express + MCP SDK | 7777 |
| PDF Worker | BullMQ + Puppeteer | - |
| React UI | Nginx 서빙 | 80/443 |
| PostgreSQL | 데이터베이스 | 5432 |
| Redis | 작업 큐 | 6379 |

## 3. Docker 빌드

### 백엔드
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./ && RUN npm ci --only=production
COPY dist/ prisma/ ./
RUN npx prisma generate
RUN apt-get update && apt-get install -y chromium fonts-noto-cjk --no-install-recommends
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["node", "dist/transport.js"]
```

### 프론트엔드
```dockerfile
FROM node:22-slim AS build
COPY ui/ ./ && RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## 4. Docker Compose

```yaml
services:
  mcp-server:
    build: .
    ports: ["7777:7777"]
    env_file: .env
    depends_on: [postgres, redis]
  pdf-worker:
    build: .
    command: ["node", "dist/workers/pdfWorker.js"]
    env_file: .env
    depends_on: [postgres, redis]
  ui:
    build: { context: ., dockerfile: ui/Dockerfile }
    ports: ["80:80"]
  postgres:
    image: postgres:16
    environment: { POSTGRES_DB: hrdb, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7
volumes:
  pgdata:
```

## 5. Nginx 핵심 설정

```nginx
location /     { root /usr/share/nginx/html; try_files $uri /index.html; }
location /sse  { proxy_pass http://mcp-server:7777; proxy_buffering off; proxy_read_timeout 86400s; }
location /messages { proxy_pass http://mcp-server:7777; }
location /api  { proxy_pass http://mcp-server:7777; }
location /uploads { proxy_pass http://mcp-server:7777; }
location /pdf  { proxy_pass http://mcp-server:7777; }
```

## 6. 환경변수 (프로덕션)

```env
DATABASE_URL=postgresql://user:pass@postgres:5432/hrdb
REDIS_URL=redis://redis:6379
JWT_SECRET=<강력한-시크릿>
PDF_CONCURRENCY=2
PORT=7777
NODE_ENV=production
```

## 7. 배포 순서

```bash
npm run build                      # 백엔드
cd ui && npm run build && cd ..    # 프론트엔드
npx prisma migrate deploy          # DB 마이그레이션
npx tsx scripts/seed-templates.ts   # (최초만) 시드
docker compose up -d
```

## 8. 헬스 체크

| 대상 | 방법 |
|------|------|
| MCP Server | `curl http://localhost:7777/health` |
| PostgreSQL | `docker exec edux-pg pg_isready` |
| Redis | `docker exec edux-redis redis-cli ping` |

## 9. 백업

| 대상 | 주기 | 방법 |
|------|------|------|
| PostgreSQL | 매일 | `pg_dump` / volume 백업 |
| PDF 파일 | 필요 시 | `/public/pdf/` |
| Redis | 불필요 | 일시적 큐 데이터 |

## 10. 환경 분리

| 환경 | 브랜치 | DB |
|------|--------|-----|
| development | feature/* | 로컬 Docker |
| staging | develop | 스테이징 서버 |
| production | main | 프로덕션 서버 |
