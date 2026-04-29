# auth_kit

**JWT 인증 + 4 provider 소셜 로그인 (Google · Apple · Kakao · Naver) + 로그인 · 비번찾기 · 이메일 인증 화면**. `backend_api_kit` 에 의존.

---

## 개요

- **인증 방식**: 이메일/비번 · Google Sign-In · Sign in with Apple · Kakao SDK · Naver SDK
- **토큰 저장**: `SecureStorage` + 원자적 ([`ADR-013`](../philosophy/adr-013-token-atomic-storage.md))
- **401 자동 refresh**: `AuthInterceptor` 가 투명 처리 ([`ADR-010`](../philosophy/adr-010-queued-interceptor.md))
- **부팅 시 토큰 검증**: `AuthCheckStep` BootStep
- **라우팅 게이트**: `redirectPriority: 10` ([`ADR-018`](../philosophy/adr-018-redirect-priority.md))
- **제공 화면**: `/login`, `/forgot-password`, `/verify-email`
- **SDK 호출 layer 분리**: `SocialAuthCoordinator` 가 4 SDK 호출 + 토큰 추출 + AuthService 위임. AuthService 는 백엔드 통신만 담당
- **Apple iOS-only 가드**: provider set 에 `apple` 이 있어도 Android 에서는 자동 숨김 (`Platform.isIOS` 체크)
- **Dev offline mock**: OAuth 키 발급 전에도 LoginScreen → /home 흐름을 디바이스에서 시연 가능

---

## 활성화

```yaml
# app_kits.yaml — 활성 provider 선언 (진실의 출처)
kits:
  backend_api_kit: {}
  auth_kit:
    providers:
      - email
      - google
      - apple
      # - kakao    # 한국 시장 앱이면 주석 해제
      # - naver
```

```dart
// lib/main.dart — 실제 install 코드 (yaml 과 수동 동기화)
await AppKits.install([
  BackendApiKit(),
  AuthKit(
    providers: const {
      AuthProvider.email,
      AuthProvider.google,
      AuthProvider.apple,
      // AuthProvider.kakao,
      // AuthProvider.naver,
    },
  ),
  // ...
]);
```

의존성 순서 주의: `backend_api_kit` 이 먼저. **두 곳 동기화** 는 `dart run tool/configure_app.dart` 로 검증 (현재 활성 provider 가 리포트에 표시됨).

---

## Provider 활성화 메커니즘

진실의 출처는 **두 곳**:

1. `app_kits.yaml` 의 `auth_kit.providers` — 선언적 의도
2. `lib/main.dart` 의 `AuthKit(providers: {...})` — 실제 install

기존 `ads_kit` / `local_db_kit` 의 활성화 패턴과 동일. 둘이 일치하지 않으면 의도와 다르게 동작하므로 **수동 동기화 필수**.

검증:
```bash
dart run tool/configure_app.dart
# Status: OK
# [x] auth_kit (providers: email, google, apple)
```

미지원 이름 (예: `facebook`) 이 들어가면 `⚠` 경고 + `--audit` 모드에서 exit 1.

**Apple 은 set 에 있어도 iOS 가 아니면 UI 에 노출되지 않는다** — `LoginScreen` 의 `Platform.isIOS` 가드 + `SocialAuthCoordinator` 의 호출 안전망.

---

## 어떤 Provider 를 켤까? (의사결정 가이드)

활성화한 provider 만 native 셋업이 필요하다 — 안 켠 provider 는 콘솔 발급 / Info.plist / AndroidManifest 작업 전부 생략 가능.

| 상황 | 권장 조합 | 이유 |
|---|---|---|
| iOS + Android, 글로벌 시장 | `email + google + apple` | 가장 보편적. App Store 정책 4.8 (다른 third-party 로그인이 있으면 Apple 의무) 충족. |
| iOS + Android, 한국 시장 우선 | `email + google + apple + kakao` | 한국 사용자 대다수가 Kakao. Naver 는 옵션 (포털 사용자 비중 높을 때). |
| iOS only | `email + google + apple` (+kakao if 한국) | Apple 은 자동 노출. |
| Android only | `email + google` (+kakao if 한국) | Apple set 에서 제거 (UI 자동 가드). |
| B2B / 사내 앱 | `email` 만 | 소셜 불필요. SDK 4개 모두 제거 가능. |
| 소셜 전용 (이메일 가입 X) | `google + apple` 같은 set | `email` 빼면 LoginScreen 에 이메일 폼 사라짐. |

### Apple App Store 정책 4.8 (중요)

> Apps that use a third-party or social login service must offer **Sign in with Apple** as an equivalent option.

