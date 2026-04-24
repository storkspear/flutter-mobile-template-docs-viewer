# Auth Flow

JWT 기반 로그인 · 갱신 · 로그아웃 전체 시퀀스. 앱별 독립 유저 + `appSlug` 검증 ([`ADR-012`](../philosophy/adr-012-per-app-user.md)).

---

## 로그인 시퀀스

```
클라이언트                                         백엔드
   │                                                │
   │ POST /api/apps/{slug}/auth/login               │
   │ Body: { email, password }                      │
   │ Header: (Authorization 없음 — skipAuth)         │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       1. 유저 검증               │
   │                       2. JWT 생성                │
   │                          sub: userId             │
   │                          appSlug: slug           │
   │                          exp: +15분               │
   │                                                │
   │ 200 OK                                         │
   │ { data: { accessToken, refreshToken }, ... }   │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ TokenStorage.saveTokens(access, refresh)       │
   │ authState.emit(authenticated)                  │
   │ (router refreshListenable → /home 이동)         │
```

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
   │                         (불일치 시 401)          │
   │                                                │
   │ 200 OK                                         │
   │ { data: { id, email, ... }, error: null }      │
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
   │ 401 TOKEN_EXPIRED                              │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ AuthInterceptor 감지                            │
   │ onTokenRefresh 콜백 실행                         │
   │                                                │
   │ POST /api/apps/{slug}/auth/refresh             │
   │ Body: { refreshToken }                         │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       Refresh token 검증        │
   │                       새 access 발급             │
   │                                                │
   │ 200 OK                                         │
   │ { data: { accessToken }, error: null }         │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ TokenStorage.saveTokens(new, existing)         │
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

## 로그아웃

```
클라이언트                                         백엔드
   │                                                │
   │ POST /api/apps/{slug}/auth/logout              │
   │ Authorization: Bearer <access>                 │
   │─────────────────────────────────────────────▶  │
   │                                                │
   │                       Refresh token 무효화       │
   │                       (블랙리스트 or DB 제거)    │
   │                                                │
   │ 200 OK                                         │
   │ ◀─────────────────────────────────────────────  │
   │                                                │
   │ TokenStorage.clearTokens()                     │
   │ authState.emit(unauthenticated)                │
   │ (router → /login 이동)                          │
```

---

## Refresh 실패 → signOut

```
refresh 응답 401 (refresh token 도 만료 · 무효)
  ↓
AuthInterceptor 가 원 401 전파
  ↓
ViewModel.catch 에서 ApiException.isUnauthorized 감지
  ↓
authService.signOut() 호출
  ↓
TokenStorage.clearTokens()
  ↓
authState.emit(unauthenticated) → /login 리다이렉트
```

**인터셉터가 signOut 직접 호출 금지** — ViewModel 이 판단.

---

## JWT 구조

### Payload

```json
{
  "sub": "user-uuid-42",          // 유저 ID
  "appSlug": "habit-tracker",     // 앱 식별자
  "iat": 1714000000,              // issued at
  "exp": 1714000900,              // expires (15분 후)
  "tokenType": "access"
}
```

### Refresh token

동일 구조, `tokenType: "refresh"`, `exp: +30일`.

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

## 소셜 로그인 (Google · Apple)

```
1. 클라이언트: GoogleSignIn.signIn() → ID token 획득
2. 클라이언트: POST /api/apps/{slug}/auth/social
   Body: { provider: 'google', idToken }
3. 백엔드: ID token 검증 → 유저 생성 or 기존 조회 → JWT 발급
4. 이후는 일반 로그인과 동일
```

Apple Sign In 도 같은 패턴 — `authorizationCode` + `identityToken`.

---

## 짝 엔드포인트

| 클라이언트 호출 | 백엔드 엔드포인트 |
|---|---|
| `signInWithEmail` | `POST /api/apps/{slug}/auth/login` |
| `signUpWithEmail` | `POST /api/apps/{slug}/auth/signup` |
| `signInWithGoogle` · `signInWithApple` | `POST /api/apps/{slug}/auth/social` |
| `refreshToken` | `POST /api/apps/{slug}/auth/refresh` |
| `signOut` | `POST /api/apps/{slug}/auth/logout` |
| `requestPasswordReset` | `POST /api/apps/{slug}/auth/password-reset` |
| `verifyEmail` | `POST /api/apps/{slug}/auth/verify-email` |
| `withdraw` | `DELETE /api/apps/{slug}/users/me` |
| `fetchCurrentUser` | `GET /api/apps/{slug}/users/me` |

---

## 관련 문서

- [`ADR-010 · 401 refresh`](../philosophy/adr-010-queued-interceptor.md)
- [`ADR-012 · 앱별 독립 유저 + appSlug`](../philosophy/adr-012-per-app-user.md)
- [`ADR-013 · 토큰 원자 저장`](../philosophy/adr-013-token-atomic-storage.md)
- [`auth_kit`](../features/auth-kit.md) — 클라이언트 Auth Kit 사용
- [`error-codes.md`](./error-codes.md) — 관련 ErrorCode
