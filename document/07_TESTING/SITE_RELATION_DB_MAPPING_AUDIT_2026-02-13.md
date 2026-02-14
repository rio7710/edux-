# 사이트 기능 관계/DB 맵핑 점검 보고서 (2026-02-13)

## 1) 점검 목적과 범위

- 목적: 현재 사이트의 기능 연계 흐름과 DB 맵핑 무결성을 점검하고, `재사용성`, `속도`, `오류 가능성` 관점의 개선안을 제시
- 점검 방식: 정적 코드/스키마 리뷰 (실운영 데이터 직접 변경 없음)
- 기준 소스:
  - 프론트 라우팅/페이지 호출: `ui/src/App.tsx:52`, `ui/src/App.tsx:56`, `ui/src/pages/CoursesPage.tsx:210`, `ui/src/pages/FeatureSharesPage.tsx:131`
  - MCP 툴 핸들러: `src/tools/course.ts`, `src/tools/lecture.ts`, `src/tools/message.ts`, `src/tools/group.ts`, `src/tools/render.ts`
  - 스키마: `prisma/schema.prisma:172`, `prisma/schema.prisma:210`, `prisma/schema.prisma:274`

## 2) 기능 관계 분석 (Page -> Tool -> DB)

### 2.1 인증/사용자

- Page:
  - 로그인/회원가입: `ui/src/App.tsx:52`, `ui/src/App.tsx:53`
- Tool:
  - `user.login`, `user.register`, `user.refreshToken`, `user.*`
- DB:
  - `User`, `InstructorProfile`, `Instructor`, `AppSetting`, `UserMessage`

### 2.2 코스/강의/공유

- Page:
  - 코스 화면: `ui/src/App.tsx:59`
  - 주요 호출: `ui/src/pages/CoursesPage.tsx:210`, `ui/src/pages/CoursesPage.tsx:322`, `ui/src/pages/CoursesPage.tsx:633`
- Tool:
  - `course.*`, `course.share*`, `lecture.*`, `lecture.grant.*`, `schedule.*`
- DB:
  - `Course`, `Lecture`, `CourseLecture`, `CourseShare`, `LectureGrant`, `CourseSchedule`, `CourseInstructor`, `UserMessage`

### 2.3 메시지함/기능공유

- Page:
  - 메시지함: `ui/src/App.tsx:64`
  - 주요 호출: `ui/src/pages/FeatureSharesPage.tsx:131`, `ui/src/pages/FeatureSharesPage.tsx:141`
- Tool:
  - `course.shareListReceived/respond/leave`, `lecture.grant.listMine/leave`, `message.*`
- DB:
  - `CourseShare`, `LectureGrant`, `UserMessage`

### 2.4 템플릿/PDF/문서함

- Page:
  - 템플릿/렌더/문서함: `ui/src/App.tsx:61`, `ui/src/App.tsx:62`, `ui/src/App.tsx:63`
- Tool:
  - `template.*`, `render.*`, `document.*`
- DB:
  - `Template`, `TemplateVersion`, `RenderJob`, `UserDocument`

### 2.5 그룹/권한/사이트설정

- Page:
  - 그룹/권한/사이트설정: `ui/src/App.tsx:68`, `ui/src/App.tsx:69`, `ui/src/App.tsx:70`
- Tool:
  - `group.*`, `permission.grant.*`, `authz.check`, `siteSetting.*`, `tableConfig.*`
- DB:
  - `Group`, `GroupMember`, `PermissionGrant`, `AppSetting`, `TableColumnConfig`

## 3) DB 맵핑 무결성 핵심 규칙

1. `CourseShare(status=accepted)` -> 해당 코스의 활성 강의(`CourseLecture + Lecture.deletedAt=null`)별 `LectureGrant(sourceType=course_share, sourceRefId=CourseShare.id)`가 존재해야 함
2. 공유 해제/거절 시 해당 `sourceRefId` grant는 revoke 또는 유효한 fallback share로 재연결되어야 함
3. 수동 grant(`sourceType=manual`)는 공유 해제 시 덮어쓰지 않아야 함
4. 소프트 삭제 엔티티(`deletedAt not null`)는 조회 체인에서 누락 없이 필터링되어야 함

## 4) 주요 리스크 (심각도순)

### P0-1. 읽기 툴 인증 우회 가능성

