# API 레퍼런스

## 1. Transport 방식

### SSE (웹 브라우저용)
```
엔드포인트: http://localhost:7777/sse
메시지:     http://localhost:7777/messages
```
- Express + MCP SDK SSEServerTransport
- `/sse`에 EventSource 연결 → 서버 이벤트 수신
- Tool 호출은 `/messages`에 POST
- JWT는 Tool 파라미터 `token` 필드로 전달

### stdio (Claude Desktop/CLI용)
```
실행: node dist/mcp-server.js
```
- MCP SDK StdioServerTransport, JSON-RPC 통신
- `npm run build` 필요, 환경변수는 Claude Desktop 설정에서 전달

## 2. 인증 플로우

```
1. 클라이언트 → user.login { email, password }
2. 서버 → bcrypt 검증 → JWT 생성
3. 서버 → { user, accessToken, refreshToken } 반환
4. 클라이언트 → accessToken 저장 (localStorage)
5. Tool 호출 시 → { ..., token: accessToken }
6. 서버 → verifyAndGetActor(token) → actor
7. 서버 → requirePermission(token, permissionKey)
```

JWT 페이로드: `{ userId, role, iat, exp }` (24h TTL)

## 3. 파일 업로드

```
POST /api/upload  (multipart/form-data)
```

| 항목 | 값 |
|------|-----|
| 미들웨어 | multer |
| 저장 위치 | `/public/uploads/{filename}` |
| 접근 URL | `http://localhost:7777/uploads/{filename}` |
| 사용처 | 강사 avatarUrl, certifications[].fileUrl, degrees[].fileUrl |

## 4. 정적 파일 서빙

| 경로 | 설명 |
|------|------|
| `/uploads/*` | 업로드 파일 |
| `/pdf/*` | 생성 PDF |
| `/*` | React UI (SPA fallback) |

## 5. Vite 프록시 (개발환경)

```ts
// ui/vite.config.ts
proxy: {
  '/sse':      { target: 'http://localhost:7777' },
  '/messages': { target: 'http://localhost:7777' },
  '/api':      { target: 'http://localhost:7777' },
  '/uploads':  { target: 'http://localhost:7777' },
  '/pdf':      { target: 'http://localhost:7777' },
}
```

## 6. 에러 코드

| 에러 | 의미 |
|------|------|
| `isError: true` | Tool 실행 실패 |
| JWT 만료 | "토큰이 만료되었습니다" |
| 권한 부족 | "권한이 없습니다" |
| 데이터 없음 | "{Entity} not found: {id}" |
| 유효성 실패 | Zod 에러 메시지 |
