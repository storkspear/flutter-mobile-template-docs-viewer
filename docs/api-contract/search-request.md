# Search Request

검색 · 필터링 · 정렬 요청 DSL. `SearchRequest` 가 양쪽 레포에서 동일한 포맷.

---

## 기본 포맷

`conditions` 는 **`<field>_<op>` 키를 가진 Map**. `page` 는 nested 객체. `direction` 은 대문자.

```json
{
  "conditions": {
    "categoryId_eq": 5,
    "amount_gte": 10000,
    "title_like": "커피"
  },
  "page": { "page": 0, "size": 20 },
  "sort": [
    { "field": "expenseDate", "direction": "DESC" }
  ]
}
```

---

## 연산자 (key suffix)

| 빌더 메서드 | key suffix | 의미 | 값 타입 |
|-----|-----|------|---------|
| `eq` | `_eq` | equal | scalar |
| `notEq` | `_not` | not equal | scalar |
| `gt` | `_gt` | greater than | number/date |
| `gte` | `_gte` | greater or equal | number/date |
| `lt` | `_lt` | less than | number/date |
| `lte` | `_lte` | less or equal | number/date |
| `like` | `_like` | SQL LIKE (SQL `%` 와일드카드) | string |
| `isIn` | `_in` | IN list | array |
| `notIn` | `_notIn` | NOT IN | array |
| `isNull` | `_isNull` | IS NULL | (true 고정) |
| `isNotNull` | `_isNotNull` | IS NOT NULL | (true 고정) |

> `between` 은 별도 메서드 없이 `gte` + `lte` 두 번 호출로 표현.

---

## SearchRequestBuilder (Dart)

```dart
final request = SearchRequestBuilder()
  .eq('userId', currentUserId)
  .gte('expenseDate', startDate)
  .lte('expenseDate', endDate)
  .like('title', '커피')                      // %는 백엔드가 자동 감싸지 않음 — 필요 시 호출자가 직접 추가
  .isIn('status', ['active', 'pending'])      // ← inList 아님
  .sortBy('expenseDate', SortDirection.desc)  // ← positional, descending: 인자 없음
  .page(0, 20)                                // ← positional (page, [size = 20])
  .build();

final response = await api.post<PageResponse<Expense>>(
  '/expenses/search',
  data: request.toJson(),
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);
```

---

## 사용 예

### 기본 조회

```dart
final req = SearchRequestBuilder()
  .eq('categoryId', 5)
  .build();
```

### 기간 필터 + 정렬 (between 대용)

```dart
final req = SearchRequestBuilder()
  .gte('expenseDate', DateTime(2026, 4, 1))
  .lte('expenseDate', DateTime(2026, 4, 30))
  .sortBy('expenseDate', SortDirection.desc)
  .build();
```

### LIKE 검색 (부분 일치)

```dart
final req = SearchRequestBuilder()
  .like('title', query)  // % 와일드카드는 백엔드가 자동 감싸지 않음 — 필요 시 호출자가 추가
  .build();
```

### 여러 값 (IN)

```dart
final req = SearchRequestBuilder()
  .isIn('categoryId', [1, 2, 3])  // ← inList 아님
  .build();
```

---

## 주의사항

### SQL Injection 방지

백엔드가 파라미터 바인딩으로 처리. 하지만 **value 가 string 일 때 트림 · 이스케이프** 는 신경 써야. `'%<user_input>%'` 같이 직접 조립 금지.

### `like` 성능

백엔드 컬럼에 **인덱스** 있어야 실용적. 앞부분 `%` (`%abc%`) 는 인덱스 못 탐 — 쿼리 느려짐. 가능하면 `abc%` (suffix 만) 사용.

### 페이지네이션 파라미터

- `page: 0-based`
- `size`: 기본 20, 최대 100 (백엔드 정책)

---

## 짝 스키마

| 프론트 | 백엔드 |
|--------|--------|
| `lib/kits/backend_api_kit/search_request.dart` | `common-web/.../SearchRequest.java` |
| `SearchRequestBuilder` | `SearchRequestBuilder.java` (Java 버전) |

---

## 관련 문서

- [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md)
- [`response-schema.md`](./response-schema.md) — PageResponse 응답
