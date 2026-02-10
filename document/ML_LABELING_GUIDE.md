# ML Labeling Guide

이 문서는 **현재 Edux 구조에서 수집/라벨링 가능한 머신러닝 데이터**를 정리한 가이드입니다.  
목표는 **교육 운영 의사결정 패턴**을 학습할 수 있는 최소 데이터셋을 정의하는 것입니다.

---

## 1. 라벨링 원칙

- **개인정보 최소화**: 사용자 이름/이메일/전화번호는 저장하지 않음
- **행동 중심 로그**: “무엇을 했다”에 초점을 둠 (생성/수정/승인/다운로드 등)
- **익명화/가명화**: `userId`는 해시/가명으로 저장
- **목적 제한**: 운영 개선 목적에 한정

---

## 2. 현재 구조에서 가능한 이벤트

### 2.1 코스 관련

- `course.create` / `course.update`
  - 라벨 후보:
    - **채택됨/미채택됨** (향후 오픈 코스 기능 기준)
    - **재사용됨** (동일 템플릿/유사 코스 반복 생성)
    - **PDF 생성됨** (해당 코스 기준 PDF 생성 여부)
- `course.list` / `course.get` (조회 패턴)

### 2.2 강사 관련

- `instructor.create` / `instructor.update`
  - 라벨 후보:
    - **승인됨/반려됨** (강사 승인 흐름 도입 시)
    - **활성/비활성** (강사 활성화/비활성 기준)

### 2.3 템플릿 관련

- `template.create` / `template.update`
  - 라벨 후보:
    - **사용됨/미사용됨** (PDF 렌더 시 템플릿 사용 여부)
    - **재사용 횟수** (템플릿 반복 사용)

### 2.4 PDF 생성 관련

- `render.coursePdf`, `render.schedulePdf`
  - 라벨 후보:
    - **완료/실패**
    - **다운로드됨/미다운로드됨**

### 2.5 사용자/운영 관련

- `user.login` (빈도/패턴)
- `user.updateRole` (권한 변경 패턴)

---

## 3. 추천 라벨링 스키마 (초안)

### 3.1 Event Log (기본)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `eventId` | string | 이벤트 고유 ID |
| `eventType` | string | 예: `course.create`, `template.update` |
| `actorId` | string | 사용자 가명 ID |
| `entityType` | string | `course`, `instructor`, `template` |
| `entityId` | string | 대상 엔티티 ID |
| `timestamp` | datetime | 발생 시간 |
| `meta` | json | 추가 정보 (수정 필드, 타입 등) |

### 3.2 Label Log (라벨)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `labelId` | string | 라벨 고유 ID |
| `entityType` | string | 대상 엔티티 종류 |
| `entityId` | string | 대상 엔티티 ID |
| `labelType` | string | 예: `adopted`, `used`, `approved` |
| `labelValue` | string/bool/number | 예: `true`, `false`, `count` |
| `timestamp` | datetime | 라벨 부여 시점 |
| `source` | string | `system` / `manual` |

---

## 4. 현재 구현 가능 라벨 (즉시 적용)

- 템플릿: 사용됨/미사용됨
  - 근거: `render.*`에서 사용된 `templateId`
- 코스: PDF 생성됨/미생성
  - 근거: `render.coursePdf` 호출 여부
- 렌더: 성공/실패
  - 근거: `RenderJob.status`

---

## 5. 향후 확장 라벨 (기획 단계)

- 추천 코스 (오픈 코스 기능 기반)
  - `selectedCount`, `conversionRate`
- 승인/반려
  - 강사 신청 → 승인 상태 기록
- 품질 점수
  - 입력 필드 누락률, 템플릿 완성도 등

---

## 6. 적용 방식 제안

1. **Event Log 테이블 추가**
2. 핵심 이벤트에서 기록
3. 라벨은 시스템 자동 + 관리자 수동 병행
4. 주기적으로 익명화된 학습 데이터셋 추출

---

## 7. 주의사항

- 개인정보 포함 필드는 반드시 제거/마스킹
- 로그 접근 권한 분리 (운영자/관리자만)
- 데이터 보관 기간 정책 필요

---

**관련 파일**
- `src/tools/*` (핵심 이벤트 발생 지점)
- `prisma/schema.prisma` (로그 테이블 추가 예정)
