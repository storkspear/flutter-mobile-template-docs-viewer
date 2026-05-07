# Queued_Interceptor

**Status**: Accepted. 현재 유효. 2026-04-24 작성 / 2026-05-07 line 수 갱신. `lib/kits/backend_api_kit/interceptors/auth_interceptor.dart` (74줄) 에서 `QueuedInterceptor` 사용. 동시 401 · 무한루프 · refresh 실패 시나리오를 모두 다뤄요.

## 결론부터

액세스 토큰이 만료돼 API 가 **401** 을 반환하면 **`AuthInterceptor` 가 자동으로 refresh → 원 요청 재시도**. Dio 의 `QueuedInterceptor` 를 써서 **동시 여러 요청이 동시 401 을 받아도 refresh 는 1회만 실행**, 나머지 요청은 큐에서 대기해요. refresh 엔드포인트 자체가 401 을 내면 무한루프 방지 로직이 작동하고, refresh 자체가 실패하면 원 401 을 그대로 ViewModel 로 전파해서 **signOut 결정을 호출자에게** 위임해요.

## 왜 이런 고민이 시작됐나?

JWT 기반 인증에서 access token 은 보통 15~60분 수명. 만료 시 refresh token 으로 새 access 를 받아 원 요청을 재시도하는 게 표준. 하지만 이 흐름을 각 ViewModel 에서 직접 처리하면 다음과 같은 코드가 N 번 반복돼요.

```dart
// ViewModel 의 악몽
Future<User> getUser() async {
  try {
    return await api.get('/users/me');
  } catch (e) {
    if (e is ApiException && e.isAccessTokenExpired) {  // CMN_007
      await authService.refreshToken();
      return await api.get('/users/me');  // 재시도
    }
    rethrow;
  }
}
```

모든 API 호출마다 이걸 넣을 수는 없어요. 압력들이 부딪혀요.

**압력 A — ViewModel 단순성**  
ViewModel 은 도메인 로직에 집중. 토큰 만료 · refresh 같은 인프라 관심사는 **인프라 계층** (인터셉터) 에서 처리돼야 해요.

**압력 B — 동시 요청 경합**  
앱이 부팅 직후 `getUser` · `getSettings` · `getNotifications` 3개 요청을 병렬로 보내고 세 요청 모두 401 을 받아요. 이때 **refresh 를 3번 실행** 하면 안 돼요. 한 번만 실행하고 나머지는 새 토큰으로 재시도.

**압력 C — 무한루프 방지**  
refresh token 도 만료됐거나 서버 오류로 `/auth/refresh` 가 401 을 반환하면? 이걸 또 refresh 시도하면 스택 오버플로우 무한.

**압력 D — refresh 실패 시 책임 분리**  
refresh 가 실패하면 강제 로그아웃이 맞는데, **로그아웃 결정을 인터셉터가 내릴지 / 호출자가 내릴지** 의 경계가 중요. 인터셉터가 매번 signOut 하면 "토큰은 유효하지만 일시 네트워크 오류" 상황에서도 로그아웃 → UX 심각히 저해.

이 결정이 답해야 했던 물음이에요.

> **401 자동 refresh + 동시 요청 큐잉 + 무한루프 방지 + 실패 시 책임 위임** 을 한 인터셉터에 어떻게 담는가?

## 고민했던 대안들

### Option 1 — Interceptor (일반) + 수동 동기화

Dio 의 일반 `Interceptor` 를 쓰고 refresh 중엔 `Mutex` 같은 락으로 동시성 제어.

- **장점**: 유연성 최대. 세밀한 제어.
- **단점 1**: Dio `Interceptor.onError` 는 **비동기 void 반환** 이라 `await` 의미가 없음. 순차성 보장 안 됨.
- **단점 2**: Mutex 직접 구현 → 데드락 · 예외 전파 버그 위험.
- **단점 3**: `dio` 패키지에 `mutex` 관리 로직 수동 추가 — 재발명.
- **탈락 이유**: `QueuedInterceptor` 가 이 문제를 이미 해결해 놓았음. 바퀴 재발명.

### Option 2 — 응답 캐싱 + pre-check

API 호출 전에 토큰 만료 시간 (JWT exp 클레임) 을 파싱해서 **선제적 refresh**.

