# PDF 렌더링 파이프라인

## 1. 렌더링 흐름

```
Client → render.coursePdf { templateId, courseId }
  → RenderJob(pending) + BullMQ Job 추가 → 즉시 { jobId, status:"pending" }
  → [Worker] Redis Job 수신 → processing
  → DB 데이터 조회 → Template HTML 로드 → Handlebars 렌더 → Puppeteer PDF 변환
  → /public/pdf/ 저장 → RenderJob(done) + UserDocument 생성
```

## 2. 큐 아키텍처

| 항목 | 설정 |
|------|------|
| 라이브러리 | BullMQ |
| 백엔드 | Redis |
| 동시성 | `PDF_CONCURRENCY` (기본 2) |
| 타임아웃 | 30초 |
| 워커 | `src/workers/pdfWorker.ts` |

```bash
npm run dev:worker   # 반드시 별도 터미널
```

## 3. 파일 네이밍

```
/public/pdf/{targetType}_{targetId}_{timestamp}.pdf
예: /public/pdf/course_cl123abc_1708000000.pdf
```

## 4. RenderJob 상태

```
pending → processing → done | failed(errorMessage)
```

| 상태 | 의미 |
|------|------|
| `pending` | 큐 대기 |
| `processing` | Worker 처리 중 |
| `done` | PDF 완료 |
| `failed` | 실패 (에러 확인) |

## 5. UserDocument (PDF 관리)

| 필드 | 설명 |
|------|------|
| userId | 요청자 |
| renderJobId | 원본 RenderJob |
| templateId | 사용 템플릿 |
| targetType | course / schedule / instructor_profile |
| targetId | 대상 ID |
| pdfUrl | PDF 경로 |
| shareToken | 외부 공유 토큰 |

외부 공유: `document.share` → shareToken 생성 → `/{shareToken}` URL (인증 불필요)
해제: `document.revokeShare`

## 6. Puppeteer 설정

| 항목 | 값 |
|------|---|
| 모드 | Headless Chrome |
| 용지 | A4 |
| 한글 폰트 | Docker `fonts-noto-cjk` 설치 필요 |
| 샌드박스 | --sandbox (프로덕션) |
