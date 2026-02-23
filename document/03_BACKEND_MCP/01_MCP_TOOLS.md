# MCP 도구 레퍼런스

코드 위치: `src/tools/`

## 응답 형식 (공통)

성공: `{ content: [{ type:"text", text: JSON문자열 }] }`
실패: `{ content: [{ type:"text", text: 에러메시지 }], isError: true }`

## Tool → Permission Key 매핑

| Tool | Permission Key |
|------|----------------|
| `dashboard.bootstrap` | `dashboard.read` |
| `siteSetting.get/getMany` | `site.settings.read` |
| `siteSetting.upsert` | `site.settings.update` |
| `tableConfig.get/upsert` | 동일 이름 |
| `course.*` | `course.*` (동일) |
| `lecture.upsert/map` | `lecture.upsert` |
| `lecture.grant.*` | `lecture.grant.*` (동일) |
| `template.create/upsert` | `template.update` |
| `template.get/list` | `template.read` |
| `render.*` | `render.*` (동일) |
| `document.*` | `document.*` (동일) |
| `message.list/unreadCount/markRead/markAllRead` | `message.list` |
| `message.send/recipientList` | `message.send` |
| `group.*` | `group.manage` |
| `group.member.*` | `group.member.manage` |
| `permission.grant.*` | `group.permission.manage` |

## 도메인별 Tool 상세

### 코스 (course.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `course.upsert` | 생성/수정 | id?, title, description?, instructorIds?, token? |
| `course.get` | 조회 (관계 포함) | id |
| `course.list` | 목록 | limit?, offset? |
| `course.listMine` | 내 코스 | token |
| `course.delete` | 삭제 | id, token? |

### 코스 공유 (course.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `course.shareInvite` | 공유 요청 | token, courseId, targetUserId |
| `course.shareRespond` | 수락/거절 | token, courseId, accept |
| `course.shareListReceived` | 내 수신 목록 | token, status? |
| `course.shareListForCourse` | 코스별 공유 목록 | token, courseId |
| `course.shareRevoke` | 해제 (발신자) | token, courseId, targetUserId |
| `course.shareLeave` | 해제 (수신자) | token, courseId |
| `course.shareTargets` | 공유 대상 목록 | token, courseId |

### 강의 (lecture.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `lecture.upsert` | 생성/수정 | id?, courseId, title, hours?, order?, token? |
| `lecture.map` | 기존 강의 매핑 | lectureId, courseId, order?, token |
| `lecture.get` | 조회 | id |
| `lecture.list` | 코스별 목록 | courseId, limit?, offset? |
| `lecture.delete` | 삭제 | id, token? |

### 강의 권한 (lecture.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `lecture.grant.upsert` | 부여/수정 | lectureId, userId, canMap?, canEdit?, canReshare?, token |
| `lecture.grant.list` | 강의별 목록 | lectureId, token |
| `lecture.grant.delete` | 해제 | lectureId, userId, token |
| `lecture.grant.listMine` | 내 수신 목록 | token |
| `lecture.grant.leave` | 자진 해제 | lectureId, token |

### 강사 (instructor.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `instructor.upsert` | 생성/수정 | id?, name, specialties?, careers?, degrees?, token? |
| `instructor.get` | 조회 | id |
| `instructor.getByUser` | 사용자 연결 조회 | userId |
| `instructor.list` | 목록 | limit?, offset? |

### 일정 (schedule.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `schedule.upsert` | 생성/수정 | id?, courseId, instructorId?, date?, location?, token? |
| `schedule.get` | 조회 | id |
| `schedule.list` | 목록 | limit?, offset? |

### 템플릿 (template.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `template.create` | 생성 | name, html, css, token? |
| `template.get` | 조회 (버전 포함) | id |
| `template.list` | 목록 | page?, pageSize? |
| `template.previewHtml` | 미리보기 렌더 | html, css, data |

### 렌더 (render.ts)

| Tool | 설명 | 주요 파라미터 |
|------|------|-------------|
| `render.coursePdf` | 코스 PDF | templateId, courseId |
| `render.schedulePdf` | 일정 PDF | templateId, scheduleId |
| `render.instructorProfilePdf` | 강사 PDF | templateId, instructorId |

모든 render 도구는 비동기 → `{ jobId, status: "pending" }` 반환

### 사용자 (user.ts)

| Tool | 설명 | 인증 |
|------|------|------|
| `user.register` | 회원가입 | 불필요 |
| `user.login` | 로그인 (JWT) | 불필요 |
| `user.me` | 내 정보 | token |
| `user.get` | 사용자 조회 | admin |
| `user.list` | 사용자 목록 | admin |
| `user.update` | 내 정보 수정 | token |
| `user.delete` | 회원 탈퇴 | token+password |
| `user.updateRole` | 역할 변경 | admin |
| `user.updateByAdmin` | 관리자 수정 | admin |
| `user.requestInstructor` | 강사 신청 | token |
| `user.approveInstructor` | 강사 승인 | admin |
| `user.updateInstructorProfile` | 강사 프로필 수정 | token |

### 기타

| Tool | 설명 |
|------|------|
| `dashboard.bootstrap` | 대시보드 통계 |
| `message.list/send/delete/markRead/markAllRead/unreadCount/unreadSummary` | 메시지 CRUD |
| `message.recipientList` | 수신자 후보 목록 |
| `message.seedDummy` | 테스트용 더미 |
| `document.list/delete/share/revokeShare` | 사용자 문서 관리 |
| `group.list/upsert/delete` | 그룹 관리 |
| `group.member.list/add/remove/updateRole` | 그룹 멤버 관리 |
| `permission.grant.list/upsert/delete` | 권한 부여 관리 |
| `siteSetting.get/getMany/upsert` | 사이트 설정 |
| `tableConfig.get/upsert` | 테이블 컬럼 설정 |
| `test.echo` | 에코 테스트 |
