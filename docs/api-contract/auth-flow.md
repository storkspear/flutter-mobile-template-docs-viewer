# Auth Flow

JWT 기반 인증 전체 시퀀스. 앱별 독립 유저 + `appSlug` 검증 ([`ADR-012`](../philosophy/adr-012-per-app-user.md)).

> **용어 구분 — 라우터 경로 vs API endpoint**
> - **라우터 경로** (`/login`, `/home`, `/forgot-password`): Flutter GoRouter 의 클라 내부 화면 경로
> - **API endpoint** (`/api/apps/{slug}/auth/email/signin`, `/auth/refresh`): 백엔드 호출 경로
> 본 문서는 둘을 명확히 구분해서 표기해요.

---

## 이메일 로그인 시퀀스

```
클라이언트                                         백엔드
   │                                                │
   │ POST /api/apps/{slug}/auth/email/signin        │  ← API endpoint
   │ Body: { email, password, appSlug }             │
   │ Header: (Authorization 없음 — skipAuth)         │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       1. 유저 검증               │
   │                       2. JWT 생성                │
   │                          sub: userId             │
   │                          appSlug: slug           │
   │                          exp: +15분               │
   │                                                │
   │ 200 OK (또는 회원가입은 201 Created)              │
   │ {                                              │
   │   "data": {                                    │
   │     "user": { "id", "email", ... },            │  ← Spring AuthResponse
   │     "tokens": {                                │     nested 구조
   │       "accessToken": "eyJ...",                 │
   │       "refreshToken": "..."                    │
   │     }                                          │
   │   },                                           │
   │   "error": null                                │
   │ }                                              │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ AuthService._handleAuthResponse 가              │
   │   data['tokens']['accessToken'] 추출 (관대 파싱) │
   │ TokenStorage.saveTokens(access, refresh)       │
   │ authState.emit(authenticated)                  │
   │ (router refreshListenable → /home 으로 이동)     │  ← 라우터 경로
```

> 회원가입(`POST /auth/email/signup`) 도 동일한 응답 구조. signup 은 201, signin 은 200.

---

## 일반 API 요청 (인증 필요)

```
클라이언트                                         백엔드
   │                                                │
   │ GET /api/apps/{slug}/users/me                  │
   │ Authorization: Bearer <access>                 │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       AppSlugVerificationFilter│
   │                         URL slug ↔ JWT slug 비교│
   │                         (불일치 시 CMN_004)     │
   │                                                │
   │ 200 OK                                         │
   │ { "data": { "id", "email", ... }, "error": null} │
   │ ◀─────────────────────────────────────────────  │
```

---

## 토큰 만료 → 자동 refresh ([`ADR-010`](../philosophy/adr-010-queued-interceptor.md))

```
클라이언트                                         백엔드
   │                                                │
   │ GET /api/apps/{slug}/users/me                  │
   │ Authorization: Bearer <expired_access>         │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │ 401 { error: { code: "CMN_007" } }              │  ← access token 만료
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ AuthInterceptor 감지 (isAccessTokenExpired)     │
   │ onTokenRefresh 콜백 실행                         │
   │                                                │
   │ POST /api/apps/{slug}/auth/refresh             │
   │ Body: { refreshToken, appSlug }                │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       Refresh token 검증        │
   │                       기존 token 폐기 + 회전     │
   │                       새 access + 새 refresh    │
   │                                                │
   │ 200 OK (Spring AuthTokens — root level)        │
   │ {                                              │
   │   "data": {                                    │
   │     "accessToken": "eyJ...",                   │  ← refresh 응답은
   │     "refreshToken": "..."                      │     root 레벨에 토큰
   │   },                                           │     (signin/signup 과 다름)
   │   "error": null                                │
   │ }                                              │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ TokenStorage.saveTokens(new_access, new_refresh)│
   │                                                │
   │ GET /api/apps/{slug}/users/me (재시도)           │
   │ Authorization: Bearer <new_access>             │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │ 200 OK                                         │
   │ ◀─────────────────────────────────────────────  │
```

### 동시 401 처리

`QueuedInterceptor` 덕분에 **동시에 401 이 터져도 refresh 는 1번만 실행**. 다른 요청은 큐에서 대기 → refresh 완료 후 순차 재시도. 상세는 [`ADR-010`](../philosophy/adr-010-queued-interceptor.md).

---

## 로그아웃 (signOut)

