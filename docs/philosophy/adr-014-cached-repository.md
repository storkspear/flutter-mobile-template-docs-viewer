# ADR-014 · 정책 기반 캐싱 (CachedRepository)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/core/cache/cached_repository.dart` (151줄) 가 5가지 정책 지원. 기본 저장소는 `MemoryCacheStore` — fork 후 `DriftCacheStore` 등으로 교체 가능.

## 결론부터

Repository 가 API 호출 시 **5가지 캐싱 정책 중 하나** 를 선택해요 — `cacheFirst`, `networkFirst`, `networkOnly`, `cacheOnly`, `staleWhileRevalidate`. 각 정책은 **화면 맥락에 맞는 UX 트레이드오프** 예요 — 목록은 최신성 우선 (networkFirst), 상세는 즉시성 우선 (cacheFirst), 대시보드는 빠른 진입 + 백그라운드 갱신 (SWR). CUD 연산 후엔 `invalidate` / `invalidateByPrefix` 로 관련 캐시 무효화.

## 왜 이런 고민이 시작됐나?

모바일 앱의 데이터 조회엔 **"속도 vs 최신성"** 의 영원한 갈등이 있어요.

**상황 1 — 빠른 진입** 을 원하면: 캐시 즉시 반환. 하지만 데이터가 stale 할 수 있음.
**상황 2 — 최신 데이터** 를 원하면: 매번 네트워크. 하지만 로딩 스피너 지속.
**상황 3 — 오프라인 대응** 이 필요하면: 네트워크 실패 시 캐시로 fallback.
**상황 4 — 백그라운드 갱신** 이면: 캐시 즉시 반환 + 뒤에서 최신화.

어느 한 정책이 만능은 아니에요. 네 힘이 부딪혀요.

**힘 A — 화면별 다른 UX**  
홈 대시보드는 "빠르게 뜨는 게" 중요. 거래 내역 상세는 "최신이 맞는지" 중요. 한 정책으로 모두 해결 안 됨.

**힘 B — ViewModel 의 단순성**  
ViewModel 코드가 "캐시 있으면 이거 쓰고, 없으면 네트워크, 실패 시 캐시 fallback" 같은 복잡한 흐름을 매번 구현하면 지옥.

**힘 C — 캐시 무효화 자동화**  
"상세 수정 후 목록으로 돌아가면 갱신돼야 함" 을 **매번 수동으로 invalidate** 하면 실수 빈발. 프리픽스 기반 일괄 삭제가 필요.

**힘 D — 저장소 교체 가능성**  
템플릿 기본은 메모리 캐시. 일부 앱은 Drift · Hive 기반 **영속 캐시** 를 원함. 교체 가능해야 해요.

이 결정이 답해야 했던 물음이에요.

> **화면별 UX 에 맞게 캐시 정책을 선택 가능하되, ViewModel 은 코드 한두 줄로 끝나는 구조** 는?

## 고민했던 대안들

### Option 1 — HTTP 수준 캐싱 (Dio interceptor)

요청 URL · 헤더 기반으로 인터셉터가 자동 캐시. 서버 `Cache-Control` 헤더 준수.

- **장점**: 투명. ViewModel · Repository 코드 불변.
- **단점 1**: 서버가 `Cache-Control` 을 세밀하게 제공해야 함. 대부분 인디 앱 백엔드는 안 줘요.
- **단점 2**: **URL 이 key**. POST / 쿼리 파라미터 변화 같은 조건 미묘.
- **단점 3**: 무효화 제어 어려움 — "거래 삭제 후 목록 갱신" 같은 **도메인 이벤트 기반** 무효화가 HTTP 스펙 밖.
- **탈락 이유**: 웹 관용. 모바일 앱의 도메인 중심 캐싱에 안 맞음.

### Option 2 — Drift (SQLite) 에 모든 데이터 영속화

Repository 가 모든 응답을 Drift 에 저장. 조회 시 Drift 에서.

- **장점**: 오프라인 우수. 재시작 후에도 데이터 유지.
- **단점 1**: **로컬 DB 스키마 관리** 가 또 필요. 서버 DTO 변경 시 Drift 스키마도 마이그레이션.
- **단점 2**: 모든 데이터를 영속화할 가치가 있는 건 아님. 일회성 조회 (권한 체크) 까지 DB 에 넣으면 과함.
- **단점 3**: 마이그레이션 실패 시 앱이 먹통. `migration_fingerprint_test.dart` 같은 방어가 매번 필요.
- **탈락 이유**: 모든 데이터가 영속 가치 있는 건 아님. 정책 기반 선택이 맞음.

### Option 3 — 추상 CacheStore + 정책 기반 CachedRepository ★ (채택)

