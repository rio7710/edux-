import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp } from 'antd';
import koKR from 'antd/locale/ko_KR';

import Layout from './components/Layout';
import CoursesPage from './pages/CoursesPage';
import InstructorsPage from './pages/InstructorsPage';
import TemplatesPage from './pages/TemplatesPage';
import RenderPage from './pages/RenderPage';
import { TestEchoPage } from './pages/TestEchoPage';
import { mcpClient } from './api/mcpClient';

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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/courses" replace />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="instructors" element={<InstructorsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="render" element={<RenderPage />} />
          <Route path="test-echo" element={<TestEchoPage />} />
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
          <AppContent />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
