import { Layout as AntLayout, Menu, theme, Button, Dropdown, Space, Avatar, Tag, message, Modal, Drawer, Grid, Badge } from 'antd';
import { useEffect, useState } from 'react';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  LogoutOutlined,
  LoginOutlined,
  TeamOutlined,
  SettingOutlined,
  InboxOutlined,
  MenuOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, mcpClient } from '../api/mcpClient';
import { useSitePermissions } from '../hooks/useSitePermissions';
import {
  clearClientErrorReports,
  downloadClientErrorReports,
  getClientErrorReports,
} from '../utils/errorReport';

const { Header, Content, Sider } = AntLayout;
type MenuItem = NonNullable<MenuProps['items']>[number];

const ROUTE_MENU_GATES: Array<{ path: string; menuKey: string }> = [
  { path: '/dashboard', menuKey: 'dashboard' },
  { path: '/courses', menuKey: 'courses' },
  { path: '/instructors', menuKey: 'instructors' },
  { path: '/templates', menuKey: 'templates' },
  { path: '/documents', menuKey: 'documents' },
  { path: '/profile', menuKey: 'profile' },
  { path: '/admin/users', menuKey: 'users' },
  { path: '/admin/groups', menuKey: 'groups' },
  { path: '/admin/site-settings', menuKey: 'site-settings' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const {
    user,
    isAuthenticated,
    logout,
    accessToken,
    extendSession,
    isImpersonating,
    impersonationActor,
    restoreImpersonation,
  } = useAuth();
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const [sessionRemaining, setSessionRemaining] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [extendPromptShown, setExtendPromptShown] = useState(false);
  const [showExpiredPrompt, setShowExpiredPrompt] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [siteTitle, setSiteTitle] = useState<string>('Edux - HR 강의 계획서 관리');
  const [draftPrompted, setDraftPrompted] = useState(false);
  const [menuDeniedBehavior, setMenuDeniedBehavior] = useState<'hide' | 'disable'>(() => {
    const cached = localStorage.getItem('menu_denied_behavior');
    return cached === 'hide' ? 'hide' : 'disable';
  });
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [messageLampBlinking, setMessageLampBlinking] = useState(false);
  const byBehavior = (allowed: boolean, item: MenuItem) => {
    if (menuDeniedBehavior === 'hide') {
      return allowed ? item : null;
    }
    return { ...item, disabled: !allowed || (item as any)?.disabled };
  };

  const roleIsAdmin = user?.role === 'admin';
  const roleIsAdminOrOperator = user?.role === 'admin' || user?.role === 'operator';
  const canReadCoursesFeature =
    canUseFeature('courses', 'course.list') ||
    canUseFeature('courses', 'course.listMine') ||
    canUseFeature('courses', 'course.get');
  const canReadInstructorsFeature =
    canUseFeature('instructors', 'instructor.list') ||
    canUseFeature('instructors', 'instructor.get') ||
    canUseFeature('instructors', 'instructor.getByUser');
  const canReadTemplatesFeature =
    canUseFeature('templates', 'template.list') ||
    canUseFeature('templates', 'template.get') ||
    canUseFeature('my-templates', 'template.listMine');
  const dashboardAllowed =
    !isAuthenticated ||
    (canAccessMenu('dashboard') && canUseFeature('dashboard', 'dashboard.read'));
  const courseAllowed =
    !isAuthenticated ||
    (canAccessMenu('courses') && canReadCoursesFeature);
  const instructorAllowed =
    !isAuthenticated ||
    (canAccessMenu('instructors') && canReadInstructorsFeature);
  const templateAllowed =
    !isAuthenticated ||
    (canAccessMenu('templates') && canReadTemplatesFeature);
  const usersAllowed = !isAuthenticated || canAccessMenu('users');
  const groupsAllowed = !isAuthenticated || canAccessMenu('groups');
  const siteSettingsAllowed = !isAuthenticated || canAccessMenu('site-settings');
  const documentsAllowed = !isAuthenticated || canAccessMenu('documents');
  const profileAllowed = !isAuthenticated || canAccessMenu('profile');

  const adminItems: MenuProps['items'] = [
    byBehavior(dashboardAllowed, {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dash Board',
    }),
    byBehavior(courseAllowed, {
      key: '/courses',
      icon: <BookOutlined />,
      label: '코스 관리',
    }),
    byBehavior(instructorAllowed, {
      key: '/instructors',
      icon: <UserOutlined />,
      label: '강사 관리',
    }),
    byBehavior(templateAllowed, {
      key: '/templates',
      icon: <FileTextOutlined />,
      label: '템플릿 관리',
    }),
    ...(isAuthenticated
      ? [
          byBehavior(!!roleIsAdmin && usersAllowed, {
            key: '/admin/users',
            icon: <TeamOutlined />,
            label: '회원관리',
            disabled: !roleIsAdmin || !usersAllowed,
          }),
          byBehavior(!!roleIsAdminOrOperator && groupsAllowed, {
            key: '/admin/groups',
            icon: <TeamOutlined />,
            label: '그룹관리',
            disabled: !roleIsAdminOrOperator || !groupsAllowed,
          }),
          byBehavior(!!roleIsAdminOrOperator && siteSettingsAllowed, {
            key: '/admin/site-settings',
            icon: <SettingOutlined />,
            label: '사이트 관리',
            disabled: !roleIsAdminOrOperator || !siteSettingsAllowed,
          }),
        ]
      : []),
  ].filter(Boolean) as MenuProps['items'];

  const userItems: MenuProps['items'] = isAuthenticated
    ? [
        byBehavior(documentsAllowed, {
          key: '/documents',
          icon: <InboxOutlined />,
          label: '내 문서함',
        }),
        byBehavior(profileAllowed, {
          key: '/profile',
          icon: <UserOutlined />,
          label: '내 정보',
        }),
        {
          key: '/feature-shares',
          icon: <ShareAltOutlined />,
          label: (
            <Space size={8}>
              <span>메시지함</span>
              {unreadMessageCount > 0 && <Badge count={unreadMessageCount} size="small" />}
            </Space>
          ),
        },
      ].filter(Boolean) as MenuProps['items']
    : [];

  const menuItems: MenuProps['items'] = isAuthenticated
    ? [
        {
          type: 'group',
          label: '관리자 메뉴',
          children: adminItems,
        },
        {
          type: 'divider',
        },
        {
          type: 'group',
          label: '사용자 메뉴',
          children: userItems,
        },
      ]
    : adminItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDownloadErrorReports = () => {
    const reports = getClientErrorReports();
    if (reports.length === 0) {
      message.info('저장된 오류 로그가 없습니다.');
      return;
    }
    const filename = downloadClientErrorReports(reports);
    if (!filename) {
      message.error('오류 로그 저장에 실패했습니다.');
      return;
    }
    message.success(`오류 로그 파일 저장 완료: ${filename}`);
  };

  const handleClearErrorReports = () => {
    Modal.confirm({
      title: '오류 로그 삭제',
      content: '저장된 클라이언트 오류 로그를 모두 삭제할까요?',
      okText: '삭제',
      cancelText: '취소',
      onOk: () => {
        clearClientErrorReports();
        message.success('오류 로그를 삭제했습니다.');
      },
    });
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === location.pathname) return;
    const hasUnsaved = (window as any).__siteSettingsHasUnsaved;
    if (hasUnsaved) {
      setPendingPath(key);
      setUnsavedPromptOpen(true);
      return;
    }
    navigate(key);
    setMobileMenuOpen(false);
  };

  const handleMessageLampClick = () => {
    navigate('/feature-shares');
    setMobileMenuOpen(false);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '내 정보',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'download-error-reports',
      icon: <FileTextOutlined />,
      label: '오류 로그 다운로드',
      onClick: handleDownloadErrorReports,
    },
    {
      key: 'clear-error-reports',
      icon: <SettingOutlined />,
      label: '오류 로그 삭제',
      onClick: handleClearErrorReports,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ];

  useEffect(() => {
    let cancelled = false;
    const setFavicon = (href: string) => {
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (link) {
        link.href = href;
      }
    };

    const loadSiteSettings = async () => {
      if (!accessToken || !isAuthenticated) {
        if (cancelled) return;
        setMenuDeniedBehavior('disable');
        setExtendMinutes(10);
        setFavicon('/favicon.svg');
        setLogoUrl('');
        setSiteTitle('Edux - HR 강의 계획서 관리');
        document.title = 'Edux - HR 강의 계획서 관리';
        return;
      }
      try {
        const result = (await api.siteSettingGetMany(accessToken, [
          'menu_denied_behavior',
          'session_extend_minutes',
          'favicon_url',
          'logo_url',
          'site_title',
        ])) as {
          items?: Record<string, unknown>;
        };
        if (cancelled) return;
        const items = result?.items || {};
        const menuDenied = items.menu_denied_behavior === 'hide' ? 'hide' : 'disable';
        const sessionMinutesRaw = items.session_extend_minutes;
        const sessionMinutes =
          typeof sessionMinutesRaw === 'number'
            ? sessionMinutesRaw
            : Number((sessionMinutesRaw as any)?.minutes) || 10;
        const favicon =
          typeof items.favicon_url === 'string' && items.favicon_url.trim()
            ? items.favicon_url
            : '/favicon.svg';
        const logo =
          typeof items.logo_url === 'string' && items.logo_url.trim() ? items.logo_url : '';
        const title =
          typeof items.site_title === 'string' && items.site_title.trim()
            ? items.site_title
            : 'Edux - HR 강의 계획서 관리';

        setMenuDeniedBehavior(menuDenied);
        localStorage.setItem('menu_denied_behavior', menuDenied);
        setExtendMinutes(sessionMinutes);
        setFavicon(favicon);
        setLogoUrl(logo);
        setSiteTitle(title);
        document.title = title;
      } catch {
        if (cancelled) return;
        setMenuDeniedBehavior('disable');
        setExtendMinutes(10);
        setFavicon('/favicon.svg');
        setLogoUrl('');
        setSiteTitle('Edux - HR 강의 계획서 관리');
        document.title = 'Edux - HR 강의 계획서 관리';
      }
    };
    loadSiteSettings();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    const handleBehavior = (event: Event) => {
      const customEvent = event as CustomEvent<'hide' | 'disable'>;
      if (customEvent.detail === 'hide' || customEvent.detail === 'disable') {
        setMenuDeniedBehavior(customEvent.detail);
        localStorage.setItem('menu_denied_behavior', customEvent.detail);
      }
    };
    window.addEventListener('menuDeniedBehaviorUpdated', handleBehavior as EventListener);
    return () => {
      window.removeEventListener('menuDeniedBehaviorUpdated', handleBehavior as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const canAccessRouteMenu = (menuKey: string) => {
      if (menuKey === 'dashboard') {
        return canAccessMenu(menuKey) && canUseFeature('dashboard', 'dashboard.read');
      }
      if (menuKey === 'courses') {
        return canAccessMenu(menuKey) && canReadCoursesFeature;
      }
      if (menuKey === 'instructors') {
        return canAccessMenu(menuKey) && canReadInstructorsFeature;
      }
      if (menuKey === 'templates') {
        return canAccessMenu(menuKey) && canReadTemplatesFeature;
      }
      return canAccessMenu(menuKey);
    };
    const matched = ROUTE_MENU_GATES.find(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`),
    );
    if (!matched) return;
    if (canAccessRouteMenu(matched.menuKey)) return;

    const fallbackPath =
      ROUTE_MENU_GATES.find((item) => canAccessRouteMenu(item.menuKey))?.path ||
      '/feature-shares';
    if (location.pathname !== fallbackPath) {
      navigate(fallbackPath, { replace: true });
    }
  }, [
    canAccessMenu,
    canUseFeature,
    canReadCoursesFeature,
    canReadInstructorsFeature,
    canReadTemplatesFeature,
    isAuthenticated,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    let timer: number | undefined;

    const decodeExp = (jwtToken?: string | null): number | null => {
      if (!jwtToken) return null;
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return null;
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (typeof payload?.exp === 'number') return payload.exp * 1000;
      } catch {
        return null;
      }
      return null;
    };

    const update = () => {
      const expMs = decodeExp(accessToken);
      if (!expMs) {
        setSessionRemaining(null);
        setSessionExpired(false);
        return;
      }
      const diff = expMs - Date.now();
      if (diff <= 0) {
        setSessionRemaining(0);
        setSessionExpired(true);
      } else {
        setSessionRemaining(diff);
        setSessionExpired(false);
      }
    };

    update();
    timer = window.setInterval(update, 1000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [accessToken]);

  useEffect(() => {
    if (sessionRemaining === null) return;
    if (sessionRemaining <= 0) return;
    const thresholdMs = 5 * 60 * 1000;
    if (sessionRemaining <= thresholdMs && !extendPromptShown) {
      setShowExtendPrompt(true);
      setExtendPromptShown(true);
    }
  }, [sessionRemaining, extendPromptShown]);

  useEffect(() => {
    if (!sessionExpired) return;
    setShowExtendPrompt(false);
    window.dispatchEvent(new CustomEvent('sessionExpired'));
    setShowExpiredPrompt(true);
  }, [sessionExpired]);

  useEffect(() => {
    const setFavicon = (href: string) => {
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (link) {
        link.href = href;
      }
    };
    const handleFavicon = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== undefined) {
        setFavicon(customEvent.detail || '/favicon.svg');
      }
    };
    window.addEventListener('siteFaviconUpdated', handleFavicon as EventListener);
    return () => {
      window.removeEventListener('siteFaviconUpdated', handleFavicon as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || draftPrompted) return;
    const sessionKey = 'draft:prompted';
    if (sessionStorage.getItem(sessionKey)) {
      setDraftPrompted(true);
      return;
    }

    let targetPath: string | null = null;
    let targetType: 'template' | 'course' | 'instructor' | null = null;
    let modalTitle = '임시 저장된 작업이 있습니다';

    const templateKeys = Object.keys(localStorage || {}).filter((key) =>
      key.startsWith('draft:template:'),
    );
    if (templateKeys.length > 0) {
      const type = templateKeys[0].replace('draft:template:', '');
      const draftParam = type || 'all';
      targetPath = `/templates?draft=${draftParam}`;
      targetType = 'template';
      modalTitle = '임시 저장된 템플릿이 있습니다';
    } else if (localStorage.getItem('draft:course')) {
      targetPath = '/courses?draft=1';
      targetType = 'course';
      modalTitle = '임시 저장된 코스가 있습니다';
    } else if (localStorage.getItem('draft:instructor')) {
      targetPath = '/instructors?draft=1';
      targetType = 'instructor';
      modalTitle = '임시 저장된 강사 정보가 있습니다';
    }

    if (!targetPath) return;

    setDraftPrompted(true);
    sessionStorage.setItem(sessionKey, '1');
    Modal.confirm({
      title: modalTitle,
      content: '이어서 작성하시겠습니까?',
      okText: '이어서 작성',
      cancelText: '아니오',
      maskClosable: false,
      closable: false,
      onOk: () => {
        navigate(targetPath as string);
      },
      onCancel: () => {
        Modal.confirm({
          title: '이전 작업 초기화',
          content: '이전 임시 저장 작업을 삭제하고 새로 시작합니다.',
          okText: '확인',
          cancelButtonProps: { style: { display: 'none' } },
          maskClosable: false,
          closable: false,
          onOk: () => {
            if (targetType === 'template') {
              Object.keys(localStorage || {}).forEach((key) => {
                if (key.startsWith('draft:template:')) {
                  localStorage.removeItem(key);
                }
              });
            } else if (targetType === 'course') {
              localStorage.removeItem('draft:course');
            } else if (targetType === 'instructor') {
              localStorage.removeItem('draft:instructor');
            }
            message.success('임시 저장 정보를 삭제했습니다.');
          },
        });
      },
    });
  }, [isAuthenticated, draftPrompted, navigate]);

  useEffect(() => {
    if (isAuthenticated) return;
    const sessionKey = 'draft:prompted';
    sessionStorage.removeItem(sessionKey);
    setDraftPrompted(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setUnreadMessageCount(0);
      setMessageLampBlinking(false);
      return;
    }

    let cancelled = false;
    let lastAttemptAt = 0;
    let lastFailedAt = 0;
    const loadUnreadCount = async () => {
      const now = Date.now();
      if (now - lastAttemptAt < 1000) return;
      if (now - lastFailedAt < 5000) return;
      lastAttemptAt = now;
      try {
        if (!mcpClient.isConnected()) {
          await mcpClient.connect();
        }
        const result = (await api.messageUnreadSummary({ token: accessToken })) as {
          total?: number;
        };
        if (cancelled) return;
        const nextCount = Number(result?.total || 0);
        setUnreadMessageCount(nextCount);
        setMessageLampBlinking(nextCount > 0);
      } catch {
        lastFailedAt = Date.now();
        if (cancelled) return;
      }
    };

    void loadUnreadCount();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadUnreadCount();
    }, 15000);
    const onFocus = () => {
      void loadUnreadCount();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount();
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
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    const handleTitle = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        setSiteTitle(customEvent.detail);
        document.title = customEvent.detail;
      }
    };
    const handleLogo = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== undefined) {
        setLogoUrl(customEvent.detail);
      }
    };
    window.addEventListener('siteTitleUpdated', handleTitle as EventListener);
    window.addEventListener('siteLogoUpdated', handleLogo as EventListener);
    return () => {
      window.removeEventListener('siteTitleUpdated', handleTitle as EventListener);
      window.removeEventListener('siteLogoUpdated', handleLogo as EventListener);
    };
  }, []);

  const formatRemaining = (ms: number | null) => {
    if (ms === null) return '-';
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const recomputeRemaining = () => {
    const decodeExp = (jwtToken?: string | null): number | null => {
      if (!jwtToken) return null;
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return null;
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (typeof payload?.exp === 'number') return payload.exp * 1000;
      } catch {
        return null;
      }
      return null;
    };
    const expMs = decodeExp(accessToken);
    if (!expMs) {
      setSessionRemaining(null);
      setSessionExpired(false);
      return;
    }
    const diff = expMs - Date.now();
    if (diff <= 0) {
      setSessionRemaining(0);
      setSessionExpired(true);
    } else {
      setSessionRemaining(diff);
      setSessionExpired(false);
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
            />
          )}
          <img
            src={logoUrl || '/logo.svg'}
            alt="site logo"
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }}
          />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            {siteTitle}
          </h1>
        </div>

        <Space>
          {isAuthenticated && user ? (
            <Space>
              <Tag color={sessionExpired ? 'red' : 'green'}>
                {sessionExpired ? '세션 만료' : '세션 정상'}
              </Tag>
              {isImpersonating && (
                <Tag color="magenta">
                  가장 로그인 ({impersonationActor?.email || 'admin'})
                </Tag>
              )}
              <Button
                type="text"
                className={`message-lamp ${unreadMessageCount > 0 ? 'is-on' : 'is-off'} ${
                  messageLampBlinking ? 'is-blinking' : ''
                }`}
                onClick={handleMessageLampClick}
                aria-label={`메시지함 이동, 안 읽은 메시지 ${unreadMessageCount}건`}
              >
                <span className="message-lamp-dot" />
                <span className="message-lamp-label">메시지 램프</span>
                <span className="message-lamp-count">{unreadMessageCount}</span>
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'extend',
                      label: `연장(+${extendMinutes}분)`,
                      onClick: async () => {
                        try {
                          const minutes = await extendSession();
                          message.success(`세션이 ${minutes || extendMinutes}분으로 연장되었습니다.`);
                          recomputeRemaining();
                          setShowExtendPrompt(false);
                          setExtendPromptShown(false);
                        } catch (err: any) {
                          message.error(`연장 실패: ${err.message}`);
                        }
                      },
                    },
                    ...(isImpersonating
                      ? [
                          { type: 'divider' as const },
                          {
                            key: 'restore',
                            label: '원래 계정 복귀',
                            onClick: () => {
                              restoreImpersonation();
                              message.success('원래 관리자 계정으로 복귀했습니다.');
                              navigate('/admin/users');
                            },
                          },
                        ]
                      : []),
                  ],
                }}
                placement="bottomRight"
              >
                <span style={{ color: '#666', cursor: 'pointer' }}>
                  종료까지 {formatRemaining(sessionRemaining)}
                </span>
              </Dropdown>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size="small" src={user.avatarUrl || undefined} icon={<UserOutlined />} />
                  <span>{user.name}</span>
                </Space>
              </Dropdown>
            </Space>
          ) : (
            <Space>
              <Button
                type="text"
                icon={<LoginOutlined />}
                onClick={() => navigate('/login')}
              >
                로그인
              </Button>
              <Button type="primary" onClick={() => navigate('/register')}>
                회원가입
              </Button>
            </Space>
          )}
        </Space>
      </Header>
      <AntLayout>
        {!isMobile && (
          <Sider
            width={200}
            style={{ background: token.colorBgContainer }}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ height: '100%', borderRight: 0 }}
              items={menuItems}
              onClick={handleMenuClick}
            />
          </Sider>
        )}
        <AntLayout style={{ padding: isMobile ? '16px' : '24px' }}>
          <Content
            style={{
              padding: isMobile ? 16 : 24,
              margin: 0,
              minHeight: 280,
              background: token.colorBgContainer,
              borderRadius: token.borderRadiusLG,
            }}
          >
            <Outlet />
          </Content>
        </AntLayout>
      </AntLayout>
      <Drawer
        title="메뉴"
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ borderRight: 0 }}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>
      <Modal
        open={showExtendPrompt}
        title="세션이 곧 종료됩니다"
        onCancel={() => setShowExtendPrompt(false)}
        footer={[
          <Button
            key="no"
            onClick={() => {
              setShowExtendPrompt(false);
            }}
          >
            연장안함
          </Button>,
          <Button
            key="yes"
            type="primary"
            onClick={async () => {
              try {
                const minutes = await extendSession();
                message.success(`세션이 ${minutes || extendMinutes}분으로 연장되었습니다.`);
                recomputeRemaining();
                setShowExtendPrompt(false);
                setExtendPromptShown(false);
              } catch (err: any) {
                message.error(`연장 실패: ${err.message}`);
              }
            }}
          >
            연장
          </Button>,
        ]}
      >
        <div>세션 연장을 진행할까요?</div>
      </Modal>
      <Modal
        open={showExpiredPrompt}
        title="세션이 만료되었습니다"
        onCancel={() => setShowExpiredPrompt(false)}
        footer={[
          <Button
            key="login"
            type="primary"
            onClick={() => {
              setShowExpiredPrompt(false);
              logout();
              navigate('/login');
            }}
          >
            다시 로그인
          </Button>,
        ]}
      >
        <div>보안을 위해 다시 로그인해주세요.</div>
      </Modal>
      <Modal
        open={unsavedPromptOpen}
        title="변경내용이 있습니다"
        onCancel={() => {
          setUnsavedPromptOpen(false);
          setPendingPath(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setUnsavedPromptOpen(false);
              setPendingPath(null);
            }}
          >
            취소
          </Button>,
          <Button
            key="discard"
            onClick={() => {
              (window as any).__siteSettingsHasUnsaved = false;
              const target = pendingPath;
              setUnsavedPromptOpen(false);
              setPendingPath(null);
              if (target) navigate(target);
            }}
          >
            저장 안함
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={async () => {
              const saveFn = (window as any).__siteSettingsSave;
              if (typeof saveFn === 'function') {
                await Promise.resolve(saveFn());
              }
              (window as any).__siteSettingsHasUnsaved = false;
              const target = pendingPath;
              setUnsavedPromptOpen(false);
              setPendingPath(null);
              if (target) navigate(target);
            }}
          >
            저장 후 이동
          </Button>,
        ]}
      >
        <div>변경 내용을 저장한 뒤 이동할까요?</div>
      </Modal>
    </AntLayout>
  );
}
