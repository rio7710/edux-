# MCP_TOOLS

`@modelcontextprotocol/sdk`의 `McpServer.tool()` 메서드로 등록되는 툴 목록입니다.
각 툴은 **Zod 스키마**로 파라미터를 정의하며, MCP 프로토콜 표준 형식으로 응답합니다.

## 응답 형식 (공통)

### 성공

```json
{
  "content": [
    { "type": "text", "text": "{\"id\":\"c_123\",\"title\":\"HRD 입문\"}" }
  ]
}
```

### 실패

```json
{
  "content": [
    { "type": "text", "text": "Course not found: c_999" }
  ],
  "isError": true
}
```

> `content[].text`에는 JSON 문자열 또는 사람이 읽을 수 있는 메시지가 들어갑니다.

---

## 코스 툴

### `course.upsert`

코스 생성 또는 수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | - | 없으면 새로 생성 |
| `title` | string | O | 코스 제목 |
| `description` | string | - | 설명 |
| `durationHours` | integer | - | 교육 시간 (min: 0) |
| `isOnline` | boolean | - | 온라인 여부 |
| `equipment` | string[] | - | 장비 목록 |
| `goal` | string | - | 교육 목표 |
| `notes` | string | - | 비고 |
| `instructorIds` | string[] | - | 코스에 매핑할 강사 ID 목록 |
| `token` | string | - | 인증 토큰 (등록자 추적용) |

### `course.get`

코스 단건 조회 (강의·스케줄 포함).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 코스 ID |

- 응답: Course 객체 전체 (Lectures, Schedules, Instructors 관계 포함)
- `createdBy`는 가입 이름으로 변환하여 반환
- 강의 시간 합계를 `durationHours`에 `총합(기존값)` 형식으로 표시

### `course.list`

코스 목록 조회 (등록자 이름으로 표시).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `limit` | integer | - | 최대 조회 개수 (기본 50, 최대 100) |
| `offset` | integer | - | 오프셋 (기본 0) |

- 응답: `{ courses, total, limit, offset }`

---

## 공유 툴

### `course.shareInvite`

코스 공유 요청 생성.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `courseId` | string | O | 코스 ID |
| `targetUserId` | string | O | 공유 대상 사용자 ID |

### `course.shareRespond`

코스 공유 요청 수락/거절 (수신자 본인).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `courseId` | string | O | 코스 ID |
| `accept` | boolean | O | 수락 여부 |

### `course.shareListReceived`

내 코스 공유 요청/수락/거절 목록 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `status` | enum | - | pending/accepted/rejected |

### `course.shareRevoke`

코스 공유 해제 (공유자/관리자 측).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `courseId` | string | O | 코스 ID |
| `targetUserId` | string | O | 공유 해제 대상 사용자 ID |

### `course.shareLeave`

코스 공유 해제 (수신자 본인 측).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `courseId` | string | O | 코스 ID |

### `lecture.grant.list`

강의별 공유 권한 목록 조회 (소유자/관리자/재공유 권한 보유자).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `lectureId` | string | O | 강의 ID |
| `token` | string | O | 액세스 토큰 |

### `lecture.grant.upsert`

강의 공유 권한 생성/수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `lectureId` | string | O | 강의 ID |
| `userId` | string | O | 대상 사용자 ID |
| `canMap` | boolean | - | 코스 매핑 권한 |
| `canEdit` | boolean | - | 강의 수정 권한 |
| `canReshare` | boolean | - | 재공유 권한 |
| `token` | string | O | 액세스 토큰 |

### `lecture.grant.delete`

강의 공유 권한 해제 (소유자/관리자).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `lectureId` | string | O | 강의 ID |
| `userId` | string | O | 대상 사용자 ID |
| `token` | string | O | 액세스 토큰 |

### `lecture.grant.listMine`

내가 공유받은 강의 권한 목록 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |

### `lecture.grant.leave`

공유 수신자가 본인 강의 공유 해제.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `lectureId` | string | O | 강의 ID |
| `token` | string | O | 액세스 토큰 |

---

## 강의 툴

### `lecture.upsert`

강의 생성 또는 수정 (코스 하위).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | - | 없으면 새로 생성 |
| `courseId` | string | O | 코스 ID |
| `title` | string | O | 강의 제목 |
| `description` | string | - | 설명 |
| `hours` | number | - | 시간 (min: 0) |
| `order` | integer | - | 순서 (min: 0) |
| `token` | string | - | 인증 토큰 (등록자 추적용) |

