import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp } from 'antd';
import koKR from 'antd/locale/ko_KR';

import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import CoursesPage from './pages/CoursesPage';
import InstructorsPage from './pages/InstructorsPage';
import TemplatesHubPage from './pages/TemplatesHubPage';
import { TestEchoPage } from './pages/TestEchoPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import SiteSettingsPage from './pages/SiteSettingsPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import GroupsPage from './pages/GroupsPage';
import FeatureSharesPage from './pages/FeatureSharesPage';
import MobileUserLayout from './components/MobileUserLayout';
import MobileCoursesPage from './pages/MobileCoursesPage';
import MobileDocumentsPage from './pages/MobileDocumentsPage';
import MobileMessagesPage from './pages/MobileMessagesPage';
import MobileProfilePage from './pages/MobileProfilePage';
import { mcpClient } from './api/mcpClient';
import McpRequestMonitor from './components/McpRequestMonitor';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  useEffect(() => {
    // Connect to MCP server on mount
    mcpClient.connect().catch((error) => {
      console.error('Failed to connect to MCP server:', error);
    });

    return () => {
      mcpClient.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <McpRequestMonitor />
      <Routes>
        {/* Auth routes (no layout) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Main app routes (with layout) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="instructors" element={<InstructorsPage />} />
          <Route path="templates" element={<TemplatesHubPage />} />
          <Route path="documents" element={<MyDocumentsPage />} />
          <Route path="my-documents" element={<Navigate to="/documents" replace />} />
          <Route path="feature-shares" element={<FeatureSharesPage />} />
          <Route path="test-echo" element={<TestEchoPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin/users" element={<UsersPage />} />
          <Route path="admin/groups" element={<GroupsPage />} />
          <Route
            path="admin/permissions"
            element={<Navigate to="/admin/site-settings?tab=permissions" replace />}
          />
          <Route path="admin/site-settings" element={<SiteSettingsPage />} />
          <Route
            path="admin/board"
            element={<Navigate to="/admin/site-settings?tab=board" replace />}
          />
        </Route>

        {/* Mobile user mode routes */}
        <Route path="/m" element={<MobileUserLayout />}>
          <Route index element={<Navigate to="/m/courses" replace />} />
          <Route path="courses" element={<MobileCoursesPage />} />
          <Route path="documents" element={<MobileDocumentsPage />} />
          <Route path="messages" element={<MobileMessagesPage />} />
          <Route path="profile" element={<MobileProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={koKR}>
        <AntApp>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
