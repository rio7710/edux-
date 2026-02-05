# Frontend Development Guide

## 1. 개요

Edux 프로젝트의 프론트엔드 개발 가이드입니다.
MCP 서버와 SSE로 통신하는 관리자 대시보드를 구축합니다.

## 2. 기술 스택

| 구분 | 기술 | 버전 | 비고 |
| --- | --- | --- | --- |
| **Framework** | React | 18.x | UI 라이브러리 |
| **Language** | TypeScript | 5.x | 정적 타입 |
| **UI Library** | Ant Design | 5.x | 관리자 UI 컴포넌트 |
| **Server State** | React Query (TanStack Query) | 5.x | MCP 응답 캐싱, 리페치 |
| **Client State** | Zustand | 4.x | 전역 상태 (인증, 테마) |
| **Routing** | React Router | 6.x | SPA 라우팅 |
| **Bundler** | Vite | 5.x | 빠른 개발 서버 |
| **HTTP Client** | fetch + EventSource | native | SSE 통신 |

## 3. 프로젝트 구조

```text
ui/
├── src/
│   ├── api/                  # MCP 클라이언트 및 API 함수
│   │   ├── mcpClient.ts      #   SSE 연결 + tools/call 요청
│   │   ├── courseApi.ts      #   course 관련 API
│   │   ├── instructorApi.ts
│   │   ├── templateApi.ts
│   │   └── renderApi.ts
│   ├── components/           # 재사용 컴포넌트
│   │   ├── common/           #   Button, Card, Loading 등
│   │   └── layout/           #   Header, Sidebar, PageLayout
│   ├── hooks/                # 커스텀 훅
│   │   ├── useMcpTool.ts     #   MCP 툴 호출 훅
│   │   └── useAuth.ts        #   인증 상태 훅
│   ├── pages/                # 페이지 컴포넌트
│   │   ├── LoginPage/
│   │   ├── DashboardPage/
│   │   ├── CoursePage/       #   코스 목록/상세/편집
│   │   ├── InstructorPage/
│   │   ├── TemplatePage/
│   │   └── RenderPage/       #   PDF 미리보기/다운로드
│   ├── store/                # Zustand 스토어
│   │   └── authStore.ts
│   ├── types/                # TypeScript 타입 정의
│   │   ├── mcp.ts            #   MCP 프로토콜 타입
│   │   ├── course.ts
│   │   ├── instructor.ts
│   │   └── template.ts
│   ├── utils/                # 유틸리티 함수
│   │   └── format.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 4. MCP 클라이언트 구현

### SSE 연결

```typescript
// src/api/mcpClient.ts
const MCP_SSE_URL = import.meta.env.VITE_MCP_SSE_URL || 'http://localhost:7777/sse';
const MCP_MESSAGES_URL = import.meta.env.VITE_MCP_MESSAGES_URL || 'http://localhost:7777/messages';

interface McpToolResult<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function callMcpTool<T>(
  name: string,
  args: Record<string, unknown>,
  token?: string
): Promise<T> {
  const res = await fetch(MCP_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const json = await res.json();
  const result = json.result as McpToolResult<T>;

  if (result.isError) {
    throw new Error(result.content[0]?.text || 'Unknown error');
  }

  return JSON.parse(result.content[0].text) as T;
}
```

### React Query 훅

```typescript
// src/hooks/useMcpTool.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { callMcpTool } from '../api/mcpClient';
import { useAuthStore } from '../store/authStore';

export function useMcpQuery<T>(
  toolName: string,
  args: Record<string, unknown>,
  options?: { enabled?: boolean }
) {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: [toolName, args],
    queryFn: () => callMcpTool<T>(toolName, args, token),
    enabled: options?.enabled ?? true,
  });
}

export function useMcpMutation<TArgs, TResult>(toolName: string) {
  const token = useAuthStore((s) => s.token);

  return useMutation({
    mutationFn: (args: TArgs) => callMcpTool<TResult>(toolName, args as Record<string, unknown>, token),
  });
}
```

### 사용 예시

```typescript
// src/pages/CoursePage/CourseList.tsx
import { useMcpQuery, useMcpMutation } from '../../hooks/useMcpTool';
import { Table, Button, message } from 'antd';
import type { Course } from '../../types/course';

export function CourseList() {
  const { data, isLoading, refetch } = useMcpQuery<{ items: Course[]; total: number }>(
    'course.list',
    { page: 1, pageSize: 20 }
  );

  const deleteMutation = useMcpMutation<{ id: string }, void>('course.delete');

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    message.success('삭제되었습니다');
    refetch();
  };

  return (
    <Table
      loading={isLoading}
      dataSource={data?.items}
      rowKey="id"
      columns={[
        { title: '제목', dataIndex: 'title' },
        { title: '시간', dataIndex: 'durationHours' },
        {
          title: '작업',
          render: (_, record) => (
            <Button danger onClick={() => handleDelete(record.id)}>
              삭제
            </Button>
          ),
        },
      ]}
    />
  );
}
```

## 5. 인증 상태 관리

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: string; name: string; role: string } | null;
  setAuth: (token: string, user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' }
  )
);
```

## 6. 페이지 구성

| 경로 | 페이지 | 설명 |
| --- | --- | --- |
| `/login` | LoginPage | 로그인 (JWT 발급) |
| `/` | DashboardPage | 대시보드 (통계, 최근 활동) |
| `/courses` | CoursePage | 코스 목록 |
| `/courses/:id` | CourseDetailPage | 코스 상세/편집 |
| `/instructors` | InstructorPage | 강사 목록/편집 |
| `/templates` | TemplatePage | 템플릿 목록/편집/미리보기 |
| `/render` | RenderPage | PDF 생성/다운로드 |

## 7. Ant Design 활용

### 주요 컴포넌트

- **Table**: 코스/강사/템플릿 목록
- **Form + Form.Item**: 생성/수정 폼
- **Modal**: 확인 다이얼로그, 미리보기
- **Menu + Layout.Sider**: 사이드바 네비게이션
- **Breadcrumb**: 페이지 경로 표시
- **message / notification**: 토스트 알림

### 테마 커스터마이징

```typescript
// src/main.tsx
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';

const theme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={theme} locale={koKR}>
    <App />
  </ConfigProvider>
);
```

## 8. 환경 변수

```text
# ui/.env.development
VITE_MCP_SSE_URL=http://localhost:7777/sse
VITE_MCP_MESSAGES_URL=http://localhost:7777/messages
VITE_API_BASE_URL=http://localhost:7777

# ui/.env.production
VITE_MCP_SSE_URL=https://api.edux.com/sse
VITE_MCP_MESSAGES_URL=https://api.edux.com/messages
VITE_API_BASE_URL=https://api.edux.com
```

## 9. 개발 서버 실행

```bash
cd ui
npm install
npm run dev
# http://localhost:5173
```

## 10. 빌드

```bash
npm run build
# dist/ 폴더에 정적 파일 생성
```

---

**관련 문서:** `ARCHITECTURE.md`, `API_REFERENCE.md`, `MCP_TOOLS.md`