**iOS 출시 + Google/Kakao/Naver 중 하나라도 활성** 이면 **Apple 도 반드시 활성** 해야 심사 통과. 본 템플릿의 default(`email + google + apple`) 가 이미 이 정책 만족.

### 의심스러우면 default 유지

`email + google + apple` 가 마찰 최저. Kakao/Naver 는 출시 후 사용자 요청 들어오면 추가해도 늦지 않다 (provider 추가는 yaml 한 줄 + main.dart 한 줄 + native 셋업).

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `AuthProvider` (enum) | `email` · `google` · `apple` · `kakao` · `naver`. yaml/main.dart 동기화 식별자 |
| `enabledAuthProvidersProvider` | UI 가 watch 해 활성 provider 만 노출. `AuthKit` 이 install 시 override |
| `AuthService` | 이메일/4 social 로그인 · 가입 · 로그아웃 · refresh · withdraw. **백엔드 통신만 담당** |
| `SocialAuthCoordinator` | 4 SDK 호출 + 토큰 추출 + AuthService 위임. SDK 다이얼로그 취소/토큰 누락/iOS 가드 위반을 sealed `SocialAuthException` 으로 통일 |
| `AuthState` (enum: `unknown` · `authenticated` · `unauthenticated`) | 앱 인증 상태 |
| `AuthStateNotifier` | 상태 브로드캐스트 (Stream) |
| `CurrentUser` | 로그인된 유저 정보 |
| `TokenStorage` | SecureStorage 기반 토큰 저장 (core 제공) |
| `AuthCheckStep` | 부팅 시 토큰 유효성 검증 + (dev mock 모드면) 백엔드 reachability probe |
| `SocialLoginBar` / `SocialLoginButton` | 활성 set 에 따른 조건부 social 버튼 렌더 (Apple 은 `Platform.isIOS` 가드) |
| `LoginScreen` · `PasswordResetScreen` · `VerifyEmailScreen` | 표준 UI |
| `LoginViewModel` · `PasswordResetViewModel` · `VerifyEmailViewModel` | 로직 |

---

## 핵심 API

### AuthService

```dart
// 이메일 로그인
await authService.signInWithEmail(email: 'x@y.com', password: 'pw');

// 4 provider 소셜 로그인 — SDK 가 받아온 토큰을 인자로 전달.
// 일반 흐름은 LoginViewModel 이 SocialAuthCoordinator 를 통해 호출하므로
// 직접 부를 일은 거의 없음.
await authService.signInWithGoogle(idToken: idToken);
await authService.signInWithApple(identityToken: identityToken);
await authService.signInWithKakao(accessToken: accessToken);
await authService.signInWithNaver(accessToken: accessToken);

// 가입
await authService.signUpWithEmail(
  email: 'x@y.com',
  password: 'pw',
  displayName: 'Alice',
);

// 비번 재설정 요청
await authService.requestPasswordReset(email: 'x@y.com');

// 로그아웃
await authService.signOut();

// 회원 탈퇴
await authService.withdraw();

// 현재 유저 조회
final user = await authService.fetchCurrentUser();

// 토큰 갱신 (인터셉터가 자동 호출)
final success = await authService.refreshToken();
```

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

경로 커스터마이징 (파생 레포에서):

```dart
AuthKit(
  loginPath: '/auth/login',
  homePath: '/main',
  forgotPasswordPath: '/auth/forgot',
  // ...
)
```

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

## OAuth 키 발급 전 e2e 시연 (dev-mock 모드)

파생 레포 만든 첫날 OAuth 키 4종 받아오기 전에도 LoginScreen → /home 흐름을 디바이스에서 시연 가능. 백엔드 (template-spring) 의 WireMock 컨테이너 + Mock Apple bean 활용.

### 백엔드 (template-spring)

```bash
cd ../template-spring/infra
docker compose -f docker-compose.dev.yml up -d postgres wiremock

# 백엔드 부팅 시 다음 환경변수 export (또는 .env 에 작성)
export APP_OAUTH_DEV_MOCK=true
export APP_OAUTH_GOOGLE_TOKENINFO_URL='http://localhost:9999/tokeninfo?id_token='
export APP_OAUTH_KAKAO_TOKEN_INFO_URL='http://localhost:9999/v1/user/access_token_info'
export APP_OAUTH_KAKAO_USER_ME_URL='http://localhost:9999/v2/user/me'
export APP_OAUTH_NAVER_USER_ME_URL='http://localhost:9999/v1/nid/me'

cd .. && ./gradlew :apps:app-template:bootRun
```

### 프론트 (template-flutter)

```bash
flutter run --dart-define=AUTH_DEV_MOCK=true
```

### 자동 분기 흐름

