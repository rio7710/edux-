# EduX 확장 기능 분리 전략 분석 (현재 사이트 기준)

작성일: 2026-02-15
기준 코드베이스: `d:\workSpace\edux`

## 1. 현재 시스템 구조 요약 (실제 코드 기준)

현재 서비스는 단일 코드베이스/단일 DB 중심이며, 아래가 강하게 결합되어 있습니다.

- 인증/권한/RBAC + 그룹 권한 정책
- 코스/강의/강사/일정 도메인
- 템플릿 관리 + PDF 렌더 큐(BullMQ/Redis)
- 파일 업로드/문서 공유 링크
- MCP 툴 서버(HTTP/SSE/stdio)

핵심 관찰:

- `src/transport.ts`에 OAuth, 업로드, 정적서빙, MCP 툴 등록이 한 파일에 집중됨
- `src/mcp-server.ts`와 `src/transport.ts`에 툴 등록 로직이 중복되어 변경 시 drift 위험 존재
- 렌더 워커(`src/workers/pdfWorker.ts`)가 DB 조회 + 템플릿 컴파일 + PDF 생성 + 문서 생성까지 모두 담당
- `prisma/schema.prisma` 상 `RenderJob`, `UserDocument`, `Template`이 코어 도메인과 동일 DB에 공존

## 2. 추가하려는 기능과 적합한 배치

요청 기능:

1) 일반 스케줄
2) AI 연동 목차 추천/자동 생성
3) 목차별 원교안 생성(사용자 가이드 반영)
4) 원교안 DM 변환으로 원고 생성
5) 원고 + 템플릿 + 스킬가이드 기반 학습교안 자동 제작/관리

배치 권고:

- Core(현 시스템 유지):
  - 사용자/권한/조직/그룹 정책
  - 코스/강의/강사/일정 기본 CRUD
  - 템플릿 메타 조회/선택 UI
  - 결과 조회/승인/배포
- Generation Platform(분리 서비스):
  - AI 오케스트레이션(목차/원교안/원고 생성)
  - DM 변환 파이프라인
  - 렌더링 파이프라인(PDF/DOC 등)
  - 장시간 작업 큐/재시도/상태관리

## 3. 왜 분리가 필요한가 (유지보수/속도/재사용)

### 3.1 유지보수

- 생성 파이프라인은 모델/프롬프트/후처리 규칙 변경 주기가 짧음
- 코어 서비스는 권한/데이터 정합성이 우선이며 변경 주기가 상대적으로 안정적
- 둘을 분리해야 배포 리스크가 분산됨

### 3.2 속도

- AI/문서 렌더링은 CPU/메모리/외부 API 지연 영향을 크게 받음
- 현재처럼 한 시스템에 집중되면 API 지연 전파 가능성이 커짐
- 비동기 Job + 별도 워커 확장이 응답시간 보호에 유리

### 3.3 재사용

- `generate-outline`, `generate-draft`, `transform-dm`, `render-material` 같은 API로 표준화 시
  - 웹 UI 외 채널(운영도구/자동화)에서도 재사용 가능
  - 템플릿/스킬가이드를 버전 데이터로 공유 가능

## 4. 분리 범위 제안 (과분리 방지)

초기에는 2개 서비스 권장:

1) Core App (기존 edux)
- 인증/권한/운영
- 도메인 원천 데이터 관리
- Job 생성 요청/결과 조회

2) Generation Platform (신규)
- AI 오케스트레이션
- DM 변환
- 문서 렌더링
- 워크플로우/큐/재시도

주의: 초기부터 AI/렌더/워크플로우를 각각 독립 서비스로 쪼개면 운영 복잡도 급증 가능.
초기 1개 플랫폼으로 묶고, 트래픽/조직 성숙도에 맞춰 2차 분리 권장.

## 5. 시스템 경계 정의 (현재 코드에 맞춘 실무 기준)

### Core에 남길 것

- `User`, `Group`, `PermissionGrant`, `Course`, `Lecture`, `Instructor`, `CourseSchedule`
- 공유/알림/권한 도메인(`CourseShare`, `LectureGrant`, `UserMessage`)
- UI와 관리자 워크플로우
- 파일 접근 정책(공유 링크 발급/회수 정책)

### Generation으로 이동/신설할 것

- 생성 요청/실행 상태 모델(신규 Job 테이블들)
- AI 생성 단계별 산출물 저장소(Outline/Draft/Script/Material)
- DM 변환기, 템플릿 조합기, 렌더 엔진
- 실패 재시도/백오프/DLQ

### 공유 계약(API)로 연결할 것

- Core -> Generation
  - Job 생성 요청(입력: courseId, templateId, guideVersion, 옵션)
  - Job 상태 조회/취소
- Generation -> Core
  - 완료 이벤트(webhook 또는 polling 대상 상태 반영)
  - 최종 산출물 URL/메타

## 6. 위험요소와 처리 방안

### 위험 1) 도메인 경계 불명확으로 중복 로직 발생

- 증상: 권한체크/소유권체크가 Core와 Generation 양쪽에서 어긋남
- 대응:
  - 권한 결정은 Core 단일 책임으로 고정
  - Generation은 "권한 검증된 요청"만 처리
  - API 계약에 `requestedBy`, `tenantId`, `scope`를 명시

