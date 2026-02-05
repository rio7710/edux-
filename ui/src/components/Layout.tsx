import { Layout as AntLayout, Menu, theme } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  FileTextOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Content, Sider } = AntLayout;

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
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Edux - HR 강의 계획서 관리
        </h1>
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
