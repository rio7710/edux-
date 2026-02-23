# 템플릿 데이터 키 레퍼런스

렌더링 시 Handlebars에 주입되는 데이터 구조.

## 1. 코스 소개서 (course_intro)

```json
{
  "course": { "title", "description", "durationHours", "isOnline", "equipment[]", "goal", "content", "notes" },
  "lectures": [{ "title", "description", "hours", "order" }],
  "instructors": [{ "name", "title", "affiliation", "specialties[]" }],
  "schedules": [{ "date", "location", "audience", "remarks" }]
}
```

사용 예시:
```handlebars
<h1>{{course.title}}</h1>
<p>총 {{course.durationHours}}시간</p>
{{#each lectures}}
  <p>{{plus1 @index}}. {{this.title}} ({{this.hours}}h)</p>
{{/each}}
```

## 2. 일정 보고서 (schedule_report)

```json
{
  "schedule": { "date", "location", "audience", "remarks", "customFields" },
  "course": { "title", "durationHours" },
  "instructor": { "name", "title" }
}
```

## 3. 강사 프로필 (instructor_profile)

```json
{
  "instructor": {
    "name", "title", "email", "affiliation", "tagline", "bio", "avatarUrl",
    "specialties[]",
    "certifications": [{ "name", "issuer", "date" }],
    "degrees": [{ "name", "school", "major" }],
    "careers": [{ "company", "role", "period" }],
    "publications": [{ "title", "type", "year" }]
  }
}
```

## 4. 데이터 주입 시점

| Tool | 동작 |
|------|------|
| `template.previewHtml` | 직접 data 전달 → HTML 미리보기 |
| `render.coursePdf` | courseId → DB 자동 조회 → 템플릿 주입 → PDF |
| `render.schedulePdf` | scheduleId → DB 자동 조회 → 템플릿 주입 → PDF |
