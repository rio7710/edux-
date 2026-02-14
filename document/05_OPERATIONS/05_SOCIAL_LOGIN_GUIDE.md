# 소셜 로그인 연동 가이드 (Google + NAVER)

## 1. 개요

이 문서는 `edux` 프로젝트에 Google/NAVER OAuth 로그인을 연결하는 절차를 설명합니다.

현재 구현 위치:

- 백엔드 OAuth 라우트: `src/transport.ts`
  - `GET /auth/:provider/start`
  - `GET /auth/:provider/callback`
- 프론트 로그인 처리: `ui/src/pages/LoginPage.tsx`
- 인증 상태 저장: `ui/src/contexts/AuthContext.tsx`

---

## 2. 필수 환경 변수

루트 `.env`에 아래 값을 설정합니다.

```env
JWT_SECRET="your-secret-key"

GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

NAVER_CLIENT_ID="..."
NAVER_CLIENT_SECRET="..."

# 선택(권장)
OAUTH_BACKEND_BASE_URL="http://localhost:7777"
OAUTH_FRONTEND_BASE_URL="http://localhost:5173"
```

설명:

- `OAUTH_BACKEND_BASE_URL`: OAuth 제공자에 등록할 백엔드 콜백의 베이스 URL
- `OAUTH_FRONTEND_BASE_URL`: 로그인 완료 후 리다이렉트할 프론트 URL
- 미설정 시 개발 환경 기본값(`7777`, `5173`)을 사용합니다.

---

## 3. OAuth 제공자 콘솔 설정

## 3.1 Google

1. Google Cloud Console에서 프로젝트 생성
2. OAuth 동의 화면 설정
3. OAuth Client ID 생성(Web application)
4. Authorized redirect URI 등록

개발 기본 콜백:

- `http://localhost:7777/auth/google/callback`

## 3.2 NAVER

1. Naver Developers 앱 생성
2. 서비스 URL/콜백 URL 등록
3. Client ID/Secret 확인
4. 이메일 동의 항목 활성화

개발 기본 콜백:

- `http://localhost:7777/auth/naver/callback`

주의:

- 이메일 동의를 받지 못하면 로그인 실패 처리됩니다.

---

## 4. 사용자 계정 매핑 규칙

서버 로직(`src/transport.ts`) 기준:

1. `(provider, providerId)` 기존 계정 있으면 해당 계정 로그인
2. 없으면 동일 이메일 계정 탐색
3. 이메일 계정이 있고 `provider`가 비어있거나 `local`이면 소셜 계정으로 연결
4. 완전 신규면 새 사용자 생성

기본 생성값:

- `role = viewer`
- `provider = google | naver`
- `providerId = 소셜 사용자 ID`

---

## 5. 프론트 동작 방식

로그인 페이지(`ui/src/pages/LoginPage.tsx`)에서:

- `Google로 로그인` 버튼: `/auth/google/start` 이동
- `NAVER로 로그인` 버튼: `/auth/naver/start` 이동

콜백 성공 시 서버는 `/login`으로 아래 파라미터를 붙여 리다이렉트:

- `accessToken`
- `refreshToken`
- `user`(base64url JSON)

프론트는 이를 파싱해 `AuthContext.loginWithTokens`로 인증 상태를 저장한 뒤 `/dashboard`로 이동합니다.

실패 시:

- `socialError` 파라미터로 `/login` 리다이렉트

---

## 6. 개발 실행 순서

1. 백엔드 실행

```bash
cd d:\workSpace\edux
npm run dev
```

2. 프론트 실행

```bash
cd d:\workSpace\edux\ui
npm run dev
```

3. 브라우저에서 로그인 페이지 접속

- `http://localhost:5173/login`

4. 소셜 로그인 버튼 클릭 후 정상 로그인 확인

---

## 7. 체크리스트

- [ ] `.env`에 4개 클라이언트 값 설정 완료
- [ ] Google redirect URI 등록 완료
- [ ] NAVER callback URL 등록 완료
- [ ] 백엔드/프론트 재시작 완료
- [ ] `/login`에서 버튼 노출 확인
- [ ] 로그인 후 `/dashboard` 이동 확인

---

## 8. 트러블슈팅

## 8.1 `...CLIENT_ID가 설정되지 않았습니다`

- 원인: `.env` 누락 또는 서버 재시작 전
- 조치: `.env` 값 확인 후 백엔드 재시작

## 8.2 `OAuth state 검증에 실패했습니다`

- 원인: 세션 만료, 뒤로가기/재시도, 탭 중복 등
- 조치: `/login`에서 다시 소셜 로그인 시작

## 8.3 `이메일 제공 동의가 필요합니다`

- 원인: 제공자 계정에서 이메일 scope 미동의
- 조치: 동의 항목 활성화 후 재로그인

## 8.4 로그인 버튼 클릭 시 404

- 원인: Vite 프록시 미적용/서버 미실행
- 조치:
  - `ui/vite.config.ts`의 `/auth` 프록시 확인
  - 백엔드 `7777` 실행 확인

---

## 9. 운영 반영 시 주의

- 운영 도메인으로 `OAUTH_BACKEND_BASE_URL`, `OAUTH_FRONTEND_BASE_URL` 교체
- Google/NAVER 콘솔 redirect URL도 운영 도메인으로 갱신
- `JWT_SECRET` 강한 값으로 교체
- HTTPS 환경에서 테스트 후 배포