### `lecture.map`

기존 강의를 코스에 연결.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `lectureId` | string | O | 기존 강의 ID |
| `courseId` | string | O | 연결할 코스 ID |
| `order` | integer | - | 코스 내 표시 순서 (min: 0) |
| `token` | string | O | 인증 토큰 |

### `lecture.get`

강의 단건 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 강의 ID |

### `lecture.list`

코스별 강의 목록 조회 (order 오름차순).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `courseId` | string | O | 코스 ID |
| `limit` | integer | - | 최대 조회 개수 (기본 50, 최대 100) |
| `offset` | integer | - | 오프셋 (기본 0) |

- 응답: `{ lectures, total, limit, offset }`

### `lecture.delete`

강의 소프트 삭제.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 강의 ID |
| `token` | string | - | 인증 토큰 |

---

## 강사 툴

### `instructor.upsert`

강사 생성 또는 수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | - | 없으면 새로 생성 |
| `name` | string | O | 강사명 |
| `title` | string | - | 직함 |
| `email` | string | - | 이메일 |
| `phone` | string | - | 전화번호 |
| `affiliation` | string | - | 소속 |
| `avatarUrl` | string | - | 프로필 이미지 URL (`/uploads/...`) |
| `tagline` | string | - | 한줄 소개 |
| `bio` | string | - | 소개 |
| `specialties` | string[] | - | 전문 분야 |
| `certifications` | object[] | - | 자격/인증 (JSON 배열) |
| `awards` | string[] | - | 수상 |
| `links` | object | - | 링크 (JSON) |
| `degrees` | object[] | - | 학력 (JSON 배열) |
| `careers` | object[] | - | 경력 (JSON 배열) |
| `publications` | object[] | - | 출판/논문 (JSON 배열) |
| `token` | string | - | 인증 토큰 (등록자 추적용) |

### `instructor.get`

강사 단건 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 강사 ID |

- 응답: Instructor 객체 + `Courses`(코스 매핑 목록)

### `instructor.list`

강사 목록 조회 (등록자 이름으로 표시).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `limit` | integer | - | 최대 조회 개수 (기본 50, 최대 100) |
| `offset` | integer | - | 오프셋 (기본 0) |

---

## 일정 툴

### `schedule.upsert`

수업 일정 생성 또는 수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | - | 없으면 새로 생성 |
| `courseId` | string | O | 코스 ID |
| `instructorId` | string | - | 강사 ID |
| `date` | string | - | ISO 8601 날짜/시간 |
| `location` | string | - | 장소 |
| `audience` | string | - | 대상 |
| `remarks` | string | - | 비고 |
| `token` | string | - | 인증 토큰 (등록자 추적용) |

### `schedule.get`

일정 단건 조회 (코스·강사 관계 포함).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 일정 ID |

### `schedule.list`

일정 목록 조회 (등록자 이름으로 표시).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `limit` | integer | - | 최대 조회 개수 (기본 50, 최대 100) |
| `offset` | integer | - | 오프셋 (기본 0) |

---

## 템플릿 툴

### `template.create`

새 템플릿 생성.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `name` | string | O | 템플릿 이름 |
| `html` | string | O | Handlebars HTML |
| `css` | string | O | CSS |
| `token` | string | - | 인증 토큰 |

### `template.get`

템플릿 단건 조회 (버전 이력 포함).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | string | O | 템플릿 ID |

### `template.list`

템플릿 목록 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `page` | integer | - | 페이지 (기본 1) |
| `pageSize` | integer | - | 페이지당 개수 (기본 20, 최대 100) |

### `template.previewHtml`

Handlebars 템플릿에 데이터를 주입하여 완성된 HTML을 반환.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `html` | string | O | Handlebars 템플릿 |
| `css` | string | O | CSS |
| `data` | object | O | course, instructor, schedule 등 |

> 실제 PDF 렌더러 기준 데이터 구조는 `TEMPLATE_GUIDE.md`를 참고하세요.

---

## 렌더 툴

### `render.coursePdf`

코스 데이터 + 템플릿으로 PDF를 생성합니다 (BullMQ 비동기 처리).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `templateId` | string | O | 템플릿 ID |
| `courseId` | string | O | 코스 ID |

응답:

```json
{
  "jobId": "rj_001",
  "status": "pending"
}
```

