# Deployment Guide

> 최종 업데이트: 2026-02-11

## 1. 시스템 구성

```text
                    ┌──────────────┐
                    │   Nginx      │
                    │  (리버스     │
                    │   프록시)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
      ┌──────────┐  ┌──────────┐  ┌──────────────┐
      │ React UI │  │ MCP 서버 │  │ /share/:token│
      │ (정적)   │  │ (SSE)    │  │ (공유 링크)  │
      └──────────┘  └────┬─────┘  └──────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
      ┌──────────┐ ┌─────────┐ ┌────────────┐
      │PostgreSQL│ │  Redis  │ │ PDF Worker │
      │          │ │ (BullMQ)│ │ (Puppeteer)│
      └──────────┘ └─────────┘ └────────────┘
```

### 프로세스 목록

| 프로세스 | 설명 | 포트 | 명령어 |
|----------|------|------|--------|
| MCP 서버 | API + SSE 통신 | 7777 | `node dist/transport.js` |
| PDF Worker | BullMQ 큐 소비, PDF 생성 | - | `node dist/workers/pdfWorker.js` |
| React UI | 프론트엔드 정적 파일 | 80 | Nginx 서빙 |
| PostgreSQL | 메인 DB | 5432 | - |
| Redis | PDF 렌더 큐 | 6379 | - |

> PDF Worker는 MCP 서버와 **별도 프로세스**로 실행해야 합니다.

---

## 2. 환경 변수

### .env.example

```bash
# ── Database ──
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hrdb?schema=public"

# ── Redis (PDF 렌더 큐) ──
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ── JWT ──
JWT_SECRET=change-this-in-production

# ── PDF ──
PDF_CONCURRENCY=2
PUPPETEER_EXECUTABLE_PATH=  # Docker: /usr/bin/chromium-browser

# ── Server ──
PORT=7777
NODE_ENV=production
```

### 환경별 관리

| 환경 | 시크릿 관리 |
|------|------------|
| 로컬 | `.env` 파일 (커밋 금지) |
| CI/CD | GitHub Secrets |
| 프로덕션 | AWS Secrets Manager / Azure Key Vault |

---

## 3. Docker

### 3.1. 백엔드 Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app

# Puppeteer 의존성 (PDF Worker용)
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 7777
CMD ["node", "dist/transport.js"]
```

### 3.2. 프론트엔드 Dockerfile

```dockerfile
# ui/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.3. Nginx 설정

```nginx
# ui/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 라우팅
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 프록시
    location /sse {
        proxy_pass http://mcp-server:7777;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        chunked_transfer_encoding off;
    }

    location /messages {
        proxy_pass http://mcp-server:7777;
    }

    # PDF 파일 서빙
    location /pdf/ {
        proxy_pass http://mcp-server:7777;
    }

    # 공유 링크
    location /share/ {
        proxy_pass http://mcp-server:7777;
    }

    # 정적 자산 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 4. Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: hrdb
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      retries: 5

  mcp-server:
    build: .
    ports:
      - '7777:7777'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/hrdb
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      PDF_CONCURRENCY: 2
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - pdf_data:/app/public/pdf

  pdf-worker:
    build: .
    command: ['node', 'dist/workers/pdfWorker.js']
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/hrdb
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PDF_CONCURRENCY: 2
      PUPPETEER_EXECUTABLE_PATH: /usr/bin/chromium-browser
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - pdf_data:/app/public/pdf

  ui:
    build: ./ui
    ports:
      - '80:80'
    depends_on:
      - mcp-server

volumes:
  postgres_data:
  redis_data:
  pdf_data:
```

---

## 5. 배포 절차

### 5.1. 첫 배포

```bash
# 1. 이미지 빌드
docker compose build

# 2. DB 마이그레이션
docker compose run --rm mcp-server npx prisma migrate deploy

# 3. 시드 데이터 (선택)
docker compose run --rm mcp-server npx tsx scripts/seed-templates.ts

# 4. 전체 기동
docker compose up -d

# 5. 상태 확인
docker compose ps
curl http://localhost:7777/health
```

### 5.2. 업데이트 배포

```bash
# 1. 최신 코드
git pull origin main

# 2. 이미지 재빌드
docker compose build

# 3. DB 마이그레이션 (스키마 변경 시)
docker compose run --rm mcp-server npx prisma migrate deploy

# 4. 서비스 재시작
docker compose up -d

# 5. 롤백 (문제 발생 시)
docker compose down
git checkout <previous-tag>
docker compose build && docker compose up -d
```

### 5.3. PM2 (Docker 없이 직접 배포)

```bash
# 빌드
npm run build
npx prisma migrate deploy

# PM2 실행
pm2 start dist/transport.js --name edux-server
pm2 start dist/workers/pdfWorker.js --name edux-worker

# UI는 nginx에서 정적 서빙
cd ui && npm run build
# dist/ 폴더를 nginx root로 복사
```

---

## 6. CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop, 'release/*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hrdb_test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npx prisma generate
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hrdb_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: test-secret

      - run: cd ui && npm ci
      - run: cd ui && npm run build

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push MCP Server
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/mcp-server:${{ github.sha }}

      - name: Build and push UI
        uses: docker/build-push-action@v5
        with:
          context: ./ui
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/ui:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}

    steps:
      - name: Deploy
        run: |
          echo "Deploying ${{ github.sha }} to ${{ github.ref }}..."
          # SSH, kubectl, 또는 클라우드 CLI로 배포
```

---

## 7. DB 마이그레이션

| 환경 | 명령어 | 설명 |
|------|--------|------|
| 개발 | `npx prisma migrate dev --name <name>` | 마이그레이션 파일 생성 + 적용 |
| 프로덕션 | `npx prisma migrate deploy` | 기존 마이그레이션 파일 적용만 |
| 긴급 | `npx prisma db push` | 마이그레이션 파일 없이 스키마 동기화 (주의) |

---

## 8. 헬스 체크

```bash
# MCP 서버
curl http://localhost:7777/health

# PostgreSQL
pg_isready -h localhost -p 5432

# Redis
redis-cli ping
```

---

## 9. 백업

| 대상 | 주기 | 보관 | 명령어 |
|------|------|------|--------|
| PostgreSQL | 일 1회 | 30일 | `pg_dump -U postgres hrdb > backup.sql` |
| PDF 파일 | 필요 시 | - | S3 sync 또는 볼륨 백업 |
| Redis | 불필요 | - | 큐 데이터, 재생성 가능 |

---

## 10. 배포 환경

| 환경 | 백엔드 | 프론트엔드 | 브랜치 |
|------|--------|-----------|--------|
| Development | api-dev.edux.com | dev.edux.com | develop |
| Staging | api-stg.edux.com | stg.edux.com | release/* |
| Production | api.edux.com | edux.com | main |