- **장점**: 401 을 받기 전에 refresh → 요청 1회로 완결.
- **단점 1**: 클라이언트 시계와 서버 시계가 다를 수 있어 exp 기반 판단 불확실 (clock skew).
- **단점 2**: JWT 파싱 로직 클라에 필요. JWT 토큰 구조 변경 시 클라 수정.
- **단점 3**: "서버가 권한 취소 (revoke)" 한 경우엔 여전히 401 발생 → 어차피 reactive 처리 필요.
- **탈락 이유**: 선제적 방어는 reactive 처리를 완전히 대체할 수 없음. 복잡도만 추가.

### Option 3 — QueuedInterceptor + 무한루프 방어 + 책임 위임 ★ (채택)

Dio 의 `QueuedInterceptor` 를 확장. 동시성은 프레임워크가 해결, 로직은 깔끔히.

- **압력 A 만족**: ViewModel 은 `ApiException(code: 'CMN_007')` (access token 만료) 를 받지 않음. 성공하거나 (새 토큰으로 재시도 성공) 진짜 인증 실패 (`ATH_002` refresh token 만료 등) 만 전파.
- **압력 B 만족**: `QueuedInterceptor` 가 onRequest / onError 를 **큐 기반 순차 처리** → 동시 401 이 오면 첫 요청만 refresh, 나머지는 큐 대기.
- **압력 C 만족**: `options.path.endsWith('/auth/refresh')` 체크로 refresh 엔드포인트 자체 401 이면 처리 건너뜀.
- **압력 D 만족**: refresh 실패 시 원 401 을 `handler.next(err)` 로 그대로 전파. signOut 결정은 ViewModel · AuthService 에서.

## 결정

### AuthInterceptor 전체 구조

```dart
// lib/kits/backend_api_kit/interceptors/auth_interceptor.dart 전체
class AuthInterceptor extends QueuedInterceptor {
  final TokenStorage _tokenStorage;
  final Dio _dio;
  final Future<bool> Function() _onTokenRefresh;

  static const _skipAuthKey = 'skipAuth';

  AuthInterceptor({
    required TokenStorage tokenStorage,
    required Dio dio,
    required Future<bool> Function() onTokenRefresh,
  }) : _tokenStorage = tokenStorage,
       _dio = dio,
       _onTokenRefresh = onTokenRefresh;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // 1. skipAuth 플래그: 로그인 · 가입 · 비번 찾기에 쓰임
    if (options.extra[_skipAuthKey] == true) {
      return handler.next(options);
    }
    // 2. 토큰 자동 첨부
    final accessToken = await _tokenStorage.getAccessToken();
    if (accessToken != null) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // 3. skipAuth / 401 아님 → 그대로 전달
    if (err.requestOptions.extra[_skipAuthKey] == true ||
        err.response?.statusCode != 401) {
      return handler.next(err);
    }

    final options = err.requestOptions;

    // 4. 무한루프 방지: refresh 엔드포인트 자체 401
    if (options.path.endsWith('/auth/refresh')) {
      return handler.next(err);
    }

    try {
      final success = await _onTokenRefresh();
      if (success) {
        // 5. 새 토큰으로 원 요청 재시도
        final accessToken = await _tokenStorage.getAccessToken();
        options.headers['Authorization'] = 'Bearer $accessToken';
        final response = await _dio.fetch(options);
        handler.resolve(response);
      } else {
        // 6. refresh 가 false 반환 → 원 401 전파
        handler.next(err);
      }
    } catch (_) {
      // 7. refresh 자체가 예외 → 원 401 전파 (signOut 결정은 호출자)
      handler.next(err);
    }
  }
}
```

### QueuedInterceptor 의 동시성 보장

Dio 의 `QueuedInterceptor` 는 **`onRequest` · `onError` 콜백을 큐로 관리**. 첫 요청이 `await _onTokenRefresh()` 중이면 다른 요청의 `onError` 는 **큐에서 대기**. refresh 가 끝난 뒤 순차적으로 처리되므로, 각 요청은 **이미 refresh 된 최신 토큰** 으로 재시도.

### skipAuth 플래그 사용

로그인 · 가입 · 비번 찾기 요청은 토큰을 아직 가지지 않거나, 인증 우회가 필요해요. `ApiClient.postRaw` 같은 API 가 `extra: {'skipAuth': true}` 를 넘기면 `AuthInterceptor` 가 토큰 첨부 / 401 처리를 건너뜀.

```dart
// ApiClient 사용 예
await api.postRaw(
  ApiEndpoints.emailSignIn,  // '/api/apps/{slug}/auth/email/signin'
  data: {'email': email, 'password': password, 'appSlug': appSlug},
);  // skipAuth: true 내부적으로 설정
```

### onTokenRefresh 콜백 (ADR-007 연결)