1. 부팅 boot step (`AuthCheckStep`) 이 `BackendReachability.probe()` 1회 호출 → `/actuator/health` 짧은 timeout (2초) ping.
2. **백엔드 살아있음** → `DevOfflineAuthInterceptor` 등록되지만 비활성 (실제로는 백엔드 호출 그대로 통과). 프론트의 `DevMock*Gate` 가 dummy 토큰 → 백엔드의 WireMock 이 stub 응답 → JWT 발급.
3. **백엔드 unreachable** → `DevOfflineAuthInterceptor` 가 `/auth/*` 호출을 가로채서 fake JWT 응답 즉시 resolve → AuthState.authenticated → /home 리다이렉트.

### 안전장치

- `AUTH_DEV_MOCK` env 변수 (프론트) 미주입 → 자동으로 실 SDK 사용. **default 빌드는 안전**.
- `app.oauth.dev-mock=true` (백엔드) 미설정 → MockAppleSignInService 비활성, 실 Apple JWKS 사용.
- 운영 빌드에 둘 다 절대 들어가면 안 된다. CI 가 `--dart-define` 없이 빌드, prod profile 은 wiremock URL 환경변수가 정의 안 됐으면 부팅 실패.

### Apple iOS-only UI 가드

dev-mock 모드에서도 LoginScreen 의 Apple 버튼은 **iOS 디바이스에서만** 보인다 (`Platform.isIOS` 가드). Android 시뮬레이터에선 dev-mock 이 켜져있어도 Apple 버튼이 안 그려진다.

---

## 파생 레포 체크리스트

각 provider 의 콘솔에서 키를 받아 **프론트(Info.plist/AndroidManifest)** 와 **백엔드(`.env` 환경변수)** 양쪽에 등록한다.

### 키 발급 한눈에 보기

| Provider | 콘솔에서 발급 받는 키 | 프론트 (Flutter) 자리 | 백엔드 (template-spring) 환경변수 | 같은 키? |
|---|---|---|---|---|
| **Google** | iOS Client ID, Android Client ID | iOS: `Info.plist` `CFBundleURLTypes` 에 **Reversed Client ID**. Android: `google-services.json` 배치. | `APP_CREDENTIALS_<SLUG>_GOOGLE_CLIENT_IDS_0` (iOS), `_1` (Android) | ✅ 같은 Client ID |
| **Apple** | App ID (Bundle Identifier) | Xcode → Signing & Capabilities **"Sign in with Apple" capability ON** (코드 변경 없음) | `APP_CREDENTIALS_<SLUG>_APPLE_BUNDLE_ID` | ✅ 같은 Bundle ID |
| **Kakao** | **Native App Key** (문자열) + **App ID** (숫자) — **다른 키 2개** | iOS: `kakao{NATIVE_APP_KEY}` redirect scheme. Android: 같은 scheme intent-filter. + `KakaoSdk.init(nativeAppKey: ...)` 부팅 코드 | `APP_CREDENTIALS_<SLUG>_KAKAO_APP_ID` (숫자) | ❌ **다른 키 2개** |
| **Naver** | Client ID + Client Secret + URL scheme | iOS: `Info.plist` URL scheme. Android: `AndroidManifest.xml` 등록. + `FlutterNaverLogin.initSdk(...)` 부팅 코드 | `APP_CREDENTIALS_<SLUG>_NAVER_CLIENT_ID` | ✅ 같은 Client ID (Secret 은 백엔드만) |

### Kakao 만 키 2개인 이유 (주의)

카카오 디벨로퍼스 콘솔의 **같은 앱 등록 페이지**에서 두 개의 식별자가 발급된다:

1. **Native App Key** — 32자 문자열. **프론트만** 사용 (KakaoTalk SDK redirect + `KakaoSdk.init()`)
2. **App ID** — 숫자. **백엔드만** 사용 (토큰 검증 시 `/v1/user/access_token_info` 의 `app_id` 매칭)

콘솔 대시보드에 둘 다 나란히 표시되므로 **둘 다 복사해서 각자 자리에 등록**해야 한다. 한 쪽이라도 빠지면 동작 안 함.

### Provider 별 셋업 단계

