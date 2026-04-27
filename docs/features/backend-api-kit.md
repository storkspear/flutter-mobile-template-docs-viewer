# backend_api_kit

**Dio 기반 HTTP 클라이언트 + 3 인터셉터**. JWT 인증 · 에러 변환 · 로깅. 백엔드 연동 앱이면 반드시 활성화.

---

## 개요

- **Dio** 클라이언트 하나 (`ApiClient`) 로 모든 HTTP 요청
- **3 인터셉터** 자동 설치: Auth (토큰) · Error (예외 변환) · Logging (debug 만)
- **응답 스키마**: 백엔드 `{data, error}` 1:1 대응 ([`ADR-009`](../philosophy/adr-009-backend-contract.md))
- **SSL pinning** opt-in (`--dart-define=SSL_PINS=...`) ([`ADR-020`](../philosophy/adr-020-security-hardening.md))

---

## 활성화

```yaml
# app_kits.yaml
kits:
  backend_api_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  BackendApiKit(),
  // ...
]);
```

### AppConfig 설정 필수

```dart
AppConfig.init(
  appSlug: 'my-app',
  baseUrl: 'https://api.example.com',  // ← backend_api_kit 이 이 값 사용
  // ...
);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `ApiClient` | Dio 래퍼. `get` · `post` · `postRaw` · `delete` |
| `AuthInterceptor` | Authorization 자동 첨부 + 401 refresh ([`ADR-010`](../philosophy/adr-010-queued-interceptor.md)) |
| `ErrorInterceptor` | `DioException` → `ApiException` 변환 |
| `LoggingInterceptor` | Debug 빌드 콘솔 로깅 |
| `ApiResponse<T>` · `PageResponse<T>` | 응답 래퍼 |
| `ApiException` | 표준 예외 + `safeErrorCode` · `safeErrorMessage` |
| `ErrorCode` 상수 | 서버 enum 1:1 매핑 |
| `SearchRequest` · `SearchRequestBuilder` | 검색 · 페이지네이션 DSL |
| `SslPinning` | opt-in SHA-256 핀 검증 |

---

## 핵심 API

### ApiClient

```dart
// GET
final response = await api.get<User>(
  '/users/me',
  fromData: User.fromJson,
);
final user = response.data!;  // User 타입

// POST
final created = await api.post<Expense>(
  '/expenses',
  body: expense.toJson(),
  fromData: Expense.fromJson,
);

// 페이지네이션
final page = await api.get<PageResponse<Expense>>(
  '/expenses',
  query: {'page': 0, 'size': 20},
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);
page.data!.hasNextPage  // bool

// 인증 우회 (로그인 · 가입 · 비번 찾기)
await api.postRaw<AuthTokens>(
  '/auth/login',
  body: {'email': email, 'password': password},
  fromData: AuthTokens.fromJson,
);
// → skipAuth: true 자동 설정
```

### SearchRequestBuilder

```dart
final request = SearchRequest.builder()
  .eq('categoryId', 5)
  .gte('amount', 10000)
  .like('title', '%커피%')
  .inList('status', ['active', 'pending'])
  .build();

final results = await api.post<PageResponse<Expense>>(
  '/expenses/search',
  body: request.toJson(),
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);
```

---

## 일반 사용 예

### Repository 패턴

```dart
// features/expense/expense_repository.dart
class ExpenseRepository {
  final ApiClient _api;
  ExpenseRepository({required ApiClient api}) : _api = api;

  Future<Expense> getById(int id) async {
    final res = await _api.get<Expense>('/expenses/$id', fromData: Expense.fromJson);
    return res.data!;
  }

  Future<PageResponse<Expense>> list({int page = 0}) async {
    final res = await _api.get<PageResponse<Expense>>(
      '/expenses',
      query: {'page': page, 'size': 20},
      fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
    );
    return res.data!;
  }

  Future<void> delete(int id) async {
    await _api.delete('/expenses/$id');
  }
}

final expenseRepositoryProvider = Provider<ExpenseRepository>((ref) {
  return ExpenseRepository(api: ref.watch(apiClientProvider));
});
```

### ViewModel 에서

```dart
class ExpenseListViewModel extends StateNotifier<ExpenseListState> {
  final Ref _ref;
  ExpenseListViewModel(this._ref) : super(const ExpenseListState());

  Future<void> load() async {
    state = state.copyWith(isLoading: true);
    try {
      final page = await _ref.read(expenseRepositoryProvider).list();
      state = state.copyWith(isLoading: false, items: page.content);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorCode: safeErrorCode(e, fallbackCode: 'FETCH_FAILED'),
      );
    }
  }
}
```

---

## 파생 레포 체크리스트

- [ ] `AppConfig.baseUrl` 설정
- [ ] (선택) SSL pinning 활성화 → `--dart-define=SSL_PINS=sha256/AAA=,sha256/BBB=`
- [ ] (선택) 백엔드에서 `SearchRequest` 스펙 확인 — 필드명 · 연산자
- [ ] `auth_kit` 과 함께 쓰면 `requires` 검증 자동

---

## Code References

- [`lib/kits/backend_api_kit/api_client.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_client.dart)
- [`lib/kits/backend_api_kit/api_response.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_response.dart)
- [`lib/kits/backend_api_kit/api_exception.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_exception.dart)
- [`lib/kits/backend_api_kit/error_code.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/error_code.dart)
- [`lib/kits/backend_api_kit/interceptors/`](https://github.com/storkspear/template-flutter/tree/main/lib/kits/backend_api_kit/interceptors) — 3개 인터셉터
- [`lib/kits/backend_api_kit/search_request.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/search_request.dart)

---

## 관련 문서

- [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md)
- [`ADR-010 · 401 자동 갱신`](../philosophy/adr-010-queued-interceptor.md)
- [`ADR-011 · 인터셉터 체인`](../philosophy/adr-011-interceptor-chain.md)
- [`Error Handling`](../conventions/error-handling.md)