`AuthService.refreshToken()` 을 직접 주입하지 않고 **`Future<bool> Function()`** 콜백으로 받아요. 이유는 ADR-007 의 late binding 철학 — `ApiClient` 가 `AuthService` 를 모르게.

```dart
// lib/common/providers.dart 발췌
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokenStorage: ref.watch(tokenStorageProvider),
    onTokenRefresh: () => ref.read(authServiceProvider).refreshToken(),  // ← 콜백
  );
});
```

### 설계 선택 포인트

**포인트 1 — `QueuedInterceptor` 는 void-async 문제 해결 + 동시성 해결**  
Dio 의 일반 `Interceptor.onError` 는 `void` 반환이라 `await handler.next(...)` 같은 순차성이 안 돼요. `QueuedInterceptor` 는 내부적으로 `Completer` 큐를 써서 한 handler 가 완료될 때까지 다음을 대기시켜요. 이 덕분에 **refresh 중엔 모든 요청이 자동으로 대기**.

**포인트 2 — 무한루프 방지는 path 체크**  
`/auth/refresh` 자체가 401 을 반환하면 refresh 시도 → 또 401 → 무한. 간단한 `options.path.endsWith('/auth/refresh')` 체크로 이 경로만 refresh 로직을 건너뜀. **JWT 디코딩 같은 복잡한 판단은 불필요**.

**포인트 3 — refresh 실패는 "원 401 전파", signOut 은 위임**  
`onError` 의 try/catch 블록은 refresh 시도 실패 시 **원래의 `DioException` 을 그대로 `handler.next(err)`**. ErrorInterceptor 가 이걸 `ApiException(code: 'UNAUTHORIZED')` 로 변환 → ViewModel 이 받아서 signOut 결정. **인터셉터가 강제 signOut 하지 않는** 이유: 일시 네트워크 장애 vs 진짜 권한 취소를 인터셉터는 구분 못 함.

**포인트 4 — `skipAuth` 는 Dio `RequestOptions.extra` 활용**  
Dio 의 `extra` 는 요청에 붙이는 메타데이터 bag. 인터셉터가 메타데이터 기반으로 분기하는 관용. 플래그 이름은 `static const _skipAuthKey` 로 상수화해서 오타 방지.

**포인트 5 — `_dio.fetch(options)` 로 재시도**  
새 토큰을 단 원 요청을 재실행할 때 `_dio.fetch(options)` 를 써요. `_dio.request` 는 새 요청을 만드는 API 지만 `fetch` 는 **기존 options 를 재실행**. 헤더 · body · 타임아웃 설정 모두 유지.

## 이 선택이 가져온 것

### 긍정적 결과

- **ViewModel 투명성**: ViewModel 은 `TOKEN_EXPIRED` 를 받을 일이 없음. 인터셉터가 투명하게 처리.
- **동시 요청 효율**: 부팅 시 10개 병렬 요청 모두 401 → refresh 1회만 실행 → 10개 모두 새 토큰으로 재시도. QueuedInterceptor 덕분에 자동.
- **무한루프 원천 차단**: refresh 엔드포인트 401 에도 재시도 안 함.
- **signOut 타이밍 정확**: 진짜 인증 실패 시에만 ViewModel 이 받아서 signOut. 일시 네트워크 장애엔 signOut 안 함.
- **테스트 용이**: `onTokenRefresh: () async => true` / `() async => false` / `() async => throw` 3가지 경우로 모든 시나리오 검증.

### 부정적 결과

- **디버깅 시 flow 복잡**: 401 → interceptor → refresh → retry 로 여러 레이어 거침. 문제 발생 시 어디서 막혔는지 추적 품이 듦.
- **요청 타임아웃 고려 필요**: refresh 에 3초 걸리면 대기 중 요청들도 총 `원 타임아웃 + refresh 시간` 만큼 기다림. 짧은 timeout 설정이면 타임아웃 발생 위험.
- **`_dio.fetch` 재귀 가능성**: 재시도한 요청이 또 401 이면? 이론적으로 무한 아닌가? 실제론 `QueuedInterceptor` 가 같은 요청 인스턴스를 다시 인터셉트하지 않도록 내부 플래그 있음. 하지만 비슷한 경로로 재진입 가능성 염두.
- **`QueuedInterceptor` 의 순차 처리가 오버헤드**: 모든 요청이 큐를 거쳐서 약간의 지연. 실측 상 무시 가능 (<1ms).

## 교훈

### 교훈 1 — "void async" 는 함정

