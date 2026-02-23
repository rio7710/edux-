# 트러블슈팅

## Prisma

| 에러 | 원인 | 해결 |
|------|------|------|
| `Unable to find engine binary` | generate 미실행 / Node 불일치 | `npx prisma generate`, 안되면 `rm -rf node_modules/.prisma && npm i && npx prisma generate` |
| `P3009 failed migrations` | 실패 마이그레이션 존재 | `npx prisma migrate resolve --rolled-back "이름"` → `migrate dev` |
| 로그인 시 엔진 모드 오류 | 첫 쿼리 시 엔진 누락 | `npx prisma generate` → 서버 재시작 |

## Redis / BullMQ

| 에러 | 원인 | 해결 |
|------|------|------|
| `ECONNREFUSED 127.0.0.1:6379` | Redis 미실행 | `docker start edux-redis` 또는 `docker run -d --name edux-redis -p 6379:6379 redis:7` |
| PDF Worker 미동작 | Worker 프로세스 미실행 | `npm run dev:worker` 별도 터미널 실행 |

## MCP / SSE

| 에러 | 원인 | 해결 |
|------|------|------|
| SSE 연결 끊김 | Nginx 타임아웃 | `proxy_read_timeout 86400s;` 설정 |
| 401 Unauthorized | JWT 만료 (24h) | `useSessionExpiredGuard` 훅 적용 확인 |

## Frontend

| 에러 | 원인 | 해결 |
|------|------|------|
| Vite→백엔드 연결 실패 | 프록시 설정 불일치 | `ui/vite.config.ts` proxy target → `http://localhost:7777` |
| AntD 스타일 깨짐 | CSS import 누락 | `cd ui && npm install` |

## Docker

| 에러 | 원인 | 해결 |
|------|------|------|
| `port 5432 already in use` | 포트 충돌 | `docker stop edux-pg && docker start edux-pg` |
| Puppeteer Chrome 실패 | Chromium 미설치 (Docker) | Dockerfile에 `apt-get install chromium fonts-noto-cjk` |

## 공통 디버깅 패턴

**데이터가 안 보일 때:** `deletedAt IS NULL` 확인 → 역할 권한 확인 (admin 테스트) → React Query `invalidateQueries` 캐시 확인

**권한이 안 먹힐 때:** 메뉴 ON/OFF (SiteSettings) → User.role → PermissionGrant 테이블 → Tool authorization 로직