### 위험 2) 단일 DB 직접 공유로 결합 재발생

- 증상: Generation이 Core 테이블을 직접 join 조회하면서 릴리즈 동기화 필요
- 대응:
  - 1단계: 읽기 전용 최소 접근 + DTO 레이어로 캡슐화
  - 2단계: 이벤트/조회 API 기반으로 DB 분리
  - 핵심: 생성 파이프라인용 테이블은 신규 스키마(또는 별도 DB)로 시작

### 위험 3) 장시간 작업 실패/중복 실행

- 증상: 동일 요청 중복 생성, 상태 꼬임, 재시도 무한루프
- 대응:
  - idempotency key 도입(입력 해시)
  - 상태머신 강제(`queued -> running -> completed|failed|canceled`)
  - 재시도 정책 + DLQ + 운영자 재처리 UI

### 위험 4) 비용 폭증(AI 토큰/렌더 인프라)

- 증상: 프롬프트 반복, 동일 결과 재생성, 예측 불가 비용
- 대응:
  - 프롬프트/모델 버전 관리
  - 입력 해시 기반 캐시(동일 입력 결과 재사용)
  - Job 단위 비용/토큰/처리시간 집계 및 알림 임계치

### 위험 5) 품질 편차(목차/원고 일관성 저하)

- 증상: 사용자 가이드 반영률 불안정, 결과 품질 변동
- 대응:
  - 스킬가이드/템플릿/프롬프트를 버전화
  - 단계별 평가 규칙(형식/누락/금칙어/길이) 자동 검증
  - 실패 시 fallback 모델 또는 규칙 기반 보정

### 위험 6) 보안/개인정보 및 문서 공유 취약점

- 증상: 산출물 URL 직접 노출, 과도한 보관
- 대응:
  - 문서 URL은 서명 URL 또는 토큰 검증 게이트 적용
  - 보관기간/폐기 정책(PII 포함 가능성 고려)
  - 감사로그(누가 어떤 문서를 생성/열람/공유했는지)

### 위험 7) 관측성 부족으로 장애 원인 추적 실패

- 증상: "느림/실패"만 보이고 단계별 병목 파악 불가
- 대응:
  - correlationId를 Core/Generation 전체에 전파
  - 단계별 메트릭: 대기시간, 처리시간, 실패율, 재시도율
  - 표준 로그 스키마 + 대시보드 + 알람

### 위험 8) 릴리즈 충돌(현재 구조의 중복 툴 등록)

- 증상: `src/mcp-server.ts` vs `src/transport.ts` 기능 차이 발생
- 대응:
  - 툴 등록 레지스트리 단일화(공통 모듈화)
  - 인터페이스 계약 테스트 추가
  - 배포 전 `tools/list` 스냅샷 비교 자동화

## 7. 성능 관점 권장 설계

- 동기식 최소화: 생성 작업은 즉시 `jobId` 반환
- 큐 분리: AI 생성 큐 / 렌더 큐 분리(서로 영향 차단)
- 단계 캐시: outline, draft, dm-script, final-material 각각 캐시 가능
- 워커 오토스케일: 큐 길이 기반으로 워커 수 조정
- 데이터 접근 최소화: 렌더 단계 입력은 사전 정규화된 payload 사용

## 8. 재사용 관점 권장 표준

API 표준(예시):

- `POST /generation/jobs/outline`
- `POST /generation/jobs/draft`
- `POST /generation/jobs/dm-transform`
- `POST /generation/jobs/material-render`
- `GET /generation/jobs/{jobId}`

공통 원칙:

- 모든 요청은 `templateVersion`, `guideVersion`, `modelProfile` 명시
- 산출물은 "원문 + 메타(버전/입력해시/생성일)" 함께 저장
- Core는 결과 소비자, Generation은 결과 생산자로 역할 고정

## 9. 단계별 전환 로드맵

### Phase 0 (즉시)

- 경계 선언 문서화(Core vs Generation 책임)
- Job 상태 표준/오류코드 표준 확정

### Phase 1

- "목차 추천/자동 생성"부터 Generation으로 분리
- Core는 Job 생성/조회 UI만 담당

### Phase 2

- "원교안/DM 변환/원고 생성" 파이프라인 이관
- 단계별 산출물 저장 + 재시도 체계 도입

### Phase 3

- 최종 교안 렌더링까지 Generation에서 일원화
- 기존 `RenderJob`/`UserDocument`는 점진 마이그레이션

## 10. 최종 판단

현재 edux 구조 기준으로는, 신규 AI/자동화 기능을 기존 서버에 계속 누적하는 방식은
유지보수성, 성능 안정성, 재사용성 모두에서 리스크가 큽니다.

가장 현실적인 해법은:

- 코어 시스템은 운영/권한/원천데이터 중심으로 고정
- 생성 파이프라인은 별도 플랫폼으로 분리
- API 계약과 비동기 Job 표준을 먼저 고정

이 방식이 "무겁고 복잡해지는 단일 시스템"을 피하면서도,
현재 코드와 데이터 모델을 크게 깨지 않고 점진적으로 전환할 수 있는 경로입니다.
