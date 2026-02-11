# TEMPLATES

**Handlebars** 기반 템플릿 규칙과 플레이스홀더 예시입니다.
템플릿 엔진은 Handlebars로 고정되어 있으며, 다른 엔진은 지원하지 않습니다.

> 주의: 실제 PDF 렌더러는 `src/workers/pdfWorker.ts`의 데이터 구조를 그대로 사용합니다.
> 이 문서의 예시는 현재 구현 기준에 맞춰 작성되었습니다.

## 공통 규칙

- 데이터는 `course`, `instructor`, `schedule` 등의 키로 주입
- 헬퍼 예시: `{{plus1 @index}}` (0-based 인덱스를 1-based로 변환)
- 외부 스크립트/URL 삽입 금지 (보안 샌드박스 정책, `SECURITY.md` 참조)
- `plus1` 헬퍼는 미리보기(`src/tools/template.ts`)와 PDF 렌더 워커(`src/workers/pdfWorker.ts`)에 등록되어 있습니다.
- 템플릿 타입 예: `course_intro`, `schedule`, `instructor_profile`

## 예시 HTML (`default-course.hbs`)

```hbs
<h1>{{course.title}}</h1>
<p><b>총 교육시간:</b> {{course.durationHours}}시간</p>
<p><b>비대면 가능:</b> {{#if course.isOnline}}예{{else}}아니오{{/if}}</p>

<h2>세부 목차</h2>
<table class="tbl">
  <thead><tr><th>#</th><th>강의명</th><th>내용</th><th>시간(h)</th></tr></thead>
  <tbody>
    {{#each course.Lectures}}
      <tr>
        <td>{{plus1 @index}}</td>
        <td>{{title}}</td>
        <td>{{description}}</td>
        <td>{{hours}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
```

## 예시 HTML (`default-schedule.hbs`)

```hbs
<h1>{{schedule.Course.title}}</h1>
<p><b>일정:</b> {{schedule.date}}</p>
<p><b>장소:</b> {{schedule.location}}</p>
<p><b>강사:</b> {{schedule.Instructor.name}}</p>
```

## 예시 CSS (`default-course.css`)

```css
body { font-family: Arial, sans-serif; font-size: 12px; }
h1 { font-size: 20px; margin: 0 0 8px; }
h2 { font-size: 16px; margin-top: 16px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { border: 1px solid #ccc; padding: 6px; }
```
