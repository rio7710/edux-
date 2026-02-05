# Testing Guide

## 1. 개요

Edux 프로젝트의 코드 품질과 안정성을 보장하기 위한 테스트 전략입니다.
백엔드(MCP 서버)와 프론트엔드 모두를 다룹니다.

## 2. 테스트 피라미드

```text
        ┌─────────┐
        │  E2E    │  적음, 비용 높음
       ─┴─────────┴─
      ┌─────────────┐
      │ Integration │  중간
     ─┴─────────────┴─
    ┌─────────────────┐
    │   Unit Tests    │  많음, 비용 낮음
    └─────────────────┘
```

## 3. 기술 스택

| 구분 | 도구 | 용도 |
| --- | --- | --- |
| **Backend Unit** | Vitest | MCP 툴 핸들러, 서비스 로직 |
| **Backend Integration** | Vitest + Prisma Test | DB 연동 테스트 |
| **Frontend Unit** | Vitest + React Testing Library | 컴포넌트, 훅 |
| **Frontend Integration** | MSW (Mock Service Worker) | MCP API 모킹 |
| **E2E** | Playwright | 전체 사용자 시나리오 |

## 4. 백엔드 테스트

### 4.1. 디렉토리 구조

```text
src/
├── tools/
│   ├── course.ts
│   └── course.test.ts      # 단위 테스트
├── services/
│   ├── pdf.ts
│   └── pdf.test.ts
└── __tests__/
    └── integration/        # 통합 테스트
        └── course.int.test.ts
```

### 4.2. MCP 툴 핸들러 단위 테스트

```typescript
// src/tools/course.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { courseUpsertHandler } from './course';
import { prisma } from '../services/prisma';

vi.mock('../services/prisma', () => ({
  prisma: {
    course: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('course.upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('새 코스를 생성한다', async () => {
    const mockCourse = { id: 'c_123', title: 'HRD 입문' };
    vi.mocked(prisma.course.upsert).mockResolvedValue(mockCourse as any);

    const result = await courseUpsertHandler({ title: 'HRD 입문', durationHours: 12 });

    expect(prisma.course.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expect.any(String) },
        create: expect.objectContaining({ title: 'HRD 입문' }),
      })
    );
    expect(result.content[0].text).toContain('c_123');
  });

  it('필수 필드 누락 시 에러를 반환한다', async () => {
    const result = await courseUpsertHandler({ description: '설명만' } as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('title');
  });
});
```

### 4.3. PDF 서비스 단위 테스트

```typescript
// src/services/pdf.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generatePdf } from './pdf';
import puppeteer from 'puppeteer';

vi.mock('puppeteer');

describe('generatePdf', () => {
  it('HTML을 PDF로 변환한다', async () => {
    const mockPage = {
      setContent: vi.fn(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
      close: vi.fn(),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn(),
    };
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

    const result = await generatePdf('<h1>Test</h1>', 'test.pdf');

    expect(mockPage.setContent).toHaveBeenCalledWith('<h1>Test</h1>', expect.any(Object));
    expect(result).toContain('test.pdf');
  });
});
```

### 4.4. DB 통합 테스트

```typescript
// src/__tests__/integration/course.int.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Course 통합 테스트', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 테스트 데이터 정리
    await prisma.courseModule.deleteMany();
    await prisma.courseSchedule.deleteMany();
    await prisma.course.deleteMany();
  });

  it('코스를 생성하고 조회할 수 있다', async () => {
    const created = await prisma.course.create({
      data: { title: '테스트 코스', durationHours: 8 },
    });

    const found = await prisma.course.findUnique({
      where: { id: created.id },
    });

    expect(found?.title).toBe('테스트 코스');
  });

  it('소프트 삭제된 코스는 deletedAt이 null이 아니다', async () => {
    const course = await prisma.course.create({
      data: { title: '삭제될 코스' },
    });

    await prisma.course.update({
      where: { id: course.id },
      data: { deletedAt: new Date() },
    });

    const deleted = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(deleted?.deletedAt).not.toBeNull();
  });
});
```

