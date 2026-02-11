import { prisma } from "../src/services/prisma.js";

const name = "ALL_강사소개_샘플";
const type = "instructor_profile";

const html = `<div class="page">
  <header class="hero">
    <div class="hero__top">
      <div>
        <div class="hero__label">INSTRUCTOR PROFILE</div>
        <h1>{{instructor.name}}</h1>
        <p class="hero__title">{{instructor.title}}</p>
      </div>
      {{#if instructor.avatarUrl}}
        <div class="hero__avatar-wrap">
          <img class="hero__avatar" src="{{instructor.avatarUrl}}" alt="{{instructor.name}}" />
        </div>
      {{/if}}
    </div>
    <p class="hero__bio">{{instructor.bio}}</p>
  </header>

  <section class="card">
    <h2>기본 정보</h2>
    <div class="grid grid-2">
      <div><span class="k">이름</span><span class="v">{{instructor.name}}</span></div>
      <div><span class="k">직함</span><span class="v">{{instructor.title}}</span></div>
      <div><span class="k">이메일</span><span class="v">{{instructor.email}}</span></div>
      <div><span class="k">전화번호</span><span class="v">{{instructor.phone}}</span></div>
      <div><span class="k">소속</span><span class="v">{{instructor.affiliation}}</span></div>
      <div><span class="k">웹사이트</span><span class="v">{{instructorProfile.website}}</span></div>
    </div>
  </section>

  <section class="card">
    <h2>전문 분야</h2>
    <div class="chips">
      {{#if instructor.specialties}}
        {{#each instructor.specialties}}
          <span class="chip">{{this}}</span>
        {{/each}}
      {{else}}
        <span class="muted">등록된 전문 분야가 없습니다.</span>
      {{/if}}
    </div>
  </section>

  <section class="card">
    <h2>학위</h2>
    <table>
      <thead>
        <tr>
          <th>No</th><th>학위</th><th>학교</th><th>전공</th><th>연도</th>
        </tr>
      </thead>
      <tbody>
        {{#if instructor.degrees}}
          {{#each instructor.degrees}}
            <tr>
              <td>{{plus1 @index}}</td>
              <td>{{this.name}}</td>
              <td>{{this.school}}</td>
              <td>{{this.major}}</td>
              <td>{{this.year}}</td>
            </tr>
          {{/each}}
        {{else}}
          <tr><td colspan="5" class="empty">등록된 학위 정보가 없습니다.</td></tr>
        {{/if}}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>주요 경력</h2>
    <table>
      <thead>
        <tr>
          <th>No</th><th>회사/기관</th><th>역할</th><th>기간</th><th>설명</th>
        </tr>
      </thead>
      <tbody>
        {{#if instructor.careers}}
          {{#each instructor.careers}}
            <tr>
              <td>{{plus1 @index}}</td>
              <td>{{this.company}}</td>
              <td>{{this.role}}</td>
              <td>{{this.period}}</td>
              <td>{{this.description}}</td>
            </tr>
          {{/each}}
        {{else}}
          <tr><td colspan="5" class="empty">등록된 경력 정보가 없습니다.</td></tr>
        {{/if}}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>출판/논문</h2>
    <table>
      <thead>
        <tr>
          <th>No</th><th>제목</th><th>구분</th><th>연도</th><th>기관</th>
        </tr>
      </thead>
      <tbody>
        {{#if instructor.publications}}
          {{#each instructor.publications}}
            <tr>
              <td>{{plus1 @index}}</td>
              <td>{{this.title}}</td>
              <td>{{this.type}}</td>
              <td>{{this.year}}</td>
              <td>{{this.publisher}}</td>
            </tr>
          {{/each}}
        {{else}}
          <tr><td colspan="5" class="empty">등록된 출판/논문 정보가 없습니다.</td></tr>
        {{/if}}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>자격증</h2>
    <table>
      <thead>
        <tr>
          <th>No</th><th>자격증명</th><th>발급기관</th><th>취득일</th>
        </tr>
      </thead>
      <tbody>
        {{#if instructor.certifications}}
          {{#each instructor.certifications}}
            <tr>
              <td>{{plus1 @index}}</td>
              <td>{{this.name}}</td>
              <td>{{this.issuer}}</td>
              <td>{{this.date}}</td>
            </tr>
          {{/each}}
        {{else}}
          <tr><td colspan="4" class="empty">등록된 자격증 정보가 없습니다.</td></tr>
        {{/if}}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>추가 링크</h2>
    <ul class="links">
      {{#if instructor.links}}
        {{#each instructor.links}}
          <li><strong>{{this.label}}</strong> - {{this.url}}</li>
        {{/each}}
      {{else if instructorProfile.links}}
        {{#each instructorProfile.links}}
          <li><strong>{{this.label}}</strong> - {{this.url}}</li>
        {{/each}}
      {{else}}
        <li class="empty">등록된 링크가 없습니다.</li>
      {{/if}}
    </ul>
  </section>

  <section class="card">
    <h2>연결 과정</h2>
    <ul class="list">
      {{#if courses}}
        {{#each courses}}
          <li>{{this.title}}</li>
        {{/each}}
      {{else}}
        <li class="empty">연결된 과정이 없습니다.</li>
      {{/if}}
    </ul>
  </section>

  <section class="card">
    <h2>예정 일정</h2>
    <table>
      <thead>
        <tr>
          <th>No</th><th>일정일</th><th>장소</th><th>대상</th><th>비고</th>
        </tr>
      </thead>
      <tbody>
        {{#if schedules}}
          {{#each schedules}}
            <tr>
              <td>{{plus1 @index}}</td>
              <td>{{this.date}}</td>
              <td>{{this.location}}</td>
              <td>{{this.audience}}</td>
              <td>{{this.remarks}}</td>
            </tr>
          {{/each}}
        {{else}}
          <tr><td colspan="5" class="empty">등록된 일정이 없습니다.</td></tr>
        {{/if}}
      </tbody>
    </table>
  </section>
</div>`;

