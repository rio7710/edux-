# SITE_SETTINGS

사이트 관리(공통 설정) 정의 문서입니다.  
현재 단계는 **전 사용자 공통 설정**을 대상으로 하며, 개인 커스텀은 향후 확장합니다.

---

## 1. 범위

- 테이블 헤더(컬럼) 표시 여부 및 순서 관리
- 향후 확장: 개인 커스텀(사용자별 설정)

---

## 2. 권한

- 기본: **admin, operator**만 접근/수정 가능
- 저장 후 반영 (즉시 UI에 적용)

---

## 3. 컬럼 설정 구조 (권장)

### 3.1. 테이블 기반 (권장)

향후 사용자별 커스텀 확장 시 `ownerType/ownerId`만 추가하면 됨.

예시 필드:

- `tableKey`: 대상 테이블 키 (`courses`, `instructors`, `templates`, `users`, `schedules`, `lectures`)
- `columnKey`: 컬럼 식별자 (`id`, `title`, `createdBy` 등)
- `label`: 헤더 표시명
- `visible`: 표시 여부
- `order`: 표시 순서
- `width`: 컬럼 너비 (선택)
- `fixed`: 고정 여부 (선택)

### 3.2. JSON 단일 설정 (대안)

초기 구현은 빠르나 확장 시 유지보수 비용 증가.

---

## 4. MCP 툴 정의 (제안)

- `tableConfig.get`
  - 입력: `tableKey`
  - 출력: 컬럼 설정 목록

- `tableConfig.upsert`
  - 입력: `tableKey`, `columns[]`
  - 출력: 저장 결과

---

## 5. UI 동작

- 메뉴: `사이트 관리 → 테이블 설정`
- 흐름:
  1. 테이블 선택
  2. 컬럼 목록 표시
  3. 체크박스(표시/숨김) + 드래그 정렬
  4. 저장 → 즉시 반영

---

## 6. 향후 확장 (개인 커스텀)

- `ownerType`: `global` | `user`
- `ownerId`: 사용자 ID (global은 null)
- 개인 설정이 있으면 개인 설정 우선 적용
