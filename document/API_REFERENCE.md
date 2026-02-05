# API_REFERENCE

MCP SDK 기반 서버의 전송(transport) 방식과 부가 HTTP 엔드포인트를 정의합니다.

## 1) MCP 전송 방식

### stdio (기본)

Claude Desktop, Claude CLI 등 로컬 MCP 클라이언트와 stdin/stdout으로 통신합니다.

- 별도 포트 불필요
- `claude_desktop_config.json`에서 서버 등록 후 자동 연결
- JSON-RPC 2.0 프로토콜 사용

```json
{
  "mcpServers": {
    "edux": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/hrdb?schema=public"
      }
    }
  }
}
```

### SSE (웹 클라이언트용)

Express 서버 위에 SSE 전송을 마운트하여 웹 브라우저나 커스텀 클라이언트에서 접근합니다.

- **`GET /sse`** — SSE 연결 수립, 서버→클라이언트 메시지 스트리밍
- **`POST /messages`** — 클라이언트→서버 요청 전송

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const server = new McpServer({ name: "edux", version: "1.0.0" });

// 툴 등록 ...

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  // SSEServerTransport가 자동 처리
});

app.listen(7777);
```

## 2) 인증 (SSE 모드)

SSE 모드에서는 HTTP 요청에 JWT 기반 인증을 적용합니다.

### 인증 흐름

1. 클라이언트가 `POST /auth/login`에 이메일/비밀번호 전송
2. 서버가 User 테이블 조회 후 JWT 발급 (유효기간: 24h)
3. 이후 요청에 `Authorization: Bearer <token>` 헤더 포함
4. 미들웨어에서 토큰 검증 + 역할(Role) 확인

### 엔드포인트

- **`POST /auth/login`** — JWT 발급

```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

응답:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "u_001", "name": "관리자", "role": "admin" }
}
```

### 역할별 접근 권한

- **admin**: 모든 툴 실행 + 사용자 관리
- **editor**: 코스/강사/템플릿/스케줄 CRUD + PDF 렌더
- **viewer**: 읽기 전용 (`*.get`, `*.list` 툴만 허용)

> stdio 모드에서는 로컬 환경이므로 인증을 생략할 수 있습니다.
> 운영 환경에서는 반드시 SSE + JWT를 사용하세요.

## 3) 정적 파일

### `GET /pdf/<file>`

생성된 PDF를 정적으로 서빙합니다.

- SSE 모드: Express의 `express.static("public")` 미들웨어로 제공
- stdio 모드: 별도 파일 서버 필요 또는 로컬 파일 경로로 직접 접근
- 예시: `GET /pdf/course-c_123.pdf`

## 4) MCP 프로토콜 메시지 예시

### tools/list 요청

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### tools/list 응답

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "course.upsert",
        "description": "코스 생성 또는 수정",
        "inputSchema": {
          "type": "object",
          "required": ["title"],
          "properties": { "title": { "type": "string" } }
        }
      }
    ]
  }
}
```

### tools/call 요청

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "course.upsert",
    "arguments": { "title": "HRD 입문", "durationHours": 12 }
  }
}
```

### tools/call 응답 (성공)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      { "type": "text", "text": "{\"id\":\"c_123\",\"title\":\"HRD 입문\"}" }
    ]
  }
}
```

### tools/call 응답 (실패)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      { "type": "text", "text": "Validation error: title is required" }
    ],
    "isError": true
  }
}
```
