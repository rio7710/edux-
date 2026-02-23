# 보안 감사 보고서 (2026년 2월 16일)

## 개요
요청에 따라 Edux 프로젝트의 백엔드 및 프론트엔드 코드베이스에 대한 보안 감사를 수행했습니다. 주요 목표는 사이트 세션 관리 및 프론트엔드에서 발생할 수 있는 잠재적인 보안 취약점을 식별하고 해결책을 제시하는 것이었습니다.

## 범위
*   **백엔드:** `src/transport.ts`, `src/services/jwt.ts`, `src/tools/user.ts` (인증 및 세션 관리 관련 로직)
*   **프론트엔드 (UI):** `ui/src/contexts/AuthContext.tsx`, `ui/src/api/mcpClient.ts`, 및 기타 UI 컴포넌트의 인증 관련 로직

## 주요 발견 사항 및 권장 사항

### 심각도: 높음 (High)

#### 1. URL 쿼리 파라미터를 통한 토큰 전송 (백엔드 및 프론트엔드)
*   **발견:** 백엔드의 OAuth 콜백 (`src/transport.ts`)에서 소셜 로그인 성공 후 `accessToken`과 `refreshToken`을 프론트엔드 로그인 페이지의 URL 쿼리 파라미터로 전달합니다. 프론트엔드 (`ui/src/contexts/AuthContext.tsx`의 `loginWithTokens` 함수)는 이 URL에서 토큰을 추출하여 사용합니다.
*   **위험:** URL을 통한 민감한 정보(토큰) 전송은 다음과 같은 심각한 보안 위험을 초래합니다.
    *   **브라우저 히스토리 기록:** 토큰이 브라우저 히스토리에 남아 노출될 수 있습니다.
    *   **서버/프록시 로그 기록:** 중간 프록시나 웹 서버 로그에 토큰이 기록될 수 있습니다.
    *   **Referer 헤더 노출:** 외부 사이트로 이동 시 Referer 헤더를 통해 토큰이 노출될 수 있습니다.
    *   ** shoulder surfing 공격:** 사용자가 공공 장소에서 화면을 볼 때 토큰이 노출될 수 있습니다.
*   **권장 사항:**
    *   **OAuth Authorization Code Flow with PKCE 구현:** 가장 권장되는 방법입니다. OAuth 콜백 시 서버는 Authorization Code만 프론트엔드로 전달하고, 프론트엔드는 이 코드를 백엔드로 보내 토큰을 안전하게 교환(POST 요청)합니다. 이 과정에서 프론트엔드는 `code_verifier`를 생성하여 CSRF 공격을 방지합니다.
    *   **대안 (덜 권장):**
        *   백엔드에서 토큰을 성공적으로 발급한 후, 안전한 `httpOnly` 쿠키를 통해 Refresh Token을 설정하고, Access Token은 응답 본문에 담아 전달합니다. 프론트엔드는 이 응답을 받아 Access Token만 `sessionStorage`에 저장합니다.
*   **관련 파일:** `src/transport.ts`, `ui/src/contexts/AuthContext.tsx`

#### 2. `localStorage`에 Refresh Token 저장 (프론트엔드)
*   **발견:** 프론트엔드 (`ui/src/contexts/AuthContext.tsx`)는 `accessToken`과 `refreshToken`을 모두 `localStorage`에 저장합니다.
*   **위험:** `localStorage`에 Refresh Token과 같은 장기 지속 토큰을 저장하는 것은 XSS (Cross-Site Scripting) 공격에 매우 취약합니다. 공격자가 악성 JavaScript를 주입하는 데 성공하면 `localStorage`에 접근하여 모든 저장된 토큰을 탈취하고 사용자 세션을 탈취할 수 있습니다.
*   **권장 사항:**
    *   **Refresh Token은 `httpOnly` 쿠키에 저장:** Refresh Token은 JavaScript에서 접근할 수 없는 `httpOnly` 및 `Secure` 플래그가 설정된 쿠키에 저장해야 합니다. 이를 통해 XSS 공격으로부터 Refresh Token을 보호할 수 있습니다.
    *   **Access Token은 메모리 또는 `sessionStorage`에 저장 (짧은 수명 가정 시):** Access Token은 `localStorage` 대신 메모리 변수나 `sessionStorage`에 저장하고, 수명을 짧게 (예: 5~15분) 유지하며 자주 갱신하는 것이 좋습니다. 이를 통해 XSS 공격 시 Access Token이 탈취되더라도 공격 가능 시간을 최소화할 수 있습니다.
