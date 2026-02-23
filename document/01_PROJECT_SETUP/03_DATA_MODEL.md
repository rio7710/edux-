# 데이터 모델

스키마 파일: `prisma/schema.prisma`

## 모델 관계 맵

```
User ←1:1→ Instructor, InstructorProfile
User ←M:N→ Group (via GroupMember)
User ←1:N→ PermissionGrant, LectureGrant, UserMessage
Course ←M:N→ Instructor (via CourseInstructor)
Course ←M:N→ Lecture (via CourseLecture)
Course ←1:N→ CourseSchedule, CourseShare
Lecture ←1:N→ LectureGrant
Template ←1:N→ TemplateVersion, RenderJob
RenderJob ←1:N→ UserDocument
```

## Enum

| Enum | 값 |
|------|---|
| Role | admin, operator, editor, instructor, viewer, guest |
| GroupMemberRole | owner, manager, member |
| PermissionEffect | allow, deny |
| CourseShareStatus | pending, accepted, rejected |
| LectureGrantSourceType | manual, course_share |
| UserMessageCategory | system, course_share, lecture_grant, instructor_approval |
| JobStatus | pending, processing, done, failed |

## 핵심 모델

**User** — id(cuid), email(unique), name, phone?, website?, avatarUrl?, role(default:guest), hashedPassword?(소셜=null), provider?, providerId?, isActive, lastLoginAt?, deletedAt?

**Instructor** — id, userId?(unique, 1:1 User), name, title?, affiliation?, specialties[], certifications(Json), degrees(Json), careers(Json), publications(Json), createdBy?

**InstructorProfile** — userId(unique), displayName?, isPending(default:true), isApproved(default:false). 강사 신청용 임시 모델.

**Course** — id, title, description?, durationHours?, isOnline?, equipment[], goal?, content?, notes?, createdBy?

**CourseShare** — courseId + sharedWithUserId(unique), sharedByUserId, status(pending/accepted/rejected), respondedAt?

**Lecture** — id, title, description?, hours?, order, createdBy?, authorId?, originLectureId?

**LectureGrant** — lectureId + userId(unique), grantedByUserId, sourceType(manual/course_share), sourceRefId?, canMap, canEdit, canReshare, revokedAt?

**Template** — id, name, type(default:"course_intro"), css, html, createdBy?

**RenderJob** — id, userId, templateId, targetType, targetId, status(pending→done/failed), pdfUrl?, errorMessage?

**UserDocument** — id, userId, renderJobId, templateId, targetType, targetId, pdfUrl, shareToken?(unique), isActive

**AppSetting** — key(unique), value(Json). 사이트 설정 key-value.

**TableColumnConfig** — tableKey + columnKey + ownerType + ownerId(unique), label, customLabel?, visible, order, width?, fixed?

## Soft Delete 대상

User, Group, GroupMember, PermissionGrant, Instructor, Course, Lecture, CourseSchedule, Template, UserMessage — 모두 `deletedAt` 필드 보유. 모든 쿼리에 `WHERE deletedAt IS NULL` 필수.

## 인덱스 전략

soft delete 필터링 빈번 → 복합 인덱스에 deletedAt 포함:
`@@index([groupId, deletedAt])`, `@@index([userId, permissionKey, deletedAt])`, `@@index([recipientUserId, isRead, createdAt(sort: Desc)])`
