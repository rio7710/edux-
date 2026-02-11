# InstructorProfile 분리 유지 vs 통합 검토 요청

> 작성일: 2026-02-11  
> 요청자 의견: `InstructorProfile`과 `Instructor`의 분리가 의미가 약해 보이며, 통합이 더 타당한지 검토 필요

---

## 1) 현재 구조 요약

- `User`
  - 계정/인증/공통 연락처(`phone`, `website`)의 단일 소스
- `InstructorProfile`
  - `User`와 1:1
  - 신청/승인 상태(`isPending`, `isApproved`) + 간단 자기소개 성격
- `Instructor`
  - 운영 엔터티
  - 과정/일정 연동(`CourseInstructor`, `CourseSchedule`)
  - 상세 이력/출력용 데이터(학위/경력/출판/자격/링크/avatar 등)

최근 정리:
- 연락처 중복(`Instructor.phone`, `InstructorProfile.phone/website`)은 제거 완료
- 연락처는 `User` 중심으로 통합

---

## 2) 문제 인식 (사용자 관점)

- 화면/동작에서는 “강사 정보는 하나”로 인식되는데, DB는 `InstructorProfile` + `Instructor` 2개 엔터티로 보임
- 내보내기/조회 시 `profileId` 의존 로직 때문에 “강사 프로필이 없습니다” 같은 UX 혼선이 발생 가능
- 동기화 포인트가 늘어날수록(신청, 승인, 상세 수정, 렌더) 코드 복잡도와 회귀 리스크 증가

---

## 3) 분리 유지의 실익

분리 자체가 무의미한 건 아님. 아래 조건이면 유효:

- 승인 전 데이터와 승인 후 운영 데이터를 명확히 분리해야 함
- 승인 프로세스에서 “제출본 스냅샷” 보존/감사 추적이 중요함
- 장기적으로 다중 신청 이력(재신청, 반려 이력) 관리 필요

즉, `InstructorProfile`이 “워크플로우 상태 머신”으로 확실한 역할이 있을 때는 유지 가치가 큼.

---

## 4) 통합의 실익

현재 제품 맥락(사용자 체감 단일 프로필)에선 통합 이점이 큼:

- 조회/수정/렌더 소스 단순화
- profileId 보조 로직 제거 가능
- 데이터 정합성 이슈 감소(동기화 지점 감소)
- 개발/운영 비용 절감

---

## 5) 권고안 (의견)

### 권고: **부분 통합(사실상 단일 원천화)**

완전 삭제보다 단계적 접근 권장:

1. **운영/출력 기준 소스는 `Instructor + User`로 고정**
2. `InstructorProfile`은 **신청 상태 전용 최소 필드**로 축소
   - 예: `userId`, `isPending`, `isApproved`, `submittedAt`, `approvedAt`, `reviewNote`
3. 내보내기/템플릿/미리보기는 `InstructorProfile` 의존 제거
4. 승인 시점에만 `InstructorProfile -> Instructor` 반영 (단방향)

이렇게 하면:
- 사용자 관점은 “강사 정보 단일화”
- 관리자 관점은 “신청 워크플로우 기록 유지”

---

## 6) 완전 통합(테이블 제거) 가능성

가능하나 아래가 필요:

- 승인 상태를 `User` 또는 `Instructor`로 이전
- 기존 `InstructorProfile` 참조 API/렌더 경로 전면 수정
- 이력/감사 요구가 생길 경우 별도 `InstructorApplicationHistory` 도입 필요

즉, “간단해 보이나” 추후 이력 요구가 생기면 재도입 비용이 큼.

---

## 7) 검토 요청 사항 (Claude)

아래 3가지 관점으로 검토 부탁:

1. 현재 제품/운영 요구 기준에서 `InstructorProfile`의 최소 존치 범위 제안  
2. 부분 통합안의 마이그레이션/롤백 전략 적정성 검토  
3. 완전 통합 시 예상 리스크(권한/승인/감사/회귀)와 우선순위

---

## 8) 제 최종 의견 (요약)

- “지금 상태의 이중 데이터 구조”는 사용자 UX 기준으로 혼란 여지가 맞음.
- 다만 즉시 완전 삭제보다,  
  **`InstructorProfile`을 워크플로우 전용으로 축소하고 실데이터는 `Instructor + User` 단일화**가 현실적으로 가장 안전하고 효과적임.
