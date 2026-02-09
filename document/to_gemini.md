# To Gemini

Gemini에게 전달하는 작업 지시 및 참고 사항입니다.

---

## 최종 업데이트: 2026-02-06 14:45

---

## 완료된 작업 요약

### 회원 관리 백엔드 구현 완료

| 항목 | 상태 | 파일 |
|------|------|------|
| Prisma 스키마 확장 | ✅ | `prisma/schema.prisma` |
| JWT 유틸리티 | ✅ | `src/services/jwt.ts` |
| User Tools (7개) | ✅ | `src/tools/user.ts` |
| Tools 등록 | ✅ | `src/transport.ts` |
| API 클라이언트 | ✅ | `ui/src/api/mcpClient.ts` |
| DB 마이그레이션 | ✅ | `20260206053646_add_user_auth_fields` |

---

## 요청 작업: 프론트엔드 인증 UI 구현

### 1. AuthContext 생성 (`ui/src/contexts/AuthContext.tsx`)

```typescript
// 필요 기능
- accessToken, refreshToken 상태 관리
- user 정보 (id, email, name, role)
- login(email, password): 로그인 후 토큰 저장
- logout(): 토큰 삭제
- isAuthenticated: boolean
- localStorage에 토큰 저장/복원
```

### 2. 로그인 페이지 (`ui/src/pages/LoginPage.tsx`)

```
- 이메일, 비밀번호 입력 폼
- 로그인 버튼 → api.userLogin 호출
- 성공 시 토큰 저장 후 메인 페이지 이동
- 실패 시 에러 메시지 표시
- 회원가입 페이지 링크
```

### 3. 회원가입 페이지 (`ui/src/pages/RegisterPage.tsx`)

```
- 이메일, 비밀번호, 비밀번호 확인, 이름 입력 폼
- 회원가입 버튼 → api.userRegister 호출
- 성공 시 로그인 페이지 이동 (또는 자동 로그인)
- 실패 시 에러 메시지 표시
```

### 4. 프로필 페이지 (`ui/src/pages/ProfilePage.tsx`)

```
- 내 정보 표시 (api.userMe)
- 이름 수정 폼
- 비밀번호 변경 폼 (현재 비밀번호, 새 비밀번호)
- 회원 탈퇴 버튼 (확인 모달 + 비밀번호 입력)
```

### 5. PrivateRoute 컴포넌트 (`ui/src/components/PrivateRoute.tsx`)

```typescript
// 인증 필요 페이지 보호
- isAuthenticated 체크
- 미인증 시 /login으로 리다이렉트
```

### 6. Layout 헤더 수정 (`ui/src/components/Layout.tsx`)

```
- 로그인 상태: 사용자 이름 + 로그아웃 버튼
- 비로그인 상태: 로그인 버튼
```

### 7. 라우팅 수정 (`ui/src/App.tsx`)

```typescript
// 추가 라우트
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

// 기존 라우트를 PrivateRoute로 감싸기 (선택)
```

---

## 🚨 에러 처리 가이드라인 (반드시 준수)

### 1. API 에러 메시지 파싱

MCP 에러는 특정 패턴을 따릅니다. 사용자 친화적 메시지로 변환 필요:

```typescript
function parseAuthError(errorMessage: string): string {
  // 백엔드에서 이미 한글 메시지를 반환하므로 그대로 사용
  // 하지만 MCP 래핑된 에러인 경우 처리 필요

  if (errorMessage.includes('MCP error')) {
    // MCP 에러 코드 추출
    const match = errorMessage.match(/MCP error -?\d+: (.+)/);
    if (match) return match[1];
  }

  // 일반 에러 메시지
  return errorMessage;
}
```

### 2. 백엔드 반환 에러 메시지 목록

| 상황 | 에러 메시지 |
|------|------------|
| 비밀번호 규칙 불일치 | `비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.` |
| 이메일 중복 | `이미 사용 중인 이메일입니다.` |
| 로그인 실패 | `이메일 또는 비밀번호가 일치하지 않습니다.` |
| 토큰 만료/무효 | `인증 실패: jwt expired` 또는 `인증 실패: invalid token` |
| 사용자 없음 | `사용자를 찾을 수 없습니다.` |
| 현재 비밀번호 불일치 | `현재 비밀번호가 일치하지 않습니다.` |
| 변경 내용 없음 | `변경할 내용이 없습니다.` |
| 권한 없음 | `관리자 권한이 필요합니다.` |