### 4.5. 백엔드 테스트 실행

```bash
# 모든 백엔드 테스트
npm test

# Watch 모드
npm test -- --watch

# 특정 파일
npm test -- src/tools/course.test.ts

# 커버리지
npm test -- --coverage
```

## 5. 프론트엔드 테스트

### 5.1. 디렉토리 구조

```text
ui/src/
├── components/
│   └── common/
│       ├── Button.tsx
│       └── Button.test.tsx
├── hooks/
│   ├── useMcpTool.ts
│   └── useMcpTool.test.ts
├── pages/
│   └── CoursePage/
│       ├── CourseList.tsx
│       └── CourseList.test.tsx
└── mocks/
    ├── handlers.ts         # MSW 핸들러
    └── server.ts           # MSW 서버 설정
```

### 5.2. MSW 설정 (MCP API 모킹)

```typescript
// ui/src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('http://localhost:7777/messages', async ({ request }) => {
    const body = await request.json() as any;
    const { method, params } = body;

    if (method === 'tools/call' && params.name === 'course.list') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              items: [
                { id: 'c_1', title: '테스트 코스', durationHours: 8 },
              ],
              total: 1,
            }),
          }],
        },
      });
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result: { content: [{ type: 'text', text: '{}' }] },
    });
  }),
];

// ui/src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 5.3. 컴포넌트 테스트

```typescript
// ui/src/pages/CoursePage/CourseList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseList } from './CourseList';
import { server } from '../../mocks/server';
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('CourseList', () => {
  it('코스 목록을 렌더링한다', async () => {
    render(<CourseList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('테스트 코스')).toBeInTheDocument();
    });
  });
});
```

### 5.4. 커스텀 훅 테스트

```typescript
// ui/src/hooks/useMcpTool.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMcpQuery } from './useMcpTool';
import { server } from '../mocks/server';
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useMcpQuery', () => {
  it('MCP 툴을 호출하고 결과를 반환한다', async () => {
    const { result } = renderHook(
      () => useMcpQuery('course.list', { page: 1 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(1);
  });
});
```

### 5.5. 프론트엔드 테스트 실행

```bash
cd ui

# 모든 테스트
npm test

# Watch 모드
npm test -- --watch

# 커버리지
npm test -- --coverage
```

## 6. E2E 테스트 (Playwright)

### 6.1. 설정

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: './ui',
      port: 5173,
    },
    {
      command: 'npx tsx src/transport.ts',
      port: 7777,
    },
  ],
});
```

### 6.2. E2E 테스트 예시

```typescript
// e2e/course.spec.ts
import { test, expect } from '@playwright/test';

test.describe('코스 관리', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('새 코스를 생성할 수 있다', async ({ page }) => {
    await page.goto('/courses');
    await page.click('button:has-text("새 코스")');

    await page.fill('input[name="title"]', 'E2E 테스트 코스');
    await page.fill('input[name="durationHours"]', '16');
    await page.click('button:has-text("저장")');

    await expect(page.getByText('E2E 테스트 코스')).toBeVisible();
  });
});
```

### 6.3. E2E 테스트 실행

```bash
# 브라우저 UI로 실행
npx playwright test --ui

# Headless 실행
npx playwright test

# 특정 파일
npx playwright test e2e/course.spec.ts
```

## 7. CI 통합

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hrdb_test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run backend tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hrdb_test

      - name: Install UI dependencies
        run: cd ui && npm ci

      - name: Run frontend tests
        run: cd ui && npm test

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
```

## 8. 테스트 커버리지 목표

| 영역 | 목표 |
| --- | --- |
| MCP 툴 핸들러 | 90% |
| 서비스 로직 | 80% |
| 프론트엔드 컴포넌트 | 70% |
| E2E 시나리오 | 핵심 플로우 100% |

---

**관련 문서:** `ARCHITECTURE.md`, `MCP_TOOLS.md`, `FRONTEND_GUIDE.md`