- 근거:
  - `course.get/list` 토큰 optional: `src/tools/course.ts:46`, `src/tools/course.ts:51`
  - 토큰 없으면 사실상 전체 조회 경로: `src/tools/course.ts:111`
  - `lecture.get/list` 토큰 없음: `src/tools/lecture.ts:47`, `src/tools/lecture.ts:51`
  - `schedule.get/list` 토큰 없음: `src/tools/schedule.ts:48`, `src/tools/schedule.ts:52`
  - `template.get/list` 토큰 없음: `src/tools/template.ts:38`, `src/tools/template.ts:42`
- 영향:
  - 비인증 접근 시 데이터 노출 가능성
  - 프론트 라우팅만으로는 보호 불충분 (`ui/src/App.tsx:56` 이하에 공통 보호 라우트 없음)
- 개선:
  - 위 조회 툴 토큰 필수화
  - 서버단 `requirePermission` 기반 통합 인가 적용
  - 프론트 `ProtectedRoute` 추가

### P0-2. ID 생성 방식 충돌 위험

- 근거:
  - `Date.now()` 기반 ID 생성:  
    `src/tools/course.ts:314`, `src/tools/lecture.ts:229`, `src/tools/instructor.ts:132`, `src/tools/schedule.ts:102`
- 영향:
  - 동시요청 시 충돌/갱신 오염 가능
- 개선:
  - 전부 DB 기본키(`cuid`) 또는 `crypto.randomUUID()`로 전환

### P0-3. 타입 맵핑 불일치 (숫자 필드 -> 문자열)

- 근거:
  - 코스 조회 시 `durationHours`를 문자열로 재할당: `src/tools/course.ts:549`
- 영향:
  - 클라이언트 타입 불일치로 저장/렌더 오류 유발 가능
- 개선:
  - `durationHours`는 number 유지
  - 표시용 필드는 별도(`durationDisplay`)로 분리

### P1-1. 공유/권한 동기화 로직의 N+1 패턴

- 근거:
  - 강의별 루프 + 개별 조회/업데이트: `src/tools/course.ts:175`, `src/tools/course.ts:240`
  - 수락자 루프 + grant 개별 upsert: `src/tools/lecture.ts:268`
- 영향:
  - 코스당 강의/공유 대상이 많을수록 응답시간 급증
- 개선:
  - set-based 처리(한 번에 findMany 후 map, bulk update/create)
  - revoke/reassign 분기용 사전 캐시 맵 사용

### P1-2. 트랜잭션 경계 불충분 (부분 성공 리스크)

- 근거:
  - `courseUpsert` 후 강사 매핑 교체가 단일 트랜잭션 아님: `src/tools/course.ts:358`, `src/tools/course.ts:386`
  - `approveInstructor` 다중 update/create가 트랜잭션 아님: `src/tools/user.ts:1226`, `src/tools/user.ts:1319`, `src/tools/user.ts:1325`
- 영향:
  - 중간 실패 시 상태 불일치
- 개선:
  - 핸들러 단위 원자 트랜잭션 적용

### P1-3. 권한 정책 중복 데이터 가능

- 근거:
  - `PermissionGrant`에 subject+permission 유니크 제약 없음: `prisma/schema.prisma:94`, `prisma/schema.prisma:109`
- 영향:
  - allow/deny 중복 누적, 판정 비용 증가, 운영 혼선
- 개선:
  - 모델 정규화(`subjectType`, `subjectId`) + 복합 unique
  - 기존 중복 정리 백필 스크립트 추가

### P1-4. sourceRefId 참조 무결성 취약

- 근거:
  - `LectureGrant.sourceRefId`는 문자열만 존재, FK 없음: `prisma/schema.prisma:280`
- 영향:
  - share 삭제/복구/마이그레이션 시 참조 깨짐 탐지 어려움
- 개선:
  - DB 트리거 또는 애플리케이션 검증으로 `sourceType=course_share` 시 참조 존재 강제
  - 정기 무결성 점검 SQL 배치

### P2-1. 재사용성 저하 (중복 헬퍼/중복 정책)

- 근거:
  - `resolveCreatorNames` 중복 구현:  
    `src/tools/course.ts:9`, `src/tools/lecture.ts:7`, `src/tools/instructor.ts:18`, `src/tools/schedule.ts:8`, `src/tools/template.ts:9`
- 영향:
  - 버그 수정 시 누락 가능성 증가
- 개선:
  - `src/services/presenter.ts` 공통 유틸로 통합

### P2-2. 대시보드 조회 부하 과다

