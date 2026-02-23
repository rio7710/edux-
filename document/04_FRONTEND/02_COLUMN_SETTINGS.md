# 테이블 컬럼 동적 설정

각 테이블의 컬럼 표시/순서/라벨을 DB에서 관리. `TableColumnConfig` 모델 사용.

## 데이터 모델

```prisma
model TableColumnConfig {
  tableKey    String    // "courses", "instructors" 등
  columnKey   String    // "title", "createdAt" 등
  label       String    // 기본 라벨
  customLabel String?   // 사용자 지정 라벨
  visible     Boolean   // 표시 여부
  order       Int       // 표시 순서
  width       Int?      // 컬럼 너비
  fixed       String?   // "left"/"right" 고정
  ownerType   String    // "global" 또는 향후 사용자별
  ownerId     String?   // user일 때 userId
}
```

## 대상 테이블

| tableKey | 페이지 | 컬럼 예시 |
|----------|--------|----------|
| `courses` | CoursesPage | title, description, durationHours, createdBy |
| `instructors` | InstructorsPage | name, title, affiliation, specialties |
| `templates` | TemplatesPage | name, type, createdAt |
| `users` | UsersPage | name, email, role, isActive |
| `schedules` | - | courseId, date, location |
| `lectures` | - | title, hours, order |

## 사용 방법 (useTableConfig)

```typescript
const { columns, isLoading } = useTableConfig("courses");
// AntD Table ColumnsType으로 변환됨
```

동작: 페이지 로드 → `tableConfig.get` → DB 설정 적용 (없으면 기본값) → visible 필터 → order 정렬

## 관리자 설정

SiteSettingsPage → 테이블 설정 탭에서 컬럼별 visible 토글, 순서 드래그, 라벨 수정 → `tableConfig.upsert`로 저장
