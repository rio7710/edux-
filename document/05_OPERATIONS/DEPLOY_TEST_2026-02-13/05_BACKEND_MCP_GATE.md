# 05. 백엔드(MCP/툴) 게이트

## 1) 필수(P0) 체크리스트

| ID | 체크 문항 | 실행 방법 | 합격 기준 |
|---|---|---|---|
| B-M-01 | 동일 기능을 다른 화면/툴에서 실행해도 결과가 같은가 | 코스 화면/기능공유 화면 양쪽 실행 | 상태/권한 결과 동일 |
| B-M-02 | `course.shareInvite/respond/revoke/leave` 상태 전이가 정상인가 | pending->accepted/rejected->reinvite | 정의되지 않은 전이 차단 |
| B-M-03 | 공유 수락 시 grant 자동 생성이 정상인가 | share accept 후 grant 조회 | `canMap=true`, `canEdit=false`, `canReshare=false` |
| B-M-04 | 공유 해제 시 grant 동기화가 정확한가 | revoke/leave 후 grant 조회 | 해당 출처 grant만 회수/재연결 |
| B-M-05 | 수동 grant와 공유 grant 충돌이 없는가 | manual + share 혼합 후 revoke | manual grant 보존 |
| B-M-06 | 권한 없는 툴 호출이 차단되는가 | viewer/guest로 보호 툴 호출 | 권한 거부 + 데이터 미변경 |
| B-M-07 | 없는 ID 매핑 오류 처리가 일관적인가 | 없는 courseId/lectureId 호출 | not found 일관 응답 |
| B-M-08 | SSE 세션 끊김/재연결 후 요청이 회복되는가 | 연결 재시작 후 호출 | 재연결 후 정상 처리 |
| B-M-09 | 로그인/토큰 갱신/만료 경로가 정상인가 | 만료 토큰 호출 후 refresh | 갱신 성공 및 재시도 정상 |
| B-M-10 | 멱등성(재시도)에서 중복 부작용이 없는가 | 동일 요청 3회 연속 | 중복 데이터/에러 폭주 없음 |
| B-M-11 | 오류 메시지가 사용자/운영자 관점에서 분리되는가 | 인증/권한/서버오류 유도 | 사용자 메시지와 내부 로그 분리 |

## 2) 확장(P1) 체크리스트

| ID | 체크 문항 | 실행 방법 | 합격 기준 |
|---|---|---|---|
| B-E-01 | 동시 요청 충돌에서 데이터 경쟁이 없는가 | 2클라이언트 동시 share/revoke | 최종 상태 일관 |
| B-E-02 | 지연/타임아웃에서 에러 안내가 명확한가 | 인위적 delay 주입 | timeout/retry 메시지 분리 |
| B-E-03 | 로그에 원인 추적 정보가 충분한가 | 실패 후 로그 확인 | tool, actor, target, error 포함 |
| B-E-04 | 반복 실패 시 회로 차단 또는 백오프가 동작하는가 | 동일 실패 반복 호출 | 무한 재시도 방지 |

## 3) 흐름 무결성 체크 규칙

1. share 수락 후 grant 생성까지 하나의 트랜잭션 흐름으로 검증
2. revoke/leave 시 source 기반 회수 규칙 검증
3. 모든 실패 케이스에서 DB 변화량 `0`인지 확인