**추상 `CacheStore`** 인터페이스 (get · put · remove · removeByPrefix) 를 두고, 기본 구현 `MemoryCacheStore`. Repository 는 `CachedRepository.fetch(key: ..., policy: ..., ttl: ..., fetcher: ..., fromJson: ..., toJson: ...)` 한 번 호출.

- **힘 A 만족**: 정책을 파라미터로 선택. 화면마다 다른 정책.
- **힘 B 만족**: Repository 호출 1회. 정책 분기는 CachedRepository 내부.
- **힘 C 만족**: `invalidate` · `invalidateByPrefix` 로 CUD 후 일괄 삭제.
- **힘 D 만족**: `CacheStore` 인터페이스 → fork 후 `DriftCacheStore` · `HiveCacheStore` 등 교체.

## 결정

### 5가지 캐시 정책

```dart
// lib/core/cache/cache_policy.dart 전체
enum CachePolicy {
  /// 캐시 우선: 유효한 캐시 있으면 사용, 없으면 네트워크
  cacheFirst,

  /// 네트워크 우선: 항상 네트워크, 실패 시 캐시 폴백
  networkFirst,

  /// 네트워크만: 캐시 사용 안 함
  networkOnly,

  /// 캐시만: 네트워크 호출 안 함 (오프라인 전용)
  cacheOnly,

  /// Stale-While-Revalidate: 캐시 즉시 반환 + 백그라운드 네트워크 갱신
  staleWhileRevalidate,
}
```

### CachedRepository.fetch

```dart
// lib/core/cache/cached_repository.dart 발췌
class CachedRepository {
  final CacheStore _store;
  final void Function(Object error, StackTrace stack)? _onRevalidateError;

  CachedRepository({required CacheStore store, void Function(Object, StackTrace)? onRevalidateError})
    : _store = store,
      _onRevalidateError = onRevalidateError;

  Future<T> fetch<T>({
    required String key,
    required Duration ttl,
    required CachePolicy policy,
    required Future<T> Function() fetcher,        // 네트워크 함수
    required T Function(String json) fromJson,    // 역직렬화
    required String Function(T data) toJson,      // 직렬화
  }) async {
    switch (policy) {
      case CachePolicy.cacheFirst:
        return _cacheFirst(key, ttl, fetcher, fromJson, toJson);
      case CachePolicy.networkFirst:
        return _networkFirst(key, ttl, fetcher, fromJson, toJson);
      case CachePolicy.networkOnly:
        return _networkOnly(key, ttl, fetcher, toJson);
      case CachePolicy.cacheOnly:
        return _cacheOnly(key, fromJson);
      case CachePolicy.staleWhileRevalidate:
        return _staleWhileRevalidate(key, ttl, fetcher, fromJson, toJson);
    }
  }

  Future<void> invalidate(String key) => _store.remove(key);
  Future<void> invalidateByPrefix(String prefix) => _store.removeByPrefix(prefix);
  // ...
}
```

### 정책별 동작

**cacheFirst** — 캐시 즉시, 없으면 네트워크:

```dart
Future<T> _cacheFirst<T>(...) async {
  final cached = await _store.get(key);
  if (cached != null) return fromJson(cached);
  final data = await fetcher();
  await _store.put(key, toJson(data), ttl: ttl);
  return data;
}
```

**networkFirst** — 항상 네트워크, 실패 시 캐시:

```dart
Future<T> _networkFirst<T>(...) async {
  try {
    final data = await fetcher();
    await _store.put(key, toJson(data), ttl: ttl);
    return data;
  } catch (_) {
    final cached = await _store.get(key);
    if (cached != null) return fromJson(cached);
    rethrow;  // ← 캐시도 없으면 원 에러 전파
  }
}
```

**staleWhileRevalidate** — 캐시 즉시 + 백그라운드 갱신:

```dart
Future<T> _staleWhileRevalidate<T>(...) async {
  final cached = await _store.get(key);

  if (cached != null) {
    unawaited(_revalidate(key, ttl, fetcher, toJson));  // ← 백그라운드
    return fromJson(cached);
  }

  // 캐시 없으면 네트워크 1회
  final data = await fetcher();
  await _store.put(key, toJson(data), ttl: ttl);
  return data;
}

Future<void> _revalidate<T>(...) async {
  try {
    final data = await fetcher();
    await _store.put(key, toJson(data), ttl: ttl);
  } catch (e, st) {
    _onRevalidateError?.call(e, st);  // ← 실패는 로깅만, 조용히
  }
}
```

### 화면별 정책 선택 가이드

