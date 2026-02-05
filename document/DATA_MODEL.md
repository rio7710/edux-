# DATA_MODEL

Prisma 스키마 정의. 실제 파일 위치: `prisma/schema.prisma`

## 변경 이력

- `User` 모델 추가 (인증/인가)
- `RenderJob.status`를 enum(`JobStatus`)으로 변경, `errorMessage` 필드 추가
- `Course`, `Instructor`, `CourseSchedule`에 소프트 삭제(`deletedAt`) 추가
- `Template.engine` 필드 제거 (Handlebars 단일 엔진 고정)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ──────────────────────────────────────
// 인증/인가
// ──────────────────────────────────────

enum Role {
  admin
  editor
  viewer
}

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String
  role           Role     @default(viewer)
  hashedPassword String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

// ──────────────────────────────────────
// 강사
// ──────────────────────────────────────

model Instructor {
  id             String    @id @default(cuid())
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
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?
  Schedules      CourseSchedule[]
}

// ──────────────────────────────────────
// 코스
// ──────────────────────────────────────

model Course {
  id            String    @id @default(cuid())
  title         String
  description   String?
  durationHours Int?
  isOnline      Boolean?
  equipment     String[]
  goal          String?
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  Modules       CourseModule[]
  Schedules     CourseSchedule[]
}

model CourseModule {
  id       String  @id @default(cuid())
  courseId  String
  title    String
  details  String?
  hours    Float?
  order    Int     @default(0)
  Course   Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
}

model CourseSchedule {
  id           String      @id @default(cuid())
  courseId      String
  instructorId String?
  date         DateTime?
  location     String?
  audience     String?
  remarks      String?
  customFields Json?
  createdAt    DateTime    @default(now())
  deletedAt    DateTime?
  Course       Course      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  Instructor   Instructor? @relation(fields: [instructorId], references: [id])
}

// ──────────────────────────────────────
// 템플릿
// ──────────────────────────────────────

model Template {
  id        String   @id @default(cuid())
  name      String
  css       String
  html      String
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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

- `Course`, `Instructor`, `CourseSchedule`에 적용
- `null`이면 활성 레코드, 값이 있으면 삭제된 레코드
- 쿼리 시 `where: { deletedAt: null }` 조건 필수
- `CourseModule`, `TemplateVersion`은 부모에 Cascade 삭제되므로 별도 소프트 삭제 불필요

### RenderJob 상태 전이

```text
pending → processing → done
                     → failed (errorMessage에 원인 기록)
```

### User 역할

- **admin**: 모든 툴 실행 가능, 사용자 관리
- **editor**: 코스/강사/템플릿 CRUD, PDF 렌더
- **viewer**: 읽기 전용 (get, list 툴만 허용)
