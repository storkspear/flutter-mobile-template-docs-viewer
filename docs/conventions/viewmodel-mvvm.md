# ViewModel + MVVM 패턴

Screen 은 UI 만, ViewModel 은 로직만. 상태 관리는 `StateNotifier<TState>` + `ConsumerWidget` 조합 하나로 통일해요. 이 규약의 근거는 [`ADR-005 · Riverpod + MVVM`](../philosophy/adr-005-riverpod-mvvm.md) 참조.

---

## 기본 구조

```
features/<domain>/
├── <domain>_screen.dart         # UI 전용
├── <domain>_view_model.dart     # State 클래스 + ViewModel 클래스 + Provider
└── models/                       # (필요 시) 도메인 모델
```

---

## State 클래스

불변 데이터 클래스. `copyWith` 로 갱신.

```dart
class LoginState {
  final bool isLoading;
  final String? errorCode;     // ← i18n 키 or ErrorCode 상수
  final String? errorMessage;  // ← 서버 제공 메시지 (nullable)
  final LoginMode mode;

  const LoginState({
    this.isLoading = false,
    this.errorCode,
    this.errorMessage,
    this.mode = LoginMode.signIn,
  });

  LoginState copyWith({
    bool? isLoading,
    String? errorCode,
    String? errorMessage,
    LoginMode? mode,
  }) {
    return LoginState(
      isLoading: isLoading ?? this.isLoading,
      errorCode: errorCode,         // ← nullable 폴백 없이 그대로 받음
      errorMessage: errorMessage,   // ← null 로 clear 가능
      mode: mode ?? this.mode,
    );
  }
}
```

### copyWith 의 nullable 관용

```dart
// ❌ 잘못된 copyWith (에러를 지울 수 없음)
errorMessage: errorMessage ?? this.errorMessage

// ✅ 올바른 copyWith (null 로 명시적 clear 가능)
errorMessage: errorMessage
```

이유: `copyWith(errorMessage: null)` 로 에러 state 를 clear 하는 게 관용적. 기본값 폴백을 넣으면 이 시나리오가 안 돼요. 모든 nullable 필드는 this 폴백 없이 그대로 받기.

---

## ViewModel 클래스

`StateNotifier<TState>` 를 상속. 생성자에서 `Ref` 받기.

```dart
class LoginViewModel extends StateNotifier<LoginState> {
  final Ref _ref;

  LoginViewModel(this._ref) : super(const LoginState());

  Future<void> signInWithEmail(String email, String password) async {
    // 1. 로딩 시작 + 이전 에러 clear
    state = state.copyWith(
      isLoading: true,
      errorCode: null,
      errorMessage: null,
    );

    try {
      // 2. Service 호출
      await _ref.read(authServiceProvider).signInWithEmail(
        email: email,
        password: password,
      );
      // 3. 성공 → 로딩 해제
      state = state.copyWith(isLoading: false);
    } catch (e) {
      // 4. 실패 → code + message 저장
      state = state.copyWith(
        isLoading: false,
        errorCode: safeErrorCode(e, fallbackCode: 'LOGIN_FAILED'),
        errorMessage: safeErrorMessage(e),
      );
    }
  }

  void toggleMode() {
    state = state.copyWith(
      mode: state.mode == LoginMode.signIn ? LoginMode.signUp : LoginMode.signIn,
      errorCode: null,
      errorMessage: null,
    );
  }
}
```

### ViewModel 규칙

- **`BuildContext` 받지 않기** — UI 에 의존 금지. `S.of(context)` 도 금지 (i18n 은 Screen 에서)
- **`try/catch` 로 에러 처리** — `safeErrorCode` · `safeErrorMessage` 로 안전 추출 ([`ADR-009`](../philosophy/adr-009-backend-contract.md))
- **외부 서비스는 `_ref.read`** — 상태 변경 시점에만 조회 ([`ADR-007`](../philosophy/adr-007-late-binding.md))
- **`_ref.watch` 지양** — ViewModel 내부에서 watch 는 재생성 체인 복잡

---

## Provider 선언

`StateNotifierProvider.autoDispose` 기본. 같은 파일 하단에 선언.

```dart
final loginViewModelProvider = StateNotifierProvider.autoDispose<LoginViewModel, LoginState>(
  LoginViewModel.new,
);
```

### autoDispose 가 기본인 이유

- 화면 이탈 시 자동 정리 → 메모리 누수 방지
- 상태 재진입 시 **초기 상태로 시작** → 예전 에러 · 로딩 남아있음 방지

### autoDispose 예외 (전역 수명)

`authStateProvider` 같이 **앱 전체 수명** 상태는 autoDispose 안 함:

```dart
// lib/common/providers.dart 발췌
final authStateProvider = Provider<AuthStateNotifier>((ref) {
  final notifier = AuthStateNotifier();
  ref.onDispose(notifier.dispose);
  return notifier;
});
```

---

## Screen 구조

`ConsumerWidget`. `ref.watch` 로 상태 구독, `ref.read` 로 액션 호출.