| 화면 | 정책 | 이유 |
|------|------|------|
| 홈 대시보드 | `staleWhileRevalidate` | 빠른 진입 + 최신화 |
| 목록 화면 | `networkFirst` | 최신성 중요, 오프라인 대응 |
| 상세 화면 | `cacheFirst` | 목록에서 클릭 시 즉시 뜨기 |
| 설정 · 프로필 | `networkFirst` | 자주 변하지 않음 + 최신성 |
| 정적 데이터 (약관 · FAQ) | `cacheFirst` | 변화 드묾 |
| 오프라인 전용 | `cacheOnly` | 네트워크 불가 상황 |

### Repository 사용 예

```dart
// 파생 레포에서 (문서 예시)
class ExpenseRepository {
  final ApiClient _api;
  final CachedRepository _cache;

  ExpenseRepository({required ApiClient api, required CachedRepository cache})
    : _api = api, _cache = cache;

  Future<ExpenseDetail> getById(int id) {
    return _cache.fetch(
      key: 'expense_$id',
      ttl: Duration(minutes: 5),
      policy: CachePolicy.cacheFirst,
      fetcher: () => _api.get('/expenses/$id', fromData: ExpenseDetail.fromJson),
      fromJson: (json) => ExpenseDetail.fromJson(jsonDecode(json)),
      toJson: (data) => jsonEncode(data.toJson()),
    );
  }

  Future<List<ExpenseSummary>> list({int page = 0}) {
    return _cache.fetch(
      key: 'expenses_list_page_$page',
      ttl: Duration(minutes: 2),
      policy: CachePolicy.networkFirst,
      fetcher: () => _api.get('/expenses?page=$page', fromData: ...),
      // ...
    );
  }

  Future<void> delete(int id) async {
    await _api.delete('/expenses/$id');
    await _cache.invalidate('expense_$id');
    await _cache.invalidateByPrefix('expenses_list_');  // ← 목록 전체 무효화
  }
}
```

### 설계 선택 포인트

**포인트 1 — 키는 문자열, 직렬화는 JSON**  
`CacheStore` 가 `Map<String, String>` 수준으로 단순. 값은 JSON 직렬화로 저장. 장점: **DB / 메모리 / 파일 어디든 저장 가능**. 단점: 매번 encode/decode 비용 (실측 ~1ms 수준, 무시 가능).

**포인트 2 — TTL 은 Duration**  
`ttl: Duration(minutes: 5)` — 만료 시간을 선언적으로. 내부 구현은 저장 시각 + ttl 비교.

**포인트 3 — SWR 의 `unawaited`**  
백그라운드 갱신은 **호출자가 기다리지 않음** (`unawaited`). 화면은 캐시 즉시 표시, 갱신은 나중에 완료. 갱신 결과는 다음 조회에 반영.

**포인트 4 — SWR 실패는 조용히**  
`_revalidate` 의 에러는 throw 하지 않음 — 옵션 콜백 `onRevalidateError` 로만 로깅. "백그라운드 갱신" 이 사용자에게 노출되면 UX 혼란.

**포인트 5 — `invalidateByPrefix` 는 강력한 무효화**  
목록을 `expenses_list_page_0`, `expenses_list_page_1` 로 저장하면 `invalidateByPrefix('expenses_list_')` 로 전체 삭제. 프리픽스 명명 규칙을 잘 잡아두는 게 중요.

**포인트 6 — CacheStore 는 `core/` 에, 구현은 교체 가능**  
`MemoryCacheStore` 가 기본. 필요 시 `DriftCacheStore` 로 `providers.dart` override. ADR-006 의 Debug 폴백 패턴과 같음.

## 이 선택이 가져온 것

### 긍정적 결과

- **ViewModel 캐시 인지 0**: ViewModel 은 `repository.getById(42)` 호출. 캐시 여부 · 정책 모름.
- **화면별 UX 최적**: 각 화면이 자기 요구에 맞는 정책 선택. 한 정책으로 강제 안 함.
- **SWR 로 빠른 첫 화면**: 대시보드 진입 시 캐시 즉시 (100ms) + 갱신은 백그라운드.
- **CUD 후 자동 반영**: `invalidateByPrefix` 한 줄로 관련 목록 전체 무효화.
- **오프라인 대응 (networkFirst)**: 네트워크 실패 시 캐시 fallback. 비행기 모드에서도 최근 데이터.
- **저장소 교체 가능**: 영속 캐시 필요하면 `DriftCacheStore` 구현 + override.

### 부정적 결과

