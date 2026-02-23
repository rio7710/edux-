# 배포 테스트 패키지 (2026-02-13)

목적: 이 패키지 문서만으로 배포 전 무결성 테스트를 수행할 수 있도록 `필수(P0)`/`확장(P1)` 기준, 실행 순서, 증빙 형식을 고정합니다.

## 0) 현재 사이트 기준선

- 프론트: `http://localhost:5173`
- MCP/백엔드: `http://localhost:7777`
- 헬스체크: `GET /health` -> `{"status":"ok"}`
- 권한/공유 핵심 도메인: `course.share*`, `lecture.grant*`, `user.login`, `user.refreshToken`

## 1) 목차 (번호 순서대로 실행)

1. `01_RELEASE_GATES.md` - 배포 판정 규칙/중단 조건
2. `02_COMMON_RULES_AND_DATA.md` - 공통 룰/더미 데이터/증빙 규칙
3. `03_PERMISSION_HARD_GATE.md` - 역할별 메뉴 접근/기능 차단 하드 게이트
4. `04_FRONTEND_GATE.md` - 프론트 UX/UI/접근성 체크
5. `05_BACKEND_MCP_GATE.md` - 백엔드 흐름/오류/동기화 체크
6. `06_MCP_QUALITY_GATE.md` - MCP 적합성/효율성/재사용성 품질 게이트
7. `07_DB_INTEGRITY_GATE.md` - DB 무결성/중복/매핑 점검
8. `08_EXECUTION_AND_REPORT.md` - 실행 순서/보고/서명 템플릿

## 2) 핵심 실행 원칙

1. `P0 100% PASS` 전까지 배포 금지
2. `권한 하드 게이트` 실패 1건이라도 즉시 중단
3. `500 Internal Server Error`는 기능 성공 여부와 무관하게 실패 처리
4. 모든 테스트는 `UI -> MCP 응답 -> DB 결과` 3단 검증

## 3) 빠른 시작

1. `01_RELEASE_GATES.md`에서 중단 조건 먼저 확인
2. `02_COMMON_RULES_AND_DATA.md` 기준으로 계정/샘플 데이터 준비
3. `03`~`07` 순서대로 케이스 실행
4. `08_EXECUTION_AND_REPORT.md` 템플릿으로 증빙 정리

