# Migration Runbook

운영/공유 DB 환경에서 **안전하게 Prisma 마이그레이션을 적용하는 절차**입니다.

---

## 1. 기본 원칙

- 운영/공유 DB에는 **`migrate dev` 금지**
- 모든 변경은 **`migrate deploy`로 적용**
- 변경 전/후 **DB 백업** 필수
- 스키마 변경은 **SQL 검토 후 적용**

---

## 2. 권장 워크플로우

### Step 1) 개발 환경에서 마이그레이션 생성

```bash
npx prisma migrate dev --name <migration_name> --create-only
```

### Step 2) 생성된 SQL 검토

```text
prisma/migrations/<timestamp>_<migration_name>/migration.sql
```

### Step 3) 테스트/스테이징에 적용

```bash
npx prisma migrate deploy
```

### Step 4) 운영 반영

```bash
npx prisma migrate deploy
```

---

## 3. Shadow DB 관련

### 문제가 발생하는 경우

- 로컬/개발 환경에서 `migrate dev` 시 shadow DB 오류 발생

### 해결 방법

1. **권장 옵션**
   ```bash
   npx prisma migrate dev --skip-shadow-database
   ```
2. **수동 생성**
   ```sql
   CREATE DATABASE <db>_shadow;
   ```

---

## 4. 상태 꼬임 해결

이미 DB에 반영된 마이그레이션이 있는데, 상태가 어긋난 경우:

```bash
npx prisma migrate resolve --applied <migration_id>
```

---

## 5. 금지/주의 사항

- **금지**: 운영/공유 DB에 `migrate dev`
- **금지**: 운영/공유 DB에 `migrate reset`
- **주의**: shadow DB 자동 생성이 실패하는 환경에서는 `--skip-shadow-database` 사용

---

## 6. 잦은 스키마 변경 대응 프로세스 (필수 권장)

필드 추가/삭제가 자주 발생하는 단계에서는 아래 절차로 안정성을 확보합니다.

### 6-1. 작은 단위 마이그레이션

- 한 번에 많은 변경을 묶지 말고 **필드 단위로 분리**
- 문제가 발생했을 때 원인 추적이 쉬움

### 6-2. “추가 → 배포 → 제거” 순서

1. **필드 추가(Nullable)**
2. **코드에서 새/구 필드 모두 대응**
3. **데이터 마이그레이션 완료**
4. **필드 제거**

삭제는 항상 마지막 단계로 미룹니다.

### 6-3. 데이터 마이그레이션 분리

- 스키마 변경과 데이터 변환(Backfill)은 분리
- 예: `migration.sql`은 컬럼 추가만, 데이터 채움은 별도 스크립트

### 6-4. 호환성 유지 (Backward Compatible)

- 배포 동안 새/구 코드가 함께 동작해야 합니다.
- 새 필드가 없어도 기존 로직이 깨지지 않아야 함.

### 6-5. 롤백 전략

- 컬럼 삭제 전까지는 **롤백 가능**
- 삭제 이후 롤백 시 데이터 복구가 어렵기 때문에 삭제는 마지막

---

## 7. 체크리스트 (운영 적용 전)

- [ ] 마이그레이션 SQL 검토 완료
- [ ] 백업 완료
- [ ] 테스트 환경 적용 완료
- [ ] 적용 로그 확인

---

## 참고

- `document/TROUBLESHOOTING.md` (마이그레이션 오류 사례)