### `render.schedulePdf`

일정 데이터 + 템플릿으로 PDF를 생성합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `templateId` | string | O | 템플릿 ID |
| `scheduleId` | string | O | 일정 ID |

응답:

```json
{
  "jobId": "rj_002",
  "status": "pending"
}
```

> 현재 `render.*`는 작업만 등록하며 PDF URL을 즉시 반환하지 않습니다.  
> 생성된 PDF 경로는 `RenderJob.pdfUrl`에 저장됩니다.

---

## 테스트 툴

### `test.echo`

간단한 에코 테스트 툴.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `message` | string | O | 에코할 메시지 |

---

## 사용자 인증 툴

### `user.register`

회원가입.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `email` | string | O | 이메일 |
| `password` | string | O | 비밀번호 (8자 이상, 영문+숫자) |
| `name` | string | O | 이름 |
| `isInstructorRequested` | boolean | - | 강사 신청 여부 |

### `user.login`

로그인 (JWT 토큰 발급).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `email` | string | O | 이메일 |
| `password` | string | O | 비밀번호 |

- 응답: `{ user, accessToken, refreshToken }`

### `user.me`

내 정보 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |

### `user.get`

사용자 정보 조회 (관리자 전용).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 (관리자) |
| `userId` | string | O | 조회할 사용자 ID |

### `user.update`

내 정보 수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `name` | string | - | 이름 |
| `currentPassword` | string | - | 현재 비밀번호 (변경 시 필수) |
| `newPassword` | string | - | 새 비밀번호 |

### `user.delete`

회원 탈퇴 (소프트 삭제).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `password` | string | O | 비밀번호 확인 |

### `user.list`

회원 목록 조회 (관리자 전용).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 (관리자) |
| `limit` | integer | - | 최대 조회 개수 |
| `offset` | integer | - | 오프셋 |

### `user.updateRole`

사용자 역할 변경 (관리자 전용).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 (관리자) |
| `userId` | string | O | 대상 사용자 ID |
| `role` | enum | O | admin/operator/editor/instructor/viewer/guest |

### `user.updateByAdmin`

사용자 정보 수정 (관리자 전용: 이름, 역할, 활성화).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 (관리자) |
| `userId` | string | O | 대상 사용자 ID |
| `name` | string | - | 이름 |
| `role` | enum | - | 역할 |
| `isActive` | boolean | - | 계정 활성화 여부 |

### `user.requestInstructor`

강사 신청/프로파일 제출.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `displayName` | string | - | 표시 이름 |
| `title` | string | - | 직함 |
| `bio` | string | - | 자기소개 |
| `phone` | string | - | 전화번호 |
| `website` | string | - | 웹사이트 |
| `links` | JSON | - | 추가 링크 |

### `user.approveInstructor`

강사 승인 (관리자 전용).

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 (관리자) |
| `userId` | string | O | 강사 승인 대상 사용자 ID |

### `user.updateInstructorProfile`

내 강사 프로파일 수정.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `token` | string | O | 액세스 토큰 |
| `displayName` | string | - | 표시 이름 |
| `title` | string | - | 직함 |
| `bio` | string | - | 자기소개 |
| `phone` | string | - | 전화번호 |
| `website` | string | - | 웹사이트 |
| `links` | JSON | - | 추가 링크 |

---

## 등록된 툴 요약 (총 26개)

| 도메인 | 툴 | 인증 |
|--------|-----|------|
| Course | `course.upsert`, `course.get`, `course.list` | token (선택) |
| Lecture | `lecture.upsert`, `lecture.get`, `lecture.list`, `lecture.delete` | token (선택) |
| Instructor | `instructor.upsert`, `instructor.get`, `instructor.list` | token (선택) |
| Schedule | `schedule.upsert`, `schedule.get`, `schedule.list` | token (선택) |
| Template | `template.create`, `template.get`, `template.list`, `template.previewHtml` | token (선택) |
| Render | `render.coursePdf`, `render.schedulePdf` | - |
| Test | `test.echo` | - |
| User | `user.register`, `user.login` | No |
| User | `user.me`, `user.get`, `user.update`, `user.delete` | Yes |
| User | `user.list`, `user.updateRole`, `user.updateByAdmin` | Admin |
| User | `user.requestInstructor`, `user.approveInstructor`, `user.updateInstructorProfile` | Yes/Admin |
