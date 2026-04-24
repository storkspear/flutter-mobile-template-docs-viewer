# Search Request

검색 · 필터링 · 정렬 요청 DSL. `SearchRequest` 가 양쪽 레포에서 동일한 포맷.

---

## 기본 포맷

```json
{
  "conditions": [
    { "field": "categoryId", "operator": "eq", "value": 5 },
    { "field": "amount", "operator": "gte", "value": 10000 }
  ],
  "sort": [
    { "field": "expenseDate", "direction": "desc" }
  ],
  "page": 0,
  "size": 20
}
```

---

## 연산자

| operator | 의미 | 값 타입 |
|----------|------|---------|
| `eq` | equal | scalar |
| `ne` | not equal | scalar |
| `gt` | greater than | number/date |
| `gte` | greater or equal | number/date |
| `lt` | less than | number/date |
| `lte` | less or equal | number/date |
| `like` | SQL LIKE (SQL `%` 와일드카드) | string |
| `in` | IN list | array |
| `notIn` | NOT IN | array |
| `isNull` | IS NULL | (값 없음) |
| `isNotNull` | IS NOT NULL | (값 없음) |
| `between` | BETWEEN A AND B | `[a, b]` 배열 |

---

## SearchRequestBuilder (Dart)

```dart
final request = SearchRequest.builder()
  .eq('userId', currentUserId)
  .gte('expenseDate', startDate)
  .lte('expenseDate', endDate)
  .like('title', '%커피%')
  .inList('status', ['active', 'pending'])
  .sortBy('expenseDate', descending: true)
  .page(0, size: 20)
  .build();

final response = await api.post<PageResponse<Expense>>(
  '/expenses/search',
  body: request.toJson(),
  fromData: (data) => PageResponse.fromJson(data, Expense.fromJson),
);
```

---

## 사용 예

### 기본 조회

```dart
final req = SearchRequest.builder()
  .eq('categoryId', 5)
  .build();
```

### 기간 필터 + 정렬

```dart
final req = SearchRequest.builder()
  .gte('expenseDate', DateTime(2026, 4, 1))
  .lte('expenseDate', DateTime(2026, 4, 30))
  .sortBy('expenseDate', descending: true)
  .build();
```

### LIKE 검색 (부분 일치)

```dart
final req = SearchRequest.builder()
  .like('title', '%$query%')  // SQL 와일드카드
  .build();
```

### 여러 값 (IN)

```dart
final req = SearchRequest.builder()
  .inList('categoryId', [1, 2, 3])
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

- [ADR-009 · 백엔드 계약](../philosophy/adr-009-backend-contract.md)
- [`response-schema.md`](./response-schema.md) — PageResponse 응답