> ⚠️ **백엔드에 로그아웃 endpoint 가 없어요** (의도적 결정). 로그아웃은 **클라단 동작**이에요. 서버 측 토큰 무효화는 refresh 시도 시 자연스럽게 일어나거나, 회원 탈퇴(`/auth/withdraw`) 시 일괄 처리.

```
사용자가 "로그아웃" 버튼 누름
  ↓
authService.signOut() 호출
  ↓
TokenStorage.clearTokens()         ← Secure storage 의 access/refresh 제거
authState.emit(unauthenticated)
  ↓
GoRouter refreshListenable 트리거
  ↓
AuthKit.buildRedirect → /login 라우터 경로로 이동
```

**왜 백엔드 로그아웃이 없나**: 짧은 access TTL (15분) + refresh 회전 + replay 감지 (`ATH_003 INVALID_TOKEN`) 조합으로 충분. 추가 endpoint 는 공격 표면만 늘림. 회원 탈퇴는 `withdraw` 가 모든 refresh 토큰 일괄 무효화.

---

## Refresh 실패 → signOut

```
refresh 응답: 401 { error: { code: "ATH_002" or "ATH_003" } }
  ↓ (refresh token 만료 또는 무효)
AuthInterceptor 가 catch → ViewModel 로 401 전파
  ↓
ViewModel 의 catch 에서 ApiException.isRefreshTokenExpired 또는
  isRefreshTokenInvalid 감지
  ↓
authService.signOut() 호출
  ↓
TokenStorage.clearTokens()
  ↓
authState.emit(unauthenticated) → /login 라우터로 리다이렉트
```

**인터셉터가 signOut 직접 호출 금지** — ViewModel 이 판단 (저장 안 된 입력 등 보호).

---

## JWT 구조

### Access Token Payload

```json
{
  "sub": "42",                    // userId String (Spring: String.valueOf(userId))
  "email": "user@example.com",    // 추가 클레임
  "appSlug": "habit-tracker",     // 앱 식별자
  "role": "user",                 // "user" | "admin" (기본 "user")
  "iss": "template-spring",       // issuer
  "iat": 1714000000,              // issued at
  "exp": 1714000900               // expires (+15분)
}
```

> Spring `JwtService` 가 발급. Flutter 측 `CurrentUser.fromJwtPayload` 가 `sub` 을 `int.parse` 해 `userId` 로 추출. JWT 표준 (RFC 7519) 의 `sub` 클레임 사용 권장.

### Refresh Token Payload

별도 구조. 보통 opaque random token (DB 저장) 또는 짧은 JWT. 클라이언트는 내부 구조 의존하지 않음 — refresh endpoint 호출 시 그대로 전달만.

### 서명

- 알고리즘: **HS256** (백엔드 ADR-006 참조)
- 비밀키: 백엔드의 `JWT_SECRET` 환경변수

---

## appSlug 검증 메커니즘

백엔드 `AppSlugVerificationFilter`:

```
1. 요청 URL 에서 {appSlug} 추출: /api/apps/{appSlug}/...
2. JWT payload.appSlug 추출
3. 비교
   - 일치 → 계속 처리
   - 불일치 → 401
4. JWT 없으면 → 기존 Spring Security 필터로 처리 (로그인 · 가입 등은 skipAuth)
```

**왜 필요**: 앱 A 의 JWT 를 복사해서 앱 B 의 URL 에 주입 시도 → 런타임 차단. 상세는 [`ADR-012`](../philosophy/adr-012-per-app-user.md).

---

## OAuth 2.0 인증 흐름 (Google · Apple · Kakao · Naver)

