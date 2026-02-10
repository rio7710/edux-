# Troubleshooting Guide

이 문서는 개발/테스트 중 발생한 장애와 해결 방법을 정리합니다. 다른 작업자가 재현/대응할 수 있도록 최소한의 재현 조건, 증상, 원인, 해결/우회 방법을 포함합니다.

## 1) 로그인 버튼이 계속 로딩만 도는 경우

### 증상
- 로그인 버튼 클릭 후 스피너가 계속 돌아가며 화면 전환 없음
- 콘솔에 `EventSource 로드하지 못함` 또는 MCP 응답이 없음

### 원인
- `/sse` 연결 실패 또는 `/messages` 요청이 404로 끝난 뒤 클라이언트가 응답 대기를 풀지 못함

### 해결/우회
- 클라이언트 MCP에서 요청 타임아웃 및 SSE 재연결 로직 추가됨
- 클라이언트 MCP에서 `/sse` 경로 실패 시 `http://localhost:7777`으로 재시도하도록 보완됨

### 확인 포인트
- 브라우저 콘솔에 `MCP 연결 시간이 초과되었습니다.` 또는 `요청 시간이 초과되었습니다.`가 뜨는지 확인
- `http://localhost:7777/health` 응답 200 확인
- `http://localhost:5173/sse`가 브라우저에서 연결 실패할 경우 프록시 설정 또는 직접 연결로 우회

## 2) SSE 연결 실패: EventSource 오류

### 증상
- 콘솔에 `EventSource 로드하지 못함: GET "http://localhost:7777/sse"` 또는 `/sse` 관련 오류

### 원인
- 프록시 설정 문제 또는 로컬 CORS/네트워크 환경에서 `localhost:7777` 접근 차단

### 해결/우회
- MCP 클라이언트가 자동으로 `/sse` 프록시와 직접 접근을 번갈아 재시도하도록 수정됨
- 재시작 후에도 실패 시, 방화벽/프록시 설정 확인 필요

## 3) 로그인 요청이 멈춤 (응답 없음)

### 증상
- `/messages?sessionId=...` 요청이 브라우저에서 무한 대기
- 콘솔에 MCP 도구 호출 로그만 있고 응답 없음

### 원인
- `sessionId`가 서버에서 만료/삭제되어 404 반환
- 클라이언트가 HTTP 404를 처리하지 못해 Promise가 resolve/reject되지 않음

### 해결/우회
- MCP 클라이언트가 `/messages` 404를 감지하면 `disconnect -> reconnect -> 재요청`하도록 수정됨

## 4) 서버는 살아있는데 화면이 안 뜨는 경우

### 확인 절차
- 포트 리슨 확인
  - 5173: 프론트
  - 7777: 백엔드 SSE
- 로그 확인
  - `D:\workSpace\edux\logs\dev-backend.out.log`
  - `D:\workSpace\edux\logs\dev-ui.out.log`

### 재시작 방법
- 현재 실행 중인 `node/tsx/npm` 프로세스 종료 후 재기동
- 백엔드: `npm run dev` (workspace root)
- 프론트: `npm run dev` (ui folder)

## 5) favicon 404

### 증상
- 콘솔에 `favicon.ico 404` 로그 출력

### 원인
- 기본 favicon이 `favicon.svg`로 변경되어 `.ico` 경로 요청이 실패

### 해결/우회
- 무시 가능 (기능 영향 없음)
- 필요 시 `public/favicon.ico`를 추가하거나 브라우저 기본 요청 경로를 맞춤

## 6) 세션 연장 버튼 눌러도 시간 미변경

### 원인
- 서버가 새 토큰을 발급했으나 클라이언트 타이머가 기존 exp를 기준으로 동작

### 해결
- 토큰 갱신 후 타이머 재계산 로직 추가됨
- 연장 후 `recomputeRemaining()` 호출로 즉시 반영

## 7) 개발 환경 기본 점검 체크리스트

1. `http://localhost:7777/health` 응답 확인
2. 브라우저 콘솔에서 `MCP SSE connected`와 `Session ID` 로그 확인
3. `/messages?sessionId=...` 호출 응답 확인
4. 프론트/백엔드 로그 tail 확인

## 참고 파일

- `ui/src/api/mcpClient.ts` (MCP 연결/재시도/타임아웃 로직)
- `src/transport.ts` (SSE 서버 및 `/messages` 처리)
