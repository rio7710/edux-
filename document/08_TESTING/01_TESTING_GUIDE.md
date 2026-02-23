# 테스트 전략

## 1. 테스트 피라미드

```
    E2E          Playwright (향후)
  Integration    MCP Tool 통합 테스트
 Unit Tests      Vitest
```

## 2. 단위 테스트 (Vitest)

```bash
npm test              # 전체
npm run test:coverage  # 커버리지
```

| 대상 | 내용 |
|------|------|
| Service 함수 | JWT 생성/검증, 권한 평가 |
| 유틸리티 | 응답 포맷, 데이터 변환 |
| Zod 스키마 | 입력값 검증 |

```typescript
describe('evaluatePermissionDecision', () => {
  it('admin은 항상 허용', () => {
    const result = evaluatePermissionDecision({ role: 'admin', permissionKey: 'anything' });
    expect(result.allowed).toBe(true);
  });
});
```

## 3. 권한 매트릭스 테스트

```bash
npm run test:permissions            # 모든 역할×도구 조합
npm run test:permissions:scenarios   # 실제 시나리오별
```

## 4. 배포 게이트 테스트

`DEPLOY_TEST_2026-02-13/` 8개 게이트:

| 게이트 | 내용 |
|--------|------|
| 01 RELEASE_GATES | 릴리스 통과 기준 |
| 02 COMMON_RULES | 공통 규칙 & 데이터 |
| 03 PERMISSION_HARD_GATE | 권한 하드 게이트 |
| 04 FRONTEND_GATE | 프론트엔드 검증 |
| 05 BACKEND_MCP_GATE | 백엔드 MCP 검증 |
| 06 MCP_QUALITY_GATE | MCP 품질 검증 |
| 07 DB_INTEGRITY_GATE | DB 무결성 |
| 08 EXECUTION_AND_REPORT | 실행 & 보고 |

## 5. 수동 테스트 체크리스트

- [ ] 로그인 → 토큰 발급 / 잘못된 비밀번호 → 에러 / 토큰 만료 → 세션 만료 모달
- [ ] 코스 CRUD → 생성·수정·삭제(soft) 동작 확인
- [ ] 코스 공유 → 요청·수락·해제 흐름
- [ ] PDF → pending → done → 다운로드 정상
