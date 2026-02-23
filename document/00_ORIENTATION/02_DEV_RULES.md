# 개발 규칙

## 1. 개발 순서 — UI First

```
UI 개발 (미구현 = 빨간 뱃지) → 백엔드 Tool 구현 → DB 마이그레이션
```

UI 먼저 → 사용자 경험 기준 API 설계. 미구현 뱃지 → 진행 상황 시각화. DB 마지막 → 롤백 쉬움.

## 2. 권한 모델 — 3단계 조합

```
최종 접근 = 메뉴 ON ∧ 역할 허용 ∧ 도구 허용
```

| 단계 | 설명 | 예시 |
|------|------|------|
| Level 1 | 메뉴 ON/OFF | 사이트 설정에서 코스 메뉴 끄기 |
| Level 2 | 역할 기반 (Role enum) | admin, operator만 사용자 관리 |
| Level 3 | 도구 기반 (MCP Tool RBAC) | `course.upsert`는 editor 이상 |

메뉴 OFF → 비활성 (값 보존, 조작 차단). 3단계 모두 통과해야 실행.

## 3. UI 라벨 컨벤션

| 상태 | 표시 | 색상 |
|------|------|------|
| 미구현 | "Not Implemented" 뱃지 | 빨강 |
| 내 것 | "My" 라벨 | 초록 |
| 관리자 전용 | "Admin Only" | 주황 |
| 잠금 (메뉴 OFF) | Disabled | 회색 |

## 4. 네이밍 컨벤션

**MCP Tool:** `도메인.동작` (전체), `도메인.동작Mine` (본인)

| 패턴 | 예시 | 대상 |
|------|------|------|
| `*.list` | `course.list` | 전체 (admin/operator) |
| `*.listMine` | `course.listMine` | 본인만 |
| `*.upsert` | `course.upsert` | 생성/수정 |
| `*.delete` / `*.deleteMine` | | 삭제 (관리자/본인) |

**파일:** 페이지 `{Domain}Page.tsx`, 컴포넌트 PascalCase, 훅 `use{기능}.ts`, 서비스 camelCase, 도구 `{domain}.ts`

## 5. 삭제 정책 — Soft Delete

기본 `deletedAt = now()`. 모든 쿼리에 `WHERE deletedAt IS NULL` 필수. Hard delete는 비민감 데이터 검토 후만.

## 6. 기능 추가 체크리스트

- [ ] 메뉴 ON/OFF + 역할 권한 동작
- [ ] "Not Implemented" 뱃지 정확
- [ ] Tool 이름 UI ↔ Backend 일치
- [ ] 데이터 모델 변경은 마지막
- [ ] 권한 3단계 적용
- [ ] Soft Delete 조건 적용

## 7. 코드 스타일

| 항목 | 규칙 |
|------|------|
| 언어 | TypeScript strict |
| Import | 상대 경로 (`../services/prisma`) |
| 응답 | `toolResponse.ts` 표준 사용 |
| 에러 | try-catch + 표준 에러 응답 |
| 검증 | Zod 스키마 |

## 8. Git 컨벤션

`feat:` 새 기능, `fix:` 버그, `chore:` 설정, `refactor:` 리팩터링, `docs:` 문서, `test:` 테스트. main 직접 push 금지 → 기능 브랜치 → PR → 머지.
