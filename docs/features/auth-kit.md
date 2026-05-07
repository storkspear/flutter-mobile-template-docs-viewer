# auth_kit

**JWT 인증 + 소셜 로그인 (Google · Apple) + 로그인 · 비번찾기 · 이메일 인증 화면**. `backend_api_kit` 에 의존.

---

## 개요

- **인증 방식**: 이메일/비번 · Google Sign-In · Sign in with Apple
- **토큰 저장**: `SecureStorage` + 원자적 ([`ADR-013`](../philosophy/adr-013-token-atomic-storage.md))
- **401 자동 refresh**: `AuthInterceptor` 가 투명 처리 ([`ADR-010`](../philosophy/adr-010-queued-interceptor.md))
- **부팅 시 토큰 검증**: `AuthCheckStep` BootStep
- **라우팅 게이트**: `redirectPriority: 10` ([`ADR-018`](../philosophy/adr-018-redirect-priority.md))
- **제공 화면**: `/login`, `/forgot-password`, `/verify-email`

---

## 활성화

```yaml
# app_kits.yaml
kits:
  backend_api_kit: {}
  auth_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(
    providers: const {
      AuthProvider.email,
      AuthProvider.google,
      AuthProvider.apple,
      // AuthProvider.kakao, AuthProvider.naver  // 한국 시장 앱일 때 활성화
    },
  ),
  // ...
]);
```

> `providers` 는 `app_kits.yaml` 의 `auth_kit.providers` 와 1:1 동기화. `tool/configure_app.dart` 가 불일치 검증.

의존성 순서 주의: `backend_api_kit` 이 먼저.

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `AuthService` | 로그인 · 가입 · 로그아웃 · refresh · withdraw |
| `AuthStatus` (enum: `unknown` · `authenticated` · `unauthenticated`) | 앱 인증 상태 enum |
| `AuthState` (클래스: `status` + `user`) | enum + `CurrentUser?` 묶음 |
| `AuthStateNotifier` | 상태 브로드캐스트 (Stream) |
| `CurrentUser` | 로그인된 유저 정보 |
| `TokenStorage` | SecureStorage 기반 토큰 저장 (core 제공) |
| `AuthCheckStep` | 부팅 시 토큰 유효성 검증 |
| `LoginScreen` · `PasswordResetScreen` · `VerifyEmailScreen` | 표준 UI |
| `LoginViewModel` · `PasswordResetViewModel` · `VerifyEmailViewModel` | 로직 |

---

## 핵심 API

### AuthService

```dart
// 이메일 로그인
await authService.signInWithEmail(email: 'x@y.com', password: 'pw');

// 가입
await authService.signUpWithEmail(
  email: 'x@y.com',
  password: 'pw',
  displayName: 'Alice',
);

// 소셜 로그인 — 각 provider SDK 로 받은 토큰을 인자로 전달
await authService.signInWithGoogle(idToken: googleIdToken);
await authService.signInWithApple(identityToken: appleIdentityToken);
await authService.signInWithKakao(accessToken: kakaoAccessToken);
await authService.signInWithNaver(accessToken: naverAccessToken);

// 비번 재설정 요청 / 확정
await authService.requestPasswordReset(email: 'x@y.com');
await authService.confirmPasswordReset(email: 'x@y.com', code: '123456', newPassword: 'new');

// 이메일 인증 / 재발송
await authService.verifyEmail(code: 'token-from-email');
await authService.resendEmailVerification();

// 로그아웃 — 클라단 동작 (백엔드 endpoint 없음)
await authService.signOut();

// 회원 탈퇴 — 백엔드 호출 + 로컬 정리
await authService.withdraw();

// 토큰 갱신 (AuthInterceptor 가 401 시 자동 호출하므로 직접 호출 거의 불필요)
final success = await authService.refreshToken();
```

> 보통은 `LoginScreen` 이 제공하는 SocialLoginBar 위젯이 provider SDK 호출 + 토큰 추출 + `signInWithXxx()` 호출까지 처리하므로 직접 호출할 일은 드물어요. 커스텀 로그인 화면 작성 시에만 위 메서드 직접 사용.

### AuthState 구독

