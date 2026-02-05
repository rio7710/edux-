# MCP_TOOLS

`@modelcontextprotocol/sdk`의 `McpServer.tool()` 메서드로 등록되는 툴 목록입니다.
각 툴은 **Zod 스키마**로 파라미터를 정의하며, MCP 프로토콜 표준 형식으로 응답합니다.

## 응답 형식 (공통)

### 성공

```json
{
  "content": [
    { "type": "text", "text": "{\"id\":\"c_123\",\"title\":\"HRD 입문\"}" }
  ]
}
```

### 실패

```json
{
  "content": [
    { "type": "text", "text": "Course not found: c_999" }
  ],
  "isError": true
}
```

> `content[].text`에는 JSON 문자열 또는 사람이 읽을 수 있는 메시지가 들어갑니다.

---

## DB 툴

### `course.upsert`

코스 생성 또는 수정.

- 파라미터:

```json
{
  "type": "object",
  "required": ["title"],
  "properties": {
    "id": { "type": "string", "description": "없으면 새로 생성" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "durationHours": { "type": "integer", "minimum": 0 },
    "isOnline": { "type": "boolean" },
    "equipment": { "type": "array", "items": { "type": "string" } },
    "goal": { "type": "string" },
    "notes": { "type": "string" }
  }
}
```

- 응답 예시: `{ "id": "c_123", "title": "HRD 입문" }`

### `course.get`

코스 단건 조회 (모듈·스케줄 포함).

- 파라미터:

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string" }
  }
}
```

- 응답 예시: Course 객체 전체 (Modules, Schedules 관계 포함)

---

### `instructor.upsert`

강사 생성 또는 수정.

- 파라미터:

```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "id": { "type": "string", "description": "없으면 새로 생성" },
    "name": { "type": "string" },
    "title": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "phone": { "type": "string" },
    "affiliation": { "type": "string" },
    "avatarUrl": { "type": "string", "format": "uri" },
    "tagline": { "type": "string" },
    "specialties": { "type": "array", "items": { "type": "string" } },
    "certifications": { "type": "array", "items": { "type": "string" } },
    "awards": { "type": "array", "items": { "type": "string" } },
    "links": { "type": "object" }
  }
}
```

- 응답 예시: `{ "id": "i_456", "name": "홍길동" }`

### `instructor.get`

강사 단건 조회.

- 파라미터:

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string" }
  }
}
```

---

### `module.batchSet`

코스의 모듈 목록을 일괄 교체 (기존 모듈 삭제 후 재생성).

- 파라미터:

```json
{
  "type": "object",
  "required": ["courseId", "modules"],
  "properties": {
    "courseId": { "type": "string" },
    "modules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title"],
        "properties": {
          "title": { "type": "string" },
          "details": { "type": "string" },
          "hours": { "type": "number", "minimum": 0 },
          "order": { "type": "integer", "minimum": 0 }
        }
      }
    }
  }
}
```

- 응답 예시: `{ "courseId": "c_123", "count": 5 }`

---

### `schedule.upsert`

수업 일정 생성 또는 수정.

- 파라미터:

```json
{
  "type": "object",
  "required": ["courseId"],
  "properties": {
    "id": { "type": "string", "description": "없으면 새로 생성" },
    "courseId": { "type": "string" },
    "instructorId": { "type": "string" },
    "date": { "type": "string", "format": "date-time" },
    "location": { "type": "string" },
    "audience": { "type": "string" },
    "remarks": { "type": "string" },
    "customFields": { "type": "object" }
  }
}
```

- 응답 예시: `{ "id": "s_789", "courseId": "c_123", "date": "2026-03-15" }`

### `schedule.get`

일정 단건 조회 (코스·강사 관계 포함).

- 파라미터:

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string" }
  }
}
```

---

## 템플릿 툴

### `template.create`

새 템플릿 생성.

- 파라미터:

```json
{
  "type": "object",
  "required": ["name", "html", "css"],
  "properties": {
    "name": { "type": "string" },
    "html": { "type": "string", "description": "Handlebars 템플릿 HTML" },
    "css": { "type": "string" }
  }
}
```

- 응답 예시: `{ "id": "t_abc", "name": "기본 코스 템플릿" }`

### `template.get`

템플릿 단건 조회 (버전 이력 포함).

- 파라미터:

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string" }
  }
}
```

### `template.list`

템플릿 목록 조회.

- 파라미터:

```json
{
  "type": "object",
  "properties": {
    "page": { "type": "integer", "minimum": 1, "default": 1 },
    "pageSize": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 }
  }
}
```

- 응답 예시: `{ "items": [...], "total": 5 }`

### `template.previewHtml`

Handlebars 템플릿에 데이터를 주입하여 완성된 HTML을 반환.

- 파라미터:

```json
{
  "type": "object",
  "required": ["html", "css", "data"],
  "properties": {
    "html": { "type": "string", "description": "Handlebars 템플릿" },
    "css": { "type": "string" },
    "data": { "type": "object", "description": "course, instructor, schedule 등" }
  }
}
```

- 응답 예시: 완성된 `<!doctype html>...` 문자열

---

## 렌더 툴

### `render.coursePdf`

코스 데이터 + 템플릿으로 PDF를 생성합니다.
BullMQ 큐를 통해 비동기 처리되며, RenderJob 레코드가 생성됩니다.

- 파라미터:

```json
{
  "type": "object",
  "required": ["templateId", "courseId"],
  "properties": {
    "templateId": { "type": "string" },
    "courseId": { "type": "string" }
  }
}
```

- 응답 예시: `{ "jobId": "rj_001", "status": "done", "url": "/pdf/course-c_123.pdf" }`

### `render.schedulePdf`

일정 데이터 + 템플릿으로 PDF를 생성합니다.

- 파라미터:

```json
{
  "type": "object",
  "required": ["templateId", "scheduleId"],
  "properties": {
    "templateId": { "type": "string" },
    "scheduleId": { "type": "string" }
  }
}
```

- 응답 예시: `{ "jobId": "rj_002", "status": "done", "url": "/pdf/schedule-s_789.pdf" }`

---

## 툴 등록 예시 (TypeScript)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "edux", version: "1.0.0" });

server.tool(
  "course.upsert",
  "코스 생성 또는 수정",
  {
    id: z.string().optional().describe("없으면 새로 생성"),
    title: z.string(),
    description: z.string().optional(),
    durationHours: z.number().int().min(0).optional(),
    isOnline: z.boolean().optional(),
    equipment: z.array(z.string()).optional(),
    goal: z.string().optional(),
    notes: z.string().optional(),
  },
  async (args) => {
    const course = await prisma.course.upsert({ /* ... */ });
    return {
      content: [{ type: "text", text: JSON.stringify(course) }],
    };
  }
);
```
