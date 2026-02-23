import { Tabs, Alert, message, Card, Button, Space, Tag, Row, Col, Typography, Checkbox, Segmented } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TemplatesPage from './TemplatesPage';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';

const courseHtml = `<div class="course-intro">
  <h1>{{course.title}}</h1>
  <p>{{course.description}}</p>
  <p>교육 시간: {{course.durationHours}}시간</p>

  <h2>교육 목표</h2>
  <p>{{course.goal}}</p>

  <h2>강사</h2>
  <ul>
    {{#each instructors}}
    <li>{{this.name}}</li>
    {{/each}}
  </ul>

  <h2>교육 내용</h2>
  <p>{{course.content}}</p>
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

const instructorSample1Html = `<div class="instructor-site">
  <header class="hero">
    <nav class="hero-nav">
      <a href="/">홈</a>
      <a href="/instructors">강사</a>
      <a href="/courses">과정</a>
    </nav>
    <p class="badge">INSTRUCTOR SAMPLE 01</p>
    <h1>{{instructor.name}}</h1>
    <p class="summary">{{instructor.title}}</p>
  </header>
  <section class="panel">
    <h2>기본 정보</h2>
    <ul>
      <li>이메일: {{instructor.email}}</li>
      <li>전화: {{instructor.phone}}</li>
      <li>소속: {{instructor.affiliation}}</li>
    </ul>
  </section>
  <section class="panel">
    <h2>소개</h2>
    <p>{{instructor.bio}}</p>
  </section>
  <section class="panel">
    <h2>전문 분야</h2>
    <p>{{instructor.specialties}}</p>
  </section>
  <section class="panel">
    <h2>연결 과정</h2>
    <ul>
      {{#each courses}}
      <li><a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></li>
      {{/each}}
    </ul>
  </section>
</div>`;

const instructorSample1Css = `.instructor-site{font-family:'Noto Sans KR',sans-serif;color:#0f172a;background:#f8fafc;padding:10px}
.hero{padding:22px;border-radius:14px;background:linear-gradient(135deg,#0f172a,#1e40af 60%,#06b6d4);color:#dbeafe;margin-bottom:12px}
.hero-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.hero-nav a{font-size:12px;color:#dbeafe;text-decoration:none;padding:5px 8px;border:1px solid rgba(255,255,255,.24);border-radius:8px}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:700;letter-spacing:.08em}
h1{margin:8px 0 6px;font-size:32px;color:inherit}
.summary{margin:0}
.panel{padding:18px;border:1px solid #dbe4f0;border-radius:12px;background:#fff;margin-bottom:10px}
.panel h2{margin:0 0 8px;color:#0b3b70}
.panel a{color:#1d4ed8;text-decoration:none;border-bottom:1px dashed #60a5fa}
.panel a:hover{text-decoration:underline}
.panel ul{line-height:1.8}`;

const courseSample1Html = `<div class="course-site">
  <header class="hero">
    <nav class="hero-nav">
      <a href="/">홈</a>
      <a href="/courses">과정</a>
      <a href="/instructors">강사</a>
    </nav>
    <p class="badge">COURSE SAMPLE 01</p>
    <h1>{{course.title}}</h1>
    <p class="summary">{{course.description}}</p>
    <p class="meta">총 시간 {{course.durationHours}}시간</p>
  </header>
  <section class="panel">
    <h2>학습 목표</h2>
    <p>{{course.goal}}</p>
  </section>
  <section class="panel">
    <h2>과정 개요</h2>
    <p>{{content}}</p>
  </section>
  <section class="panel">
    <h2>강사</h2>
    <ul>
      {{#each instructors}}
      <li><a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a> {{this.title}}</li>
      {{/each}}
    </ul>
  </section>
  <section class="panel">
    <h2>강의 모듈</h2>
    <ol>
      {{#each modules}}
      <li>{{this.title}} ({{this.hours}}시간)</li>
      {{/each}}
    </ol>
  </section>
</div>`;

const courseSample1Css = `.course-site{font-family:'Noto Sans KR',sans-serif;color:#0f172a;background:#f8fafc;padding:10px}
.hero{padding:22px;border-radius:14px;background:linear-gradient(135deg,#0f172a,#1d4ed8 60%,#22d3ee);color:#dbeafe;margin-bottom:12px}
.hero-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.hero-nav a{font-size:12px;color:#dbeafe;text-decoration:none;padding:5px 8px;border:1px solid rgba(255,255,255,.24);border-radius:8px}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:700;letter-spacing:.08em}
h1{margin:8px 0 6px;font-size:32px;color:inherit}
.summary{margin:0}
.meta{font-weight:700;margin-top:8px}
.panel{padding:18px;border:1px solid #dbe4f0;border-radius:12px;background:#fff;margin-bottom:10px}
.panel h2{margin:0 0 8px;color:#0b3b70}
.panel a{color:#1d4ed8;text-decoration:none;border-bottom:1px dashed #60a5fa}
.panel a:hover{text-decoration:underline}`;

const brochureCourseInstructorHtml = `<div class="brochure">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/courses">과정 페이지</a>
    <a href="/instructors">강사 페이지</a>
    <a href="#courses">브로셔-강의</a>
    <a href="#instructors">브로셔-강사</a>
  </nav>
  <section class="cover page">
    <p class="kicker">COURSE + INSTRUCTOR</p>
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>

  <section id="courses" class="toc page">
    <h2>강의 목차</h2>
    <ul>
      {{#each courses}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.title}}</a></li>
      {{/each}}
    </ul>
  </section>

  {{#each courses}}
  <section id="course-{{this.id}}" class="page">
    <h2>
      강의 {{plus1 @index}}.
      <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a>
    </h2>
    <p>{{this.description}}</p>
  </section>
  {{/each}}

  <section id="instructors" class="toc page">
    <h2>강사 목차</h2>
    <ul>
      {{#each instructors}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.name}}</a></li>
      {{/each}}
    </ul>
  </section>

  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="page">
    <h2>
      강사 {{plus1 @index}}.
      <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a>
    </h2>
    <p class="subtitle">{{this.title}}</p>
    <p>{{this.bio}}</p>
  </section>
  {{/each}}
</div>`;

const brochureCourseInstructorCss = `.brochure{font-family:'Noto Sans KR',sans-serif;color:#0f172a}
.top-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;margin:0 0 10px;background:#0f172a;border-radius:10px}
.top-nav a{color:#e2e8f0;text-decoration:none;font-size:12px;padding:6px 8px;border:1px solid #334155;border-radius:8px}
.top-nav a:hover{background:#1e293b}
.page{padding:28px;border:1px solid #dbe4f0;border-radius:12px;margin:0 0 16px;background:#fff}
.toc ul{margin:8px 0 0;padding-left:18px;line-height:1.9}
.cover{background:linear-gradient(120deg,#e0f2fe,#fef9c3)}
.kicker{font-size:11px;font-weight:700;letter-spacing:.08em;color:#0f3a74}
h1{margin:0 0 10px;font-size:34px}
h2{margin:0 0 8px;font-size:24px;color:#0b3b70}
.subtitle{font-weight:700;color:#334155}
.entity-link{color:#0b3b70;text-decoration:none;border-bottom:1px dashed #60a5fa}
.entity-link:hover{text-decoration:underline}
@media print{.page{break-after:page}.page:last-child{break-after:auto}}`;

const brochureInstructorCourseHtml = `<div class="brochure v2">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/instructors">강사 페이지</a>
    <a href="/courses">과정 페이지</a>
    <a href="#instructors">브로셔-강사</a>
    <a href="#courses">브로셔-강의</a>
  </nav>
  <header class="hero page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </header>

  <section id="instructors" class="panel page">
    <h2>강사 목차</h2>
    <ul>
      {{#each instructors}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.name}}</a></li>
      {{/each}}
    </ul>
  </section>

  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="panel page">
    <h2>
      강사 {{plus1 @index}}.
      <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a>
    </h2>
    <div class="meta">{{this.title}}</div>
    <p>{{this.bio}}</p>
  </section>
  {{/each}}

  <section id="courses" class="panel page">
    <h2>강의 목차</h2>
    <ul>
      {{#each courses}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.title}}</a></li>
      {{/each}}
    </ul>
  </section>

  {{#each courses}}
  <section id="course-{{this.id}}" class="panel page">
    <h2>
      강의 {{plus1 @index}}.
      <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a>
    </h2>
    <p>{{this.description}}</p>
    <p class="meta">총 시간: {{this.durationHours}}시간</p>
  </section>
  {{/each}}
</div>`;

const brochureInstructorCourseCss = `.brochure.v2{font-family:'Noto Sans KR',sans-serif;color:#111827}
.top-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;margin:0 0 10px;background:#052e16;border-radius:10px}
.top-nav a{color:#ecfccb;text-decoration:none;font-size:12px;padding:6px 8px;border:1px solid #14532d;border-radius:8px}
.top-nav a:hover{background:#14532d}
.hero{padding:28px;border-radius:16px;background:#111827;color:#f9fafb;margin-bottom:16px}
.panel{padding:22px;border-left:6px solid #22c55e;background:#f8fafc;border-radius:10px;margin-bottom:14px}
h1{margin:0 0 10px;font-size:32px}
h2{margin:0 0 8px;font-size:22px}
.meta{color:#475569;font-weight:700}
.entity-link{color:#14532d;text-decoration:none;border-bottom:1px dashed #22c55e}
.entity-link:hover{text-decoration:underline}
@media print{.page{break-after:page}.page:last-child{break-after:auto}}`;

const brochureInstructorOnlyHtml = `<div class="brochure v3">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/instructors">강사 페이지</a>
    <a href="#instructors">브로셔-강사</a>
  </nav>
  <section class="cover page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>
  <section id="instructors" class="profile page">
    <h2>강사 목차</h2>
    <ul>
      {{#each instructors}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.name}}</a></li>
      {{/each}}
    </ul>
  </section>
  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="profile page">
    <h2><a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
    <p class="role">{{this.title}}</p>
    <p>{{this.bio}}</p>
    <ul>
      <li>이메일: {{this.email}}</li>
      <li>전화: {{this.phone}}</li>
      <li>소속: {{this.affiliation}}</li>
    </ul>
  </section>
  {{/each}}
</div>`;

const brochureInstructorOnlyCss = `.brochure.v3{font-family:'Noto Sans KR',sans-serif}
.top-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;margin:0 0 10px;background:#1e3a8a;border-radius:10px}
.top-nav a{color:#dbeafe;text-decoration:none;font-size:12px;padding:6px 8px;border:1px solid #60a5fa;border-radius:8px}
.top-nav a:hover{background:#1d4ed8}
.cover{padding:24px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin-bottom:16px}
.profile{padding:20px;border:1px dashed #94a3b8;border-radius:10px;margin-bottom:14px;background:#fff}
h1{margin:0 0 8px;font-size:30px;color:#1e3a8a}
h2{margin:0 0 6px;font-size:24px;color:#0f172a}
.role{font-weight:700;color:#1d4ed8}
.entity-link{color:#0f172a;text-decoration:none;border-bottom:1px dashed #93c5fd}
.entity-link:hover{text-decoration:underline}
ul{margin:12px 0 0;padding-left:18px;line-height:1.8}
@media print{.page{break-after:page}.page:last-child{break-after:auto}}`;

const brochureCourseOnlyHtml = `<div class="brochure v4">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/courses">과정 페이지</a>
    <a href="#courses">브로셔-강의</a>
  </nav>
  <section class="intro page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>
  <section id="courses" class="course page">
    <h2>강의 목차</h2>
    <ul>
      {{#each courses}}
      <li><a class="entity-link" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{plus1 @index}}. {{this.title}}</a></li>
      {{/each}}
    </ul>
  </section>
  {{#each courses}}
  <section id="course-{{this.id}}" class="course page">
    <h2>{{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
    <p>{{this.description}}</p>
    <div class="meta">총 시간: {{this.durationHours}}시간</div>
    <div class="goal">{{this.goal}}</div>
  </section>
  {{/each}}
</div>`;

const brochureCourseOnlyCss = `.brochure.v4{font-family:'Noto Sans KR',sans-serif;color:#1f2937}
.top-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;margin:0 0 10px;background:#0f766e;border-radius:10px}
.top-nav a{color:#ecfeff;text-decoration:none;font-size:12px;padding:6px 8px;border:1px solid #14b8a6;border-radius:8px}
.top-nav a:hover{background:#0d9488}
.intro{padding:24px;border-radius:14px;background:linear-gradient(120deg,#dcfce7,#ecfeff);margin-bottom:16px}
.course{padding:20px;border:1px solid #d1d5db;border-radius:12px;margin-bottom:12px;background:#fff}
h1{margin:0 0 8px;font-size:32px;color:#065f46}
h2{margin:0 0 8px;font-size:22px}
.meta{font-weight:700;color:#0369a1;margin-top:8px}
.entity-link{color:#0f766e;text-decoration:none;border-bottom:1px dashed #22d3ee}
.entity-link:hover{text-decoration:underline}
.goal{margin-top:10px;padding:10px;border-radius:8px;background:#f8fafc}
@media print{.page{break-after:page}.page:last-child{break-after:auto}}`;

const brochureCourseInstructorPagesHtml = `<div class="brochure">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/courses">과정 페이지</a>
    <a href="/instructors">강사 페이지</a>
  </nav>
  <section class="cover page">
    <p class="kicker">EBOOK / COVER + PAGES</p>
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>
  {{#each courses}}
  <section id="course-{{this.id}}" class="page">
    <h2>강의 {{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
    <p>{{this.description}}</p>
  </section>
  {{/each}}
  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="page">
    <h2>강사 {{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
    <p class="subtitle">{{this.title}}</p>
    <p>{{this.bio}}</p>
  </section>
  {{/each}}
</div>`;

const brochureInstructorCoursePagesHtml = `<div class="brochure v2">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/instructors">강사 페이지</a>
    <a href="/courses">과정 페이지</a>
  </nav>
  <header class="hero page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </header>
  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="panel page">
    <h2>강사 {{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
    <div class="meta">{{this.title}}</div>
    <p>{{this.bio}}</p>
  </section>
  {{/each}}
  {{#each courses}}
  <section id="course-{{this.id}}" class="panel page">
    <h2>강의 {{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
    <p>{{this.description}}</p>
    <p class="meta">총 시간: {{this.durationHours}}시간</p>
  </section>
  {{/each}}
</div>`;

const brochureInstructorOnlyPagesHtml = `<div class="brochure v3">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/instructors">강사 페이지</a>
  </nav>
  <section class="cover page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>
  {{#each instructors}}
  <section id="instructor-{{this.id}}" class="profile page">
    <h2><a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
    <p class="role">{{this.title}}</p>
    <p>{{this.bio}}</p>
    <ul>
      <li>이메일: {{this.email}}</li>
      <li>전화: {{this.phone}}</li>
      <li>소속: {{this.affiliation}}</li>
    </ul>
  </section>
  {{/each}}
</div>`;

const brochureCourseOnlyPagesHtml = `<div class="brochure v4">
  <nav class="top-nav">
    <a href="/">홈</a>
    <a href="/courses">과정 페이지</a>
  </nav>
  <section class="intro page">
    <h1>{{brochure.title}}</h1>
    <p>{{brochure.summary}}</p>
  </section>
  {{#each courses}}
  <section id="course-{{this.id}}" class="course page">
    <h2>{{plus1 @index}}. <a class="entity-link" target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
    <p>{{this.description}}</p>
    <div class="meta">총 시간: {{this.durationHours}}시간</div>
    <div class="goal">{{this.goal}}</div>
  </section>
  {{/each}}
</div>`;

const brochureSample1Html = `<div class="brochure-site" id="cover">
  <header class="hero page">
    <p class="badge">BROCHURE SAMPLE 01</p>
    <h1>{{brochure.title}}</h1>
    <p class="summary">{{brochure.summary}}</p>
  </header>

  {{#if brochure.includeToc}}
  <section id="toc" class="toc page">
    <h2>목차</h2>
    {{#if brochure.includeCourses}}
    <h3>과정</h3>
    <ol>{{#each courses}}<li><a href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></li>{{/each}}</ol>
    {{/if}}
    {{#if brochure.includeInstructors}}
    <h3>강사</h3>
    <ol>{{#each instructors}}<li><a href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></li>{{/each}}</ol>
    {{/if}}
  </section>
  {{/if}}

  {{#if brochure.courseFirst}}
    {{#if brochure.includeCourses}}
    <section id="courses">
      {{#each courses}}
      <section id="course-{{this.id}}" class="content-card page">
        <h2>과정 {{plus1 @index}}. <a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
        {{#if this.webHtml}}
          {{{this.webHtml}}}
        {{else}}
          <p>{{this.description}}</p>
          <p class="meta">총 시간: {{this.durationHours}}시간</p>
          <p class="goal">{{this.goal}}</p>
        {{/if}}
      </section>
      {{/each}}
    </section>
    {{/if}}
    {{#if brochure.includeInstructors}}
    <section id="instructors">
      {{#each instructors}}
      <section id="instructor-{{this.id}}" class="content-card page">
        <h2>강사 {{plus1 @index}}. <a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
        {{#if this.webHtml}}
          {{{this.webHtml}}}
        {{else}}
          <p class="meta">{{this.title}}</p>
          <p>{{this.bio}}</p>
        {{/if}}
      </section>
      {{/each}}
    </section>
    {{/if}}
  {{else}}
    {{#if brochure.includeInstructors}}
    <section id="instructors">
      {{#each instructors}}
      <section id="instructor-{{this.id}}" class="content-card page">
        <h2>강사 {{plus1 @index}}. <a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#instructor-{{this.id}}{{/if}}">{{this.name}}</a></h2>
        {{#if this.webHtml}}
          {{{this.webHtml}}}
        {{else}}
          <p class="meta">{{this.title}}</p>
          <p>{{this.bio}}</p>
        {{/if}}
      </section>
      {{/each}}
    </section>
    {{/if}}
    {{#if brochure.includeCourses}}
    <section id="courses">
      {{#each courses}}
      <section id="course-{{this.id}}" class="content-card page">
        <h2>과정 {{plus1 @index}}. <a target="_blank" rel="noopener noreferrer" href="{{#if this.pdfUrl}}{{this.pdfUrl}}{{else}}#course-{{this.id}}{{/if}}">{{this.title}}</a></h2>
        {{#if this.webHtml}}
          {{{this.webHtml}}}
        {{else}}
          <p>{{this.description}}</p>
          <p class="meta">총 시간: {{this.durationHours}}시간</p>
          <p class="goal">{{this.goal}}</p>
        {{/if}}
      </section>
      {{/each}}
    </section>
    {{/if}}
  {{/if}}
</div>`;

const brochureSample1Css = `.brochure-site{font-family:'Noto Sans KR',sans-serif;color:#0f172a;background:#f8fafc}
.page{margin:0 0 14px;padding:22px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}
.hero{background:linear-gradient(135deg,#0f172a,#1d4ed8 55%,#22d3ee);color:#e2e8f0}
.hero-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.hero-nav a{font-size:12px;color:#dbeafe;text-decoration:none;padding:5px 8px;border:1px solid rgba(255,255,255,.28);border-radius:8px}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.2);font-size:11px;font-weight:700;letter-spacing:.08em}
h1{margin:10px 0 8px;font-size:34px;color:inherit}
.summary{margin:0;color:#dbeafe}
.toc h2,.toc h3{margin:0 0 8px}
.toc ol{margin:0 0 10px;padding-left:18px;line-height:1.8}
.toc a{text-decoration:none;color:#1d4ed8}
.content-card h2{margin:0 0 8px;font-size:24px}
.content-card h2 a{text-decoration:none;color:#0b3b70;border-bottom:1px dashed #60a5fa}
.content-card h2 a:hover{text-decoration:underline}
.meta{font-weight:700;color:#334155}
.goal{margin-top:10px;padding:10px;border-radius:8px;background:#f1f5f9}
@media print{.page{break-after:page}.page:last-child{break-after:auto}}`;

export default function TemplatesHubPage() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const { Title, Text } = Typography;
  const draftTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('draft') || '';
  }, [location.search]);
  const initialKey = draftTarget === 'course_intro'
    ? 'course'
    : draftTarget === 'instructor_profile'
      ? 'instructor'
      : draftTarget === 'brochure_package'
        ? 'brochure'
      : 'all';
  const [activeKey, setActiveKey] = useState(initialKey);
  const [includeCover] = useState(true);
  const [brochureLayoutKey, setBrochureLayoutKey] = useState('brochure-course-instructor');
  const [includeToc, setIncludeToc] = useState(true);
  const [packageMode, setPackageMode] = useState<'web' | 'pdf' | 'both'>('both');
  const [templateCounts, setTemplateCounts] = useState({
    all: 0,
    instructor: 0,
    course: 0,
    brochure: 0,
  });

  useEffect(() => {
    setActiveKey(initialKey);
  }, [initialKey]);

  const includeCourse = brochureLayoutKey !== 'brochure-instructor-only';
  const includeInstructor = brochureLayoutKey !== 'brochure-course-only';
  const courseFirst = brochureLayoutKey === 'brochure-course-instructor' || brochureLayoutKey === 'brochure-course-only';

  const updateBrochureLayout = (
    nextIncludeCourse: boolean,
    nextIncludeInstructor: boolean,
    nextCourseFirst: boolean,
  ) => {
    if (!nextIncludeCourse && !nextIncludeInstructor) {
      message.warning('강의 또는 강사 중 최소 하나는 포함해야 합니다.');
      return;
    }
    if (nextIncludeCourse && nextIncludeInstructor) {
      setBrochureLayoutKey(nextCourseFirst ? 'brochure-course-instructor' : 'brochure-instructor-course');
      return;
    }
    setBrochureLayoutKey(nextIncludeCourse ? 'brochure-course-only' : 'brochure-instructor-only');
  };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const loadCounts = async () => {
      try {
        const [allRes, instRes, courseRes, brochureRes] = await Promise.all([
          api.templateList(1, 1, undefined, accessToken) as Promise<{ total?: number }>,
          api.templateList(1, 1, 'instructor_profile', accessToken) as Promise<{ total?: number }>,
          api.templateList(1, 1, 'course_intro', accessToken) as Promise<{ total?: number }>,
          api.templateList(1, 1, 'brochure_package', accessToken) as Promise<{ total?: number }>,
        ]);
        if (cancelled) return;
        setTemplateCounts({
          all: allRes?.total || 0,
          instructor: instRes?.total || 0,
          course: courseRes?.total || 0,
          brochure: brochureRes?.total || 0,
        });
      } catch {
        // noop
      }
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const ensurePresets = async () => {
      try {
        const [brochureResult, courseResult, instructorResult] = await Promise.all([
          api.templateList(1, 100, 'brochure_package', accessToken) as Promise<{ items?: Array<{ id: string; name: string; html?: string; css?: string }> }>,
          api.templateList(1, 100, 'course_intro', accessToken) as Promise<{ items?: Array<{ id: string; name: string; html?: string; css?: string }> }>,
          api.templateList(1, 100, 'instructor_profile', accessToken) as Promise<{ items?: Array<{ id: string; name: string; html?: string; css?: string }> }>,
        ]);
        if (cancelled) return;

        const brochurePresets = [
          { name: '[샘플1] 브로셔 풀버전 웹사이트형', html: brochureSample1Html, css: brochureSample1Css },
        ];
        const coursePresets = [
          { name: '[샘플1] 과정 소개 웹사이트형', html: courseSample1Html, css: courseSample1Css },
        ];
        const instructorPresets = [
          { name: '[샘플1] 강사 프로필 웹사이트형', html: instructorSample1Html, css: instructorSample1Css },
        ];

        const syncPresets = async (
          existingItems: Array<{ id: string; name: string; html?: string; css?: string }>,
          presets: Array<{ name: string; html: string; css: string }>,
          type: 'brochure_package' | 'course_intro' | 'instructor_profile',
        ) => Promise.all(presets.map(async (preset) => {
          const matched = existingItems.find((item) => item.name === preset.name);
          if (!matched) {
            await api.templateUpsert({
              token: accessToken,
              name: preset.name,
              type,
              html: preset.html,
              css: preset.css,
            });
            return;
          }
          const shouldSync = (matched.html || '') !== preset.html || (matched.css || '') !== preset.css;
          if (!shouldSync) return;
          await api.templateUpsert({
            token: accessToken,
            id: matched.id,
            name: matched.name,
            type,
            html: preset.html,
            css: preset.css,
            changelog: 'default preset sync',
          });
        }));

        await Promise.all([
          syncPresets(brochureResult.items || [], brochurePresets, 'brochure_package'),
          syncPresets(courseResult.items || [], coursePresets, 'course_intro'),
          syncPresets(instructorResult.items || [], instructorPresets, 'instructor_profile'),
        ]);

        if (!cancelled) {
          message.success('샘플1 템플릿(브로셔/과정/강사 웹사이트형)을 동기화했습니다.');
        }
      } catch {
        // 권한이 없거나 이미 생성된 경우는 조용히 무시
      }
    };

    void ensurePresets();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div>
      <Card
        style={{
          marginBottom: 14,
          borderRadius: 20,
          border: '1px solid #bfdbfe',
          background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 45%, #22d3ee 100%)',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 22 }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={14}>
            <Space direction="vertical" size={10}>
              <Tag color="cyan">BROCHURE LANDING</Tag>
              <Title level={2} style={{ margin: 0, color: '#f8fafc' }}>
                브로셔 템플릿 스튜디오
              </Title>
              <Text style={{ color: '#dbeafe', fontSize: 15 }}>
                강의/강사를 조합해 레이아웃 기반 브로셔를 빠르게 제작합니다.
                기본 템플릿 선택 후 매핑 데이터만 바꾸면 N페이지로 자동 확장됩니다.
              </Text>
                    <Space wrap>
                <Button type="primary" size="large" onClick={() => setActiveKey('brochure')}>
                  브로셔 시작하기
                </Button>
                <Button size="large" onClick={() => setActiveKey('all')}>
                  전체 템플릿 보기
                </Button>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={10}>
            <Row gutter={[8, 8]}>
              <Col span={12}><Card size="small" style={{ borderRadius: 12 }}>전체<br /><strong>{templateCounts.all}</strong></Card></Col>
              <Col span={12}><Card size="small" style={{ borderRadius: 12 }}>과정<br /><strong>{templateCounts.course}</strong></Card></Col>
              <Col span={12}><Card size="small" style={{ borderRadius: 12 }}>강사<br /><strong>{templateCounts.instructor}</strong></Card></Col>
              <Col span={12}><Card size="small" style={{ borderRadius: 12 }}>브로셔<br /><strong>{templateCounts.brochure}</strong></Card></Col>
            </Row>
          </Col>
        </Row>
      </Card>
      <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={8}>
          <Card size="small" style={{ borderRadius: 12, border: '1px solid #dbeafe' }}>
            <Tag color="blue">STEP 1</Tag>
            <div style={{ fontWeight: 700, marginTop: 6 }}>레이아웃 선택</div>
            <Text type="secondary">강의+강사 / 강사+강의 / 강사만 / 강의만</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" style={{ borderRadius: 12, border: '1px solid #dcfce7' }}>
            <Tag color="green">STEP 2</Tag>
            <div style={{ fontWeight: 700, marginTop: 6 }}>매핑 데이터 확인</div>
            <Text type="secondary">courses, instructors 반복 매핑으로 자동 페이지 확장</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" style={{ borderRadius: 12, border: '1px solid #fde68a' }}>
            <Tag color="gold">STEP 3</Tag>
            <div style={{ fontWeight: 700, marginTop: 6 }}>저장 후 적용</div>
            <Text type="secondary">내문서함 기본 템플릿으로 연결해 바로 사용</Text>
          </Card>
        </Col>
      </Row>
      <Alert
        type="info"
        showIcon icon={<NotificationOutlined />}
        message="강사/과정/브로셔 템플릿을 관리합니다."
        description="템플릿 미리보기는 샘플 데이터를 사용하며, PDF 렌더는 별도 페이지에서 수행합니다."
        style={{ marginBottom: 16 }}
      />
      <Tabs
        activeKey={activeKey}
        onChange={(key) => setActiveKey(key)}
        destroyInactiveTabPane
        items={[
          {
            key: 'all',
            label: 'All',
            children: (
              <TemplatesPage
                title="템플릿 전체"
                description="강사 프로필/과정 소개 전체 목록입니다."
                defaultHtml={courseHtml}
                defaultCss={courseCss}


              />
            ),
          },
          {
            key: 'instructor',
            label: '강사 프로필',
            children: (
              <TemplatesPage
                title="강사 프로필 템플릿"
                description="강사 기본 정보와 매핑된 과정 목록을 포함한 템플릿입니다."
                typeLabel="강사 프로필"
                templateType="instructor_profile"
                defaultHtml={instructorSample1Html}
                defaultCss={instructorSample1Css}


              />
            ),
          },
          {
            key: 'course',
            label: '과정 소개',
            children: (
              <TemplatesPage
                title="과정 소개 템플릿"
                description="코스 정보와 강사, 강의 목록을 포함한 템플릿입니다."
                typeLabel="과정 소개"
                templateType="course_intro"
                defaultHtml={courseSample1Html}
                defaultCss={courseSample1Css}


              />
            ),
          },
          {
            key: 'brochure',
            label: '브로셔',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small" style={{ borderRadius: 12, border: '1px solid #dbe4f0' }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space wrap>
                      <Checkbox checked={includeCover} disabled>
                        표지 포함
                      </Checkbox>
                      <Checkbox
                        checked={includeToc}
                        onChange={(e) => setIncludeToc(e.target.checked)}
                      >
                        목차 포함
                      </Checkbox>
                      <Checkbox
                        checked={includeCourse}
                        onChange={(e) => updateBrochureLayout(e.target.checked, includeInstructor, courseFirst)}
                      >
                        강의 포함
                      </Checkbox>
                      <Checkbox
                        checked={includeInstructor}
                        onChange={(e) => updateBrochureLayout(includeCourse, e.target.checked, courseFirst)}
                      >
                        강사 포함
                      </Checkbox>
                      {includeCourse && includeInstructor ? (
                        <Space size={8} align="center">
                          <span style={{ color: '#475569', fontSize: 12 }}>순서</span>
                          <Segmented
                            value={courseFirst ? 'course-first' : 'instructor-first'}
                            onChange={(value) => updateBrochureLayout(true, true, value === 'course-first')}
                            options={[
                              { label: '강의 → 강사', value: 'course-first' },
                              { label: '강사 → 강의', value: 'instructor-first' },
                            ]}
                          />
                        </Space>
                      ) : null}
                    </Space>
                    <Space size={10}>
                      <span style={{ color: '#475569', fontSize: 12 }}>출력 방식</span>
                      <Segmented
                        value={packageMode}
                        onChange={(value) => setPackageMode(value as 'web' | 'pdf' | 'both')}
                        options={[
                          { label: '웹', value: 'web' },
                          { label: 'PDF', value: 'pdf' },
                          { label: '둘다', value: 'both' },
                        ]}
                      />
                    </Space>
                    </Space>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      기본: 표지 포함. 강의/강사 체크 조합으로 구성하며, 둘 다 포함 시에만 순서를 선택합니다.
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      출력: {packageMode === 'pdf'
                        ? 'PDF 파일 하나로 패키징 후 내 문서함 저장'
                        : packageMode === 'web'
                          ? '웹 브로셔 형태로 패키징 후 웹 주소 제공'
                          : '웹 주소 제공 + PDF 파일 저장을 모두 진행'}
                    </div>
                  </Space>
                </Card>
                <TemplatesPage
                  title={`브로셔 템플릿(${includeToc ? '표지+목차+페이지' : '표지+페이지'}): ${
                    brochureLayoutKey === 'brochure-course-instructor'
                      ? '강의+강사'
                      : brochureLayoutKey === 'brochure-instructor-course'
                        ? '강사+강의'
                        : brochureLayoutKey === 'brochure-instructor-only'
                          ? '강사만'
                          : '강의만'
                  }`}
                  description={includeToc
                    ? '기본값: 표지와 목차 뒤에 상세 페이지가 이어집니다.'
                    : '목차를 생략하고 표지 다음에 상세 페이지가 바로 이어집니다.'}
                  typeLabel="브로셔"
                  templateType="brochure_package"
                  defaultHtml={
                    includeToc
                      ? brochureLayoutKey === 'brochure-course-instructor'
                        ? brochureCourseInstructorHtml
                        : brochureLayoutKey === 'brochure-instructor-course'
                          ? brochureInstructorCourseHtml
                          : brochureLayoutKey === 'brochure-instructor-only'
                            ? brochureInstructorOnlyHtml
                            : brochureCourseOnlyHtml
                      : brochureLayoutKey === 'brochure-course-instructor'
                        ? brochureCourseInstructorPagesHtml
                        : brochureLayoutKey === 'brochure-instructor-course'
                          ? brochureInstructorCoursePagesHtml
                          : brochureLayoutKey === 'brochure-instructor-only'
                            ? brochureInstructorOnlyPagesHtml
                            : brochureCourseOnlyPagesHtml
                  }
                  defaultCss={
                    brochureLayoutKey === 'brochure-course-instructor'
                      ? brochureCourseInstructorCss
                      : brochureLayoutKey === 'brochure-instructor-course'
                        ? brochureInstructorCourseCss
                        : brochureLayoutKey === 'brochure-instructor-only'
                          ? brochureInstructorOnlyCss
                          : brochureCourseOnlyCss
                  }
                />
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
