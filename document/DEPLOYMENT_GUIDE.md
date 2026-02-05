# Deployment Guide

## 1. 개요

Edux 프로젝트의 배포 환경, CI/CD 파이프라인, 환경 변수 관리 정책입니다.
MCP 서버(백엔드) + React UI(프론트엔드) 구성을 다룹니다.

## 2. 배포 환경

| 환경 | 백엔드 URL | 프론트엔드 URL | 브랜치 |
| --- | --- | --- | --- |
| **Development** | `api-dev.edux.com` | `dev.edux.com` | `develop` |
| **Staging** | `api-stg.edux.com` | `stg.edux.com` | `release/*` |
| **Production** | `api.edux.com` | `edux.com` | `main` |

## 3. 아키텍처

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│  MCP Server │────▶│  PostgreSQL │
│  (Reverse   │     │  (Node.js)  │     │             │
│   Proxy)    │     │             │────▶│   Redis     │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ /pdf/*
       ▼
┌─────────────┐
│  Static     │
│  (PDF files)│
└─────────────┘
```

## 4. Docker 이미지

### 4.1. MCP 서버 (백엔드)

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:18-alpine AS runner
WORKDIR /app

# Puppeteer 의존성
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 7777
CMD ["node", "dist/transport.js"]
```

### 4.2. React UI (프론트엔드)

```dockerfile
# ui/Dockerfile
FROM node:18-alpine AS builder
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

### 4.3. Nginx 설정 (프론트엔드)

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

    # 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 5. Docker Compose (로컬/개발)

```yaml
# docker-compose.yml
version: '3.8'

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

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  mcp-server:
    build: .
    ports:
      - '7777:7777'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/hrdb
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      PDF_CONCURRENCY: 2
    depends_on:
      - postgres
      - redis
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

## 6. CI/CD 파이프라인 (GitHub Actions)

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
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hrdb_test
          REDIS_URL: redis://localhost:6379

      - name: Install UI dependencies
        run: cd ui && npm ci

      - name: Run UI tests
        run: cd ui && npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
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

  deploy-dev:
    if: github.ref == 'refs/heads/develop'
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: development

    steps:
      - name: Deploy to Development
        run: |
          # kubectl, helm, 또는 SSH 배포 스크립트
          echo "Deploying to development..."

  deploy-staging:
    if: startsWith(github.ref, 'refs/heads/release/')
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging..."

  deploy-prod:
    if: github.ref == 'refs/heads/main'
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
```

## 7. 환경 변수 관리

### 7.1. 환경별 변수

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis 연결 문자열 | `redis://host:6379` |
| `JWT_SECRET` | JWT 서명 키 | (시크릿 매니저) |
| `PDF_CONCURRENCY` | 동시 PDF 생성 수 | `2` |
| `NODE_ENV` | 환경 구분 | `production` |

### 7.2. 시크릿 관리

- **GitHub Secrets**: CI/CD 파이프라인용
- **AWS Secrets Manager** 또는 **Azure Key Vault**: 런타임 시크릿
- `.env` 파일은 로컬 개발 전용, **절대 커밋 금지**

## 8. MCP 서버 배포 모드

### 8.1. SSE 모드 (운영)

웹 클라이언트, React UI와 통신합니다.

```bash
# 환경 변수 설정 후
node dist/transport.js
# 또는 PM2
pm2 start dist/transport.js --name edux-mcp
```

### 8.2. stdio 모드 (Claude Desktop)

stdio 모드는 로컬 Claude Desktop 전용입니다.
서버 배포 대상이 아니며, 사용자 PC에서 직접 실행합니다.

```json
// claude_desktop_config.json (사용자 PC)
{
  "mcpServers": {
    "edux": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"]
    }
  }
}
```

## 9. 데이터베이스 마이그레이션

### 9.1. 개발/스테이징

```bash
npx prisma migrate dev --name <migration_name>
```

### 9.2. 프로덕션

```bash
npx prisma migrate deploy
```

### 9.3. CI에서 자동 마이그레이션

```yaml
- name: Run migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## 10. 모니터링

### 10.1. 로깅

- **Winston** 또는 **Pino**로 구조화된 JSON 로그
- **Fluentd** → **Elasticsearch** 또는 **CloudWatch Logs**

### 10.2. 메트릭

- **Prometheus** + **Grafana** 또는 **CloudWatch**
- 주요 지표:
  - MCP 툴 호출 수/지연시간
  - PDF 렌더 큐 길이
  - 에러율

### 10.3. 알림

- **Slack** 또는 **PagerDuty** 연동
- 트리거:
  - 에러율 > 1%
  - PDF 큐 대기 > 10개
  - 서버 다운

## 11. 백업 정책

| 대상 | 주기 | 보관 기간 |
| --- | --- | --- |
| PostgreSQL | 일 1회 | 30일 |
| PDF 파일 | (필요 시 S3 전환) | 30일 |
| Redis | 백업 불필요 (캐시) | - |

## 12. 롤백 절차

1. 이전 이미지 태그 확인: `ghcr.io/org/edux/mcp-server:<previous-sha>`
2. Kubernetes: `kubectl rollout undo deployment/mcp-server`
3. Docker Compose: `docker-compose up -d --force-recreate`

---

**관련 문서:** `ARCHITECTURE.md`, `SECURITY.md`, `SETUP_WINDOWS.md`
