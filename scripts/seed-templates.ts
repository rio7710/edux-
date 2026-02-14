import { prisma } from "../src/services/prisma.js";

const instructorHtml = `<div class="instructor-profile">
  <h1>{{instructor.name}}</h1>
  <p>{{instructor.title}}</p>

  <h2>기본 정보</h2>
  <ul>
    <li>이메일: {{instructor.email}}</li>
    <li>전화번호: {{instructor.phone}}</li>
    <li>소속: {{instructor.affiliation}}</li>
  </ul>

  <h2>전문 분야</h2>
  <p>{{instructor.specialties}}</p>

  <h2>강의 가능 과정</h2>
  <ul>
    {{#each courses}}
    <li>{{this.title}}</li>
    {{/each}}
  </ul>
</div>`;

const instructorCss = `.instructor-profile {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

h1 {
  color: #1a1a1a;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 10px;
}

h2 {
  color: #333;
  margin-top: 30px;
}

ul {
  line-height: 1.8;
}`;

const courseHtml = `<div class="course-intro">
  <h1>{{course.title}}</h1>
  <p>{{course.description}}</p>

  <h2>교육 목표</h2>
  <p>{{course.goal}}</p>

  <h2>강사</h2>
  <ul>
    {{#each instructors}}
    <li>{{this.name}}</li>
    {{/each}}
  </ul>

  <h2>교육 내용</h2>
  <ul>
    {{#each lectures}}
    <li>{{this.title}} ({{this.hours}}시간)</li>
    {{/each}}
  </ul>
</div>`;

const courseCss = `.course-intro {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

h1 {
  color: #1a1a1a;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 10px;
}

h2 {
  color: #333;
  margin-top: 30px;
}

ul {
  line-height: 1.8;
}`;

const courseHtml2 = `<div class="page">
  <div class="doc-header">
    <div class="doc-label">과정 소개서</div>
    <h1>{{course.title}}</h1>
    <p class="subtitle">{{course.description}}</p>
  </div>

  <h2>과정 개요</h2>
  <table>
    <tbody>
      <tr>
        <th>교육 시간</th>
        <td>{{course.durationHours}}시간</td>
        <th>교육 방식</th>
        <td>{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</td>
      </tr>
      <tr>
        <th>교육 목표</th>
        <td colspan="3">{{course.goal}}</td>
      </tr>
    </tbody>
  </table>

  <h2>담당 강사</h2>
  <table>
    <tbody>
      <tr>
        <th>강사명</th>
        {{#each instructors}}
        <td>{{this.name}}</td>
        {{/each}}
      </tr>
    </tbody>
  </table>

  <h2>교육 내용</h2>
  <table>
    <thead>
      <tr>
        <th class="col-no">No.</th>
        <th class="col-title">강의명</th>
        <th>내용</th>
        <th class="col-hours">시간</th>
      </tr>
    </thead>
    <tbody>
      {{#each lectures}}
      <tr>
        <td class="center">{{plus1 @index}}</td>
        <td>{{this.title}}</td>
        <td>{{this.description}}</td>
        <td class="center">{{this.hours}}H</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
</div>`;

const courseCss2 = `@page {
  size: A4;
  margin: 0;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #e5e7eb;
  color-scheme: light;
}

.page {
  font-family: 'Noto Sans KR', sans-serif;
  width: 210mm;
  min-height: 297mm;
  margin: 20px auto;
  padding: 60px 50px;
  background: #fff;
  color: #111827;
  line-height: 1.6;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}

@media print {
  html, body { background: #fff; }
  .page {
    margin: 0;
    padding: 20mm 18mm;
    box-shadow: none;
    width: 100%;
    min-height: auto;
  }
}

/* ── 헤더 ── */
.doc-header {
  text-align: center;
  padding-bottom: 20px;
  margin-bottom: 32px;
  border-bottom: 2px solid #111827;
}

.doc-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #fff;
  background: #1d4ed8;
  padding: 4px 16px;
  border-radius: 2px;
  margin-bottom: 10px;
}

h1 {
  margin: 12px 0 8px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* ── 섹션 제목 ── */
h2 {
  font-size: 15px;
  font-weight: 700;
  margin: 28px 0 10px;
  padding: 7px 14px;
  background: #f0f4ff;
  border-left: 4px solid #1d4ed8;
  color: #1e3a5f;
}

/* ── 테이블 공통 ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4px;
  font-size: 13px;
}

th, td {
  border: 1px solid #c7d2e0;
  padding: 9px 14px;
  text-align: left;
}

thead th {
  background: #e8edf4;
  font-weight: 700;
  color: #1e3a5f;
  text-align: center;
}

tbody th {
  background: #f5f7fa;
  font-weight: 600;
  color: #374151;
  width: 120px;
  text-align: center;
}

.center {
  text-align: center;
}

.col-no { width: 50px; }
.col-title { width: 160px; }
.col-hours { width: 60px; }`;

