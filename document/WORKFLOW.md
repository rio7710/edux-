# WORKFLOW

**원칙: 한 단계 = 한 MCP 툴 호출.** 꼬임 방지를 위해 각 단계의 입력/출력을 명확히 유지합니다.

## 단계 1 — 코스 생성/수정

- 요청 (MCP `tools/call`):

```json
{
  "method": "tools/call",
  "params": {
    "name": "course.upsert",
    "arguments": { "title": "HRD 입문", "durationHours": 12, "isOnline": false }
  }
}
```

- 응답:

```json
{
  "content": [
    { "type": "text", "text": "{\"id\":\"c_123\",\"title\":\"HRD 입문\"}" }
  ]
}
```

## 단계 2 — 템플릿 미리보기 (선택)

- 요청:

```json
{
  "method": "tools/call",
  "params": {
    "name": "template.previewHtml",
    "arguments": {
      "html": "<h1>{{course.title}}</h1>",
      "css": "h1{font-size:20px}",
      "data": { "course": { "title": "HRD 입문" } }
    }
  }
}
```

- 응답:

```json
{
  "content": [
    { "type": "text", "text": "<!doctype html><html>...</html>" }
  ]
}
```

## 단계 3 — PDF 렌더

- 요청:

```json
{
  "method": "tools/call",
  "params": {
    "name": "render.coursePdf",
    "arguments": { "templateId": "t_abc", "courseId": "c_123" }
  }
}
```

- 응답:

```json
{
  "content": [
    { "type": "text", "text": "{\"jobId\":\"rj_001\",\"status\":\"done\",\"url\":\"/pdf/course-c_123.pdf\"}" }
  ]
}
```

## 운영 규칙

### A. 고정값 재사용

생성된 `course.id`, `template.id`는 다음 단계에서 그대로 사용합니다.

### B. 에러 처리

실패 응답은 `isError: true` 플래그로 구분합니다.

```json
{
  "content": [
    { "type": "text", "text": "Course not found: c_999" }
  ],
  "isError": true
}
```

에러 발생 시:

1. 에러 메시지를 사용자에게 즉시 표시
2. 다음 턴에서 재시도 또는 파라미터 수정 후 재호출
3. `render.*` 툴 실패 시 RenderJob에 `status: failed`, `errorMessage`가 기록됨

### C. 결과 요약

LLM 컨텍스트 길이를 고려해 id, 제목, URL 정도만 사용자에게 노출합니다.

### D. 소프트 삭제된 데이터

`course.get`, `instructor.get` 등은 `deletedAt`이 `null`인 레코드만 반환합니다.
삭제된 데이터에 접근하면 `isError: true`와 함께 "삭제된 레코드" 메시지가 반환됩니다.