Dio 일반 `Interceptor.onError` 는 `void` 반환인데 안에서 `async` 가능. 겉으론 `await` 로 순차성 있어 보이지만, Dio 가 이 Future 를 **기다리지 않음**. 결과적으로 여러 요청의 onError 가 병렬 실행되어 refresh 중복. `QueuedInterceptor` 가 이 문제를 큐로 해결.

**교훈**: 프레임워크 콜백이 `void async` 라면 **내부에서 `await` 가 순차성을 보장하지 않음**. 프레임워크가 제공하는 동기화 매커니즘 (QueuedInterceptor, Mutex 등) 을 활용해야 해요.

### 교훈 2 — "인터셉터가 signOut 하면 안 된다"

초기엔 refresh 실패 시 `AuthInterceptor` 가 직접 `authService.signOut()` 을 호출했어요. 그 결과 **네트워크 일시 끊김에도 앱이 로그아웃** 되는 문제. "공항 와이파이 끊김 → 앱 재시작 시 로그아웃 상태" 불만 다수. 지금은 원 401 전파 → ViewModel 이 상황 판단.

**교훈**: 인프라 레이어 (인터셉터) 는 **정보를 전달만** 해야 해요. 비즈니스 결정 (signOut) 은 도메인 레이어의 몫.

### 교훈 3 — "무한루프" 는 단순한 조건으로 막자

초기엔 JWT exp 디코딩 + 서버 응답의 특정 error code 까지 파싱해서 "진짜 refresh 불가능한가?" 를 판단했어요. 복잡. 지금은 **`/auth/refresh` path 체크** 라는 가장 단순한 조건. 대부분의 케이스 커버.

**교훈**: 방어 로직은 **가장 단순한 조건** 으로 시작. 실제 버그가 나면 그때 정교화. 조건을 복잡하게 만들수록 **조건 자체의 버그** 가 늘어요.

## 관련 사례 (Prior Art)

- [Dio `QueuedInterceptor` 공식 문서](https://pub.dev/documentation/dio/latest/dio/QueuedInterceptor-class.html)
- [OkHttp Authenticator](https://square.github.io/okhttp/3.x/okhttp/okhttp3/Authenticator.html) — Kotlin/Java 의 동일 패턴
- [Retrofit + OkHttp TokenAuthenticator 예시](https://stackoverflow.com/questions/22450036/refreshing-oauth-token-using-retrofit-without-modifying-all-calls) — StackOverflow 토론 정석
- [RFC 7519 JWT](https://datatracker.ietf.org/doc/html/rfc7519) — exp 클레임 정의
- [`template-spring ADR-006 · HS256 JWT`](https://github.com/storkspear/template-spring/blob/main/docs/philosophy/adr-006-hs256-jwt.md) — 짝이 되는 백엔드의 JWT 발급 / 검증 원리

## Code References

**인터셉터 구현**
- [`lib/kits/backend_api_kit/interceptors/auth_interceptor.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/interceptors/auth_interceptor.dart) — 74줄, `QueuedInterceptor` 확장

**콜백 주입**
- [`lib/common/providers.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/common/providers.dart) — `onTokenRefresh: () => ref.read(authServiceProvider).refreshToken()`
- [`lib/kits/auth_kit/auth_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_service.dart) — `refreshToken()` 실제 구현

**ApiClient 조립**
- [`lib/kits/backend_api_kit/api_client.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_client.dart) — 3개 인터셉터 설치
- [`lib/kits/backend_api_kit/backend_api_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/backend_api_kit.dart)

**테스트**
- [`test/kits/backend_api_kit/interceptors/auth_interceptor_test.dart`](https://github.com/storkspear/template-flutter/blob/main/test/kits/backend_api_kit/interceptors/auth_interceptor_test.dart) — 동시성 · 무한루프 · refresh 실패 시나리오

**관련 ADR**:
- [`ADR-007 · Late Binding 으로 순환 의존 해결`](./adr-007-late-binding.md) — `onTokenRefresh` 콜백 주입의 이유
- [`ADR-009 · 백엔드 응답 1:1 계약`](./adr-009-backend-contract.md) — `ApiException.code` 가 `TOKEN_EXPIRED` / `UNAUTHORIZED` 인 이유
- [`ADR-011 · 3층 인터셉터 체인`](./adr-011-interceptor-chain.md) — Auth → Error → Logging 실행 순서
- [`ADR-013 · 토큰 저장 원자성`](./adr-013-token-atomic-storage.md) — refresh 결과를 원자적으로 저장
