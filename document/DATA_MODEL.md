# DATA_MODEL

Prisma 스키마 정의. 실제 파일 위치: `prisma/schema.prisma`

## 변경 이력

- `User` 모델 추가 (인증/인가)
- `RenderJob.status`를 enum(`JobStatus`)으로 변경, `errorMessage` 필드 추가
- `Course`, `Instructor`, `CourseSchedule`에 소프트 삭제(`deletedAt`) 추가
- `Template.engine` 필드 제거 (Handlebars 단일 엔진 고정)
- `CourseModule` → `Lecture` 모델로 교체 (강의 단위 관리, 소프트 삭제 지원)
- `Role` enum 확장: `admin`, `operator`, `editor`, `instructor`, `viewer`, `guest`
- `InstructorProfile` 모델 추가 (강사 신청/승인 워크플로우)
- 전 엔티티에 `createdBy` 필드 추가 (등록자 추적)
- `User` 모델에 `isActive`, `lastLoginAt`, `deletedAt`, `provider`, `providerId` 추가
- `Instructor.userId` 추가 (User ↔ Instructor 1:1 매핑)
- `CourseInstructor` 조인 테이블 추가 (Course ↔ Instructor M:N 매핑)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ──────────────────────────────────────
// 인증/인가
// ──────────────────────────────────────

enum Role {
  admin
  operator
  editor
  instructor
  viewer
  guest
}

model User {
  id                String             @id @default(cuid())
  email             String             @unique
  name              String
  role              Role               @default(guest)
  hashedPassword    String?
  provider          String?            // 'local' | 'google' | 'kakao'
  providerId        String?
  isActive          Boolean            @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  deletedAt         DateTime?
  instructorProfile InstructorProfile?
  instructor        Instructor?        @relation("UserInstructor")
}

model InstructorProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  displayName String?
  title       String?
  bio         String?
  phone       String?
  website     String?
  links       Json?
  isApproved  Boolean  @default(false)
  isPending   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  User        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────
// 강사
// ──────────────────────────────────────

model Instructor {
  id             String           @id @default(cuid())
  userId         String?          @unique
  name           String
  title          String?
  email          String?
  phone          String?
  affiliation    String?
  avatarUrl      String?
  tagline        String?
  specialties    String[]
  certifications String[]
  awards         String[]
  links          Json?
  createdBy      String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?
  Schedules      CourseSchedule[]
  CourseInstructors CourseInstructor[]
  User           User?            @relation("UserInstructor", fields: [userId], references: [id], onDelete: SetNull)
}

// ──────────────────────────────────────
// 코스
// ──────────────────────────────────────

model Course {
  id            String           @id @default(cuid())
  title         String
  description   String?
  durationHours Int?
  isOnline      Boolean?
  equipment     String[]
  goal          String?
  notes         String?
  createdBy     String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  deletedAt     DateTime?
  Lectures      Lecture[]
  Schedules     CourseSchedule[]
  CourseInstructors CourseInstructor[]
}

model CourseInstructor {
  id           String     @id @default(cuid())
  courseId     String
  instructorId String
  createdAt    DateTime   @default(now())

  Course      Course     @relation(fields: [courseId], references: [id], onDelete: Cascade)
  Instructor  Instructor @relation(fields: [instructorId], references: [id], onDelete: Cascade)

  @@unique([courseId, instructorId])
  @@index([instructorId])
}

model Lecture {
  id          String    @id @default(cuid())
  courseId    String
  title       String
  description String?
  hours       Float?
  order       Int       @default(0)
  createdBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  Course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
}

model CourseSchedule {
  id           String      @id @default(cuid())
  courseId     String
  instructorId String?
  date         DateTime?
  location     String?
  audience     String?
  remarks      String?
  customFields Json?
  createdBy    String?
  createdAt    DateTime    @default(now())
  deletedAt    DateTime?
  Course       Course      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  Instructor   Instructor? @relation(fields: [instructorId], references: [id])
}

// ──────────────────────────────────────
// 템플릿
// ──────────────────────────────────────

model Template {
  id        String            @id @default(cuid())
  name      String
  css       String
  html      String
  createdBy String?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  Versions  TemplateVersion[]
}

model TemplateVersion {
  id         String   @id @default(cuid())
  templateId String
  version    Int
  css        String
  html       String
  changelog  String?
  createdAt  DateTime @default(now())
  Template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────
// 렌더 작업
// ──────────────────────────────────────

enum JobStatus {
  pending
  processing
  done
  failed
}

model RenderJob {
  id           String    @id @default(cuid())
  templateId   String
  targetType   String    // 'course' | 'schedule'
  targetId     String
  status       JobStatus @default(pending)
  pdfUrl       String?
  errorMessage String?
  createdAt    DateTime  @default(now())
}
```

## 주요 설계 결정

### 소프트 삭제 (`deletedAt`)

- `Course`, `Instructor`, `CourseSchedule`, `Lecture`, `User`에 적용
- `null`이면 활성 레코드, 값이 있으면 삭제된 레코드
- 쿼리 시 `where: { deletedAt: null }` 조건 필수
- `TemplateVersion`은 부모에 Cascade 삭제되므로 별도 소프트 삭제 불필요

### RenderJob 상태 전이

```text
pending → processing → done
                     → failed (errorMessage에 원인 기록)
```

### User 역할

- **admin**: 모든 툴 실행 가능, 사용자 관리, 강사 승인
- **operator**: 운영 업무 (코스/일정/강사 관리, 통계)
- **editor**: 코스/강사/템플릿 CRUD, PDF 렌더
- **instructor**: 자신이 소유한 코스/강의/일정 CRUD
- **viewer**: 읽기 전용 (get, list 툴만 허용)
- **guest**: 최소 권한 (신규 가입 시 기본 역할)

### createdBy 등록자 추적

- `Course`, `Lecture`, `Instructor`, `CourseSchedule`, `Template`에 `createdBy` 필드 적용
- 등록 시 JWT 토큰에서 사용자 ID를 추출하여 자동 저장
- 목록/상세 조회 시 `resolveCreatorNames` 헬퍼로 사용자 ID → 가입 이름으로 변환하여 표시
- 중첩된 관계(코스→강의, 일정→강사 등)도 재귀적으로 변환

### 강사 신청/승인 워크플로우

- `InstructorProfile`: 사용자의 강사 신청 정보 저장
- `isPending`: 신청 후 관리자 승인 대기 상태
- `isApproved`: 관리자 승인 완료 시 `true`
- 승인 시 `Instructor` 레코드 자동 생성 + `User.role` → `instructor`로 변경
