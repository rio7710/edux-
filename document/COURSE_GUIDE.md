# 코스 가이드 (정의/권한/플로우)

본 문서는 코스 기능을 **관리자 영역**과 **내 문서 영역**으로 분리하여 운영하는 기준을 정의합니다.

---

## 1. 코스 구분 (두 가지)

- **내가 만든 코스**
  - 작성자(본인) 기준
- **공유받은 코스**
  - 다른 사용자가 공유한 코스

관리자는 **전체 코스**에 접근 가능합니다.

---

## 2. 메뉴 위치 및 역할

- **관리자 메뉴(코스 관리)**: 전체 코스 조회/관리
- **내 문서 메뉴(탭 구성 권장)**:
  - `내가 만든 코스`
  - `공유받은 코스`
- **사용자 메뉴(기능공유)**:
  - `코스 공유 요청/수락/거절 목록`
  - `내가 공유받은 코스/강의 공유 해제`

관리 영역은 유지하고, **사용자 영역은 내 문서 탭**에 배치합니다.

---

## 3. 권한 정책 (요약)

### 관리자

- 전체 조회/수정/공유 관리 가능
- 공유 요청 생성/해제 가능

### 운영자/편집자/강사

- 본인 코스 및 공유받은 코스만 접근
- 역할별 메뉴 접근에서 세부 조정

### 뷰어/게스트

- 조회 제한 (정책에 따라 허용 범위 결정)

---

## 4. 공유/수락 규칙

- 코스 공유 수락/거절은 **공유 수신자 본인**이 처리
- 공유 요청/대상/해제 관련 기능은 “기타 > 공유”에 묶어 관리
- 수신자 본인은 사용자 메뉴 `기능공유`에서 공유 목록을 조회하고 본인 공유를 해제 가능
- 역할별 메뉴 접근에서 **조회/사용 허용 여부 조정**
- 수락(`accepted`) 시 강의 권한 기본값:
  - `canMap=true`
  - `canEdit=false`
  - `canReshare=false`
- 강의 원문 수정은 `Lecture.authorId` 또는 `LectureGrant.canEdit=true`만 허용

---

## 5. 삭제 정책

- **코스 삭제는 소프트 삭제 기본**
- 하드 삭제는 원칙적으로 금지
- 초기 단계에서는 **관리자만 삭제 허용** 권장

---

## 6. 구현 상태 기준

- UI는 먼저 구현(미구현 기능은 빨간 표시)
- 백엔드 툴 구현 후 “미구현” 표시 제거
- 마이그레이션은 마지막 단계 적용

---

## 7. 권장 툴 분리

- `course.list` (관리자/전체)
- `course.listMine` (본인용)
- `course.share*` (공유 관련, 기타 메뉴로 관리)
- `course.shareLeave` (수신자 본인 공유 해제)
- `lecture.map` (기존 강의를 코스에 연결, `canMap` 권한 반영)
- `lecture.grant.listMine` (내 강의 공유 목록)
- `lecture.grant.leave` (수신자 본인 강의 공유 해제)

---

## 8. 동기화/장애 대응 업데이트 (2026-02-13)

### 공유 동기화 강화

- `course.shareInvite/respond/revoke/leave/delete`에서 코스 공유 상태와 강의 권한(`LectureGrant`)을 동일 트랜잭션으로 동기화
- `LectureGrant`에 출처 필드 추가:
  - `sourceType`: `manual` | `course_share`
  - `sourceRefId`: 공유 레코드(`CourseShare.id`) 참조
- 공유 해제 시 동일 사용자/강의에 다른 `accepted` 공유가 있으면 권한을 즉시 회수하지 않고 fallback 공유로 재연결(reassign)
- 수동 권한(`manual`)은 자동 권한(`course_share`) 동기화에서 덮어쓰지 않도록 보호

### 로그인 장애 사례 정리 (Prisma URL 오류)

- 증상:
  - 로그인 시 `prisma.user.findUnique()` 실패
  - 메시지: `the URL must start with the protocol prisma://`
- 원인:
  - Prisma Client가 `--no-engine`(Data Proxy 모드)로 생성되어 `prisma://`만 허용된 상태
  - 로컬 `.env`의 `DATABASE_URL`은 `postgresql://...` 이므로 런타임 충돌
- 복구:
  1. `npx prisma generate` (일반 엔진 모드로 재생성)
  2. 서버 재시작
  3. `http://localhost:7777/health` 확인
- 재발 방지:
  - 로컬 개발 환경에서는 `prisma generate --no-engine` 사용 금지
  - 잘못 실행한 경우 즉시 `npx prisma generate` 재실행