const courseAllHtml = `<div class="all-page">
  <header class="hero">
    <div class="badge">COURSE INTRO ALL</div>
    <h1>{{course.title}}</h1>
    <p class="desc">{{course.description}}</p>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">교육 시간</div>
        <div class="meta-value">{{course.durationHours}}시간</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">교육 방식</div>
        <div class="meta-value">{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">등록자</div>
        <div class="meta-value">{{course.createdBy}}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">코스 ID</div>
        <div class="meta-value mono">{{course.id}}</div>
      </div>
    </div>
  </header>

  <section class="block">
    <h2>교육 목표</h2>
    <p>{{course.goal}}</p>
  </section>

  <section class="block">
    <h2>비고</h2>
    <p>{{course.notes}}</p>
  </section>

  <section class="block">
    <h2>필요 장비</h2>
    <ul class="chip-list">
      {{#each course.equipment}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
  </section>

  <section class="block">
    <h2>담당 강사</h2>
    {{#if instructors.length}}
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>이름</th>
          <th>직함</th>
          <th>이메일</th>
          <th>소속</th>
        </tr>
      </thead>
      <tbody>
        {{#each instructors}}
        <tr>
          <td class="center">{{plus1 @index}}</td>
          <td>{{this.name}}</td>
          <td>{{this.title}}</td>
          <td>{{this.email}}</td>
          <td>{{this.affiliation}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <p class="empty">등록된 강사 정보가 없습니다.</p>
    {{/if}}
  </section>

  <section class="block">
    <h2>강의 상세 커리큘럼</h2>
    {{#if lectures.length}}
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>강의명</th>
          <th>설명</th>
          <th>시간</th>
          <th>순서</th>
          <th>등록자</th>
        </tr>
      </thead>
      <tbody>
        {{#each lectures}}
        <tr>
          <td class="center">{{plus1 @index}}</td>
          <td>{{this.title}}</td>
          <td>{{this.description}}</td>
          <td class="center">{{this.hours}}</td>
          <td class="center">{{this.order}}</td>
          <td>{{this.createdBy}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <p class="empty">등록된 강의 정보가 없습니다.</p>
    {{/if}}
  </section>

  <section class="block">
    <h2>운영 일정</h2>
    {{#if schedules.length}}
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>일정</th>
          <th>장소</th>
          <th>대상</th>
          <th>강사</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        {{#each schedules}}
        <tr>
          <td class="center">{{plus1 @index}}</td>
          <td>{{this.date}}</td>
          <td>{{this.location}}</td>
          <td>{{this.audience}}</td>
          <td>{{this.Instructor.name}}</td>
          <td>{{this.remarks}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <p class="empty">등록된 일정 정보가 없습니다.</p>
    {{/if}}
  </section>

  <footer class="foot">
    <div>Last Update: {{course.updatedAt}}</div>
  </footer>
</div>`;

const courseAllCss = `@page {
  size: A4;
  margin: 0;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #f1f5f9;
  color: #0f172a;
}

.all-page {
  font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
  width: 210mm;
  min-height: 297mm;
  margin: 20px auto;
  padding: 20mm 18mm;
  background: #ffffff;
  color: #0f172a;
}

@media print {
  html, body { background: #fff; }
  .all-page {
    margin: 0;
    width: auto;
    min-height: auto;
    padding: 14mm 12mm;
  }
}

.hero {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  background: linear-gradient(130deg, #f8fbff 0%, #eff6ff 100%);
}

.badge {
  display: inline-block;
  background: #1d4ed8;
  color: #fff;
  font-size: 10px;
  letter-spacing: 0.16em;
  font-weight: 700;
  border-radius: 999px;
  padding: 4px 10px;
}

h1 {
  margin: 12px 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.desc {
  margin: 0 0 16px;
  color: #334155;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.meta-item {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
}

.meta-label {
  font-size: 11px;
  color: #64748b;
}

.meta-value {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.mono {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.block {
  margin-top: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
}

h2 {
  margin: 0 0 10px;
  font-size: 15px;
  color: #0f172a;
}

.chip-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-list li {
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  background: #eff6ff;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th, td {
  border: 1px solid #cbd5e1;
  padding: 7px 8px;
  vertical-align: top;
}

thead th {
  background: #f8fafc;
  font-weight: 700;
}

.center {
  text-align: center;
}

.empty {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.foot {
  margin-top: 16px;
  text-align: right;
  color: #94a3b8;
  font-size: 11px;
}`;

async function main() {
  const items = [
    {
      name: "강사 프로필 샘플",
      type: "instructor_profile",
      html: instructorHtml,
      css: instructorCss,
    },
    {
      name: "과정 소개 샘플",
      type: "course_intro",
      html: courseHtml,
      css: courseCss,
    },
    {
      name: "과정 소개 샘플 2",
      type: "course_intro",
      html: courseHtml2,
      css: courseCss2,
    },
    {
      name: "과정소개서_all버젼",
      type: "course_intro",
      html: courseAllHtml,
      css: courseAllCss,
    },
  ];

  for (const item of items) {
    const exists = await prisma.template.findFirst({
      where: { name: item.name, type: item.type },
      include: { Versions: true },
    });
    if (exists) {
      await prisma.template.update({
        where: { id: exists.id },
        data: {
          html: item.html,
          css: item.css,
          Versions: {
            create: {
              version: (exists as any).Versions?.length
                ? (exists as any).Versions.length + 1
                : 2,
              html: item.html,
              css: item.css,
              changelog: "Update seed sample template",
            },
          },
        },
      });
      console.log(`Updated: ${item.name}`);
      continue;
    }

    await prisma.template.create({
      data: {
        name: item.name,
        type: item.type,
        html: item.html,
        css: item.css,
        Versions: {
          create: {
            version: 1,
            html: item.html,
            css: item.css,
            changelog: "Seed sample template",
          },
        },
      },
    });

    console.log(`Created: ${item.name}`);
  }
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
