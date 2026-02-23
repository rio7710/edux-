# 코드 재사용 규칙

## 필수 규칙

- localStorage draft 로직을 페이지에 직접 작성 금지 → `useDraftStorage` 사용
- 세션 만료 Modal.confirm 복제 금지 → `useSessionExpiredGuard` 사용
- 신규 페이지는 공통 훅/컴포넌트로 시작, 예외 시 주석 필수

## 공통 빌딩 블록

| 훅/컴포넌트 | 위치 | 역할 |
|------------|------|------|
| `useDraftStorage` | hooks/useDraftStorage.ts | draft 저장/복구/삭제 표준화 |
| `useSessionExpiredGuard` | hooks/useSessionExpiredGuard.ts | 세션 만료 모달 + 로그인 이동 |
| `PageHeader` | components/PageHeader.tsx | CRUD 페이지 상단 헤더 |

```typescript
// useDraftStorage
const { saveDraft, loadDraft, clearDraft } = useDraftStorage({
  storageKey: "courses-draft",
  buildPayload: () => form.getFieldsValue(),
});
// useSessionExpiredGuard
useSessionExpiredGuard({
  saveDraft: () => saveDraft(),
  onGoToLogin: () => navigate("/login"),
});
```

## 마이그레이션 현황

| 순서 | 페이지 | 상태 |
|------|--------|------|
| 1 | TemplatesPage | 완료 |
| 2 | InstructorsPage | 진행 중 |
| 3 | CoursesPage | 대기 |

## 페이지 마이그레이션 체크리스트

- [ ] 페이지 내 draft 함수 삭제 → `useDraftStorage` 대체
- [ ] `handleSessionExpired` 중복 삭제 → `useSessionExpiredGuard` 대체
- [ ] draft 불러오기/초기화/모달 흐름 수동 테스트
- [ ] 세션 만료 시 임시저장 → 로그인 이동 테스트
