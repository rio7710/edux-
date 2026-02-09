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

const courseHtml2 = `<div class="course-doc">
  <div class="doc-header">
    <div>
      <div class="doc-label">과정 소개서</div>
      <h1>{{course.title}}</h1>
      <p class="subtitle">{{course.description}}</p>
    </div>
    <div class="doc-meta">
      <div class="meta-box">
        <div class="meta-label">교육 시간</div>
        <div class="meta-value">{{course.durationHours}}시간</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">온라인 여부</div>
        <div class="meta-value">{{#if course.isOnline}}온라인{{else}}오프라인{{/if}}</div>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>교육 목표</h2>
      <p>{{course.goal}}</p>
    </div>
    <div class="card">
      <h2>강사</h2>
      <ul>
        {{#each instructors}}
        <li>{{this.name}}</li>
        {{/each}}
      </ul>
    </div>
  </div>

  <div class="card">
    <h2>교육 내용</h2>
    <div class="lesson-grid">
      {{#each lectures}}
      <div class="lesson">
        <div class="lesson-title">{{this.title}}</div>
        <div class="lesson-desc">{{this.description}}</div>
        <div class="lesson-hours">{{this.hours}}시간</div>
      </div>
      {{/each}}
    </div>
  </div>
</div>`;

const courseCss2 = `.course-doc {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 820px;
  margin: 0 auto;
  padding: 36px;
  color: #1f2a37;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border: 2px solid #111827;
  padding: 20px;
  border-radius: 12px;
}

.doc-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
}

h1 {
  margin: 8px 0 6px;
  font-size: 28px;
}

.subtitle {
  margin: 0;
  color: #4b5563;
}

.doc-meta {
  display: grid;
  gap: 12px;
  min-width: 180px;
}

.meta-box {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
  background: #f9fafb;
}

.meta-label {
  font-size: 12px;
  color: #6b7280;
}

.meta-value {
  font-weight: 700;
  margin-top: 4px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}

.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  background: #fff;
}

.lesson-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.lesson {
  border: 1px dashed #cbd5f5;
  border-radius: 10px;
  padding: 10px 12px;
}

.lesson-title {
  font-weight: 600;
}

.lesson-desc {
  color: #4b5563;
  font-size: 12px;
  margin-top: 4px;
}

.lesson-hours {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
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
