import { useEffect, useMemo, useState } from 'react';
import { Button, Card, List, Space, Tag, Typography } from 'antd';
import { BookOutlined, FileTextOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons';
import { api, mcpClient } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

type Course = { id: string; title: string; createdAt?: string; updatedAt?: string };
type Instructor = { id: string; name: string; createdAt?: string; updatedAt?: string };
type Template = { id: string; name: string; createdAt?: string; updatedAt?: string; type?: string };

const toDate = (value?: string) => (value ? new Date(value) : null);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const withinDays = (date: Date | null, days: number) => {
  if (!date) return false;
  const diff = Date.now() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const countByPeriod = <T,>(items: T[], getDate: (item: T) => Date | null) => {
  const today = startOfToday();
  const total = items.length;
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  items.forEach((item) => {
    const date = getDate(item);
    if (!date) return;
    if (date >= today) todayCount += 1;
    if (withinDays(date, 7)) weekCount += 1;
    if (withinDays(date, 30)) monthCount += 1;
  });
  return { total, today: todayCount, week: weekCount, month: monthCount };
};

const buildSeries = (items: Array<{ createdAt?: string }>) => {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const counts = days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return items.filter((item) => {
      const date = toDate(item.createdAt);
      return date && date >= day && date < next;
    }).length;
  });
  return { days, counts };
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    mcpClient.onConnect(() => {
      api.courseList(50, 0).then((result) => {
        const data = result as { courses: Course[] };
        setCourses(data.courses || []);
      });
      api.instructorList(50, 0).then((result) => {
        const data = result as { instructors: Instructor[] };
        setInstructors(data.instructors || []);
      });
      api.templateList(1, 50).then((result) => {
        const data = result as { items: Template[] };
        setTemplates(data.items || []);
      });
    });
  }, []);

  const courseCounts = useMemo(
    () => countByPeriod(courses, (c) => toDate(c.createdAt)),
    [courses],
  );
  const instructorCounts = useMemo(
    () => countByPeriod(instructors, (i) => toDate(i.createdAt)),
    [instructors],
  );
  const templateCounts = useMemo(
    () => countByPeriod(templates, (t) => toDate(t.updatedAt || t.createdAt)),
    [templates],
  );

  const courseSeries = useMemo(() => buildSeries(courses), [courses]);

  const todayCourses = useMemo(
    () =>
      courses
        .filter((c) => toDate(c.createdAt) && toDate(c.createdAt)! >= startOfToday())
        .slice(0, 5),
    [courses],
  );

  const todayInstructors = useMemo(
    () =>
      instructors
        .filter((i) => toDate(i.createdAt) && toDate(i.createdAt)! >= startOfToday())
        .slice(0, 5),
    [instructors],
  );

  if (!isAuthenticated) {
    return (
      <Card>
        <Title level={3}>대시보드를 사용하려면 로그인해주세요.</Title>
        <Button type="primary" onClick={() => navigate('/login')}>
          로그인
        </Button>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 24,
        fontFamily: '"Space Grotesk", "Noto Sans KR", sans-serif',
      }}
    >
      <section
        style={{
          padding: 24,
          borderRadius: 20,
          background:
            'radial-gradient(1200px 380px at 0% 0%, #e0f2fe 0%, #f8fafc 55%, #ffffff 100%)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, fontFamily: '"Noto Sans KR", sans-serif' }}>
              운영 대시보드
            </Title>
            <Text type="secondary">총합 · 오늘 · 주간 · 월간 지표를 한눈에 확인하세요.</Text>
          </div>
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => navigate('/courses')}>
              코스 등록
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => navigate('/instructors')}>
              강사 등록
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/templates')}>
              템플릿 생성
            </Button>
          </Space>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {[
          { label: '코스', icon: <BookOutlined />, data: courseCounts, tone: '#0ea5e9' },
          { label: '강사', icon: <UserOutlined />, data: instructorCounts, tone: '#14b8a6' },
          { label: '템플릿', icon: <FileTextOutlined />, data: templateCounts, tone: '#f97316' },
        ].map((item) => (
          <Card
            key={item.label}
            style={{
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      background: `${item.tone}1a`,
                      color: item.tone,
                    }}
                  >
                    {item.icon}
                  </div>
                  <Text strong>{item.label}</Text>
                </Space>
                <Tag color="blue">총합</Tag>
              </Space>
              <Title level={2} style={{ margin: 0 }}>
                {item.data.total}
              </Title>
              <Space>
                <Tag color="geekblue">오늘 {item.data.today}</Tag>
                <Tag color="cyan">주간 {item.data.week}</Tag>
                <Tag color="orange">월간 {item.data.month}</Tag>
              </Space>
            </Space>
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 2fr) minmax(240px, 1fr)' }}>
        <Card
          title="최근 7일 요약"
          style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary">최근 7일 평균</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {courseSeries.counts.length
                    ? Math.round(
                        courseSeries.counts.reduce((a, b) => a + b, 0) / courseSeries.counts.length,
                      )
                    : 0}
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 14 }}>
                    건/일
                  </Text>
                </Title>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">전일 대비</Text>
                <Title level={4} style={{ margin: 0 }}>
                  {courseSeries.counts.length >= 2
                    ? courseSeries.counts[courseSeries.counts.length - 1] -
                      courseSeries.counts[courseSeries.counts.length - 2]
                    : 0}
                  <Text type="secondary" style={{ marginLeft: 6, fontSize: 14 }}>
                    건
                  </Text>
                </Title>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 6,
              }}
            >
              {courseSeries.counts.map((count, idx) => {
                const intensity = Math.min(0.9, 0.2 + count * 0.12);
                return (
                  <div
                    key={`${idx}-${count}`}
                    style={{
                      height: 28,
                      borderRadius: 8,
                      background: `rgba(56, 189, 248, ${intensity})`,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
              {courseSeries.days.map((day, idx) => (
                <span key={idx}>{day.getMonth() + 1}/{day.getDate()}</span>
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              상단은 평균/전일 대비 요약, 아래는 7일 히트맵입니다.
            </Text>
          </div>
        </Card>

        <Card
          title="알림 카드"
          style={{ borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc' }}
        >
          <List
            size="small"
            dataSource={[
              '승인 대기 항목이 없습니다.',
              '누락 정보 체크 기능은 추후 연동 예정입니다.',
              '추천/채택 기반 지표는 오픈 코스 기능 이후 적용됩니다.',
            ]}
            renderItem={(item) => <List.Item style={{ color: '#475569' }}>{item}</List.Item>}
          />
        </Card>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="오늘 등록된 코스" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <List
            dataSource={todayCourses}
            locale={{ emptyText: '오늘 등록된 코스가 없습니다.' }}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={2}>
                  <Text strong>{item.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '-'}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
        <Card title="오늘 등록된 강사" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <List
            dataSource={todayInstructors}
            locale={{ emptyText: '오늘 등록된 강사가 없습니다.' }}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={2}>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '-'}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </section>
    </div>
  );
}
