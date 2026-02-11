# COLUMN_SETTINGS_APPLY

테이블 컬럼 설정을 실제 리스트 UI에 적용하는 방식 정의 문서입니다.

---

## 1. 목표

- 사이트 관리에서 저장한 컬럼 설정을 리스트 UI에 **동적으로 적용**
- 공통 설정을 기준으로 모든 사용자에게 동일한 UI 제공
- 관계 데이터는 기본 제외, 스칼라 필드 중심

---

## 2. 적용 대상 테이블

- `courses`
- `instructors`
- `templates`
- `users`
- `schedules`
- `lectures`

---

## 3. 기본 원칙

- 연번(`No`)는 모든 테이블 공통, 항상 표시, 첫 번째 고정
- 컬럼 순서는 설정 `order`를 따른다
- `visible=false` 컬럼은 숨김 처리
- 컬럼 라벨은 `customLabel`이 있으면 우선 적용

---

## 4. 데이터 매핑 규칙

- 컬럼 키는 데이터 필드명과 1:1 매핑을 기본으로 한다
- 표시값 가공은 UI 포맷터로 처리한다

예시:

- `durationHours` → `${hours}시간`
- `isOnline` → `예/아니오`
- `createdAt` → locale date
- `lastLoginAt` → locale date

---

## 5. 프론트 적용 방식 (권장)

### 5.1 컬럼 설정 로드

- `tableConfig.get`으로 tableKey별 설정 조회
- 없으면 기본값(`DEFAULT_COLUMNS`) 사용

### 5.2 컬럼 빌더

- `buildColumns(tableKey, settings, formatters)` 유틸 작성
- `settings` 순서대로 실제 `antd` Table columns 생성
- `visible=false`는 제외

### 5.3 포맷터

- 테이블별 포맷터 맵 작성
- 예: `formatters['courses'].durationHours`

---

## 6. 백엔드 연동

- `tableConfig.get` / `tableConfig.upsert` 구현
- 설정 저장은 공통 전역 기준
- 향후 개인 커스텀 확장 시 `ownerType/ownerId` 추가

---

## 7. 단계별 적용 계획

1. 프론트: 컬럼 설정 저장 UI 완성 (현재 단계)
2. 백엔드: 설정 저장/조회 API 구현
3. 프론트: 리스트 컬럼 동적 적용
4. QA: 테이블별 표시/숨김/라벨 테스트
