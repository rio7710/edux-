import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Result, Space, Tag, Typography } from 'antd';
import {
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  NotificationOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useSitePermissions } from '../hooks/useSitePermissions';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

type Course = { id: string; title: string; createdAt?: string; updatedAt?: string };
type Instructor = { id: string; name: string; createdAt?: string; updatedAt?: string };
type Template = { id: string; name: string; createdAt?: string; updatedAt?: string; type?: string };
type MessageCategory = 'system' | 'course_share' | 'lecture_grant' | 'instructor_approval';
type UserMessage = {
  id: string;
  category: MessageCategory;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt?: string;
};
type CourseShare = { id: string };
type LectureGrant = { id: string };
type UnreadSummary = {
  total: number;
  system: number;
  courseShare: number;
  lectureGrant: number;
  instructorApproval: number;
};
type DashboardBootstrapPayload = {
  courses: Course[];
  instructors: Instructor[];
  templates: Template[];
  recentMessages: UserMessage[];
  pendingShareCount: number;
  lectureGrantCount: number;
  unreadSummary: UnreadSummary;
};

const toDate = (value?: string) => (value ? new Date(value) : null);
const roleLabelMap: Record<string, string> = {
  admin: '관리자',
  operator: '운영자',
  editor: '편집자',
  instructor: '강사',
  viewer: '뷰어',
  guest: '게스트',
};
const messageCategoryLabel: Record<MessageCategory, string> = {
  system: '시스템',
  course_share: '코스 공유',
  lecture_grant: '강의 공유',
  instructor_approval: '강사 승인',
};
const messageCategoryColor: Record<MessageCategory, string> = {
  system: 'default',
  course_share: 'blue',
  lecture_grant: 'purple',
  instructor_approval: 'green',
};

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
  const { isAuthenticated, accessToken, user } = useAuth();
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const canReadDashboard =
    !isAuthenticated ||
    (canAccessMenu('dashboard') && canUseFeature('dashboard', 'dashboard.read'));
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recentMessages, setRecentMessages] = useState<UserMessage[]>([]);
  const [pendingShareCount, setPendingShareCount] = useState(0);
  const [lectureGrantCount, setLectureGrantCount] = useState(0);
  const [unreadSummary, setUnreadSummary] = useState<UnreadSummary>({
    total: 0,
    system: 0,
    courseShare: 0,
    lectureGrant: 0,
    instructorApproval: 0,
  });
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const isInstructorRole = user?.role === 'instructor';

  useEffect(() => {
    let cancelled = false;
    setBootstrapReady(false);
    const load = async () => {
      if (!isAuthenticated || !accessToken) return;
      try {
        const bootstrap = (await api.dashboardBootstrap({
          token: accessToken,
        })) as DashboardBootstrapPayload;
        if (cancelled) return;
        setCourses(bootstrap?.courses || []);
        setInstructors(bootstrap?.instructors || []);
        setTemplates(bootstrap?.templates || []);
        setRecentMessages(
          (bootstrap?.recentMessages || [])
            .slice()
            .sort(
              (a, b) =>
                (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0),
            )
            .slice(0, 5),
        );
        setPendingShareCount(bootstrap?.pendingShareCount || 0);
        setLectureGrantCount(bootstrap?.lectureGrantCount || 0);
        setUnreadSummary({
          total: bootstrap?.unreadSummary?.total || 0,
          system: bootstrap?.unreadSummary?.system || 0,
          courseShare: bootstrap?.unreadSummary?.courseShare || 0,
          lectureGrant: bootstrap?.unreadSummary?.lectureGrant || 0,
          instructorApproval: bootstrap?.unreadSummary?.instructorApproval || 0,
        });
      } catch {
        if (cancelled) return;
        setCourses([]);
        setInstructors([]);
        setTemplates([]);
        setRecentMessages([]);
        setPendingShareCount(0);
        setLectureGrantCount(0);
        setUnreadSummary({
          total: 0,
          system: 0,
          courseShare: 0,
          lectureGrant: 0,
          instructorApproval: 0,
        });
      } finally {
        if (!cancelled) {
          setBootstrapReady(true);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    if (!bootstrapReady) return;
    let cancelled = false;
    const loadRealtimeMessageData = async () => {
      if (!isAuthenticated || !accessToken) return;
      try {
        const [
          recentMessageResult,
          pendingShareResult,
          lectureGrantResult,
          unreadSummaryResult,
        ] = await Promise.allSettled([
          api.messageList({ token: accessToken, limit: 6, status: 'all' }) as Promise<{
            messages: UserMessage[];
          }>,
          api.courseShareListReceived({ token: accessToken, status: 'pending' }) as Promise<{
            shares: CourseShare[];
          }>,
          api.lectureGrantListMine({ token: accessToken }) as Promise<{ grants: LectureGrant[] }>,
          api.messageUnreadSummary({ token: accessToken }) as Promise<UnreadSummary>,
        ]);
        if (cancelled) return;

        setRecentMessages(
          recentMessageResult.status === 'fulfilled'
            ? (recentMessageResult.value.messages || [])
                .slice()
                .sort(
                  (a, b) =>
                    (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0),
                )
                .slice(0, 5)
            : [],
        );
        setPendingShareCount(
          pendingShareResult.status === 'fulfilled' ? pendingShareResult.value.shares?.length || 0 : 0,
        );
        setLectureGrantCount(
          lectureGrantResult.status === 'fulfilled' ? lectureGrantResult.value.grants?.length || 0 : 0,
        );
        setUnreadSummary({
          total:
            unreadSummaryResult.status === 'fulfilled'
              ? unreadSummaryResult.value.total || 0
              : 0,
          system:
            unreadSummaryResult.status === 'fulfilled'
              ? unreadSummaryResult.value.system || 0
              : 0,
          courseShare:
            unreadSummaryResult.status === 'fulfilled'
              ? unreadSummaryResult.value.courseShare || 0
              : 0,
          lectureGrant:
            unreadSummaryResult.status === 'fulfilled'
              ? unreadSummaryResult.value.lectureGrant || 0
              : 0,
          instructorApproval:
            unreadSummaryResult.status === 'fulfilled'
              ? unreadSummaryResult.value.instructorApproval || 0
              : 0,
        });
      } catch {
        if (cancelled) return;
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadRealtimeMessageData();
    }, 15000);
    const onFocus = () => {
      void loadRealtimeMessageData();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadRealtimeMessageData();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accessToken, isAuthenticated, bootstrapReady]);

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
  const instructorSeries = useMemo(() => buildSeries(instructors), [instructors]);
  const templateSeries = useMemo(() => buildSeries(templates), [templates]);
  const sevenDayRows = useMemo(
    () =>
      courseSeries.days.map((day, index) => ({
        dateLabel: `${day.getMonth() + 1}/${day.getDate()}`,
        courseCount: courseSeries.counts[index] || 0,
        instructorCount: instructorSeries.counts[index] || 0,
        templateCount: templateSeries.counts[index] || 0,
      })),
    [courseSeries.counts, courseSeries.days, instructorSeries.counts, templateSeries.counts],
  );
  const sevenDayMax = useMemo(
    () =>
      Math.max(
        1,
        ...sevenDayRows.map((row) =>
          Math.max(row.courseCount, row.instructorCount, row.templateCount),
        ),
      ),
    [sevenDayRows],
  );
  const sevenDaySummary = useMemo(() => {
    const courseTotal = sevenDayRows.reduce((sum, row) => sum + row.courseCount, 0);
    const instructorTotal = sevenDayRows.reduce((sum, row) => sum + row.instructorCount, 0);
    const templateTotal = sevenDayRows.reduce((sum, row) => sum + row.templateCount, 0);
    const combinedTotal = courseTotal + instructorTotal + templateTotal;
    const avgPerDay = Math.round((combinedTotal / Math.max(sevenDayRows.length, 1)) * 10) / 10;
    return { courseTotal, instructorTotal, templateTotal, combinedTotal, avgPerDay };
  }, [sevenDayRows]);

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
  const summaryCards = useMemo(
    () => [
      {
        label: '코스',
        icon: <BookOutlined />,
        tone: '#0ea5e9',
        total: courseCounts.total,
        route: '/courses',
        createRoute: '/courses?create=1',
        canCreate: canUseFeature('courses', 'course.upsert'),
        visible: canAccessMenu('courses'),
        tags: [`오늘 ${courseCounts.today}`, `주간 ${courseCounts.week}`, `월간 ${courseCounts.month}`],
      },
      {
        label: '강사',
        icon: <UserOutlined />,
        tone: '#14b8a6',
        total: instructorCounts.total,
        route: '/instructors',
        createRoute: '/instructors?create=1',
        canCreate: canUseFeature('instructors', 'instructor.upsert'),
        visible: canAccessMenu('instructors'),
        tags: [
          `오늘 ${instructorCounts.today}`,
          `주간 ${instructorCounts.week}`,
          `월간 ${instructorCounts.month}`,
        ],
      },
      {
        label: '템플릿',
        icon: <FileTextOutlined />,
        tone: '#f97316',
        total: templateCounts.total,
        route: '/templates',
        createRoute: '/templates?create=1',
        canCreate: canUseFeature('templates', 'template.upsert'),
        visible: canAccessMenu('templates'),
        tags: [
          `오늘 ${templateCounts.today}`,
          `주간 ${templateCounts.week}`,
          `월간 ${templateCounts.month}`,
        ],
      },
      {
        label: '알림',
        icon: <NotificationOutlined />,
        tone: '#ef4444',
        total: unreadSummary.total,
        route: '/feature-shares',
        createRoute: undefined,
        canCreate: false,
        visible: true,
        tags: [
          `시스템 ${unreadSummary.system}`,
          `코스공유 ${unreadSummary.courseShare}`,
          `강의공유 ${unreadSummary.lectureGrant}`,
        ],
      },
    ].filter((item) => item.visible),
    [
      canAccessMenu,
      canUseFeature,
      courseCounts,
      instructorCounts,
      templateCounts,
      unreadSummary,
    ],
  );
  const instructorBoard = useMemo(
    () => [
      {
        title: '응답 대기 공유',
        value: pendingShareCount,
        description: '수락/거절이 필요한 코스 공유 요청',
        icon: <ClockCircleOutlined />,
        actionLabel: '메시지함',
        route: '/feature-shares',
      },
      {
        title: '내 강의 권한',
        value: lectureGrantCount,
        description: '현재 보유 중인 강의 공유 권한',
        icon: <CheckCircleOutlined />,
        actionLabel: '권한 확인',
        route: '/feature-shares',
      },
      {
        title: '내 일정/알림',
        value: unreadSummary.total,
        description: '미확인 메시지 및 일정 관련 알림',
        icon: <CalendarOutlined />,
        actionLabel: '알림 보기',
        route: '/feature-shares',
      },
    ],
    [pendingShareCount, lectureGrantCount, unreadSummary.total],
  );
  const nowText = useMemo(() => new Date().toLocaleString('ko-KR'), []);

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

  if (!canReadDashboard) {
    return (
      <Result
        status="403"
        title="권한 없음"
        subTitle="대시보드 접근 권한이 없습니다."
      />
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
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        <Card
          style={{
            borderRadius: 20,
            background:
              'radial-gradient(1200px 380px at 0% 0%, #e0f2fe 0%, #f8fafc 55%, #ffffff 100%)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <Title level={2} style={{ margin: 0, fontFamily: '"Noto Sans KR", sans-serif' }}>
                대시보드
              </Title>
              <Text type="secondary">
                핵심 지표와 최근 활동을 한 화면에서 빠르게 확인합니다.
              </Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  <Tag color="geekblue">역할: {roleLabelMap[user?.role || 'guest']}</Tag>
                  {isInstructorRole ? (
                    <Tag color="magenta">강사 모드</Tag>
                  ) : (
                    <Tag color="default">관리 화면</Tag>
                  )}
                  <Tag color="default">업데이트 {nowText}</Tag>
                </Space>
              </div>
            </div>
          </div>
        </Card>
        <Card
          style={{
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 16 }}>빠른 요약</Text>
            <Space size={16} wrap>
              <div>
                <Text type="secondary">총 코스</Text>
                <Title level={3} style={{ margin: 0 }}>{courseCounts.total}건</Title>
              </div>
              <div>
                <Text type="secondary">총 강사</Text>
                <Title level={3} style={{ margin: 0 }}>{instructorCounts.total}명</Title>
              </div>
              <div>
                <Text type="secondary">총 템플릿</Text>
                <Title level={3} style={{ margin: 0 }}>{templateCounts.total}건</Title>
              </div>
              <div>
                <Text type="secondary">미확인 알림</Text>
                <Title level={3} style={{ margin: 0 }}>{unreadSummary.total}건</Title>
              </div>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              아래 카드에서 해당 화면으로 바로 이동할 수 있습니다.
            </Text>
          </Space>
        </Card>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {summaryCards.map((item) => (
          <Card
            key={item.label}
            onClick={() => navigate(item.route)}
            style={{
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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
                <Space>
                  {item.canCreate && item.createRoute && (
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      aria-label={`${item.label} 신규 등록`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(item.createRoute!);
                      }}
                    />
                  )}
                  <Tag color="blue">총합</Tag>
                </Space>
              </Space>
              <Title level={2} style={{ margin: 0 }}>
                {item.total}
              </Title>
              <Space>
                {item.tags.map((tag) => (
                  <Tag key={tag} color="default">
                    {tag}
                  </Tag>
                ))}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                카드 클릭: 목록 이동 {item.canCreate ? '· + 클릭: 신규 등록' : ''}
              </Text>
            </Space>
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {instructorBoard.map((item) => (
          <Card
            key={item.title}
            style={{
              borderRadius: 16,
              border: '1px solid #f5d0fe',
              background: 'linear-gradient(180deg, #ffffff 0%, #fdf4ff 100%)',
            }}
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#a21caf',
                      background: '#f3e8ff',
                    }}
                  >
                    {item.icon}
                  </div>
                  <Text strong>{item.title}</Text>
                </Space>
                <Space size={4}>
                  <Tag color="magenta">강사 전용</Tag>
                  {!isInstructorRole && <Tag color="default">미리보기</Tag>}
                </Space>
              </Space>
              <Title level={2} style={{ margin: 0 }}>
                {item.value}
              </Title>
              <Text type="secondary">{item.description}</Text>
              <Button size="small" onClick={() => navigate(item.route)}>
                {item.actionLabel}
              </Button>
            </Space>
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="최근 7일 활동 추이" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag color="blue">콘텐츠</Tag>
            <Tag color="green">강사</Tag>
            <Tag color="orange">템플릿</Tag>
          </Space>
          <Space wrap style={{ marginBottom: 12 }}>
            <Text type="secondary">7일 총합 {sevenDaySummary.combinedTotal}건</Text>
            <Text type="secondary">일평균 {sevenDaySummary.avgPerDay}건</Text>
            <Text type="secondary">최대값 {sevenDayMax}건</Text>
          </Space>
          <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 10, alignItems: 'end', minHeight: 220 }}>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(5, 1fr)', alignItems: 'center', height: 170 }}>
              {[4, 3, 2, 1, 0].map((tick) => (
                <Text key={`tick-${tick}`} type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>
                  {Math.round((sevenDayMax * tick) / 4)}
                </Text>
              ))}
            </div>
            {sevenDayRows.map((row) => {
              const courseHeight = row.courseCount === 0 ? 2 : Math.max(8, Math.round((row.courseCount / sevenDayMax) * 140));
              const instructorHeight =
                row.instructorCount === 0 ? 2 : Math.max(8, Math.round((row.instructorCount / sevenDayMax) * 140));
              const templateHeight =
                row.templateCount === 0 ? 2 : Math.max(8, Math.round((row.templateCount / sevenDayMax) * 140));
              const total = row.courseCount + row.instructorCount + row.templateCount;
              return (
                <div key={`multi-b-${row.dateLabel}`} style={{ textAlign: 'center' }} title={`${row.dateLabel} 총 ${total}건`}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: 4, minHeight: 150 }}>
                    <div style={{ width: 10, height: courseHeight, borderRadius: 4, background: '#38bdf8' }} />
                    <div style={{ width: 10, height: instructorHeight, borderRadius: 4, background: '#22c55e' }} />
                    <div style={{ width: 10, height: templateHeight, borderRadius: 4, background: '#fb923c' }} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{row.dateLabel}</Text>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    총 {total}
                  </div>
                </div>
              );
            })}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            날짜별 신규 건수를 비교합니다. 막대가 높을수록 해당 일자의 등록 건수가 많습니다.
          </Text>
        </Card>

        <Card
          title="최근 알림"
          extra={
            <Button size="small" type="link" onClick={() => navigate('/feature-shares')}>
              전체 보기
            </Button>
          }
          style={{ borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc' }}
        >
          {recentMessages.length === 0 ? (
            <Empty
              description="표시할 알림이 없습니다."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {recentMessages.map((item) => (
                <div
                  key={item.id}
                  style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}
                >
                  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color={messageCategoryColor[item.category]}>
                        {messageCategoryLabel[item.category]}
                      </Tag>
                      <Badge
                        status={item.isRead ? 'default' : 'processing'}
                        text={item.isRead ? '읽음' : '미확인'}
                      />
                    </Space>
                    <Text strong>{item.title}</Text>
                    {!!item.body && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.body}
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '-'}
                    </Text>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="오늘 등록된 코스" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
          {todayCourses.length === 0 ? (
            <Text type="secondary">오늘 등록된 코스가 없습니다.</Text>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {todayCourses.map((item) => (
                <div key={item.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <Space orientation="vertical" size={2}>
                    <Text strong>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '-'}
                    </Text>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="오늘 등록된 강사" style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
          {todayInstructors.length === 0 ? (
            <Text type="secondary">오늘 등록된 강사가 없습니다.</Text>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {todayInstructors.map((item) => (
                <div key={item.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <Space orientation="vertical" size={2}>
                    <Text strong>{item.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '-'}
                    </Text>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
