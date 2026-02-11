# PDF_RENDER_GUIDE

PDF 렌더링 플로우와 다운로드 정책을 정리한 문서입니다.
현재 구현 기준(큐 기반 비동기)과 향후 개선 포인트를 함께 표시합니다.

## 1) 현재 구현 요약

- 렌더 요청은 `render.coursePdf`, `render.schedulePdf`로만 제공
- 응답은 `jobId`, `status: pending`만 반환
- 워커가 백그라운드에서 PDF 생성 후 `public/pdf/`에 저장
- 다운로드 경로: `/pdf/<file>`

## 2) 파일명 규칙

- 코스 PDF: `course-<courseId>.pdf`
- 일정 PDF: `schedule-<scheduleId>.pdf`

## 3) 데이터 주입 구조 (현재)

- 코스 PDF: `course` (포함: `Lectures`, `Schedules`)
- 일정 PDF: `schedule` (포함: `Course`, `Instructor`)

템플릿 작성은 `TEMPLATE_GUIDE.md`를 기준으로 합니다.

## 4) 상태 확인

현재는 상태 조회용 API가 없습니다.
필요 시 아래 중 하나를 선택해 추가 구현해야 합니다.

- `render.job.get` 툴 추가
- 관리자 UI에서 RenderJob 조회 기능 추가
- 서명 URL 발급 시 완료 시점에 URL 반환

## 5) 보안 정책

- `/pdf/*`는 정적 파일 제공으로 기본 인증이 없습니다.
- 민감 데이터가 포함될 경우 서명 URL 또는 토큰 검증이 필요합니다.

## 6) 강사 프로필 PDF (추가 예정)

강사 템플릿 기반 PDF가 필요하다면 아래 항목이 필요합니다.

- `render.instructorPdf` 툴 추가
- 워커에서 `instructor` 및 연관 `courses` 주입
- 템플릿 타입 구분 (예: `Template.targetType`)
