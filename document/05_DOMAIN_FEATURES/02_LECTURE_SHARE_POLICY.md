# 강의 공유 정책

## 1. 소유 개념

| 항목 | 결정 기준 |
|------|----------|
| 원저작자 | `Lecture.authorId` (최초 생성자) |
| 등록자 | `Lecture.createdBy` (등록 행위자) |
| 권한 보유자 | `LectureGrant` 레코드 존재 |

## 2. LectureGrant 모델

```prisma
model LectureGrant {
  lectureId       String
  userId          String
  grantedByUserId String              // 부여자
  sourceType      LectureGrantSourceType  // manual | course_share
  sourceRefId     String?             // course_share → CourseShare ID
  canMap          Boolean
  canEdit         Boolean
  canReshare      Boolean
  revokedAt       DateTime?
}
```

## 3. 부여 방식

**수동 (manual):** `lecture.grant.upsert { lectureId, userId, canMap, canEdit, canReshare, token }`
- 조건: 강의 소유자 또는 canReshare=true 보유 또는 admin/operator

**코스 공유 자동 (course_share):** `course.shareRespond { accept: true }` 시 자동 생성
- sourceRefId = CourseShare.id
- 기본: canMap=true, canEdit=false, canReshare=false

## 4. 해제 규칙

| 시나리오 | 삭제 대상 |
|---------|----------|
| `lecture.grant.delete` | 특정 사용자의 특정 강의 권한 |
| `course.shareRevoke/Leave` | sourceType=course_share + sourceRefId 일치하는 모든 Grant |

핵심: course_share 권한만 삭제, manual 보존

## 5. 재공유

- canReshare=true인 사용자만 다른 사용자에게 부여 가능
- 재공유 시 grantedByUserId = 재공유자
- canReshare는 기본 false (명시적 설정 필요)

## 6. 충돌 방지

`@@unique([lectureId, userId])` — 중복 Grant 불가, upsert 패턴으로 업데이트
