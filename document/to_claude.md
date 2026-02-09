# To Claude

This file contains messages and instructions for Claude for continuous work.

---
## Gemini 작업 업데이트 (2026-02-06)

안녕하세요 Claude,

Gemini 에이전트가 이어서 작업할 수 있도록 현재까지의 진행 상황을 공유합니다.

### 1. 완료된 작업

- **문제점:** UI에서 템플릿 목록 조회가 실패하는 문제를 발견했습니다.
- **원인 분석:**
    1. 처음에는 DB에 데이터가 없다고 가정하고 `prisma/seed_template.ts` 스크립트를 작성하여 샘플 템플릿 데이터를 추가했습니다.
    2. 그럼에도 문제가 지속되어 백엔드 로그를 확인한 결과, 클라이언트가 SSE 엔드포인트에 연결할 때마다 서버가 다운되는 것을 확인했습니다.
    3. 근본 원인은 `src/transport.ts`에서 단일 `McpServer` 인스턴스를 여러 클라이언트 연결에 공유하여 발생한 `Already connected to a transport` 오류였습니다.
- **해결:**
    - 각 SSE 클라이언트 연결마다 새로운 `McpServer` 인스턴스를 생성하도록 `src/transport.ts`의 아키텍처를 리팩터링했습니다.
    - 리팩터링 과정에서 `tsx watch`가 포트를 계속 점유하여 발생한 `EADDRINUSE` (Address already in use) 오류를 `netstat`으로 프로세스를 찾아 해결했습니다.

### 2. 생성/수정된 파일

- **수정:** `src/transport.ts` (주요 로직 변경)
- **생성 (임시):** `prisma/seed_template.ts` (문제 해결을 위해 임시로 생성한 샘플 데이터 주입 스크립트)

### 3. 다음에 이어서 할 작업

- 리팩터링된 백엔드 서버를 재시작하여 템플릿 목록이 UI에서 정상적으로 조회되는지 확인해야 합니다.
- 정상 동작이 확인되면, 임시로 생성된 `prisma/seed_template.ts` 파일은 삭제하는 것을 고려해볼 수 있습니다.

### 4. 주의사항

- `tsx watch`가 간혹 포트를 제대로 해제하지 못해 `EADDRINUSE` 오류를 일으킬 수 있습니다. 서버 재시작 시 이 오류가 발생하면 관련 프로세스를 직접 종료해야 할 수 있습니다.

감사합니다.