*   **관련 파일:** `ui/src/contexts/AuthContext.tsx`

### 심각도: 중간 (Medium)

#### 3. `uploadFile` 엔드포인트의 인증 방식 확인 (프론트엔드 및 백엔드)
*   **발견:** `ui/src/api/mcpClient.ts`의 `uploadFile` 함수는 파일을 `/api/upload` REST 엔드포인트로 전송하며, 이 요청에는 명시적인 `token` 인수가 포함되어 있지 않습니다.
*   **위험:** `uploadFile` 엔드포인트가 적절한 인증/권한 부여 없이 호출될 경우, 인증되지 않은 사용자 또는 권한 없는 사용자가 파일을 업로드할 수 있는 취약점이 발생할 수 있습니다. 현재 코드만으로는 백엔드에서 이 엔드포인트를 어떻게 보호하는지 명확하지 않습니다.
*   **권장 사항:**
    *   **백엔드 `/api/upload` 엔드포인트에 대한 명확한 인증 및 권한 부여 로직 구현 확인:** 이 엔드포인트가 JWT Access Token을 기반으로 인증하는지, 아니면 세션 쿠키 등 다른 메커니즘을 사용하는지 확인하고, 적절한 권한 (예: 로그인한 사용자만 업로드 가능)이 부여되었는지 검토해야 합니다. 필요한 경우 `Authorization` 헤더에 `accessToken`을 포함하여 요청하도록 프론트엔드를 수정해야 합니다.
*   **관련 파일:** `ui/src/api/mcpClient.ts`

### 기타 발견 사항 (양호한 사례)

*   **백엔드 비밀번호 처리:** `bcrypt`를 사용한 해싱 및 솔팅, 비밀번호 복잡성 검증 등 비밀번호 관리가 안전하게 이루어지고 있습니다.
*   **역할 기반 접근 제어 (RBAC):** 백엔드에서 관리자 권한이 필요한 기능들에 대해 `role` 기반의 접근 제어가 잘 구현되어 있습니다.
*   **JWT 토큰 만료 및 갱신:** Access Token과 Refresh Token의 적절한 만료 시간 설정 및 Refresh Token을 통한 Access Token 갱신 메커니즘이 잘 구현되어 있습니다.
*   **Impersonation 기능 제어:** 관리자 가장 로그인 기능이 개발 환경으로 제한되어 있으며, 감사 로깅이 구현되어 있습니다.
*   **클라이언트 측 에러 리포팅:** `mcpClient`에 상세한 클라이언트 측 에러 리포팅 메커니즘이 구현되어 있어 문제 진단에 유용합니다.
*   **XSS 방어 (일부):** `dangerouslySetInnerHTML`의 사용이 발견되지 않아, 사용자 입력으로부터의 직접적인 HTML 주입 공격 위험이 낮습니다.

## 결론
Edux 프로젝트의 인증 및 세션 관리 로직은 전반적으로 잘 설계되어 있으나, **토큰 저장 및 전송 방식에 심각한 보안 취약점(URL 노출 및 `localStorage` 저장)**이 존재합니다. 이 부분을 최우선적으로 개선해야 합니다. `httpOnly` 쿠키를 사용한 Refresh Token 저장과 Authorization Code Flow with PKCE 구현을 통해 이러한 위험을 크게 줄일 수 있습니다. 또한, `uploadFile` 엔드포인트의 인증/권한 부여 로직을 명확히 확인하는 것이 중요합니다.