import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NAME = "과정 소개 All버젼";
const TYPE = "course_intro";

const html = `<div class="course-sheet">
  <header class="hero">
    <div class="hero-badge">ALL VERSION</div>
    <h1>{{course.title}}</h1>
    <p class="desc">{{course.description}}</p>
    <div class="meta-row">
      <span class="pill">총 {{course.durationHours}}시간</span>
      <span class="pill">{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</span>
      <span class="pill">등록자 {{course.createdBy}}</span>
    </div>
  </header>

  <section class="panel">
    <h2>교육 목표</h2>
    <p>{{course.goal}}</p>
  </section>

  <section class="panel">
    <h2>교육 내용</h2>
    {{#if course.content}}
      <div class="content-box">{{course.content}}</div>
    {{else}}
      {{#if content}}
        <div class="content-box">{{content}}</div>
      {{else}}
        <div class="empty">등록된 교육 내용이 없습니다.</div>
      {{/if}}
    {{/if}}
  </section>

  <section class="panel">
    <h2>강의 모듈</h2>
    {{#if lectures.length}}
      <ol class="module-list">
        {{#each lectures}}
          <li>
            <div class="module-head">
              <strong>{{#if this.order}}{{this.order}}{{else}}{{plus1 @index}}{{/if}}. {{this.title}}</strong>
              <span class="chip">{{this.hours}}h</span>
            </div>
            <p>{{this.description}}</p>
          </li>
        {{/each}}
      </ol>
    {{else}}
      <div class="empty">등록된 강의가 없습니다.</div>
    {{/if}}
  </section>

  <section class="panel two-col">
    <div>
      <h2>강사진</h2>
      {{#if instructors.length}}
        <ul class="clean-list">
          {{#each instructors}}
            <li><strong>{{this.name}}</strong> {{#if this.title}}<span class="muted">- {{this.title}}</span>{{/if}}</li>
          {{/each}}
        </ul>
      {{else}}
        <div class="empty">배정된 강사가 없습니다.</div>
      {{/if}}
    </div>

    <div>
      <h2>필요 장비</h2>
      {{#if course.equipment.length}}
        <div class="equip-wrap">
          {{#each course.equipment}}
            <span class="chip alt">{{this}}</span>
          {{/each}}
        </div>
      {{else}}
        <div class="empty">별도 장비 없음</div>
      {{/if}}
    </div>
  </section>

  <section class="panel">
    <h2>운영 일정</h2>
    {{#if schedules.length}}
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>일시</th>
            <th>장소</th>
            <th>대상</th>
            <th>강사</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {{#each schedules}}
            <tr>
              <td>{{plus1 @index}}</td>
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
      <div class="empty">등록된 일정이 없습니다.</div>
    {{/if}}
  </section>

  <section class="panel">
    <h2>비고</h2>
    <p>{{course.notes}}</p>
  </section>
</div>`;

const css = `:root {
  --ink: #10243d;
  --muted: #61758a;
  --line: #d9e2ec;
  --bg: #f4f8ff;
  --card: #ffffff;
  --accent-a: #00c2ff;
  --accent-b: #ff4f9a;
  --accent-c: #ffd166;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 28px;
  color: var(--ink);
  background:
    radial-gradient(circle at 90% -10%, rgba(255,79,154,.18), transparent 35%),
    radial-gradient(circle at 5% 5%, rgba(0,194,255,.18), transparent 30%),
    var(--bg);
  font-family: "Pretendard", "SUIT", "Noto Sans KR", sans-serif;
}
.course-sheet { max-width: 980px; margin: 0 auto; display: grid; gap: 16px; }
.hero {
  background: linear-gradient(120deg, #0ea5e9 0%, #6366f1 45%, #ec4899 100%);
  color: #fff;
  border-radius: 22px;
  padding: 28px;
  box-shadow: 0 14px 34px rgba(17, 24, 39, 0.2);
}
.hero h1 { margin: 10px 0 8px; font-size: 34px; letter-spacing: -.02em; }
.hero .desc { margin: 0 0 14px; opacity: .95; white-space: pre-wrap; line-height: 1.6; }
.hero-badge {
  display: inline-block;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: .08em;
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.32);
  border-radius: 999px;
  padding: 6px 10px;
}
.meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.35);
}
.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 8px 20px rgba(10, 41, 77, 0.06);
}
.panel h2 {
  margin: 0 0 12px;
  font-size: 18px;
  letter-spacing: -.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel h2::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(120deg, var(--accent-a), var(--accent-b));
}
.panel p { margin: 0; line-height: 1.75; white-space: pre-wrap; }
.content-box {
  background: linear-gradient(180deg, #f0f9ff, #eef2ff);
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  padding: 12px 14px;
}
.module-list { margin: 0; padding-left: 18px; display: grid; gap: 10px; }
.module-list li { padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: #fbfdff; }
.module-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  font-size: 11px;
  font-weight: 800;
  color: #0f172a;
  background: linear-gradient(120deg, #67e8f9, #f9a8d4);
  border-radius: 999px;
  padding: 5px 10px;
}
.chip.alt { background: linear-gradient(120deg, #fde68a, #86efac); margin: 0 6px 6px 0; }
.clean-list { margin: 0; padding-left: 18px; line-height: 1.8; }
.equip-wrap { display: flex; flex-wrap: wrap; }
.muted { color: var(--muted); font-weight: 500; }
.empty {
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 13px;
}
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
thead th {
  background: linear-gradient(120deg, #e0f2fe, #ede9fe);
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
}
tbody td {
  font-size: 12px;
  padding: 9px 8px;
  border-bottom: 1px solid #edf2f7;
  color: #1e293b;
}
tbody tr:nth-child(even) td { background: #fbfdff; }
@media (max-width: 760px) {
  body { padding: 12px; }
  .hero h1 { font-size: 26px; }
  .two-col { grid-template-columns: 1fr; }
}`;

async function main() {
  const existing = await prisma.template.findFirst({
    where: { name: NAME, type: TYPE, deletedAt: null },
    include: { Versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (existing) {
    const nextVersion = (existing.Versions[0]?.version || 0) + 1;
    const updated = await prisma.template.update({
      where: { id: existing.id },
      data: {
        html,
        css,
        Versions: {
          create: {
            version: nextVersion,
            html,
            css,
            changelog: "Vivid all-content redesign",
          },
        },
      },
    });
    console.log(
      JSON.stringify(
        {
          action: "updated",
          id: updated.id,
          name: updated.name,
          version: nextVersion,
        },
        null,
        2,
      ),
    );
    return;
  }

  const created = await prisma.template.create({
    data: {
      name: NAME,
      type: TYPE,
      html,
      css,
      Versions: {
        create: {
          version: 1,
          html,
          css,
          changelog: "Initial vivid all-content template",
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        action: "created",
        id: created.id,
        name: created.name,
        version: 1,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