- **정책 선택 피로**: 화면 짤 때마다 "뭐 쓰지?" 판단 필요. 위 가이드 표 제공하지만 결정 비용.
- **fromJson / toJson 보일러플레이트**: 각 호출마다 `fromJson: (json) => ...` 람다. `freezed` + `json_serializable` 로 자동화 가능하지만 본 템플릿은 미도입 (ADR-009).
- **TTL 관리 수동**: "이 화면 캐시 TTL 5분? 1시간?" 결정이 반복. 기본값 상수 제공하면 개선.
- **캐시 크기 제한 없음**: 현재 `MemoryCacheStore` 는 무제한. 장기 실행 시 메모리 누적 가능. LRU 정책 같은 게 필요할 수 있음.
- **멀티 디바이스 일관성 없음**: 클라 캐시라 기기 간 동기화 안 됨. 중요한 데이터는 networkFirst 가 안전.

## 교훈

### 교훈 1 — "정책" 은 화면 맥락에서만 결정 가능

초기엔 Repository 안에 `CachePolicy.cacheFirst` 하드코딩. 하지만 **같은 Repository 의 같은 메서드** 도 화면에 따라 정책이 다를 수 있음. 예: 홈에서 목록 → SWR, 검색 화면에서 목록 → networkFirst. **정책을 파라미터** 로 받아 ViewModel 이 결정하는 게 맞아요.

**교훈**: 인프라 레이어의 동작 양식은 **도메인 컨텍스트 (어느 화면? 어떤 상황?)** 에서 결정. 인프라가 스스로 결정하면 유연성 상실.

### 교훈 2 — SWR 의 에러는 실패로 치지 않는 게 맞다

초기엔 `_revalidate` 실패 시 로그 · 메트릭에 "Cache revalidate failed" 로 표시. 그러면 **백그라운드 실패로 대시보드 가득**. SWR 은 본질적으로 "best-effort 갱신" 이므로 실패가 정상 동작. `onRevalidateError` 콜백으로만 기록, 메트릭 무시.

**교훈**: "best-effort 작업" 의 실패는 **실패가 아닌 정상 동작의 일부**. 성공만 측정하세요.

### 교훈 3 — `invalidateByPrefix` 가 목록-상세 연관의 주춧돌

목록을 `expenses_list_page_0` · `expenses_list_page_1` · ... 로 저장하면, 한 건 수정 후 **전체 페이지** 를 재조회해야. 개별 invalidate 로는 비용이 커서 prefix 기반 일괄 삭제가 필수. 프리픽스 명명 규칙만 지키면 강력.

**교훈**: 캐시 키는 **도메인 계층 구조** (resource_list_... · resource_detail_...) 를 반영. 일관된 키 스킴이 무효화를 가능하게.

## 관련 사례 (Prior Art)

- [SWR (React)](https://swr.vercel.app/) — Stale-While-Revalidate 패턴의 대중화. 본 ADR 의 `staleWhileRevalidate` 이름 출처
- [TanStack Query](https://tanstack.com/query/latest) — 정책 기반 캐싱 + 자동 무효화. 본 ADR 과 가장 가까운 개념
- [Apollo Client Cache](https://www.apollographql.com/docs/react/caching/overview) — GraphQL 진영의 캐싱 전략
- [Android Room + Repository Pattern](https://developer.android.com/topic/libraries/architecture/data-layer) — 캐시 + 네트워크 결합
- [HTTP Cache-Control RFC 7234](https://datatracker.ietf.org/doc/html/rfc7234) — HTTP 수준 캐싱 표준 (Option 1 의 근거)

## Code References

**캐시 인프라**
- [`lib/core/cache/cache_policy.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/cache/cache_policy.dart) — 5가지 enum
- [`lib/core/cache/cache_store.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/cache/cache_store.dart) — 추상 인터페이스
- [`lib/core/cache/memory_cache_store.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/cache/memory_cache_store.dart) — 기본 구현
- [`lib/core/cache/cached_repository.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/cache/cached_repository.dart) — 151줄 정책 구현

**Provider 연결**
- [`lib/common/providers.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/common/providers.dart) — `cacheStoreProvider` · `cachedRepositoryProvider`

**테스트**
- [`test/core/cache/cached_repository_test.dart`](https://github.com/storkspear/template-flutter/blob/main/test/core/cache/cached_repository_test.dart) — 각 정책 · TTL · SWR 동작 검증

**관련 ADR**:
- [`ADR-002 · 3계층 모듈 구조`](./adr-002-layered-modules.md) — CacheStore 가 `core/` 에 있는 이유
- [`ADR-005 · Riverpod + MVVM`](./adr-005-riverpod-mvvm.md) — Repository Provider 주입 패턴
- [`ADR-006 · 인터페이스 기반 서비스 교체`](./adr-006-debug-fallback.md) — CacheStore 교체 가능성
- [`ADR-009 · 백엔드 응답 1:1 계약`](./adr-009-backend-contract.md) — fetcher 의 `fromData` 콜백과 연결
