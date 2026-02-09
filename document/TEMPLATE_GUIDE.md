# TEMPLATE_GUIDE

템플릿에서 사용할 수 있는 데이터 키(Handlebars) 가이드입니다.  
현재 **강사 프로필 템플릿**과 **과정 소개 템플릿** 기준으로 정리했습니다.

## 공통

- 템플릿은 `{{...}}` 형태의 Handlebars 문법을 사용합니다.
- 목록은 `{{#each list}} ... {{/each}}` 형태로 반복합니다.
- 미리보기는 A4 출력 기준 CSS가 자동 주입됩니다.

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

### 1-2. 강사 목록 (코스에 매핑된 강사)

반복 키:

```hbs
{{#each instructors}}
  {{this.id}}
  {{this.name}}
  {{this.title}}
  {{this.email}}
  {{this.phone}}
  {{this.affiliation}}
{{/each}}
```

### 1-3. 강의 목록 (코스 상세 강의)

다음 키 중 아무거나 사용 가능 (동일 데이터):

- `{{#each lectures}} ... {{/each}}`
- `{{#each modules}} ... {{/each}}`
- `{{#each courseLectures}} ... {{/each}}`

필드 예시:

```hbs
{{#each lectures}}
  {{this.id}}
  {{this.title}}
  {{this.description}}
  {{this.hours}}
  {{this.order}}
  {{this.createdBy}}
{{/each}}
```

### 1-4. 일정 목록 (선택)

```hbs
{{#each schedules}}
  {{this.id}}
  {{this.date}}
  {{this.location}}
  {{this.audience}}
  {{this.remarks}}
  {{this.createdBy}}
{{/each}}
```

---

## 2) 강사 프로필 템플릿 (instructor_profile)

### 2-1. 강사 기본 정보

- `{{instructor.id}}`
- `{{instructor.userId}}`
- `{{instructor.name}}`
- `{{instructor.title}}`
- `{{instructor.email}}`
- `{{instructor.phone}}`
- `{{instructor.affiliation}}`
- `{{instructor.specialties}}`
- `{{instructor.createdBy}}`

### 2-2. 강의 가능 과정 (강사에 매핑된 코스)

```hbs
{{#each courses}}
  {{this.id}}
  {{this.title}}
  {{this.description}}
  {{this.durationHours}}
  {{this.goal}}
{{/each}}
```

### 2-3. 강사 일정 (선택)

```hbs
{{#each schedules}}
  {{this.id}}
  {{this.date}}
  {{this.location}}
  {{this.audience}}
  {{this.remarks}}
  {{this.createdBy}}
{{/each}}
```

---

## 3) 참고

- `course.isOnline`은 boolean이므로 다음과 같이 처리할 수 있습니다.

```hbs
{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}
```

- 목록이 비어 있을 수 있으므로 필요하면 조건문으로 감쌀 수 있습니다.

```hbs
{{#if lectures}}
  {{#each lectures}} ... {{/each}}
{{/if}}
```
