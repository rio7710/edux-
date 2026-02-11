# TEMPLATE_GUIDE

템플릿에서 사용할 수 있는 데이터 키(Handlebars) 가이드입니다.  
현재 **과정 소개 템플릿**과 **일정 템플릿** 기준으로 정리했으며,
강사 프로필 템플릿은 **문서 기준(추가 예정)**으로만 안내합니다.

> 실제 PDF 렌더 데이터는 `src/workers/pdfWorker.ts` 기준입니다.

## 공통

- 템플릿은 `{{...}}` 형태의 Handlebars 문법을 사용합니다.
- 목록은 `{{#each list}} ... {{/each}}` 형태로 반복합니다.
- 미리보기는 A4 출력 기준 CSS가 자동 주입됩니다.
- 인덱스 헬퍼: `{{plus1 @index}}` (0-based → 1-based)

---

## 1) 과정 소개 템플릿 (course_intro)

### 1-1. 코스 기본 정보

- `{{course.id}}`
- `{{course.title}}`
- `{{course.description}}`
- `{{course.durationHours}}`
- `{{course.isOnline}}` (boolean)
- `{{course.goal}}`
- `{{course.notes}}`
- `{{course.createdBy}}`

### 1-2. 강의 목록 (코스 상세 강의)

현재 렌더러는 `course.Lectures`를 주입합니다.

필드 예시:

```hbs
{{#each course.Lectures}}
  {{id}}
  {{title}}
  {{description}}
  {{hours}}
  {{order}}
  {{createdBy}}
{{/each}}
```

### 1-3. 일정 목록 (선택)

```hbs
{{#each course.Schedules}}
  {{id}}
  {{date}}
  {{location}}
  {{audience}}
  {{remarks}}
  {{createdBy}}
{{/each}}
```

---

## 2) 일정 템플릿 (schedule)

### 2-1. 일정 기본 정보

- `{{schedule.id}}`
- `{{schedule.date}}`
- `{{schedule.location}}`
- `{{schedule.audience}}`
- `{{schedule.remarks}}`
- `{{schedule.createdBy}}`

### 2-2. 일정에 연결된 코스/강사

```hbs
{{schedule.Course.id}}
{{schedule.Course.title}}
{{schedule.Course.description}}
{{schedule.Instructor.id}}
{{schedule.Instructor.name}}
```

---

## 3) 강사 프로필 템플릿 (instructor_profile) — 추가 예정

현재 렌더 툴/워커에는 강사 전용 PDF가 없습니다.
강사 프로필 PDF가 필요하면 다음이 필요합니다.

- `render.instructorPdf` 툴 추가
- 워커에서 `instructor` 및 연관 `courses` 주입
- 템플릿 선택 시 강사 전용 타입 구분

강사 템플릿에서 사용할 수 있는 주요 키(예상):

- `{{instructor.id}}`
- `{{instructor.userId}}`
- `{{instructor.name}}`
- `{{instructor.title}}`
- `{{instructor.email}}`
- `{{instructor.phone}}`
- `{{instructor.affiliation}}`
- `{{instructor.avatarUrl}}` (예: `/uploads/...`)
- `{{instructor.tagline}}`
- `{{instructor.bio}}`
- `{{instructor.specialties}}`
- `{{instructor.certifications}}` (JSON 배열)
- `{{instructor.awards}}`
- `{{instructor.links}}` (JSON)
- `{{instructor.degrees}}` (JSON 배열)
- `{{instructor.careers}}` (JSON 배열)
- `{{instructor.publications}}` (JSON 배열)

---

## 4) 참고

- `course.isOnline`은 boolean이므로 다음과 같이 처리할 수 있습니다.

```hbs
{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}
```

- 목록이 비어 있을 수 있으므로 필요하면 조건문으로 감쌀 수 있습니다.

```hbs
{{#if course.Lectures}}
  {{#each course.Lectures}} ... {{/each}}
{{/if}}
```
