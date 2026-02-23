# 사용자 정책

## 생명주기

```
회원가입 (role:guest) → [이메일 인증] → 활성 → 역할 변경 (admin만) → 비활성 → Soft Delete
```

- 가입: `user.register` (email, name, password). 소셜: provider+providerId 연동.
- 비활성: `isActive=false` → 로그인 차단. admin이 관리.
- 탈퇴: `user.delete` → `deletedAt=now()`. 관련 데이터 cascade/SetNull.

## 역할 관리

역할 변경은 admin만 (`user.updateRole`). 자동 부여 없음.

| 역할 | 한국어 | 설명 |
|------|--------|------|
| admin | 관리자 | 시스템 전체 |
| operator | 운영자 | 콘텐츠 운영 + 설정 |
| editor | 편집자 | 콘텐츠 편집 |
| instructor | 강사 | 자기 콘텐츠 |
| viewer | 열람자 | 읽기 전용 |
| guest | 게스트 | 최소 접근 |

## 강사 등록 워크플로우

```
user.requestInstructor → InstructorProfile(isPending=true)
    → [관리자] user.approveInstructor → Instructor 생성 + isApproved=true
```

규칙: User 계정 필수, InstructorProfile은 User당 1개(unique), 이미 Instructor 있으면 재신청 불가.

## 소셜 로그인 매핑

| 제공자 | provider | 매핑 |
|--------|----------|------|
| 로컬 | local | email + password |
| Google | google | email + providerId |
| NAVER | naver | email + providerId |

같은 email 기존 계정 → provider 업데이트로 연동. 소셜 전용은 hashedPassword=null.
