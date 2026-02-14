# 03. 권한 하드 게이트

## 1) 기준 문서

- `document/00_FEATURES_PERMISSIONS_TABLE.md`
- `document/02_API_MCP/01_MCP_TOOLS.md`
- `document/COURSE_GUIDE.md`

## 2) 역할별 메뉴 접근 매트릭스 (필수)

현 기준선은 `document/00_FEATURES_PERMISSIONS_TABLE.md`를 따릅니다.  
`O`=허용, `X`=차단입니다.

| 역할 | 메뉴 | Expected | Actual | 결과 |
|---|---|---|---|---|
| admin | 코스 관리 | O |  |  |
| admin | 기능공유 | O |  |  |
| admin | 사용자관리 | O |  |  |
| admin | 권한설정 | O |  |  |
| admin | 그룹관리 | O |  |  |
| admin | 사이트설정 | O |  |  |
| operator | 코스 관리 | O |  |  |
| operator | 기능공유 | O |  |  |
| operator | 사용자관리 | O |  |  |
| operator | 권한설정 | X |  |  |
| operator | 그룹관리 | O |  |  |
| operator | 사이트설정 | X |  |  |
| editor | 코스 관리 | O |  |  |
| editor | 기능공유 | O |  |  |
| editor | 사용자관리 | X |  |  |
| editor | 권한설정 | X |  |  |
| editor | 그룹관리 | X |  |  |
| editor | 사이트설정 | X |  |  |
| instructor | 코스 관리 | O |  |  |
| instructor | 기능공유 | O |  |  |
| instructor | 사용자관리 | X |  |  |
| instructor | 권한설정 | X |  |  |
| instructor | 그룹관리 | X |  |  |
| instructor | 사이트설정 | X |  |  |
| viewer | 코스 관리 | X |  |  |
| viewer | 기능공유 | O |  |  |
| viewer | 사용자관리 | X |  |  |
| viewer | 권한설정 | X |  |  |
| viewer | 그룹관리 | X |  |  |
| viewer | 사이트설정 | X |  |  |
| guest | 코스 관리 | X |  |  |
| guest | 기능공유 | X |  |  |
| guest | 사용자관리 | X |  |  |
| guest | 권한설정 | X |  |  |
| guest | 그룹관리 | X |  |  |
| guest | 사이트설정 | X |  |  |

정책 충돌 메모: 일부 문서에 `operator`의 사이트설정 접근 가능 표현이 있으나, 본 게이트는 보수적으로 `admin 전용`을 기준으로 판정합니다.

## 3) 기능 차단 검증 문항 (필수/Blocker)

| ID | 체크 문항 | 실행 방법 | 합격 기준 |
|---|---|---|---|
| A-M-01 | 메뉴 비노출 역할이 URL 직접 접근 시 차단되는가 | `/admin/...` 직접 접근 | 리다이렉트/차단 화면, 데이터 미노출 |
| A-M-02 | UI 비활성 + 서버 차단이 함께 동작하는가 | 비활성 대상 API 수동 호출 | 권한 에러 + DB 변경 0건 |
| A-M-03 | 권한 없는 툴 호출 에러가 일관적인가 | 금지 툴 호출 | 에러 포맷 일관, 500 아님 |
| A-M-04 | 권한 변경 직후 반영되는가 | role 변경 후 즉시 조회 | 메뉴/액션 권한 즉시 일치 |
| A-M-05 | 공유로 열린 권한 범위가 정책을 넘지 않는가 | share accept 후 기능 실행 | 허용 범위만 동작 |
| A-M-06 | 차단 요청에서 DB 무결성이 유지되는가 | 실패 요청 전후 SQL | 데이터/상태 변형 없음 |
| A-M-07 | 숨김 메뉴 URL 북마크 재진입이 차단되는가 | 이전 URL 재접속 | 동일 차단 결과 |
| A-M-08 | 토큰 갱신 후에도 차단 규칙이 유지되는가 | refresh 후 금지 호출 | 우회 불가 |
| A-M-09 | 다중 탭에서 권한 강등 시 즉시 차단되는가 | 탭A 변경, 탭B 실행 | 탭B도 차단 |
| A-M-10 | 승인/수락 이벤트 후 타 역할 데이터 노출이 없는가 | share/accept 흐름 실행 | 비대상 데이터 미노출 |

## 4) 실행 원칙

1. 프론트 확인만으로 통과 처리 금지
2. 반드시 `UI -> MCP 응답 -> DB 결과` 3단 검증
3. `403/권한없음`은 정상, `500`은 실패
4. 허용 케이스보다 차단 케이스 먼저 검증
