# 회원 관리 기능 기획

## 현재 상태 분석

### 기존 User 모델
```prisma
enum Role {
  admin    // 관리자
  editor   // 편집자 (코스, 템플릿 수정 가능)
  viewer   // 조회자 (읽기 전용)
}

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String
  role           Role     @default(viewer)
  hashedPassword String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

## 기능 목록

### 1. 회원가입 (Register)
- **필수 입력**: 이메일, 비밀번호, 이름
- **비밀번호 규칙**: 최소 8자, 영문+숫자 조합
- **이메일 중복 검사**
- **기본 역할**: viewer

### 2. 로그인 (Login)
- **이메일 + 비밀번호**
- **JWT 토큰 발급** (access token + refresh token)
- **실패 시 에러 메시지** (보안상 구체적 내용 숨김)

### 3. 로그아웃 (Logout)
- **클라이언트 토큰 삭제**
- **(선택) 서버 토큰 블랙리스트**

### 4. 회원정보 조회 (Get Profile)
- **본인 정보만 조회 가능**
- **반환**: id, email, name, role, createdAt

### 5. 회원정보 수정 (Update Profile)
- **수정 가능**: 이름, 비밀번호
- **비밀번호 변경 시 현재 비밀번호 확인**

### 6. 회원 탈퇴 (Delete Account)
- **비밀번호 확인 후 삭제**
- **Soft Delete vs Hard Delete 선택**

### 7. 관리자 기능 (Admin Only)
- **회원 목록 조회**
- **회원 역할 변경**
- **회원 삭제 (관리자 권한)**

---

## MCP Tools 설계

| Tool Name | Description | Auth Required |
|-----------|-------------|---------------|
| `user.register` | 회원가입 | No |
| `user.login` | 로그인 (토큰 발급) | No |
| `user.me` | 내 정보 조회 | Yes |
| `user.update` | 내 정보 수정 | Yes |
| `user.delete` | 회원 탈퇴 | Yes |
| `user.list` | 회원 목록 (관리자) | Admin |
| `user.updateRole` | 역할 변경 (관리자) | Admin |

---

## 스키마 수정 (선택사항)

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String
  role           Role      @default(viewer)
  hashedPassword String
  isActive       Boolean   @default(true)   // 계정 활성화 상태
  lastLoginAt    DateTime?                  // 마지막 로그인
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?                  // Soft Delete
}

// Refresh Token 저장 (선택)
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 개발 난이도 및 분량 예측

### 난이도 기준
- ⭐ 쉬움 (1-2시간)
- ⭐⭐ 보통 (2-4시간)
- ⭐⭐⭐ 어려움 (4-8시간)
- ⭐⭐⭐⭐ 복잡함 (1-2일)

---

### 1. user.register (회원가입)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐⭐ 보통 |
| **예상 시간** | 2-3시간 |
| **백엔드** | Zod 스키마, bcrypt 해싱, Prisma create |
| **프론트엔드** | 가입 폼, 유효성 검사, 에러 처리 |
| **의존성** | `bcrypt` 패키지 설치 필요 |

```
작업 내역:
- src/tools/user.ts 생성 (스키마 + 핸들러)
- transport.ts에 등록
- ui/src/pages/RegisterPage.tsx 생성
- 라우팅 추가
```

---

### 2. user.login (로그인)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐⭐⭐ 어려움 |
| **예상 시간** | 4-6시간 |
| **백엔드** | 비밀번호 검증, JWT 생성, 토큰 반환 |
| **프론트엔드** | 로그인 폼, 토큰 저장, 인증 상태 관리 |
| **의존성** | `jsonwebtoken` 패키지 설치 필요 |

```
작업 내역:
- JWT 유틸 함수 (sign, verify)
- 로그인 핸들러
- ui/src/pages/LoginPage.tsx
- AuthContext 또는 zustand로 인증 상태 관리
- PrivateRoute 컴포넌트 (인증 필요 페이지 보호)
```

---

### 3. user.me (내 정보 조회)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐ 쉬움 |
| **예상 시간** | 1-2시간 |
| **백엔드** | 토큰에서 userId 추출, Prisma findUnique |
| **프론트엔드** | 프로필 페이지 또는 헤더에 사용자 정보 표시 |
| **의존성** | 로그인 기능 완료 필요 |

```
작업 내역:
- user.me 핸들러 (토큰 검증 + 조회)
- 헤더에 사용자 이름 표시
```

---

### 4. user.update (정보 수정)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐⭐ 보통 |
| **예상 시간** | 2-3시간 |
| **백엔드** | 현재 비밀번호 확인, 새 비밀번호 해싱 |
| **프론트엔드** | 프로필 수정 폼, 비밀번호 변경 폼 |
| **의존성** | 로그인 기능 완료 필요 |

```
작업 내역:
- user.update 핸들러
- ui/src/pages/ProfilePage.tsx (수정 폼 포함)
```

---

### 5. user.delete (회원 탈퇴)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐ 쉬움 |
| **예상 시간** | 1-2시간 |
| **백엔드** | 비밀번호 확인, Soft Delete (deletedAt 설정) |
| **프론트엔드** | 탈퇴 확인 모달, 비밀번호 입력 |
| **의존성** | 스키마에 deletedAt 필드 추가 필요 |

```
작업 내역:
- user.delete 핸들러
- 탈퇴 확인 UI
- 로그아웃 처리
```

---

### 6. user.list (관리자 - 목록 조회)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐ 쉬움 |
| **예상 시간** | 1-2시간 |
| **백엔드** | 관리자 권한 체크, Prisma findMany |
| **프론트엔드** | 회원 목록 테이블 |
| **의존성** | 로그인 + 권한 체크 미들웨어 |

```
작업 내역:
- user.list 핸들러 (role 체크)
- ui/src/pages/admin/UsersPage.tsx
```

---

### 7. user.updateRole (관리자 - 역할 변경)
| 항목 | 내용 |
|------|------|
| **난이도** | ⭐ 쉬움 |
| **예상 시간** | 1시간 |
| **백엔드** | 관리자 권한 체크, role 업데이트 |
| **프론트엔드** | 역할 선택 드롭다운 |
| **의존성** | user.list 완료 필요 |

```
작업 내역:
- user.updateRole 핸들러
- 목록에서 역할 변경 UI
```

---

## 전체 예상 소요 시간

| Phase | 기능 | 예상 시간 |
|-------|------|-----------|
| **Phase 1** | register + login + me | 7-11시간 |
| **Phase 2** | update + delete | 3-5시간 |
| **Phase 3** | list + updateRole | 2-3시간 |
| **합계** | | **12-19시간 (2-3일)** |

---

## 추가 기능별 난이도

| 기능 | 난이도 | 예상 시간 | 비고 |
|------|--------|-----------|------|
| 이메일 인증 | ⭐⭐⭐⭐ | 1-2일 | 메일 서버 연동 필요 (nodemailer + SMTP) |
| 소셜 로그인 (Google) | ⭐⭐⭐ | 4-6시간 | OAuth 2.0, Google Cloud Console 설정 |
| 소셜 로그인 (Kakao) | ⭐⭐⭐ | 4-6시간 | Kakao Developers 설정 |
| 비밀번호 찾기 | ⭐⭐⭐ | 4-6시간 | 이메일 발송 + 임시 토큰 |
| Refresh Token | ⭐⭐⭐ | 4-6시간 | DB 저장, 토큰 갱신 로직 |

---

## 구현 우선순위 (권장)

### Phase 1: 기본 인증 (필수, 7-11시간)
1. [ ] user.register - 회원가입
2. [ ] user.login - 로그인
3. [ ] user.me - 내 정보 조회

### Phase 2: 회원 관리 (필수, 3-5시간)
4. [ ] user.update - 정보 수정
5. [ ] user.delete - 회원 탈퇴

### Phase 3: 관리자 기능 (선택, 2-3시간)
6. [ ] user.list - 목록 조회
7. [ ] user.updateRole - 역할 변경

### Phase 4: 추가 기능 (선택)
8. [ ] Refresh Token
9. [ ] 비밀번호 찾기
10. [ ] 소셜 로그인

---

## 기술 스택

- **비밀번호 암호화**: bcrypt
- **토큰**: JWT (jsonwebtoken)
- **토큰 저장**:
  - Access Token: 메모리/localStorage (1시간)
  - Refresh Token: httpOnly Cookie (7일)

---

## 질문사항

1. **이메일 인증** 필요한가요?
2. **소셜 로그인** (Google, Kakao 등) 필요한가요?
3. **비밀번호 찾기** 기능 필요한가요?
4. **세션 방식** vs **JWT 방식** 중 선호하는 것?
5. **RefreshToken**을 DB에 저장할까요, 아니면 stateless JWT만 사용할까요?