```dart
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(loginViewModelProvider);
    final vm = ref.read(loginViewModelProvider.notifier);
    final s = S.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(s.login)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // 에러 배너
            if (state.errorCode != null)
              ErrorBanner(message: _localizedError(context, state.errorCode!)),

            // 입력 필드
            AppTextField(controller: _emailController, label: s.email),
            AppTextField(controller: _passwordController, label: s.password, obscureText: true),

            const SizedBox(height: 16),

            // 버튼 (로딩 상태 전달)
            PrimaryButton(
              label: s.signIn,
              loading: state.isLoading,                    // ← state 구독
              onPressed: () => vm.signInWithEmail(         // ← action 호출
                _emailController.text,
                _passwordController.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _localizedError(BuildContext context, String code) {
    final s = S.of(context);
    switch (code) {
      case 'LOGIN_FAILED': return s.loginFailed;
      case 'INVALID_CREDENTIALS': return s.invalidCredentials;
      case 'NETWORK_ERROR': return s.errorNetwork;
      default: return s.errorUnknown;
    }
  }
}
```

### Screen 규칙

- **`ref.watch` = 상태 구독** — 값 변경 시 리빌드
- **`ref.read` = 단발성 호출** — `.notifier` 로 ViewModel 메서드 호출할 때
- **`if (mounted)` 체크 불필요** — StatelessWidget 이므로 life cycle 간섭 없음
- **`StatefulWidget` 은 `TextEditingController` 등 controller 필요할 때만** — 그 외엔 `ConsumerWidget`

---

## Service 레이어

ViewModel 이 의존하는 로직. `lib/core/` 또는 `lib/kits/<kit>/` 에 정의.

```dart
// lib/kits/auth_kit/auth_service.dart 개요
class AuthService {
  final ApiClient _apiClient;
  final TokenStorage _tokenStorage;
  final AuthStateNotifier _authState;

  AuthService({
    required ApiClient apiClient,
    required TokenStorage tokenStorage,
    required AuthStateNotifier authState,
  }) : _apiClient = apiClient,
       _tokenStorage = tokenStorage,
       _authState = authState;

  Future<void> signInWithEmail({required String email, required String password}) async {
    final response = await _apiClient.post<AuthTokens>(
      '/auth/login',
      body: {'email': email, 'password': password},
      fromData: AuthTokens.fromJson,
    );
    final tokens = response.data!;
    await _tokenStorage.saveTokens(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
    final user = await fetchCurrentUser();
    _authState.emit(AuthState.authenticated(user));
  }

  // ...
}
```

Service 는 **Provider 를 모름** — 생성자로 의존성 주입받을 뿐. Provider 설정은 `providers.dart`:

```dart
// lib/common/providers.dart 발췌
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    apiClient: ref.watch(apiClientProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    authState: ref.watch(authStateProvider),
  );
});
```

---

## 전체 흐름 예시 (로그인)

```
LoginScreen 의 PrimaryButton onPressed
  ↓
ref.read(loginViewModelProvider.notifier).signInWithEmail(...)
  ↓
LoginViewModel.signInWithEmail()
  ↓ state = copyWith(isLoading: true)
  ↓ UI 자동 리빌드 → 버튼 스피너 표시
  ↓
_ref.read(authServiceProvider).signInWithEmail(email, password)
  ↓
AuthService → ApiClient.post('/auth/login', ...) → JWT 토큰 저장 → authState.emit(authenticated)
  ↓ (authState 변화 → go_router refreshListenable 트리거 → /home 으로 이동)
  ↓
LoginViewModel 로 복귀 → state = copyWith(isLoading: false)
```

에러 시:
```
AuthService 가 ApiException(code: 'INVALID_CREDENTIALS') throw
  ↓
LoginViewModel catch → state = copyWith(errorCode: 'INVALID_CREDENTIALS', errorMessage: '...')
  ↓ UI 리빌드 → ErrorBanner 표시 + 스피너 해제
```

---

## 자주 하는 실수

### ❌ ViewModel 에서 BuildContext 쓰기

```dart
// 금지
class BadViewModel extends StateNotifier<...> {
  Future<void> doSomething(BuildContext context) async {  // ← context 받지 말기
    ScaffoldMessenger.of(context).showSnackBar(...);      // ← 금지
  }
}
```

**올바르게**: ViewModel 은 state 에 `showSnackbar: true` 같은 플래그만 세팅. Screen 이 watch 해서 SnackBar 띄움.

### ❌ ViewModel 이 직접 ApiClient · SecureStorage 생성

```dart
// 금지
class BadViewModel extends StateNotifier<...> {
  final _client = ApiClient();  // ← 금지
  // ...
}
```

**올바르게**: 의존성은 `_ref.read` 또는 생성자 주입.

### ❌ copyWith 에 nullable 폴백

```dart
// 금지 — 에러를 clear 할 수 없음
state = state.copyWith(errorMessage: errorMessage ?? this.errorMessage);

// 올바르게
state = state.copyWith(errorMessage: errorMessage);  // null 도 값으로 받음
```

### ❌ Screen 에서 ViewModel 메서드 직접 정의

```dart
// 금지
class LoginScreen extends ConsumerWidget {
  Future<void> _handleSignIn() async {
    // 비즈니스 로직을 Screen 에
    await http.post(...);
  }
}
```

**올바르게**: 비즈니스 로직은 ViewModel 로. Screen 은 `vm.signInWithEmail()` 만 호출.

---

## 관련 문서

- [`naming.md`](./naming.md) — ViewModel · State · Provider 네이밍
- [`error-handling.md`](./error-handling.md) — ViewModel 의 `safeErrorCode` 사용
- [`ADR-005 · Riverpod + MVVM`](../philosophy/adr-005-riverpod-mvvm.md) — 이 규약의 근거
- [`ADR-007 · Late Binding`](../philosophy/adr-007-late-binding.md) — `ref.read` 사용의 근거
