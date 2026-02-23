# 프론트엔드 가이드

코드 위치: `ui/src/`

## 1. 기술 스택

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 19.2 | UI 프레임워크 |
| Vite | 7.2 | 빌드 + 개발 서버 |
| TypeScript | 5.9 | 타입 안전 |
| Ant Design | 6.2 | UI 컴포넌트 |
| TanStack Query | 5.90 | 서버 상태 관리 |
| React Router | 7.13 | 클라이언트 라우팅 |

## 2. 디렉터리 구조

```
ui/src/
├── api/mcpClient.ts          # MCP SSE 클라이언트 + API 래퍼
├── pages/                     # 페이지 (17개)
├── components/                # 공통 컴포넌트
│   ├── Layout.tsx             # 사이드바 + 헤더
│   ├── AuthCardLayout.tsx     # 로그인/가입 카드
│   ├── PageHeader.tsx         # CRUD 페이지 헤더
│   ├── AvatarUploadField.tsx  # 아바타 업로드
│   ├── CollapsibleSection.tsx # 접이식 섹션
│   ├── InstructorCareerSection.tsx
│   ├── McpRequestMonitor.tsx  # MCP 요청 모니터
│   ├── PlannedFeaturePanel.tsx # Not Implemented 패널
│   └── SecuritySettingSection.tsx
├── hooks/
│   ├── useDraftStorage.ts     # 임시저장
│   ├── useSessionExpiredGuard.ts # 세션 만료 가드
│   ├── useSitePermissions.ts  # 사이트 권한
│   └── useTableConfig.ts      # 테이블 컬럼 설정
├── contexts/AuthContext/       # 인증 상태
└── utils/
```

## 3. MCP 클라이언트 (mcpClient.ts)

```typescript
// EventSource로 /sse 연결, Tool 호출은 /messages POST
const result = await callTool("course.list", { limit: 50 });
```

- localStorage에 accessToken 저장
- Tool 호출 시 파라미터에 `token` 포함
- 만료 시 `useSessionExpiredGuard`로 처리

## 4. 상태 관리

```typescript
// TanStack Query — 조회
const { data } = useQuery({
  queryKey: ["courses"],
  queryFn: () => callTool("course.list", { limit: 50 }),
});
// 변경
const mutation = useMutation({
  mutationFn: (data) => callTool("course.upsert", data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
});
// AuthContext
const { user, token, login, logout, isAuthenticated } = useAuth();
```

## 5. 라우팅

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/login` | LoginPage | 불필요 |
| `/register` | RegisterPage | 불필요 |
| `/` | DashboardPage | 필요 |
| `/courses` | CoursesPage | 필요 |
| `/instructors` | InstructorsPage | 필요 |
| `/templates` | TemplatesPage | 필요 |
| `/templates-hub` | TemplatesHubPage | 필요 |
| `/render` | RenderPage | 필요 |
| `/my-documents` | MyDocumentsPage | 필요 |
| `/users` | UsersPage | admin/operator |
| `/groups` | GroupsPage | admin/operator |
| `/permissions` | PermissionSettingsPage | admin |
| `/site-settings` | SiteSettingsPage | admin |
| `/profile` | ProfilePage | 필요 |
| `/feature-shares` | FeatureSharesPage | 필요 |

## 6. 환경변수

```env
VITE_MCP_SSE_URL=/sse
VITE_MCP_MESSAGES_URL=/messages
VITE_API_BASE_URL=/api
```

개발 시 Vite 프록시가 localhost:7777로 전달

## 7. 빌드

```bash
cd ui && npm run build   # dist/ 생성
```

프로덕션: Nginx에서 dist/ 서빙 + API 프록시
