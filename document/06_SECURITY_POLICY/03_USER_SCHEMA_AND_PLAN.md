# 사용자 스키마 및 고도화 실행 계획

작성일: 2026-02-09
목적: 회원관리 고도화(이메일 인증, 비밀번호 재설정, 역할(RBAC), 강사 전용 프로필 등)에 필요한 DB 스키마, API·툴, 프론트 변경과 마이그레이션·테스트·배포 계획을 제시합니다.

---

## 1. 권장 Prisma 스키마

(현재 `prisma/schema.prisma`에 다음을 반영하도록 제안)

```prisma
model User {
  id                      String   @id @default(cuid())
  email                   String   @unique
  name                    String
  role                    Role     @default(viewer)
  hashedPassword          String?
  emailVerified           Boolean  @default(false)
  emailVerificationToken  String?
  emailVerificationSentAt DateTime?
  passwordResetToken      String?
  passwordResetExpires    DateTime?
  mfaEnabled              Boolean  @default(false)
  mfaSecret               String?
  isActive                Boolean  @default(true) // soft-deactivate
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  InstructorProfile       InstructorProfile?
}

model InstructorProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  affiliation  String?
  certifications String[] @default([]) // Postgres: text[] or JSON
  bio          String?
  avatarUrl    String?
  isActive     Boolean  @default(false) // 관리자 승인 여부
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Role {
  admin
  operator
  instructor
  viewer
  guest
}
```

**비고:** `InstructorProfile`을 별도 테이블로 두면 User 모델 경량화 및 강사 전용 필드 확장에 유리합니다. `certifications`는 DB에 따라 `String[]`(Postgres) 또는 JSON으로 구현합니다.

---

## 2. MCP 툴 / API 변경 제안

- `user.register` (업데이트)
  - 추가 파라미터: `isInstructorRequested?: boolean` (체크박스)
  - 동작: 기본적으로 `InstructorProfile`을 생성하지 않음. 체크 시 빈 `InstructorProfile` 생성(또는 `isActive=false` 상태로 생성)
- `user.verifyEmail` (토큰 검증)
- `user.requestPasswordReset` (토큰 생성 + 이메일 전송)
- `user.resetPassword` (토큰 검증 후 비밀번호 갱신)
- `user.requestInstructor` (로그인 후 요청, operator나 admin이 검토)
- `user.approveInstructor` (admin 전용)
- `user.updateInstructorProfile` (instructor 본인 또는 admin)
- `user.list`/`user.get` 확장: `include: { InstructorProfile: true }` 옵션

---

## 3. 프론트엔드 변경 제안

- `RegisterPage`:
  - 체크박스 `강사로 등록` 추가
  - 체크 시 추가 입력 폼(선택적)을 팝업이나 링크로 노출
- `ProfilePage`:
  - `Instructor` 전용 섹션 조건부 렌더링
  - `isInstructorProfileActive` 상태 노출(관리자 승인 대기 표기)
- Admin UI (간단): `user.list`에 `요청된 강사` 필터/승인 버튼

---

## 4. 마이그레이션 절차 (로컬 → 스테이징 → 운영)

1. `prisma migrate dev --name add_instructor_profile`로 마이그레이션 생성(로컬)
2. 스테이징 DB에 적용 및 데이터 검증
3. 백업/운영 DB 스냅샷 확보
4. 운영에 마이그레이션 적용

**주의:** 운영 DB 변경 전 백업 필수. `certifications` 칼럼 타입(텍스트 배열 vs JSON) 선택에 따라 migration 영향 검토.

---

## 5. 테스트 계획

- 단위 테스트:
  - `user.register` 입력 조합(강사체크 on/off)
  - 이메일 토큰 생성/검증
  - `user.requestPasswordReset` / `user.resetPassword` 시나리오
- 통합 테스트:
  - 가입 → 이메일 검증 → 로그인 → 강사 요청 → 승인 플로우
  - RBAC: 툴 호출 권한 검증 (admin/operator/instructor/viewer)
- 수동 검증:
  - UI에서 가입 폼, 프로필 편집, 관리자 승인 동작 확인

---

## 6. 배포 및 점검 항목

- 배포전 체크리스트:
  - 마이그레이션 스크립트 생성 및 검토
  - 메일 서비스 (SMTP) 연결 설정
  - Redis 연결(필요시) 점검
  - 환경변수(`JWT_SECRET`, `EMAIL_*`) 준비
- 배포 후 점검:
  - 가입/로그인/이메일 검증 실제 시나리오 수행
  - 관리자 승인 시퀀스 테스트
  - 로그(인증, 권한 변경) 정상 기록 확인

---

## 7. 권장 우선순위 (단계별)

1. DB 스키마 추가(예: `InstructorProfile`) 및 마이그레이션 템플릿 생성
2. `user.register` 확장(강사요청 플래그) + 이메일 토큰 기능 구현
3. `user.requestInstructor` / `user.approveInstructor` 툴 구현
4. 프론트엔드: RegisterPage 체크박스 + ProfilePage 조건부 UI
5. 테스트 및 스테이징 점검

---

원하시면 제가 위 스키마 제안으로 `prisma/schema.prisma`의 패치를 생성하고, 간단한 마이그레이션 템플릿(설계 문구)까지 준비해 드리겠습니다. 커밋/푸시는 요청 시에만 진행하겠습니다.
