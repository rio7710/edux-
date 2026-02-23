# 작업 흐름 원칙

## 1. 핵심 원칙: 1 Step = 1 Tool Call

- 하나의 작업 = 하나의 MCP Tool 호출
- 복합 작업은 여러 Tool 순차 호출
- Tool 간 트랜잭션 없음 (각 Tool 독립 실행)
- 실패 시 부분 완료 가능 → 재시도 또는 수동 보정

## 2. 주요 워크플로우

### 코스 생성 → PDF 출력
```
1. course.upsert { title, description } → courseId
2. lecture.upsert { courseId, title, hours } → lectureId (반복)
3. schedule.upsert { courseId, instructorId, date } → scheduleId
4. template.previewHtml { html, css, data } → HTML 미리보기
5. render.coursePdf { templateId, courseId } → { jobId, status:"pending" }
6. [비동기] Worker → RenderJob done → pdfUrl → UserDocument 생성
```

### 코스 공유
```
1. course.shareTargets { token, courseId } → 공유 가능 사용자
2. course.shareInvite { token, courseId, targetUserId } → CourseShare(pending) + 메시지
3. [수신자] course.shareRespond { token, courseId, accept:true } → accepted + LectureGrant 자동 부여
4. [해제] course.shareRevoke / shareLeave → CourseShare 삭제 + LectureGrant 정리
```

### 강사 등록
```
1. user.requestInstructor { token, displayName, bio } → InstructorProfile(isPending)
2. [관리자] user.approveInstructor { token, userId } → Instructor 생성 + isApproved
```

## 3. Soft Delete 규칙

| 상황 | 처리 |
|------|------|
| 삭제 요청 | `deletedAt = now()` |
| 조회 쿼리 | `WHERE deletedAt IS NULL` 필수 |
| 복구 | `deletedAt = null` (관리자) |
| 연관 데이터 | Cascade 또는 보존 (관계별 상이) |

## 4. 에러 처리 패턴

```typescript
try {
  const actor = await requirePermission(token, "course.upsert");
  // 비즈니스 로직
  return toolResponse.success(result);
} catch (error) {
  return toolResponse.error(error.message);
}
```

모든 Tool은 try-catch 래핑. 인증/권한/Zod 실패 → `toolResponse.error` 반환.

## 5. 페이지네이션 패턴

```
요청: { limit: 50, offset: 0 }
응답: { items: [...], total: 123, limit: 50, offset: 0 }
```

기본 limit 50, 최대 100, offset 기반 (cursor 미사용)