```dart
// Screen
final state = ref.watch(authStreamProvider);
state.whenData((auth) {
  if (auth.isAuthenticated) { /* 로그인 */ }
});

// Service 내부 (sync)
final current = ref.read(authStateProvider).current;
if (current.isAuthenticated) { /* ... */ }
```

---

## 라우팅

`auth_kit` 이 기여하는 3개 라우트:

| 경로 | 화면 | 용도 |
|------|------|------|
| `/login` | `LoginScreen` | 이메일/소셜 로그인 · 가입 토글 |
| `/forgot-password` | `PasswordResetScreen` | 비번 재설정 요청 |
| `/verify-email` | `VerifyEmailScreen` | 이메일 인증 (가입 후) |

### 리다이렉트 규칙

`AuthKit.buildRedirect()`:

```
상태 = unknown (부팅 중)
  → splash 로 유지 (홈 깜빡임 방지)

상태 = unauthenticated
  → 인증 흐름 (/login · /forgot-password · /verify-email) 만 허용
  → 그 외 경로 접근 시 /login 으로

상태 = authenticated
  → /login · /forgot-password 접근 시 /home 으로 리다이렉트
  → /verify-email 은 인증 후에도 접근 허용 (보안 이벤트)
```

### 경로 커스터마이징 (파생 레포에서)

`AuthKit` 의 default 값:
- `loginPath: '/login'`, `homePath: '/'`, `splashPath: '/splash'`
- `forgotPasswordPath: '/forgot-password'`, `verifyEmailPath: '/verify-email'`

이 경로들은 **Flutter GoRouter 의 클라 라우트** 예요 (백엔드 API endpoint 와 무관). 파생 레포가 변경하려면:

```dart
AuthKit(
  providers: const {AuthProvider.email, AuthProvider.google},
  loginPath: '/sign-in',          // 클라 라우트만 변경
  homePath: '/dashboard',
  forgotPasswordPath: '/reset-password',
)
```

