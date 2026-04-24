# Error Handling

모든 에러는 **`ApiException` 으로 표준화** 되어 ViewModel 에 도달해요. ViewModel 은 `safeErrorCode` · `safeErrorMessage` 로 안전 추출. UI 는 code 기반으로 i18n 번역. 이 규약의 근거는 [ADR-009](../philosophy/adr-009-backend-contract.md) · [ADR-010](../philosophy/adr-010-queued-interceptor.md) · [ADR-011](../philosophy/adr-011-interceptor-chain.md) 참조.

---

## 에러 흐름 (High-Level)

```
서버 응답 / 네트워크 실패
  ↓
Dio 의 DioException
  ↓
ErrorInterceptor → ApiException 으로 변환
  ↓
AuthInterceptor → 401 이면 refresh 시도 (성공 시 재시도, 실패 시 원 에러)
  ↓
LoggingInterceptor → debug 빌드만 콘솔 출력
  ↓
ViewModel 의 try/catch 블록에서 수신
  ↓
safeErrorCode(e) / safeErrorMessage(e) 로 추출
  ↓
state = copyWith(errorCode: ..., errorMessage: ...)
  ↓
Screen 이 state.errorCode 보고 i18n 번역 표시
```

---

## ApiException 구조

```dart
// lib/kits/backend_api_kit/api_exception.dart 발췌
class ApiException implements Exception {
  final String code;             // ← 서버 ErrorCode enum 문자열
  final String message;          // ← 서버 제공 메시지 (사용자 노출 가능)
  final int? statusCode;         // ← HTTP 상태 코드 (401, 500 등)
  final Map<String, dynamic>? details;

  factory ApiException.fromApiError(ApiError error, {int? statusCode}) => ...;
  factory ApiException.network([String? message]) => ...;
  factory ApiException.timeout() => ...;
  factory ApiException.unknown([String? message]) => ...;

  bool get isTokenExpired => code == 'TOKEN_EXPIRED';
  bool get isUnauthorized => code == 'UNAUTHORIZED' || statusCode == 401;
  bool get isValidationError => code == 'VALIDATION_ERROR';
}
```

### 생성 경로

| 상황 | factory | code |
|------|---------|------|
| 서버가 `{error: {...}}` 로 응답 | `fromApiError` | 서버 제공 (예: `INVALID_CREDENTIALS`) |
| 네트워크 연결 실패 | `network` | `NETWORK_ERROR` |
| 타임아웃 | `timeout` | `TIMEOUT` |
| 알 수 없는 에러 | `unknown` | `UNKNOWN_ERROR` |

---

## safeErrorCode / safeErrorMessage

ViewModel 이 catch 블록에서 사용. raw exception 의 stack · 내부 경로가 UI 로 유출되는 걸 차단.

```dart
// lib/kits/backend_api_kit/api_exception.dart 발췌
String safeErrorCode(Object e, {String fallbackCode = 'UNKNOWN_ERROR'}) {
  if (e is ApiException) return e.code;
  return fallbackCode;
}

String? safeErrorMessage(Object e) {
  if (e is ApiException) return e.message;
  return null;
}
```

### ViewModel 사용 패턴

```dart
Future<void> signInWithEmail(String email, String password) async {
  state = state.copyWith(isLoading: true, errorCode: null, errorMessage: null);
  try {
    await _ref.read(authServiceProvider).signInWithEmail(email: email, password: password);
    state = state.copyWith(isLoading: false);
  } catch (e) {
    state = state.copyWith(
      isLoading: false,
      errorCode: safeErrorCode(e, fallbackCode: 'LOGIN_FAILED'),  // ← code
      errorMessage: safeErrorMessage(e),                            // ← message (nullable)
    );
  }
}
```

### fallbackCode 선택 가이드

| 상황 | fallbackCode |
|------|-------------|
| 로그인 시도 | `'LOGIN_FAILED'` |
| 회원가입 시도 | `'SIGNUP_FAILED'` |
| 데이터 조회 | `'FETCH_FAILED'` |
| 저장 · 수정 | `'SAVE_FAILED'` |
| 삭제 | `'DELETE_FAILED'` |
| 범용 | `'UNKNOWN_ERROR'` (기본값) |

---

## ErrorCode 상수

서버 `ErrorCode` enum 과 **문자열 동일** 하게 관리. 자세한 건 [ADR-009](../philosophy/adr-009-backend-contract.md).

```dart
// lib/kits/backend_api_kit/error_code.dart 발췌
class ErrorCode {
  static const validationError = 'VALIDATION_ERROR';
  static const unauthorized = 'UNAUTHORIZED';
  static const tokenExpired = 'TOKEN_EXPIRED';
  static const invalidCredentials = 'INVALID_CREDENTIALS';
  static const emailAlreadyExists = 'EMAIL_ALREADY_EXISTS';
  // ...
}
```

### ErrorCode 비교 (if 분기)

```dart
if (state.errorCode == ErrorCode.invalidCredentials) {
  // 로그인 실패 특별 처리
}
```

switch 쓰지 않는 이유: Dart enum 이 아니라 static const String. switch 는 컴파일 타임 constant 비교라 가능하지만 `if` 가 관용.

---

## Screen 에서 i18n 변환

ViewModel 은 code 만, Screen 이 번역. [ADR-016 · i18n 처음부터](../philosophy/adr-016-i18n-from-start.md) 참조.

```dart
// Screen 의 helper
String _localizedError(BuildContext context, String code) {
  final s = S.of(context);
  switch (code) {
    case ErrorCode.invalidCredentials: return s.errorInvalidCredentials;
    case ErrorCode.tokenExpired: return s.errorTokenExpired;
    case ErrorCode.emailAlreadyExists: return s.errorEmailAlreadyExists;
    case 'LOGIN_FAILED': return s.errorLoginFailed;
    case 'NETWORK_ERROR': return s.errorNetwork;
    case 'TIMEOUT': return s.errorTimeout;
    default: return s.errorUnknown;
  }
}
```

