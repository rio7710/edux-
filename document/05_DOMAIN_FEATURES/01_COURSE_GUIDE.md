# 코스 가이드

## 1. 코스 구조

```
Course (과정)
├── CourseInstructor[] (강사 매핑, M:N)
├── CourseLecture[] (강의 매핑, M:N) → Lecture
├── CourseSchedule[] (일정, 1:N)
└── CourseShare[] (공유, 1:N)
```

## 2. 코스 CRUD

| 동작 | Tool | 비고 |
|------|------|------|
| 생성/수정 | `course.upsert` | id 없으면 생성, 있으면 수정 |
| 조회 | `course.get` | 강의, 일정, 강사 관계 포함 |
| 전체 목록 | `course.list` | admin/operator/editor |
| 내 목록 | `course.listMine` | createdBy = 본인 |
| 삭제 | `course.delete` | Soft delete |

`course.upsert` 시 token에서 userId 추출 → `createdBy` 저장

## 3. 코스 뷰 분리

| 뷰 | 대상 | 설명 |
|----|------|------|
| 내 코스 | createdBy = 본인 | 본인이 만든 코스 |
| 공유받은 코스 | CourseShare(accepted) | 타인이 공유한 코스 |
| 전체 코스 | 관리자 메뉴 | 모든 코스 (admin/operator) |

## 4. 코스 공유 워크플로우

```
[발신자] course.shareInvite → CourseShare(pending) + UserMessage
[수신자] course.shareRespond(accept:true) → accepted + LectureGrant 자동 부여
         (canMap=true, canEdit=false, canReshare=false)
[해제-발신자] course.shareRevoke → CourseShare 삭제 + course_share LectureGrant 정리
[해제-수신자] course.shareLeave → 동일
```

공유 규칙:
- 동일 사용자 중복 불가 (`@@unique([courseId, sharedWithUserId])`)
- 수락 시 해당 코스 모든 강의에 LectureGrant 자동 부여 (sourceType=course_share)
- 해제 시 course_share 출처만 삭제 (manual 보존)

## 5. 강의 매핑

생성 방식: `lecture.upsert { courseId, title }` (새 강의) 또는 `lecture.map { lectureId, courseId }` (기존 매핑)

Lecture는 독립 엔티티 → 여러 코스에 매핑 가능 (CourseLecture M:N)

### LectureGrant 권한

| 권한 | 설명 |
|------|------|
| `canMap` | 다른 코스에 매핑 가능 |
| `canEdit` | 강의 내용 수정 가능 |
| `canReshare` | 다른 사용자에게 재공유 가능 |
