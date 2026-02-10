import { Layout as AntLayout, Menu, theme, Button, Dropdown, Space, Avatar, Tag, message, Modal } from 'antd';
import { useEffect, useState } from 'react';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  LogoutOutlined,
  LoginOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/mcpClient';

const { Header, Content, Sider } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { user, isAuthenticated, logout, accessToken, extendSession } = useAuth();
  const [sessionRemaining, setSessionRemaining] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [extendPromptShown, setExtendPromptShown] = useState(false);
  const [showExpiredPrompt, setShowExpiredPrompt] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [siteTitle, setSiteTitle] = useState<string>('Edux - HR 강의 계획서 관리');
  const [draftPrompted, setDraftPrompted] = useState(false);

  // Build menu items dynamically
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '대시보드',
    },
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: '코스 관리',
    },
    {
      key: '/instructors',
      icon: <UserOutlined />,
      label: '강사 관리',
    },
    {
      key: '/templates',
      icon: <FileTextOutlined />,
      label: '템플릿 관리',
    },
    {
      key: '/render',
      icon: <FilePdfOutlined />,
      label: 'PDF 생성',
    },
    // Member management section
    ...(isAuthenticated ? [
      {
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: '회원관리',
        disabled: user?.role !== 'admin',
      },
      {
        key: '/admin/site-settings',
        icon: <SettingOutlined />,
        label: '사이트 관리',
        disabled: !(user?.role === 'admin' || user?.role === 'operator'),
      },
    ] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '내 정보',
      onClick: () => navigate('/profile'),
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
    let cancelled = false;
    const loadSetting = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'session_extend_minutes')) as {
          value: number | null;
        };
        const minutes =
          typeof result?.value === 'number'
            ? result.value
            : Number((result as any)?.value?.minutes) || 10;
        if (!cancelled) setExtendMinutes(minutes);
      } catch {
        if (!cancelled) setExtendMinutes(10);
      }
    };
    loadSetting();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    const setFavicon = (href: string) => {
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (link) {
        link.href = href;
      }
    };
    if (!accessToken) {
      setFavicon('/favicon.svg');
      return;
    }
    let cancelled = false;
    const loadFavicon = async () => {
      try {
        const result = (await api.siteSettingGet(accessToken, 'favicon_url')) as {
          value: string | null;
        };
        if (!cancelled) {
          setFavicon(result?.value || '/favicon.svg');
        }
      } catch {
        if (!cancelled) setFavicon('/favicon.svg');
      }
    };
    loadFavicon();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

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
    if (!accessToken) {
      setLogoUrl('');
      setSiteTitle('Edux - HR 강의 계획서 관리');
      document.title = 'Edux - HR 강의 계획서 관리';
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [logoResult, titleResult] = await Promise.all([
          api.siteSettingGet(accessToken, 'logo_url') as Promise<{ value: string | null }>,
          api.siteSettingGet(accessToken, 'site_title') as Promise<{ value: string | null }>,
        ]);
        if (cancelled) return;
        const nextLogo = logoResult?.value || '';
        const nextTitle = titleResult?.value || 'Edux - HR 강의 계획서 관리';
        setLogoUrl(nextLogo);
        setSiteTitle(nextTitle);
        document.title = nextTitle;
      } catch {
        if (!cancelled) {
          setLogoUrl('');
          setSiteTitle('Edux - HR 강의 계획서 관리');
          document.title = 'Edux - HR 강의 계획서 관리';
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated || draftPrompted) return;
    const sessionKey = 'draft:prompted';
    if (sessionStorage.getItem(sessionKey)) {
      setDraftPrompted(true);
      return;
    }

    let targetPath: string | null = null;
    let modalTitle = '임시 저장된 작업이 있습니다';

    const templateKeys = Object.keys(localStorage || {}).filter((key) =>
      key.startsWith('draft:template:'),
    );
    if (templateKeys.length > 0) {
      const type = templateKeys[0].replace('draft:template:', '');
      const draftParam = type || 'all';
      targetPath = `/templates?draft=${draftParam}`;
      modalTitle = '임시 저장된 템플릿이 있습니다';
    } else if (localStorage.getItem('draft:course')) {
      targetPath = '/courses?draft=1';
      modalTitle = '임시 저장된 코스가 있습니다';
    } else if (localStorage.getItem('draft:instructor')) {
      targetPath = '/instructors?draft=1';
      modalTitle = '임시 저장된 강사 정보가 있습니다';
    }

    if (!targetPath) return;

    setDraftPrompted(true);
    sessionStorage.setItem(sessionKey, '1');
    Modal.confirm({
      title: modalTitle,
      content: '이어서 작성하시겠습니까?',
      okText: '이어서 작성',
      cancelText: '나중에',
      onOk: () => {
        navigate(targetPath as string);
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
              <span style={{ color: '#666' }}>
                종료까지 {formatRemaining(sessionRemaining)}
              </span>
              <Button
                size="small"
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
                연장(+{extendMinutes}분)
              </Button>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size="small" icon={<UserOutlined />} />
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
        <Sider
          width={200}
          style={{ background: token.colorBgContainer }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <AntLayout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
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
    </AntLayout>
  );
}
