import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Variant = {
  name: string;
  html: string;
  css: string;
};

const variants: Variant[] = [
  {
    name: "과정 소개 All버젼 1",
    html: `<div class="v1-wrap">
  <header class="v1-hero">
    <p class="eyebrow">COURSE INTRO</p>
    <h1>{{course.title}}</h1>
    <p class="desc">{{course.description}}</p>
    <div class="meta">
      <span>총 {{course.durationHours}}시간</span>
      <span>{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</span>
      <span>등록자 {{course.createdBy}}</span>
    </div>
  </header>

  <section class="card">
    <h2>교육 목표</h2>
    <p>{{course.goal}}</p>
  </section>

  <section class="card">
    <h2>교육 내용</h2>
    {{#if course.content}}
    <p>{{course.content}}</p>
    {{else}}
      {{#if content}}<p>{{content}}</p>{{else}}<p>교육 내용 없음</p>{{/if}}
    {{/if}}
  </section>

  <section class="card">
    <h2>강의 모듈</h2>
    <ul class="modules">
      {{#each lectures}}
      <li><strong>{{#if this.order}}{{this.order}}{{else}}{{plus1 @index}}{{/if}}. {{this.title}}</strong><em>{{this.hours}}h</em><p>{{this.description}}</p></li>
      {{/each}}
    </ul>
  </section>

  <section class="grid">
    <article class="card">
      <h2>강사진</h2>
      <ul>{{#each instructors}}<li>{{this.name}}</li>{{/each}}</ul>
    </article>
    <article class="card">
      <h2>필요 장비</h2>
      <div class="chips">{{#each course.equipment}}<span>{{this}}</span>{{/each}}</div>
    </article>
  </section>

  <section class="card">
    <h2>운영 일정</h2>
    <table>
      <thead><tr><th>No</th><th>일시</th><th>장소</th><th>대상</th><th>강사</th><th>비고</th></tr></thead>
      <tbody>
        {{#each schedules}}
        <tr><td>{{plus1 @index}}</td><td>{{this.date}}</td><td>{{this.location}}</td><td>{{this.audience}}</td><td>{{this.Instructor.name}}</td><td>{{this.remarks}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </section>

  <section class="card"><h2>비고</h2><p>{{course.notes}}</p></section>
</div>`,
    css: `body{margin:0;padding:24px;background:#f6f8ff;color:#1b2a41;font-family:"Pretendard","SUIT","Noto Sans KR",sans-serif}
.v1-wrap{max-width:980px;margin:0 auto;display:grid;gap:14px}
.v1-hero{padding:26px;border-radius:20px;color:#fff;background:linear-gradient(120deg,#00c2ff,#4f46e5 55%,#ff4f9a);box-shadow:0 10px 30px rgba(0,0,0,.2)}
.eyebrow{margin:0;font-size:12px;letter-spacing:.12em;font-weight:800;opacity:.9}
h1{margin:8px 0 6px;font-size:34px}
.desc{margin:0 0 10px;opacity:.95;white-space:pre-wrap}
.meta{display:flex;gap:8px;flex-wrap:wrap}.meta span{padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.2);font-size:12px}
.card{background:#fff;border:1px solid #d9e2ec;border-radius:16px;padding:16px}
h2{margin:0 0 10px;font-size:18px}.card p{margin:0;line-height:1.7;white-space:pre-wrap}
.modules{margin:0;padding-left:18px;display:grid;gap:8px}.modules li{background:#fbfdff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
.modules em{float:right;font-style:normal;font-weight:700;color:#334155}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.chips span{display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#e0f2fe;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e8f0;padding:8px}th{background:#eef2ff}
@media (max-width:760px){.grid{grid-template-columns:1fr}h1{font-size:28px}}`,
  },
  {
    name: "과정 소개 All버젼 2",
    html: `<div class="v2">
  <aside class="left">
    <div class="stamp">02</div>
    <h1>{{course.title}}</h1>
    <p>{{course.description}}</p>
    <dl>
      <dt>시간</dt><dd>{{course.durationHours}}시간</dd>
      <dt>형태</dt><dd>{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</dd>
      <dt>등록자</dt><dd>{{course.createdBy}}</dd>
    </dl>
  </aside>

  <main class="right">
    <section><h2>교육 목표</h2><p>{{course.goal}}</p></section>
    <section><h2>교육 내용</h2>{{#if course.content}}<p>{{course.content}}</p>{{else}}{{#if content}}<p>{{content}}</p>{{/if}}{{/if}}</section>
    <section><h2>강의 모듈</h2><ol>{{#each lectures}}<li><strong>{{this.title}}</strong> <span>{{this.hours}}h</span><p>{{this.description}}</p></li>{{/each}}</ol></section>
    <section class="split">
      <div><h2>강사진</h2><ul>{{#each instructors}}<li>{{this.name}}</li>{{/each}}</ul></div>
      <div><h2>필요 장비</h2><ul>{{#each course.equipment}}<li>{{this}}</li>{{/each}}</ul></div>
    </section>
    <section><h2>운영 일정</h2><ul class="timeline">{{#each schedules}}<li><b>{{this.date}}</b><p>{{this.location}} / {{this.audience}} / {{this.Instructor.name}}</p><small>{{this.remarks}}</small></li>{{/each}}</ul></section>
    <section><h2>비고</h2><p>{{course.notes}}</p></section>
  </main>
</div>`,
    css: `body{margin:0;background:#fffaf2;color:#2b2118;padding:0;font-family:"NanumSquare Neo","Pretendard","Noto Sans KR",sans-serif}
.v2{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:320px 1fr;min-height:100vh}
.left{background:linear-gradient(180deg,#ff7b00,#ff2d55);color:#fff;padding:26px;position:sticky;top:0;height:100vh}
.stamp{width:52px;height:52px;border:2px solid rgba(255,255,255,.7);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800}
.left h1{font-size:30px;margin:14px 0 10px;line-height:1.2}.left p{line-height:1.6;white-space:pre-wrap}
dl{margin:20px 0 0;display:grid;grid-template-columns:1fr;gap:8px}dt{font-size:11px;opacity:.85}dd{margin:0;font-weight:700}
.right{padding:28px;display:grid;gap:18px}
section{background:#fff;border:2px solid #f7d8b6;border-radius:14px;padding:16px}
h2{margin:0 0 10px;font-size:18px;color:#a83b00}
p{margin:0;line-height:1.7;white-space:pre-wrap}
ol,ul{margin:0;padding-left:18px}
ol li{margin-bottom:8px}ol li span{float:right;font-weight:800;color:#ff2d55}
.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.timeline{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.timeline li{background:#fff3e6;border:1px solid #ffd5b0;border-radius:10px;padding:10px}
.timeline b{display:block;color:#7c2d12}
@media (max-width:860px){.v2{grid-template-columns:1fr}.left{position:relative;height:auto}.split{grid-template-columns:1fr}}`,
  },
  {
    name: "과정 소개 All버젼 3",
    html: `<div class="v3">
  <div class="frame">
    <header>
      <p class="kicker">COURSE DOSSIER / V3</p>
      <h1>{{course.title}}</h1>
      <p>{{course.description}}</p>
      <div class="badges"><span>{{course.durationHours}}h</span><span>{{#if course.isOnline}}ONLINE{{else}}OFFLINE{{/if}}</span><span>{{course.createdBy}}</span></div>
    </header>

    <section class="blocks">
      <article><h2>교육 목표</h2><p>{{course.goal}}</p></article>
      <article><h2>교육 내용</h2>{{#if course.content}}<p>{{course.content}}</p>{{else}}{{#if content}}<p>{{content}}</p>{{/if}}{{/if}}</article>
      <article><h2>강의 모듈</h2><div class="mod-grid">{{#each lectures}}<div><b>{{this.title}}</b><small>{{this.hours}}h</small><p>{{this.description}}</p></div>{{/each}}</div></article>
      <article><h2>강사진</h2><p>{{#each instructors}}# {{this.name}} {{/each}}</p></article>
      <article><h2>필요 장비</h2><p>{{#each course.equipment}}[{{this}}] {{/each}}</p></article>
      <article><h2>운영 일정</h2><p>{{#each schedules}}• {{this.date}} | {{this.location}} | {{this.Instructor.name}} | {{this.audience}} | {{this.remarks}}\n{{/each}}</p></article>
      <article><h2>비고</h2><p>{{course.notes}}</p></article>
    </section>
  </div>
</div>`,
    css: `body{margin:0;padding:20px;background:#0d1117;color:#e6edf3;font-family:"IBM Plex Sans KR","SUIT","Noto Sans KR",sans-serif}
.v3{max-width:1024px;margin:0 auto}
.frame{position:relative;padding:22px;border:1px solid #30363d;border-radius:18px;background:
linear-gradient(180deg,rgba(56,139,253,.14),rgba(238,90,36,.08)),
repeating-linear-gradient(0deg,transparent,transparent 22px,rgba(255,255,255,.03) 23px)}
header{padding:14px;border:1px solid #30363d;border-radius:12px;background:rgba(13,17,23,.75)}
.kicker{margin:0;color:#7ee787;font-size:12px;letter-spacing:.12em}.badges{display:flex;gap:8px;flex-wrap:wrap}
.badges span{font-size:11px;padding:4px 9px;border-radius:999px;border:1px solid #3d444d;background:#161b22}
h1{margin:8px 0 8px;font-size:32px;letter-spacing:-.02em;color:#f0f6fc}p{margin:0;line-height:1.72;white-space:pre-wrap}
.blocks{display:grid;gap:12px;margin-top:12px}
article{padding:14px;border-radius:12px;border:1px solid #30363d;background:rgba(22,27,34,.75);backdrop-filter: blur(1px)}
h2{margin:0 0 9px;font-size:16px;color:#79c0ff}
.mod-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mod-grid > div{border:1px dashed #3d444d;border-radius:10px;padding:10px;background:#0d1117}
.mod-grid b{display:block;color:#ffa657}.mod-grid small{color:#a5d6ff}
@media (max-width:760px){.mod-grid{grid-template-columns:1fr}h1{font-size:26px}}`,
  },
];

async function upsertOne(variant: Variant) {
  const existing = await prisma.template.findFirst({
    where: { name: variant.name, type: "course_intro", deletedAt: null },
    include: { Versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (existing) {
    const nextVersion = (existing.Versions[0]?.version || 0) + 1;
    const updated = await prisma.template.update({
      where: { id: existing.id },
      data: {
        html: variant.html,
        css: variant.css,
        Versions: {
          create: {
            version: nextVersion,
            html: variant.html,
            css: variant.css,
            changelog: "Style refresh for all-version set",
          },
        },
      },
    });
    return { action: "updated", id: updated.id, name: updated.name, version: nextVersion };
  }

  const created = await prisma.template.create({
    data: {
      name: variant.name,
      type: "course_intro",
      html: variant.html,
      css: variant.css,
      Versions: {
        create: {
          version: 1,
          html: variant.html,
          css: variant.css,
          changelog: "Initial all-version variant",
        },
      },
    },
  });
  return { action: "created", id: created.id, name: created.name, version: 1 };
}

async function main() {
  const results = [];
  for (const variant of variants) {
    results.push(await upsertOne(variant));
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
