# 사용자 & 강사 관리

## 1. 사용자 관리

### 관리자 기능 (UsersPage)

| 기능 | Tool | 권한 |
|------|------|------|
| 사용자 목록 | `user.list` | admin |
| 사용자 조회 | `user.get` | admin |
| 역할 변경 | `user.updateRole` | admin |
| 정보 수정 | `user.updateByAdmin` | admin |

### 본인 기능 (ProfilePage)

| 기능 | Tool |
|------|------|
| 내 정보 조회 | `user.me` |
| 정보 수정 | `user.update` |
| 비밀번호 변경 | `user.update` (currentPassword + newPassword) |
| 회원 탈퇴 | `user.delete` (password 확인) |
| 강사 신청 | `user.requestInstructor` |
| 강사 프로필 수정 | `user.updateInstructorProfile` |

## 2. 강사 등록 워크플로우

```
User ─1:1→ InstructorProfile (임시 신청서) ─1:1→ Instructor (승인 후)
```

```
1. user.requestInstructor { token, displayName, bio }
   → InstructorProfile(isPending=true) + 관리자에게 UserMessage
2. [관리자] user.approveInstructor { token, userId }
   → isApproved=true + Instructor 생성 + (선택) role="instructor"
3. 이후 instructor.upsert로 상세 수정 가능
```

규칙: User당 InstructorProfile 1개, 이미 Instructor 있으면 재신청 불가, 승인 전 강사 기능 사용 불가

## 3. Instructor 모델

| 필드 그룹 | 필드 | 타입 |
|----------|------|------|
| 기본 | name, title, email, affiliation, tagline, bio | String |
| 이미지 | avatarUrl | String (업로드 URL) |
| 배열 | specialties, awards | String[] |
| JSON | certifications, degrees, careers, publications, links | Json |

JSON 구조 예시:
```json
{ "certifications": [{ "name":"PMP", "issuer":"PMI", "date":"2024", "fileUrl":"..." }] }
{ "careers": [{ "company":"삼성전자", "role":"HRD 팀장", "period":"2018-2023" }] }
```

## 4. 그룹 관리

| Tool | 설명 | 권한 |
|------|------|------|
| `group.list/upsert/delete` | 그룹 CRUD | admin/operator |
| `group.member.add/remove/updateRole` | 멤버 관리 | admin/operator |

그룹 역할: owner, manager, member
그룹 PermissionGrant → 소속 멤버 전체에 적용. 개인 권한 > 그룹 권한.
