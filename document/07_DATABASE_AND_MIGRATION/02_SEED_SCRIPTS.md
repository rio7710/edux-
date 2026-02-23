# 시드 스크립트

위치: `scripts/`

## 1. 초기 세팅 스크립트

| 스크립트 | 용도 | 실행 |
|---------|------|------|
| `seed-templates.ts` | 기본 템플릿 | `npx tsx scripts/seed-templates.ts` |
| `create-users-by-role.ts` | 역할별 테스트 사용자 | `npx tsx scripts/create-users-by-role.ts` |
| `create-sample-courses.ts` | 샘플 코스 | `npx tsx scripts/create-sample-courses.ts` |
| `create-instructors.ts` | 샘플 강사 | `npx tsx scripts/create-instructors.ts` |

권장 순서: 템플릿 → 사용자 → (선택) 코스/강사

## 2. 데이터 마이그레이션 스크립트

| 스크립트 | 용도 |
|---------|------|
| `backfill-instructor-users.ts` | Instructor에 userId 연결 |
| `backfill-lecture-grants-from-course-shares.ts` | 기존 공유에 LectureGrant 생성 |
| `backfill-user-contact.ts` | User 연락처 필드 채우기 |
| `update-password.ts` | 비밀번호 변경 (개발용) |

## 3. 검증 스크립트

| 스크립트 | 용도 |
|---------|------|
| `check-permission-matrix.ts` | 역할×도구 매트릭스 무결성 |
| `check-permission-scenarios.ts` | 시나리오별 권한 테스트 |

```bash
npm run test:permissions           # 매트릭스 검사
npm run test:permissions:scenarios  # 시나리오 검사
```
