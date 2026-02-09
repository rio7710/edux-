import { Tabs } from 'antd';
import TemplatesPage from './TemplatesPage';

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

const instructorSample = {
  instructor: {
    name: '홍길동',
    title: 'HRD 수석 강사',
    email: 'hong@example.com',
    phone: '010-1234-5678',
    affiliation: '에듀엑스',
    specialties: '리더십, 조직문화, 커뮤니케이션',
  },
  courses: [
    { title: '리더십 기본 과정' },
    { title: '조직문화 혁신 워크숍' },
  ],
};

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

const courseSample = {
  course: {
    title: '리더십 기본 과정',
    description: '조직 리더십 역량을 강화하는 과정입니다.',
    durationHours: 12,
    goal: '핵심 리더십 역량을 체계적으로 습득',
  },
  instructors: [{ name: '홍길동' }, { name: '김강사' }],
  lectures: [
    { title: '리더십 개론', hours: 2 },
    { title: '코칭 실습', hours: 3 },
  ],
};

export default function TemplatesHubPage() {
  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: 12 }}>템플릿 관리</h2>
      <Tabs
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
                sampleData={courseSample}
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
                defaultHtml={instructorHtml}
                defaultCss={instructorCss}
                sampleData={instructorSample}
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
                defaultHtml={courseHtml}
                defaultCss={courseCss}
                sampleData={courseSample}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
