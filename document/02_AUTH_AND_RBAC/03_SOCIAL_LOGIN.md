# 소셜 로그인 설정

## Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth 클라이언트 ID 생성
2. 리디렉션 URI: `http://localhost:7777/api/auth/google/callback` (dev) / `https://domain/api/auth/google/callback` (prod)
3. 환경변수:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:7777/api/auth/google/callback
```

## NAVER OAuth

1. [NAVER Developers](https://developers.naver.com/) → 애플리케이션 등록 (네이버 로그인)
2. 콜백 URL 등록 (dev/prod 분리)
3. 환경변수:
```env
NAVER_CLIENT_ID=your-client-id
NAVER_CLIENT_SECRET=your-client-secret
NAVER_CALLBACK_URL=http://localhost:7777/api/auth/naver/callback
```

## 계정 매핑 로직

소셜 로그인 → email로 기존 User 조회 → 있으면 provider 업데이트 + JWT 발급, 없으면 새 User 생성(guest, hashedPassword=null) + JWT 발급.

## 체크리스트

- [ ] OAuth 클라이언트 ID/Secret 설정
- [ ] 콜백 URL이 환경(dev/prod)에 맞음
- [ ] 기존 계정 연동이 email 기준 동작
- [ ] 소셜 로그인 후 JWT 발급 확인