> API endpoint (`/api/apps/{slug}/auth/email/signin` 등) 는 [`api_endpoints.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_endpoints.dart) 에서 관리. 백엔드와 1:1 일치 필요해서 일반적으로 변경하지 않아요.

---

## 시연 모드 (Dev Mock)

백엔드 · OAuth SDK 키 없이 로그인 → home 흐름까지 keyless 시연하는 모드. 솔로 dev 가 새 derived repo 첫 `flutter run` 에서 가장 자주 쓸 옵션이에요.

```bash
flutter run --dart-define=AUTH_DEV_MOCK=true
```

활성 조건: dart-define 주입 + 백엔드 unreachable. 자동으로 `BackendReachability.probe()` 가 baseUrl 의 `/actuator/health` 핑 → 실패 시 `DevOfflineAuthInterceptor` 가 `/auth/*` 응답을 fake JWT 로 가로채요.

> ⚠️ **운영 빌드 절대 금지** — release 에 `AUTH_DEV_MOCK=true` 박으면 모든 인증이 fake JWT.

자세한 메커니즘 · 핵심 코드 위치 · 운영 빌드 안전장치는 [`auth_kit/README.md` Dev Mock 섹션](../../lib/kits/auth_kit/README.md#dev-mock-백엔드-없이-시연) 참고.

---

## 일반 사용 예

### 로그인 화면 (이미 제공됨)

`/login` 라우트는 `AuthKit` 이 자동으로 기여. 파생 레포에서 커스텀 로그인 화면 원하면 위 경로를 override + 자체 Screen 등록.

### 로그아웃 버튼

```dart
// 설정 화면 등
ElevatedButton(
  onPressed: () async {
    await ref.read(authServiceProvider).signOut();
    // authState 변화 → 라우터 자동으로 /login 리다이렉트
  },
  child: Text(s.logout),
)
```

### 현재 유저 정보 표시

```dart
class ProfileScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStreamProvider);
    return auth.when(
      data: (state) {
        if (state.user == null) return const SizedBox();
        return Text('Hi, ${state.user!.displayName}');
      },
      loading: () => const LoadingView(),
      error: (e, _) => Text('Error: $e'),
    );
  }
}
```

### 401 처리

ViewModel 에서 `e.isUnauthorized` 감지:

```dart
try {
  final data = await repo.fetchData();
  // ...
} catch (e) {
  if (e is ApiException && e.isUnauthorized) {
    // refresh 도 실패 → 강제 로그아웃
    await ref.read(authServiceProvider).signOut();
  } else {
    state = state.copyWith(errorCode: safeErrorCode(e));
  }
}
```

---

## 파생 레포 체크리스트

### Google Sign-In

- [ ] [Google Cloud Console](https://console.cloud.google.com) 프로젝트 생성
- [ ] OAuth 2.0 Client ID 발급 (Android / iOS / Web 각각)
- [ ] `android/app/google-services.json` · `ios/Runner/GoogleService-Info.plist` 배치 (Firebase 안 쓰면 생략 가능)
- [ ] Android: `build.gradle` 에 Client ID · 지문 (SHA-1 / SHA-256) 등록
- [ ] iOS: `Info.plist` 의 `CFBundleURLTypes` 에 reversed Client ID 추가

### Sign in with Apple

- [ ] Apple Developer 에서 Bundle ID 설정 (Capabilities → Sign in with Apple)
- [ ] Service ID 생성 (웹 혹은 백엔드용)
- [ ] Xcode 의 Signing & Capabilities 에서 Sign in with Apple 추가
- [ ] 백엔드 `auth_kit` 에 Bundle ID · Service ID · Team ID · Key File 등록

### 백엔드

- [ ] `template-spring` 쌍 운영 전제
- [ ] 유저 테이블이 `appSlug` 기반 격리 ([`ADR-012`](../philosophy/adr-012-per-app-user.md))
- [ ] 다음 endpoint 제공 (`template-spring/common/common-web/.../ApiEndpoints.java` 의 `Auth.*`):
  - `POST /api/apps/{slug}/auth/email/signup` (201)
  - `POST /api/apps/{slug}/auth/email/signin` (200)
  - `POST /api/apps/{slug}/auth/{google|apple|kakao|naver}` (200)
  - `POST /api/apps/{slug}/auth/refresh` (200, AuthTokens — 회전)
  - `POST /api/apps/{slug}/auth/withdraw` (204, 인증 필요)
  - `POST /api/apps/{slug}/auth/verify-email` (204)
  - `POST /api/apps/{slug}/auth/resend-verification` (204, 인증 필요)
  - `POST /api/apps/{slug}/auth/password-reset/request` (204)
  - `POST /api/apps/{slug}/auth/password-reset/confirm` (204)
  - `PATCH /api/apps/{slug}/auth/password` (204, 인증 필요)
  - `GET /api/apps/{slug}/users/me` (인증 필요)
- [ ] **로그아웃 endpoint 는 없음** — 클라단 `signOut()` 만으로 충분 ([auth-flow.md §로그아웃](../api-contract/auth-flow.md) 참조)
- [ ] 응답 envelope `{data, error}`, signin/signup 은 `{user, tokens: {accessToken, refreshToken}}` nested, refresh 는 `{accessToken, refreshToken}` root

---

## Code References

- [`lib/kits/auth_kit/auth_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_kit.dart) — `AppKit` 구현
- [`lib/kits/auth_kit/auth_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_service.dart)
- [`lib/kits/auth_kit/auth_state.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_state.dart)
- [`lib/kits/auth_kit/auth_check_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_check_step.dart)
- [`lib/kits/auth_kit/ui/`](https://github.com/storkspear/template-flutter/tree/main/lib/kits/auth_kit/ui) — 3개 화면 + ViewModel
- [`lib/core/storage/token_storage.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/storage/token_storage.dart) — 원자 저장

---

## 관련 문서

- [`backend-api-kit.md`](./backend-api-kit.md) — 의존 Kit
- [`ADR-010 · 401 refresh`](../philosophy/adr-010-queued-interceptor.md)
- [`ADR-012 · 앱별 독립 유저`](../philosophy/adr-012-per-app-user.md)
- [`ADR-013 · 토큰 원자 저장`](../philosophy/adr-013-token-atomic-storage.md)
- [`ADR-018 · 라우팅 우선순위`](../philosophy/adr-018-redirect-priority.md)