- 근거:
  - 초기/실시간 양쪽에서 유사 대량 호출: `ui/src/pages/DashboardPage.tsx:149`, `ui/src/pages/DashboardPage.tsx:256`
  - 5초 폴링: `ui/src/pages/DashboardPage.tsx:321`
- 영향:
  - 불필요한 DB 부하 및 프론트 지연
- 개선:
  - unread summary 단일 집계 API 도입
  - 폴링 주기 완화 + visibility 기반 중지

### P2-3. 배치 메시지 생성 비효율

- 근거:
  - `Promise.all(create)` 방식: `src/services/message.ts:37`
- 영향:
  - 대량 생성 시 connection 사용량 증가
- 개선:
  - `createMany` 도입 또는 chunk 처리

## 5) 속도/인덱스 관점 개선안

### 5.1 인덱스 권고

1. `Course(deletedAt, createdBy)` 복합 인덱스
2. `CourseShare(courseId, status)` 인덱스
3. `LectureGrant(lectureId, revokedAt)` 인덱스
4. `CourseSchedule(courseId, deletedAt)` 인덱스
5. `Template(deletedAt, type, createdAt)` 인덱스

### 5.2 쿼리 구조 개선

1. 공유 동기화 로직 set-based 변환
2. 메시지 카운트 API 단일화 (`message.unreadSummary`)
3. 반복 조회 API에 cursor pagination 적용 검토

## 6) 재사용성 개선안

1. `resolveCreatorNames` 공통화
2. 권한 체크 방식을 `evaluatePermission/requirePermission`로 통일
3. 에러 포맷 표준화 (`code`, `message`, `meta`)로 UI 파서 단순화
4. 공유/권한 상태전이 로직을 `services/shareGrantSync.ts`로 분리

## 7) DB 맵핑 오류 점검 SQL (운영 전 필수)

```sql
-- 1) 중복 권한 정책 점검
SELECT COALESCE("userId",'_') AS user_id,
       COALESCE("groupId",'_') AS group_id,
       COALESCE(CAST("role" AS text),'_') AS role_name,
       "permissionKey",
       COUNT(*) AS cnt
FROM "PermissionGrant"
WHERE "deletedAt" IS NULL
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;

-- 2) share 기반 grant 참조 깨짐 점검
SELECT lg.*
FROM "LectureGrant" lg
LEFT JOIN "CourseShare" cs ON cs."id" = lg."sourceRefId"
WHERE lg."sourceType" = 'course_share'
  AND lg."revokedAt" IS NULL
  AND cs."id" IS NULL;

-- 3) accepted share 대비 grant 누락 점검
SELECT cs."id" AS share_id, cs."courseId", cs."sharedWithUserId", cl."lectureId"
FROM "CourseShare" cs
JOIN "CourseLecture" cl ON cl."courseId" = cs."courseId"
JOIN "Lecture" l ON l."id" = cl."lectureId" AND l."deletedAt" IS NULL
LEFT JOIN "LectureGrant" lg
  ON lg."lectureId" = cl."lectureId"
 AND lg."userId" = cs."sharedWithUserId"
 AND lg."sourceType" = 'course_share'
 AND lg."sourceRefId" = cs."id"
 AND lg."revokedAt" IS NULL
WHERE cs."status" = 'accepted'
  AND lg."id" IS NULL;
```

## 8) 실행 우선순위 (권장)

### P0 (즉시)

1. 비인증 조회 경로 차단 (course/lecture/schedule/template get/list)
2. ID 생성 방식 교체 (`Date.now` 제거)
3. 타입 불일치 제거 (`durationHours`)

### P1 (1차 안정화)

1. 공유/권한 동기화 N+1 개선
2. `courseUpsert`, `approveInstructor` 트랜잭션화
3. PermissionGrant 중복 제약/정리
4. sourceRef 무결성 검증 도입

### P2 (고도화)

1. 공통 헬퍼/권한체계 통합
2. 대시보드 폴링/집계 API 최적화
3. 메시지 대량 생성 최적화
4. 통합 테스트 확장 (현재 `tests/contact-sync.test.ts` 단일)

## 9) 완료 기준(Definition of Done)

1. P0 항목 반영 후 비인증 데이터 접근 0건
2. 공유/권한 시나리오에서 무결성 SQL 경고 0건
3. 핵심 API p95: 조회 < 500ms, 변경 < 800ms
4. 기능 회귀 테스트(코스/공유/권한/메시지) 자동화 추가

