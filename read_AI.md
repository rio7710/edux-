# AI 개발 시 반복 실수 및 참고사항

## 0. 필수 문서 & 분석 플로우 (요약)

**필수 문서 (우선순위 순)**

1. `document/00_START_HERE/01_README.md`
2. `document/00_START_HERE/02_WORKFLOW.md`
3. `document/00_START_HERE/03_TROUBLESHOOTING.md`
4. `document/01_ARCHITECTURE/01_ARCHITECTURE.md`
5. `document/01_ARCHITECTURE/02_DATA_MODEL.md`
6. `document/02_API_MCP/01_MCP_TOOLS.md`
7. `document/02_API_MCP/02_API_REFERENCE.md`
8. `document/03_FRONTEND/01_FRONTEND_GUIDE.md`

**기능별 참고 문서**

- 템플릿/PDF: `document/04_TEMPLATES_PDF/*`
- 운영/배포/마이그레이션: `document/05_OPERATIONS/*`
- 보안/정책: `document/06_SECURITY_POLICY/*`
- 테스트: `document/07_TESTING/*`
- ML 라벨링: `document/08_ML/01_ML_LABELING_GUIDE.md`
- 진행 현황: `document/09_PROGRESS/01_PROGRESS_REPORT.md`

**분석 플로우 (권장 순서)**

1. `01_README`로 문서 구조 파악
2. `02_WORKFLOW`로 MCP 호출 흐름 이해
3. `ARCHITECTURE` + `DATA_MODEL`로 구조/스키마 파악
4. `MCP_TOOLS` + `API_REFERENCE`로 실제 호출 인터페이스 확인
5. 필요한 도메인별 문서로 이동
6. 최근 변경 사항은 `PROGRESS_REPORT` 확인

---

## 1. Prisma 스키마 필드명 확인

- **실수**: `password` 필드를 사용하려 함
- **정정**: User 모델의 실제 필드명은 `hashedPassword`
- **교훈**: Prisma schema를 먼저 확인하고 수정하기

```typescript
// ❌ 잘못된 코드
data: {
  password: hashedPassword;
}

// ✅ 올바른 코드
data: {
  hashedPassword;
}
```

---

## 2. Zod `.optional()` vs `.nullable()` 구분

- **`.optional()`**: `undefined`만 허용 (null 거부)
- **`.nullable()`**: `null` 과 `undefined` 모두 허용

Frontend form에서 null이 전달될 수 있으므로:

```typescript
// ❌ 틀림 (null을 거부)
durationHours: z.number().int().min(0).optional();

// ✅ 맞음 (null 허용)
durationHours: z.number().int().min(0).optional().nullable();
```

---

## 3. Handler 파라미터 타입 ↔ Schema 타입 일치

- TypeScript 컴파일 오류: Zod schema의 `.nullable()`이 있으면 handler param도 `| null` 포함
- **규칙**: Schema에서 nullable인 필드 → handler param에도 `| null` 명시

```typescript
// Schema
durationHours: z.number().optional().nullable()

// Handler parameter
export async function courseUpsertHandler(args: {
  durationHours?: number | null;  // ← null 타입 필수
}) { ... }
```

---

## 4. Frontend Form → Backend 데이터 전송 시 null 처리

- Form input이 빈 값일 때 `null`을 반환할 수 있음
- Backend는 `undefined`를 기대할 때가 많음 (optional 필드)
- **해결책**: Form handler에서 명시적으로 null → undefined 변환

```typescript
// CoursesPage.tsx handleSubmit
durationHours: values.durationHours !== null &&
values.durationHours !== undefined
  ? Number(values.durationHours)
  : undefined;
```

---

## 5. Build 후 dist 폴더 사용

- TypeScript 파일 실행: `dist/` 폴더 사용 (컴파일된 JS)
- src 폴더는 개발용일 뿐, 런타임에서는 dist 사용

```typescript
// ❌ 틀림
import { prisma } from "../src/services/prisma.js";

// ✅ 맞음
import { prisma } from "../dist/services/prisma.js";
```

---

## 6. Node 프로세스 포트 충돌 해결

- 포트 7777이 구분되어 있으면 새 프로세스 시작 불가
- **필수 단계**: 기존 node 프로세스 모두 종료 후 시작

```powershell
# 모든 node 프로세스 강제 종료
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
node dist/transport.js
```

---

## 7. Frontend 빌드 후 브라우저 새로고침 필요

- Vite dev server 실행 중이어도 build 산출물 변경 후 새로고침 필수
- Hot reload가 항상 작동하지는 않음

---

## 8. 타입 변환 순서 (Frontend form)

- Form validation 완료 후 타입 변환
- Number() 변환 전에 null/undefined 체크

```typescript
const values = await form.validateFields(); // ← 먼저 validation
createMutation.mutate({
  ...values,
  durationHours: values.durationHours
    ? Number(values.durationHours)
    : undefined, // ← 그 후 변환
});
```

---

## 9. 콘솔 에러 메시지 읽기

- "Expected number, received null" → Schema가 null을 거부함
- "Unknown argument `password`" → 필드명이 틀림
- "Record to update not found" → 찾는 데이터가 없음

---

## 10. MCP Tool Schema 등록 위치

- `src/tools/*.ts`: Schema 정의 + Handler 구현
- `src/mcp-server.ts` 또는 `src/transport.ts`: Tool 등록
- Schema 변경 후 등록된 곳도 함께 수정
