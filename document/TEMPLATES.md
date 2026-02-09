# TEMPLATES

**Handlebars** 기반 템플릿 규칙과 플레이스홀더 예시입니다.
템플릿 엔진은 Handlebars로 고정되어 있으며, 다른 엔진은 지원하지 않습니다.

## 공통 규칙

- 데이터는 `course`, `instructor`, `schedule` 등의 키로 주입
- 헬퍼 예시: `{{inc @index}}` (0-based 인덱스를 1-based로 변환)
- 외부 스크립트/URL 삽입 금지 (보안 샌드박스 정책, `SECURITY.md` 참조)

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
        <td>{{inc @index}}</td>
        <td>{{title}}</td>
        <td>{{description}}</td>
        <td>{{hours}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
```

## 예시 CSS (`default-course.css`)

```css
body { font-family: Arial, sans-serif; font-size: 12px; }
h1 { font-size: 20px; margin: 0 0 8px; }
h2 { font-size: 16px; margin-top: 16px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { border: 1px solid #ccc; padding: 6px; }
```
