# 보안 설계

## 인증 (Authentication)

JWT 기반: 로그인 → bcrypt 검증 → JWT 발급(24h, payload: `{userId, role}`) → 이후 요청에 token 포함.

| 항목 | 값 |
|------|---|
| 토큰 | JWT (jsonwebtoken), 24h |
| 해시 | bcrypt 라운드 12+ |
| 소셜 | hashedPassword=null, provider 필드 사용 |
| 비밀번호 | 최소 8자, 영문+숫자, 최근 3회 재사용 금지(권장) |

## 인가 (Authorization) — RBAC

| 역할 | 한국어 | 권한 범위 |
|------|--------|----------|
| admin | 관리자 | 모든 기능 (와일드카드 `*`) |
| operator | 운영자 | 콘텐츠 운영 + 사용자 조회 + 사이트 설정 |
| editor | 편집자 | 콘텐츠 CRUD + 공유 + 렌더링 |
| instructor | 강사 | 자기 소유 콘텐츠 CRUD + 공유 |
| viewer | 열람자 | 읽기 + 제한된 공유 |
| guest | 게스트 | 최소 (템플릿 열람, 메시지) |

**권한 평가 순서** (authorization.ts): admin bypass → deny 체크(user→group→role) → allow 체크(user→group→role) → Role Default Allow → default-deny

핵심: deny > allow, 개인 > 그룹 > 역할, 기본은 거부.

**PermissionGrant**: permissionKey + effect(allow/deny) + userId?/groupId?/role? 중 하나. 와일드카드 `course.*` 지원.

## 보안 위협 대응

| 위협 | 대응 |
|------|------|
| XSS | 템플릿에 script/이벤트핸들러/외부URL 금지 |
| 인증 우회 | JWT 만료 + isActive/deletedAt 체크 |
| 권한 상승 | 역할 변경 admin만, PermissionGrant 세밀 제어 |
| DoS (렌더링) | PDF_CONCURRENCY 제한, 30초 타임아웃 |
| SSRF | Puppeteer --sandbox, 외부 리소스 차단 |

## 파일 보안

PDF `/public/pdf/` (30일 자동삭제 향후), 업로드 `/public/uploads/` (multer, 크기 제한), 외부 공유 UserDocument.shareToken(unique).

## 보안 체크리스트

- [ ] JWT 시크릿 프로덕션용 변경
- [ ] bcrypt 라운드 12+
- [ ] 모든 Tool에 requirePermission 호출
- [ ] Soft delete 쿼리에 deletedAt IS NULL
- [ ] 템플릿에 스크립트/외부URL 없음
- [ ] .env가 .gitignore에 포함
