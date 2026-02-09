import { Layout as AntLayout, Menu, theme, Button, Dropdown, Space, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
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

const { Header, Content, Sider } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { user, isAuthenticated, logout } = useAuth();

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
      label: '템플릿',
    },
    {
      key: '/render',
      icon: <FilePdfOutlined />,
      label: 'PDF 생성',
    },
    // Member management section
    ...(isAuthenticated ? [
      {
        key: 'member',
        icon: <TeamOutlined />,
        label: '회원관리',
        children: [
          {
            key: '/profile',
            icon: <SettingOutlined />,
            label: '내 정보',
          },
          // Admin only: user list
          ...(user?.role === 'admin' ? [
            {
              key: '/admin/users',
              icon: <TeamOutlined />,
              label: '회원 목록',
            },
          ] : []),
        ],
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
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user.name}</span>
              </Space>
            </Dropdown>
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