### 서버 `message` 를 직접 쓸 vs i18n 번역

두 옵션:

**Option A — 서버 message 그대로** (간단):
```dart
Text(state.errorMessage ?? s.errorUnknown)
```
- 장점: Screen 의 `_localizedError` 불필요.
- 단점: 서버 메시지가 **한국어 고정** — 다국어 지원 안 됨.

**Option B — code 기반 i18n** (다국어):
```dart
Text(state.errorCode != null ? _localizedError(context, state.errorCode!) : '')
```
- 장점: 영어 · 일본어 · 스페인어 대응 가능.
- 단점: ARB 에 에러 키 추가 필요.

**권장**: 단일 언어 앱은 Option A, 다국어 앱은 Option B. 템플릿은 Option B 를 기본 관용으로 해두되 Option A 도 허용.

---

## 401 자동 refresh (AuthInterceptor 의 동작)

[ADR-010](../philosophy/adr-010-queued-interceptor.md) 참조.

```
ApiClient.get('/users/me')
  ↓ Authorization: Bearer <access>
  ↓ 서버 응답 401
  ↓
AuthInterceptor.onError 가 감지
  ↓
onTokenRefresh() 호출 → authService.refreshToken() 실행
  ↓ 성공: 새 access token 저장 → 원 요청 재시도 → 200
  ↓ 실패: 원 401 전파 → ViewModel 이 수신
```

ViewModel 은 **401 / refresh 실패를 구분 안 함** — `ApiException(code: 'UNAUTHORIZED')` 으로 받으면 signOut 결정.

```dart
// 일반 API 호출은 토큰 걱정 없음 — 인터셉터가 자동
Future<void> loadProfile() async {
  try {
    final user = await _ref.read(userRepositoryProvider).getCurrentUser();
    state = state.copyWith(user: user);
  } catch (e) {
    if (e is ApiException && e.isUnauthorized) {
      // refresh 마저 실패 → 강제 로그아웃
      await _ref.read(authServiceProvider).signOut();
    } else {
      state = state.copyWith(errorCode: safeErrorCode(e));
    }
  }
}
```

---

## 인터셉터 순서 (ApiClient 내부)

[ADR-011](../philosophy/adr-011-interceptor-chain.md) 참조.

```dart
// lib/kits/backend_api_kit/api_client.dart 발췌
_dio.interceptors.addAll([
  AuthInterceptor(...),       // 1. 토큰 첨부 + 401 refresh
  ErrorInterceptor(),         // 2. DioException → ApiException
  if (kDebugMode) LoggingInterceptor(),  // 3. debug 만 로깅
]);
```

개발자가 직접 순서 바꾸면 안 돼요. 이 순서가 refresh · error 변환 흐름의 전제.

---

## skipAuth 플래그 (비로그인 요청)

로그인 · 가입 · 비번 찾기 요청은 **토큰 우회** 필요. `ApiClient.postRaw` 같은 API 가 내부적으로 `skipAuth: true` 설정.

```dart
// ApiClient 의 API
await api.postRaw<AuthTokens>(
  '/auth/login',
  body: {'email': email, 'password': password},
  fromData: AuthTokens.fromJson,
);
// → 내부적으로 RequestOptions.extra['skipAuth'] = true
// → AuthInterceptor 가 감지 → 토큰 첨부 건너뜀
```

---

## 자주 하는 실수

### ❌ raw exception 을 state.errorMessage 에 넣기

```dart
// 금지 — stack · 내부 경로가 UI 로 유출
state = state.copyWith(errorMessage: e.toString());
```

**올바르게**:
```dart
state = state.copyWith(
  errorCode: safeErrorCode(e),
  errorMessage: safeErrorMessage(e),
);
```

### ❌ 서버 메시지 하드코딩 번역

```dart
// 금지 — 번역 일관성 깨짐
if (state.errorMessage?.contains('invalid') ?? false) {
  Text('로그인 정보를 확인해주세요');
}
```

**올바르게**: code 로 분기.
```dart
if (state.errorCode == ErrorCode.invalidCredentials) {
  Text(s.errorInvalidCredentials);
}
```

### ❌ 인터셉터가 signOut 직접 호출

```dart
// 금지 (AuthInterceptor 내부)
if (refreshFailed) {
  await authService.signOut();  // ← 인프라 레이어가 비즈니스 결정
}
```

**올바르게**: 원 401 전파 → ViewModel 이 상황 판단 후 signOut.

### ❌ switch 의 default 누락

```dart
// 금지
switch (errorCode) {
  case ErrorCode.invalidCredentials: return '...';
  // default 없음 → 새 코드 추가 시 빈 문자열
}
```

**올바르게**:
```dart
switch (errorCode) {
  case ErrorCode.invalidCredentials: return s.errorInvalidCredentials;
  // ...
  default: return s.errorUnknown;
}
```

---

## 관련 문서

- [`viewmodel-mvvm.md`](./viewmodel-mvvm.md) — ViewModel 의 try/catch 패턴
- [`i18n.md`](./i18n.md) — 에러 메시지 키 관리
- [ADR-009 · 백엔드 응답 1:1 계약](../philosophy/adr-009-backend-contract.md) — `ApiException` 계약 근거
- [ADR-010 · QueuedInterceptor 로 401 자동 갱신](../philosophy/adr-010-queued-interceptor.md) — refresh 흐름
- [ADR-011 · 3층 인터셉터 체인](../philosophy/adr-011-interceptor-chain.md) — 인터셉터 순서
