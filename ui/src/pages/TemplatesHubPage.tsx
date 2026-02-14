import { Tabs, Alert } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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




export default function TemplatesHubPage() {
  const location = useLocation();
  const draftTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('draft') || '';
  }, [location.search]);
  const initialKey = draftTarget === 'course_intro'
    ? 'course'
    : draftTarget === 'instructor_profile'
      ? 'instructor'
      : 'all';
  const [activeKey, setActiveKey] = useState(initialKey);

  useEffect(() => {
    setActiveKey(initialKey);
  }, [initialKey]);

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: 12 }}>템플릿 관리</h2>
      <Alert
        type="info"
        showIcon
        message="강사 프로필/과정 소개 템플릿을 관리합니다."
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
                defaultHtml={instructorHtml}
                defaultCss={instructorCss}


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


              />
            ),
          },
        ]}
      />
    </div>
  );
}
