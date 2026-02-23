# Prisma 마이그레이션 절차

## 1. 핵심 규칙

| 환경 | 명령어 | 설명 |
|------|--------|------|
| **개발** | `npx prisma migrate dev` | 마이그레이션 생성 + 적용 |
| **운영** | `npx prisma migrate deploy` | 기존 파일만 적용 |

**운영에서 `migrate dev` 절대 금지**

## 2. 개발 마이그레이션

```bash
# 스키마 변경 → 마이그레이션 생성 + 적용
npx prisma migrate dev --name add_new_field

# 프로토타이핑용 (마이그레이션 파일 없음)
npx prisma db push
```

## 3. 운영 마이그레이션

```bash
npx prisma migrate deploy    # git의 마이그레이션 파일 적용
npx prisma generate          # Client 재생성
```

## 4. 실패 복구

```bash
# 롤백 처리
npx prisma migrate resolve --rolled-back "마이그레이션_이름"
npx prisma migrate dev       # 수정 후 재시도

# 히스토리 리셋 (개발 전용, 데이터 유실)
npx prisma migrate reset
```

## 5. 안전 수칙

| 규칙 | 설명 |
|------|------|
| 변경 순서 | UI → Backend → Migration |
| NOT NULL 추가 | 먼저 기본값 또는 backfill 실행 |
| 컬럼 삭제 | 코드 참조 제거 → 다음 릴리스에서 삭제 |
| 인덱스 | `@@index` 데코레이터 |
| 마이그레이션 파일 | git 커밋 필수 (삭제 금지) |

## 6. Prisma Studio

```bash
npx prisma studio   # http://localhost:5555 (개발 전용)
```
