# 템플릿 문법

## 1. Handlebars 기본 문법

```handlebars
{{title}}              <!-- 이스케이프 출력 -->
{{{description}}}      <!-- HTML 그대로 출력 (주의) -->

{{#if isOnline}}<p>온라인</p>{{else}}<p>오프라인</p>{{/if}}

{{#each lectures}}
  <tr><td>{{plus1 @index}}</td><td>{{this.title}}</td><td>{{this.hours}}</td></tr>
{{/each}}
```

커스텀 헬퍼: `plus1` → 인덱스 +1 (`{{plus1 @index}}` → 1, 2, 3...)

## 2. 보안 규칙 (샌드박스)

| 구분 | 항목 |
|------|------|
| 금지 | `<script>`, `onclick=`, `onload=`, `javascript:`, 외부 URL |
| 허용 | `{{변수}}`, CSS inline/style 블록, `<img src="/uploads/">` (내부 경로) |

## 3. 템플릿 타입

| type | 용도 | 데이터 소스 |
|------|------|-----------|
| `course_intro` | 코스 소개서 | Course + Lectures + Schedules |
| `schedule_report` | 일정 보고서 | CourseSchedule + Course + Instructor |
| `instructor_profile` | 강사 프로필 | Instructor |

## 4. 템플릿 CRUD

| Tool | 설명 |
|------|------|
| `template.create` | 새 템플릿 (name, html, css) |
| `template.get` | 조회 (TemplateVersion 이력 포함) |
| `template.list` | 목록 (page, pageSize) |
| `template.previewHtml` | 데이터 주입 → HTML 미리보기 |

버전 관리: 수정 시 TemplateVersion 자동 생성, 순차 증가, 수동 롤백 가능
