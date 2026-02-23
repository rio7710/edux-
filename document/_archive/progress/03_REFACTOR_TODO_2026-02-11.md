# 리팩토링 TODO (2026-02-11)

## 목적
- 로그인 직후 메뉴/대시보드 지연 감소
- 권한 체크 중복 호출 제거
- `숨김/비활성화` 정책 적용 일관성 강화

## 현재 이슈
- MCP(SSE) 세션 연결 후 API 호출이 시작되어 첫 진입 지연이 체감됨
- 페이지별 `authz.check` 분산 호출로 네트워크 호출 수가 많음
- 권한/설정 캐시와 서버 상태 동기화 포인트가 분산됨

## 개선 목표
1. 인증 직후 권한/설정 선로딩 단일화
2. 메뉴/대시보드/페이지에서 공통 권한 상태 사용
3. 권한 키 상수화 및 호출 인터페이스 통일

## 단계별 작업

### Phase 1. 권한/설정 Provider 도입 (우선)
- [ ] `ui/src/contexts/PermissionContext.tsx` 추가
- [ ] `AuthContext` 로그인 성공 시 `connect + prefetch` 단일 실행
- [ ] `menu_denied_behavior` + 메뉴 권한(`course/template/instructor/render.read`)를 Provider에서 관리
- [ ] Provider 초기값은 캐시(localStorage), 백그라운드 동기화
- [ ] 실패 시 fallback 정책을 한 곳에서 처리

완료 기준
- 메뉴 렌더가 Provider 값만 참조
- `Layout` 내부에서 개별 `authz.check` 직접 호출 제거

### Phase 2. 대시보드 데이터 호출 정리
- [ ] 대시보드의 데이터/권한 호출을 분리
- [ ] 인증 전 `token: undefined` 요청 완전 차단
- [ ] 중복 호출 방지(컴포넌트 mount/re-render 시 1회)
- [ ] 필요 시 react-query로 캐싱/리패치 정책 통일

완료 기준
- 로그인 직후 네트워크 탭에서 동일 호출 중복 없음
- 대시보드 버튼 노출이 권한과 즉시 일치

### Phase 3. 권한 키 상수화
- [ ] `ui/src/constants/permissions.ts` 추가
- [ ] `Layout`, `DashboardPage`, `PermissionSettingsPage`의 문자열 키 상수로 교체
- [ ] 백엔드 `src/services/authorization.ts`와 키 동기화 기준 문서화

완료 기준
- 권한 키 문자열 하드코딩 최소화
- 키 변경 시 수정 지점 추적 가능

### Phase 4. UX/상태 개선
- [ ] 권한/설정 로딩 스켈레톤 규칙 정의
- [ ] 메뉴 정책(`hide/disable`) 전역 적용 테스트
- [ ] 권한설정 페이지 저장 성공/실패 피드백 표준화

완료 기준
- 리프레시 후 메뉴 깜빡임 최소화
- 권한설정 저장 직후 반영 일관성 확보

## 테스트 체크리스트
- [ ] `viewer` 로그인 후 메뉴 정책 hide/disable 각각 검증
- [ ] `admin/operator` 로그인 후 메뉴/버튼 정상 노출 검증
- [ ] 권한설정 변경 후 즉시 반영 + 리프레시 후 유지 검증
- [ ] SSE 재연결 시 메뉴 상태 유지/복구 검증

## 리스크
- 기존 페이지가 개별 권한 호출에 의존하고 있어 단계적 이관 필요
- 캐시 우선 로딩 시 아주 짧은 stale 상태 가능(백그라운드 동기화로 보정)

## 권장 진행 순서
1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