#### Google
- [ ] [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 Client ID 발급 (iOS / Android 별도)
- [ ] iOS: `ios/Runner/Info.plist` 의 `CFBundleURLTypes` 에 Reversed Client ID 추가
- [ ] Android: `android/app/google-services.json` 배치 + `build.gradle` 설정
- [ ] 백엔드 `.env` 에 `APP_CREDENTIALS_<SLUG>_GOOGLE_CLIENT_IDS_0/1` 주입

#### Apple (iOS 전용)
- [ ] Apple Developer Portal → App ID 의 "Sign In with Apple" capability ON
- [ ] Xcode → Signing & Capabilities → "Sign in with Apple" 추가
- [ ] 백엔드 `.env` 에 `APP_CREDENTIALS_<SLUG>_APPLE_BUNDLE_ID` 주입
- [ ] **Android 셋업 불필요** — UI 자동 숨김

#### Kakao
- [ ] Kakao Developers → 앱 등록 → **Native App Key + App ID 둘 다** 발급
- [ ] iOS: `Info.plist` 의 `LSApplicationQueriesSchemes` 에 `kakaokompassauth`, `kakaolink` + `CFBundleURLTypes` 에 `kakao{NATIVE_APP_KEY}` redirect scheme
- [ ] Android: `AndroidManifest.xml` 의 `AuthCodeCustomTabsActivity` intent-filter 활성 (scheme = `kakao{NATIVE_APP_KEY}`)
- [ ] 부팅 시 `KakaoSdk.init(nativeAppKey: '...')` 호출 — `lib/main.dart` 또는 신규 boot step
- [ ] 백엔드 `.env` 에 `APP_CREDENTIALS_<SLUG>_KAKAO_APP_ID` (숫자) 주입

#### Naver
- [ ] Naver Developers → 앱 등록 → Client ID / Client Secret / URL scheme
- [ ] iOS: `Info.plist` 의 `CFBundleURLTypes` 에 Naver URL scheme
- [ ] Android: `AndroidManifest.xml` 등록 (보통 SDK 자동 등록)
- [ ] 부팅 시 `FlutterNaverLogin.initSdk(clientId: ..., clientName: ..., clientSecret: ...)`
- [ ] 백엔드 `.env` 에 `APP_CREDENTIALS_<SLUG>_NAVER_CLIENT_ID` 주입

상세 단계는 각 SDK 공식 문서 참조. 템플릿은 `Info.plist` / `AndroidManifest.xml` 에 자리(주석)만 마련되어 있고 실제 키는 파생 레포가 채운다. **활성 안 한 provider 는 위 단계 전부 생략**.

### 백엔드

- [ ] `template-spring` 쌍 운영 전제
- [ ] 유저 테이블이 `appSlug` 기반 격리 ([`ADR-012`](../philosophy/adr-012-per-app-user.md))
- [ ] `/auth/{email/signin,email/signup,google,apple,kakao,naver,refresh,logout}` 엔드포인트 제공
- [ ] 자세한 백엔드 셋업: [`template-spring 의 social-auth-setup.md`](https://github.com/storkspear/docs-template-spring/blob/main/docs/start/social-auth-setup.md)

---

## Code References

- [`lib/kits/auth_kit/auth_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_kit.dart) — `AppKit` 구현 + `providers` 생성자 인자
- [`lib/kits/auth_kit/auth_provider.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_provider.dart) — `AuthProvider` enum + `enabledAuthProvidersProvider`
- [`lib/kits/auth_kit/auth_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_service.dart) — 4 provider 백엔드 호출 메서드
- [`lib/kits/auth_kit/social/social_auth_coordinator.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/social_auth_coordinator.dart) — SDK 호출 + AuthService 위임
- [`lib/kits/auth_kit/social/social_auth_gates.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/social_auth_gates.dart) — 4 SDK mockable 인터페이스
- [`lib/kits/auth_kit/social/social_auth_exceptions.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/social_auth_exceptions.dart) — sealed exception
- [`lib/kits/auth_kit/social/dev_mock_gates.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/dev_mock_gates.dart) — `--dart-define=AUTH_DEV_MOCK=true` 시 사용
- [`lib/kits/auth_kit/social/dev_offline_auth.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/dev_offline_auth.dart) — `BackendReachability` + `DevOfflineAuthInterceptor`
- [`lib/kits/auth_kit/auth_state.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_state.dart)
- [`lib/kits/auth_kit/auth_check_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_check_step.dart) — 부팅 시 토큰 검증 + (dev mock) reachability probe
- [`lib/kits/auth_kit/ui/`](https://github.com/storkspear/template-flutter/tree/main/lib/kits/auth_kit/ui) — 3개 화면 + ViewModel + SocialLoginBar/Button
- [`lib/core/storage/token_storage.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/storage/token_storage.dart) — 원자 저장

---

## 관련 문서

- [`backend-api-kit.md`](./backend-api-kit.md) — 의존 Kit
- [`ADR-010 · 401 refresh`](../philosophy/adr-010-queued-interceptor.md)
- [`ADR-012 · 앱별 독립 유저`](../philosophy/adr-012-per-app-user.md)
- [`ADR-013 · 토큰 원자 저장`](../philosophy/adr-013-token-atomic-storage.md)
- [`ADR-018 · 라우팅 우선순위`](../philosophy/adr-018-redirect-priority.md)
