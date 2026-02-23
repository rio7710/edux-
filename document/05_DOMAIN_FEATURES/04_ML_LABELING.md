# ML 데이터 수집 전략

목표: 사용자 행동 데이터 축적 → 추천/최적화 활용. 프라이버시 보호 + 경량 모델부터 시작.

## 수집 대상 이벤트

| 이벤트 | 설명 | 데이터 |
|--------|------|--------|
| `course_created` | 코스 생성 | courseId, userId, templateFields |
| `course_shared` | 공유 요청 | courseId, fromUserId, toUserId |
| `course_share_accepted` | 공유 수락 | courseId, userId |
| `document_rendered` | PDF 생성 | templateId, targetType, targetId, userId |
| `template_used` | 템플릿 사용 | templateId, userId, context |
| `lecture_granted` | 권한 부여 | lectureId, userId, permissions |

## 이벤트 스키마

```json
{
  "eventId": "uuid",
  "eventName": "course_shared",
  "occurredAt": "2026-02-16T10:00:00Z",
  "actor": { "userId": "...", "role": "editor" },
  "target": { "type": "course", "id": "..." },
  "payload": { "toUserId": "..." },
  "schemaVersion": 1
}
```

## 초기 추천 라벨

| 라벨 | 기준 | 용도 |
|------|------|------|
| 추천 사용 여부 | 추천 템플릿 실제 사용 | 추천 품질 측정 |
| 수락률 | 코스 공유 수락 비율 | 공유 타겟 최적화 |
| 렌더 완료율 | 요청 대비 완료 비율 | 템플릿 품질 측정 |

## 구현 로드맵

| 단계 | 내용 | 시기 |
|------|------|------|
| Phase 0 | 이벤트 스키마 정의 | 즉시 |
| Phase 1 | Tool에 이벤트 로깅 삽입 | 1개월 |
| Phase 2 | 이벤트 저장소 (append-only) | 2개월 |
| Phase 3 | 경량 추천 모델 실험 | 3개월+ |

## 프라이버시 원칙

- PII 미포함 (userId만), 분석 전용 DB 분리, 탈퇴 시 익명화, 최소 수집