const css = `@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #eef2ff; color: #111827; }

.page {
  width: 210mm;
  min-height: 297mm;
  margin: 10mm auto;
  padding: 14mm;
  background: #fff;
  font-family: 'Pretendard','Noto Sans KR',sans-serif;
  color: #0f172a;
}

.hero {
  border: 2px solid #0f172a;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 14px;
  background: linear-gradient(130deg,#e0f2fe 0%,#ede9fe 55%,#fef3c7 100%);
}
.hero__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.hero__label {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.16em;
  font-weight: 800;
  color: #fff;
  background: #0f172a;
  padding: 4px 10px;
  border-radius: 999px;
}
h1 { margin: 10px 0 6px; font-size: 30px; line-height: 1.2; }
.hero__title { margin: 0; font-size: 16px; font-weight: 700; color: #1d4ed8; }
.hero__bio { margin: 10px 0 0; font-size: 13px; line-height: 1.6; color: #334155; }
.hero__avatar-wrap {
  width: 92px;
  height: 92px;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid #cbd5e1;
  background: #fff;
  flex: 0 0 92px;
}
.hero__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: #ffffff;
}
h2 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  border-left: 4px solid #2563eb;
  padding-left: 8px;
}

.grid { display: grid; gap: 8px 12px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.k { display: block; font-size: 11px; color: #64748b; margin-bottom: 2px; }
.v { display: block; font-size: 13px; font-weight: 600; color: #0f172a; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
}

table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border: 1px solid #dbe3ee; padding: 7px 8px; vertical-align: top; }
th { background: #f8fafc; color: #334155; font-weight: 700; text-align: left; }
.empty { color: #94a3b8; text-align: center; }

.links, .list { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.7; }
.muted { color: #94a3b8; font-size: 12px; }

@media print {
  html, body { background: #fff; }
  .page { margin: 0; width: 100%; min-height: auto; padding: 12mm; }
}`;

async function main() {
  const existing = await prisma.template.findFirst({
    where: { name, type },
    include: {
      Versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!existing) {
    const created = await prisma.template.create({
      data: {
        name,
        type,
        html,
        css,
        Versions: {
          create: {
            version: 1,
            html,
            css,
            changelog: "ALL instructor profile sample",
          },
        },
      },
    });
    console.log(`Created template: ${created.id} (${created.name})`);
    return;
  }

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
          changelog: "Refresh ALL instructor profile sample",
        },
      },
    },
  });
  console.log(
    `Updated template: ${updated.id} (${updated.name}) to version ${nextVersion}`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed ALL instructor template:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