### 3. 프론트엔드 유효성 검사 (서버 호출 전)

```typescript
// 이메일 형식
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 비밀번호 규칙: 8자 이상, 영문+숫자
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

// 이름: 최소 1자
const nameMinLength = 1;
```

### 4. 토큰 만료 처리

```typescript
// API 호출 시 토큰 만료 에러 감지
if (error.message.includes('jwt expired') || error.message.includes('invalid token')) {
  // 로그아웃 처리
  authContext.logout();
  // 로그인 페이지로 이동
  navigate('/login');
  message.warning('세션이 만료되었습니다. 다시 로그인해주세요.');
}
```

### 5. 400 에러 (Zod 유효성 검사 실패)

MCP 도구 호출 시 Zod 스키마 유효성 검사 실패하면 `-32602` 에러 발생:

```
MCP error -32602: Invalid params for tool user.register: ...
```

**해결 방법**: 프론트엔드에서 먼저 유효성 검사 수행

---

## API 사용법

### 회원가입

```typescript
const result = await api.userRegister({
  email: 'user@example.com',
  password: 'password123',  // 8자 이상, 영문+숫자
  name: '홍길동'
});
// 성공: { id: 'cuid...', email: '...', name: '...' }
```

### 로그인

```typescript
const result = await api.userLogin({
  email: 'user@example.com',
  password: 'password123'
});
// 성공: { user: {...}, accessToken: 'jwt...', refreshToken: 'jwt...' }
```

### 내 정보 조회

```typescript
const result = await api.userMe(accessToken);
// 성공: { id, email, name, role, createdAt, lastLoginAt }
```

### 정보 수정

```typescript
// 이름만 수정
await api.userUpdate({ token: accessToken, name: '새이름' });

// 비밀번호 변경
await api.userUpdate({
  token: accessToken,
  currentPassword: '현재비밀번호',
  newPassword: '새비밀번호123'
});
```

### 회원 탈퇴

```typescript
await api.userDelete({
  token: accessToken,
  password: '현재비밀번호'
});
// 성공: { message: '계정이 비활성화되었습니다.', userId: '...' }
```

---

## 파일 구조 예시

```
ui/src/
├── api/
│   └── mcpClient.ts        # ✅ 이미 user API 추가됨
├── contexts/
│   └── AuthContext.tsx     # 🆕 생성 필요
├── components/
│   ├── Layout.tsx          # 수정 필요 (헤더에 사용자 정보)
│   └── PrivateRoute.tsx    # 🆕 생성 필요
├── pages/
│   ├── LoginPage.tsx       # 🆕 생성 필요
│   ├── RegisterPage.tsx    # 🆕 생성 필요
│   ├── ProfilePage.tsx     # 🆕 생성 필요
│   ├── CoursesPage.tsx
│   ├── InstructorsPage.tsx
│   └── ...
└── App.tsx                 # 수정 필요 (라우팅 추가)
```

---

## Ant Design 컴포넌트 참고

```typescript
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Modal,
  Avatar,
  Dropdown,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
```

---

## 테스트 방법

```bash
# 서버 실행 확인
curl http://localhost:7777/health

# 프론트엔드 실행
cd ui && npm run dev

# 브라우저에서 테스트
# 1. /register에서 회원가입
# 2. /login에서 로그인
# 3. 메인 페이지에서 사용자 이름 표시 확인
# 4. /profile에서 정보 수정/탈퇴 테스트
```

---

## 작업 완료 후

`to_claude.md`에 다음 내용 업데이트:
1. 생성된 파일 목록
2. 주요 구현 내용
3. 테스트 결과
4. 발견된 이슈 (있다면)

---

## 참고: 기존 코드 패턴

### InstructorsPage.tsx의 에러 처리 패턴

```typescript
const parseValidationError = (errorMessage: string): string => {
  if (errorMessage.includes('Invalid email')) {
    return '이메일 형식이 올바르지 않습니다.';
  }
  if (errorMessage.includes('Invalid url')) {
    return 'URL 형식이 올바르지 않습니다.';
  }
  if (errorMessage.includes('Required')) {
    return '필수 항목을 입력해주세요.';
  }
  return errorMessage;
};

// useMutation의 onError에서 사용
onError: (error: Error) => {
  const friendlyMessage = parseValidationError(error.message);
  message.error(friendlyMessage);
}
```

---
