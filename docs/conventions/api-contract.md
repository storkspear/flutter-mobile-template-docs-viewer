# API Contract — 백엔드 계약 요약

`template-spring` 백엔드와의 1:1 계약 한눈 요약. 상세는 [`docs/api-contract/`](../api-contract/) 의 4개 파일 참조.

> 본 문서는 **conventions 영역의 진입점**이에요. "API 호출 코드 작성 시 따라야 할 것 한 페이지 요약" 목적. 깊이 들어가려면 아래 cross-link 의 전용 문서로.

---

## 핵심 5가지

### 1. 응답 envelope: `{data, error}`

```json
// 성공
{ "data": { ... }, "error": null }

// 실패
{ "data": null, "error": { "code": "ATH_001", "message": "...", "details": {} } }
```

`data` 와 `error` 는 **상호 배타** — 동시에 존재 X. 상세 → [`response-schema.md`](../api-contract/response-schema.md).

### 2. 에러 코드: `<도메인약어>_<번호>` prefix

- `CMN_*` — 공통 (validation, not found, JWT access token 등)
- `ATH_*` — 인증 도메인 (credentials, refresh token, social 등)
- 클라 자체 코드 — `NETWORK_ERROR`, `TIMEOUT`, `UNKNOWN_ERROR`

전체 매핑 → [`error-codes.md`](../api-contract/error-codes.md).

### 3. 페이지네이션: `PageResponse<T>`

```json
{
  "content": [...],
  "page": 0,            // 0-based
  "size": 20,
  "totalElements": 153,
  "totalPages": 8
}
```

Spring `Page<T>` 와 1:1. 상세 → [`response-schema.md`](../api-contract/response-schema.md).

### 4. 인증: JWT Bearer + appSlug 검증

```
Authorization: Bearer <accessToken>
URL: /api/apps/{appSlug}/...
```

- access token 만료 (`CMN_007`) → 인터셉터가 자동 refresh
- refresh 실패 (`ATH_002`/`003`) → ViewModel 이 signOut 호출
- URL 의 `{appSlug}` 와 JWT payload 의 `appSlug` 가 백엔드에서 비교 (불일치 시 401)

상세 → [`auth-flow.md`](../api-contract/auth-flow.md), [`ADR-012`](../philosophy/adr-012-per-app-user.md).

### 5. 검색: `SearchRequest` DSL

```dart
final request = SearchRequestBuilder()
  .eq('category', 'food')
  .gte('amount', 1000)
  .page(0, 20)
  .sortBy('createdAt', SortDirection.desc)
  .build();

// path 는 base 만 — '/search' suffix 는 ApiClient 가 자동 prepend
final result = await api.search<Expense>(
  '/expenses',
  request: request,
  fromItem: Expense.fromJson,
);
```

11개 연산자 (`_eq`, `_not`, `_gte`, `_lte`, `_gt`, `_lt`, `_like`, `_in`, `_notIn`, `_isNull`, `_isNotNull` — between 은 gte+lte 조합). 상세 → [`search-request.md`](../api-contract/search-request.md).

---

## API 호출 패턴

```dart
// GET 단일 객체
final user = await api.get<User>(
  '/users/me',
  fromData: User.fromJson,
);

// GET 목록 (페이지네이션)
final page = await api.get<PageResponse<Expense>>(
  '/expenses',
  queryParameters: {'page': 0, 'size': 20},
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);

// POST 생성
final created = await api.post<Expense>(
  '/expenses',
  data: {'amount': 1500, 'category': 'food'},
  fromData: Expense.fromJson,
);

// 검색 (path 는 base — ApiClient 가 '/search' suffix 자동 추가)
final result = await api.search<Expense>(
  '/expenses',
  request: searchRequest,
  fromItem: Expense.fromJson,
);
```

`/api/apps/{appSlug}` prefix 는 `ApiClient` 가 자동 prepend. 상대 경로만 작성. 검색 호출 시 `'/search'` suffix 도 자동 — `'/expenses/search'` 처럼 직접 적으면 `'/expenses/search/search'` 로 중복 호출됨.

---

## 짝 동기화 매트릭스

Flutter ↔ Spring 양쪽 변경 영향:

| Flutter 파일 | Spring 파일 | 동기화 의무 |
|---|---|---|
| `lib/kits/backend_api_kit/api_response.dart` | `common-web/.../ApiResponse.java`, `PageResponse.java` | 필드 추가/제거 시 양쪽 |
| `lib/kits/backend_api_kit/error_code.dart` | `common-web/.../CommonError.java`, `core-auth-api/.../AuthError.java` | enum 추가/제거 시 양쪽 |
| `lib/kits/backend_api_kit/api_endpoints.dart` | `common-web/.../ApiEndpoints.java` | 경로 변경 시 양쪽 |
| `lib/kits/auth_kit/auth_service.dart` | `core-auth-impl/.../AuthController.java` | 인증 흐름 변경 시 양쪽 |

---

## 자주 빠지는 함정

1. **응답 파싱**: `data['accessToken']` 같이 root 에서 추출했는데 실제는 nested (`data['tokens']['accessToken']`). [auth-flow.md](../api-contract/auth-flow.md) 의 nested 구조 참조
2. **에러 코드 raw string 사용**: `if (e.code == 'INVALID_CREDENTIALS')` ❌ → `e.code == ErrorCode.invalidCredentials` ✓ (`'ATH_001'`)
3. **페이지 0/1-based 혼동**: 우리는 **0-based**. 첫 페이지 `page: 0`
4. **금액 부동소수점**: `double` 쓰면 정확도 깨짐 — 항상 정수 (원 단위) 사용
5. **날짜 timezone 누락**: 서버는 항상 UTC (`Z` 또는 `+00:00`) — 클라에서 `DateTime.parse()` 후 필요시 `toLocal()`
6. **search 와 query 혼동**: 단순 GET 은 `queryParameters` 인자, 조건 검색은 `search()` + `SearchRequestBuilder`

---

## 관련 문서 (api-contract/ 디렉토리)

| 파일 | 다루는 것 |
|---|---|
| [`api-contract/README.md`](../api-contract/README.md) | 디렉토리 인덱스 |
| [`api-contract/response-schema.md`](../api-contract/response-schema.md) | `{data, error}` · PageResponse · 필드 네이밍 |
| [`api-contract/error-codes.md`](../api-contract/error-codes.md) | CMN_* / ATH_* 전체 매핑 + i18n 매핑 |
| [`api-contract/auth-flow.md`](../api-contract/auth-flow.md) | 로그인 · refresh · withdraw 시퀀스 |
| [`api-contract/search-request.md`](../api-contract/search-request.md) | SearchRequestBuilder + 11개 연산자 |

## 관련 ADR

- [`ADR-009 · Backend Contract`](../philosophy/adr-009-backend-contract.md) — `{data, error}` 설계 결정
- [`ADR-010 · Queued Interceptor`](../philosophy/adr-010-queued-interceptor.md) — 401 자동 refresh
- [`ADR-011 · Interceptor Chain`](../philosophy/adr-011-interceptor-chain.md) — Auth/Error/Logging 3층 인터셉터
- [`ADR-012 · Per-App User`](../philosophy/adr-012-per-app-user.md) — appSlug 검증
