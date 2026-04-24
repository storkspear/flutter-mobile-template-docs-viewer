# Response Schema

모든 API 응답은 **`{data, error}`** 상호 배타적 구조. 페이지네이션은 **`PageResponse<T>`** 표준.

---

## ApiResponse<T>

### 성공

```json
{
  "data": {
    "id": 42,
    "title": "..."
  },
  "error": null
}
```

### 실패

```json
{
  "data": null,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다",
    "details": {
      "field": "email"
    }
  }
}
```

### 규칙

- `data` 와 `error` 는 **동시에 존재하지 않음**
- 성공 시 `error: null`, 실패 시 `data: null`
- `details` 는 선택 — 검증 에러 · 부가 정보

### Dart

```dart
class ApiResponse<T> {
  final T? data;
  final ApiError? error;
  bool get isSuccess => error == null;
  bool get isError => error != null;

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic)? fromData);
}

class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
}
```

상세: [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md)

---

## PageResponse<T>

Spring Boot `Page<T>` 1:1 매핑.

### JSON

```json
{
  "data": {
    "content": [
      { "id": 1, "title": "..." },
      { "id": 2, "title": "..." }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 153,
    "totalPages": 8
  },
  "error": null
}
```

### Dart

```dart
class PageResponse<T> {
  final List<T> content;
  final int page;             // 0-based
  final int size;
  final int totalElements;
  final int totalPages;

  bool get isEmpty => content.isEmpty;
  bool get isLastPage => page >= totalPages - 1;
  bool get hasNextPage => !isLastPage;

  factory PageResponse.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) fromItem);
}
```

### 사용 예

```dart
final page = await api.get<PageResponse<Expense>>(
  '/expenses',
  query: {'page': 0, 'size': 20},
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);

for (final expense in page.data!.content) {
  // ...
}

if (page.data!.hasNextPage) {
  // 다음 페이지 로드
}
```

---

## 필드 네이밍

**camelCase**. snake_case 금지.

```json
// ✅ 올바른 예
{
  "userId": 42,
  "createdAt": "2026-04-24T12:34:56Z",
  "expenseDate": "2026-04-24"
}

// ❌ 금지
{
  "user_id": 42,
  "created_at": "..."
}
```

### 날짜 · 시간

- **ISO 8601 UTC** (Z 접미사 또는 `+00:00`)
- Dart: `DateTime.parse(...)` 로 자동 UTC 인식

### 숫자

- **원시 타입** (int · double) — JSON number
- 금액: **정수 (원 단위)** 권장 — 부동소수점 정확도 문제 회피. `int amount` (예: 1500 = 1,500원)

---

## 짝 스키마 동기화

| 프론트 | 백엔드 |
|--------|--------|
| `lib/kits/backend_api_kit/api_response.dart` | `common-web/.../ApiResponse.java` |
| `lib/kits/backend_api_kit/api_response.dart` | `common-web/.../PageResponse.java` |

---

## 관련 문서

- [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md)
- [`error-codes.md`](./error-codes.md)
- [`search-request.md`](./search-request.md)