각 provider 의 SDK 가 클라이언트에서 토큰을 받아오면 백엔드의 **provider 별 endpoint** 로 전송. 백엔드는 provider 공식 endpoint 로 토큰을 재검증한 후 우리 JWT 를 발급. 짝 백엔드 ADR: [`template-spring ADR-017 · OAuth 2.0 통합`](https://github.com/storkspear/template-spring/blob/main/docs/philosophy/adr-017-oauth-integration.md).

### 흐름 (provider 무관 공통)

```
1. 클라이언트: provider SDK 로 사용자 로그인 → 토큰 획득
2. 클라이언트: POST /api/apps/{slug}/auth/{provider}
   Body: { ... provider 별 토큰 필드 ..., appSlug }
3. 백엔드: provider 공식 endpoint 로 토큰 재검증 (위조 방지)
4. 백엔드: social_identities (provider, provider_id) 조회 → 신규/기존 분기
5. 백엔드: 우리 JWT 발급 (access + refresh, family 신규)
6. 클라이언트: 토큰 저장 → 이후는 일반 로그인과 동일
```

### Provider 별 토큰 / Endpoint

| Provider | Endpoint | Body 필드 | 검증 방식 (백엔드) |
|---|---|---|---|
| Google | `POST /auth/google` | `{ idToken, appSlug }` | `oauth2.googleapis.com/tokeninfo` 호출 → `aud` 검증 |
| Apple | `POST /auth/apple` | `{ identityToken, authorizationCode?, firstName?, lastName?, email?, nonce?, appSlug }` | JWKS + RS256 직접 검증 → `iss`/`aud`/`exp` |
| Kakao | `POST /auth/kakao` | `{ accessToken, appSlug }` | `kapi.kakao.com/v1/user/access_token_info` (app_id) + `/v2/user/me` (email) |
| Naver | `POST /auth/naver` | `{ accessToken, appSlug }` | `openapi.naver.com/v1/nid/me` (Naver 가 client 자체 검증) |

### Apple "Hide My Email" 처리

Apple 사용자가 "Hide My Email" 을 선택하면 첫 로그인 후 identity token 에 email claim 이 빠져요. 클라이언트는 **첫 로그인 시 받은 email** 을 `AppleSignInRequest.email` 에 fallback 으로 전달. 백엔드는 token email > request email 우선순위로 사용.

### Kakao / Naver 이메일 동의

사용자가 가입 시 이메일 동의를 거부할 수 있어요. 응답에 email 이 없으면 백엔드가 `AuthError.SOCIAL_AUTH_FAILED` (`reason=email_required`) 반환. 클라이언트는 i18n 메시지로 "이메일 제공 동의 필요" 안내.

---

## 짝 엔드포인트 (전체)

| 클라이언트 호출 | 백엔드 엔드포인트 | 설명 |
|---|---|---|
| `signUpWithEmail` | `POST /api/apps/{slug}/auth/email/signup` | 이메일 가입 (201) |
| `signInWithEmail` | `POST /api/apps/{slug}/auth/email/signin` | 이메일 로그인 |
| `signInWithGoogle` | `POST /api/apps/{slug}/auth/google` | Google ID token 검증 |
| `signInWithApple` | `POST /api/apps/{slug}/auth/apple` | Apple identity token 검증 |
| `signInWithKakao` | `POST /api/apps/{slug}/auth/kakao` | Kakao access token 검증 |
| `signInWithNaver` | `POST /api/apps/{slug}/auth/naver` | Naver access token 검증 |
| `refreshToken` | `POST /api/apps/{slug}/auth/refresh` | 토큰 회전 (ADR-010) |
| `verifyEmail` | `POST /api/apps/{slug}/auth/verify-email` | 이메일 인증 토큰 검증 (204) |
| `resendEmailVerification` | `POST /api/apps/{slug}/auth/resend-verification` | 인증 메일 재발송 (인증 필요, 204) |
| `requestPasswordReset` | `POST /api/apps/{slug}/auth/password-reset/request` | 재설정 메일 발송 (204) |
| `confirmPasswordReset` | `POST /api/apps/{slug}/auth/password-reset/confirm` | 토큰으로 재설정 (204) |
| `withdraw` | `POST /api/apps/{slug}/auth/withdraw` | 회원 탈퇴 (인증 필요, 204) |

> 백엔드 `PATCH /api/apps/{slug}/auth/password` (인증 비번 변경) 는 contract에 있지만 `AuthService` 메서드는 미구현 (파생 레포에서 필요 시 직접 호출).

> 경로 단일 진실의 출처: 백엔드 `common-web/ApiEndpoints.java` 의 `Auth.*` 상수. Flutter 쪽 경로 상수도 1:1 일치 권장.

---

## 관련 문서

- [`ADR-010 · 401 refresh`](../philosophy/adr-010-queued-interceptor.md)
- [`ADR-012 · 앱별 독립 유저 + appSlug`](../philosophy/adr-012-per-app-user.md)
- [`ADR-013 · 토큰 원자 저장`](../philosophy/adr-013-token-atomic-storage.md)
- [`template-spring ADR-017 · OAuth 2.0 통합`](https://github.com/storkspear/template-spring/blob/main/docs/philosophy/adr-017-oauth-integration.md) — 백엔드 OAuth 처리 정책 + provider 별 검증 방식
- [`auth_kit`](../features/auth-kit.md) — 클라이언트 Auth Kit 사용
- [`error-codes.md`](./error-codes.md) — 관련 ErrorCode (`socialAuthFailed` / `ATH_004` 포함)
