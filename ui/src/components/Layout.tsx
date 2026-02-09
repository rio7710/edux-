import { Layout as AntLayout, Menu, theme, Button, Dropdown, Space, Avatar, Tag } from 'antd';
import { useEffect, useState } from 'react';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  LogoutOutlined,
  LoginOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content, Sider } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { user, isAuthenticated, logout, accessToken } = useAuth();
  const [sessionRemaining, setSessionRemaining] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Build menu items dynamically
  const menuItems = [
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

  const formatRemaining = (ms: number | null) => {
    if (ms === null) return '-';
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Edux - HR 강의 계획서 관리
        </h1>

        <Space>
          {isAuthenticated && user ? (
            <Space>
              <Tag color={sessionExpired ? 'red' : 'green'}>
                {sessionExpired ? '세션 만료' : '세션 정상'}
              </Tag>
              <span style={{ color: '#666' }}>
                종료까지 {formatRemaining(sessionRemaining)}
              </span>
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
    </AntLayout>
  );
}
