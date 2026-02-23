# 07. DB 무결성 게이트

## 1) 필수(P0) 체크리스트

| ID | 체크 문항 | 실행 방법 | 합격 기준 |
|---|---|---|---|
| D-M-01 | 마이그레이션 상태가 최신인가 | `npx prisma migrate status` | up to date |
| D-M-02 | 의미 없는 중복 share 데이터가 없는가 | 중복 점검 SQL | 중복 0건 |
| D-M-03 | grant 출처 필드가 정책대로 저장되는가 | share/manual 생성 후 조회 | share=`course_share`, manual=`manual` |
| D-M-04 | orphan 매핑 데이터가 없는가 | orphan SQL 점검 | orphan 0건 |
| D-M-05 | soft delete 데이터가 조회에 섞이지 않는가 | 삭제 후 list/get | 삭제 데이터 노출 없음 |
| D-M-06 | 공유 해제 시 회수 대상만 변경되는가 | revoke 전후 diff | 비대상 row 변경 없음 |
| D-M-07 | 주요 조회 인덱스가 작동하는가 | `EXPLAIN ANALYZE` | full scan 남용 없음 |
| D-M-08 | 권한 차단된 요청에서 DB 변경이 0건인가 | 차단 API 전후 비교 | row 변경 0건 |

## 2) 확장(P1) 체크리스트

| ID | 체크 문항 | 실행 방법 | 합격 기준 |
|---|---|---|---|
| D-E-01 | 대량 더미(예: 10k row)에서도 SLA를 만족하는가 | 부하 데이터 후 list/share | 응답시간 기준 내 |
| D-E-02 | 비활성/오래된 데이터 정리 정책이 있는가 | 배치/문서 점검 | 정리 기준 문서화 |

## 3) 점검 SQL 샘플

```sql
-- 중복 share 점검
SELECT "courseId", "sharedWithUserId", COUNT(*)
FROM "CourseShare"
GROUP BY 1,2
HAVING COUNT(*) > 1;

-- orphan courseLecture 점검
SELECT cl.*
FROM "CourseLecture" cl
LEFT JOIN "Course" c ON c."id" = cl."courseId"
LEFT JOIN "Lecture" l ON l."id" = cl."lectureId"
WHERE c."id" IS NULL OR l."id" IS NULL;

-- grant 출처 점검
SELECT "sourceType", COUNT(*)
FROM "LectureGrant"
GROUP BY 1;
```

## 4) DB 실패 분류

1. 구조 실패: 스키마/마이그레이션 상태 이상
2. 데이터 실패: 중복/orphan/출처 규칙 위반
3. 성능 실패: 인덱스 미활용, 응답시간 기준 초과

