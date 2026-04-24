# Loading UX Conventions

로딩 상황은 **4가지 패턴** 중 하나. 풀스크린 블로킹 스피너 금지. 규약 근거는 [`ADR-017 · 4가지 로딩 UX 패턴`](../philosophy/adr-017-loading-ux.md) 참조.

---

## 4가지 패턴 한눈

| 맥락 | 패턴 | 위젯 |
|------|------|------|
| **첫 진입** (목록 · 상세 처음 로딩) | Skeleton | `SkeletonLoading` |
| **새로고침** (이미 데이터 있음) | Pull-to-refresh | `RefreshIndicator` |
| **버튼 액션** (로그인 · 저장) | 버튼 스피너 + IgnorePointer | `PrimaryButton(loading: true)` |
| **백그라운드** (동기화 · 업로드) | TopProgressBar | `TopProgressBar` |

**금지**:
- ❌ 풀스크린 스피너 오버레이
- ❌ 별도 스켈레톤 위젯 (예: `SkeletonListItem`)
- ❌ 버튼 옆에 별도 스피너

---

## 1. Skeleton — 첫 진입

`SkeletonLoading(enabled: isLoading, child: 실제위젯)` 으로 감쌈. 로딩 중엔 shimmer 효과 자동. `skeletonizer` 패키지 기반.

```dart
Widget build(BuildContext context, WidgetRef ref) {
  final state = ref.watch(expenseListViewModelProvider);

  return SkeletonLoading(
    enabled: state.isLoading,
    child: ListView.builder(
      itemCount: state.items.isEmpty ? 6 : state.items.length,  // ← 로딩 중 더미 6개
      itemBuilder: (context, i) {
        final item = state.items.isEmpty
          ? Expense.dummy()  // 더미 데이터
          : state.items[i];
        return ListTile(
          title: Text(item.title),
          subtitle: Text(item.date.toString()),
          trailing: Text('₩${item.amount}'),
        );
      },
    ),
  );
}
```

### 더미 아이템 개수

| 화면 유형 | 개수 |
|---------|------|
| ListView (세로 목록) | 5 ~ 8 |
| GridView (2열) | 4 ~ 6 |
| GridView (3열) | 6 ~ 9 |
| 상세 화면 | 1 |

화면을 "가득 채울" 정도.

### 규칙

- **실제 위젯 레이아웃 유지** — 별도 Skeleton 위젯 만들지 말기
- **더미 데이터는 `Expense.dummy()` 같은 factory** — `Text('Placeholder')` 보다 자연
- **`skeletonizer` 가 알아서 블러 처리** — 개발자가 shimmer 색상 · 애니메이션 지정할 필요 없음

---

## 2. Pull-to-refresh — 새로고침

이미 데이터가 있는 상태에서 사용자가 당겨서 갱신.

```dart
RefreshIndicator(
  onRefresh: () => ref.read(expenseListViewModelProvider.notifier).refresh(),
  child: ListView.builder(
    itemCount: state.items.length,
    itemBuilder: (context, i) => ExpenseTile(expense: state.items[i]),
  ),
)
```

### ViewModel 측

```dart
class ExpenseListViewModel extends StateNotifier<ExpenseListState> {
  // 첫 진입
  Future<void> load() async {
    state = state.copyWith(isLoading: true);
    try {
      final items = await _repository.list();
      state = state.copyWith(isLoading: false, items: items);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorCode: safeErrorCode(e));
    }
  }

  // 당겨서 갱신
  Future<void> refresh() async {
    // ← isLoading 플래그 안 씀. RefreshIndicator 가 자체 스피너.
    try {
      final items = await _repository.list();
      state = state.copyWith(items: items);
    } catch (e) {
      state = state.copyWith(errorCode: safeErrorCode(e));
    }
  }
}
```

### 규칙

- **`Future` 반환 필수** — `RefreshIndicator` 가 `Future` 완료까지 스피너 유지
- **isLoading 플래그 건드리지 말기** — RefreshIndicator 가 자체 관리
- **기존 데이터 유지** — 새로고침 중에도 리스트는 보여줌

---

## 3. 버튼 스피너 — 버튼 액션

로그인 · 저장 · 제출 같은 CTA 버튼. `PrimaryButton(loading: state.isLoading)` 만.

```dart
PrimaryButton(
  label: S.of(context).save,
  loading: state.isLoading,            // ← state 구독
  onPressed: () => vm.save(),          // ← action 호출
)
```

### PrimaryButton 내부 동작

- `loading: true` 일 때:
  - label 대신 스피너 표시
  - `IgnorePointer` 적용 → 중복 탭 방지
  - 버튼 크기 불변 → 레이아웃 안 흔들림

### 여러 버튼이 있는 화면

```dart
Column(
  children: [
    PrimaryButton(
      label: s.submit,
      loading: state.isSubmitting,
      onPressed: vm.submit,
    ),
    TextButton(
      onPressed: state.isSubmitting ? null : vm.cancel,  // ← submitting 중 cancel 비활성
      child: Text(s.cancel),
    ),
  ],
)
```

### 규칙

- **스피너는 버튼 내부만** — 별도 CircularProgressIndicator 금지
- **다른 버튼도 비활성화** — `onPressed: isLoading ? null : callback`
- **TextField 비활성화는 선택** — 단순 폼은 그대로, 복잡한 multi-step 은 `IgnorePointer`

---

## 4. TopProgressBar — 백그라운드

사용자가 명시적으로 기다리지 않는 작업 (동기화 · 업로드). AppBar 하단의 얇은 progress.

```dart
Scaffold(
  appBar: AppBar(
    title: Text(s.home),
    bottom: TopProgressBar(
      visible: state.isSyncing,
      value: state.syncProgress,  // 0.0 ~ 1.0 or null (indeterminate)
    ),
  ),
  body: ...,
)
```

### 3가지 모드

| 모드 | value | 용도 |
|------|-------|------|
| 퍼센트 | `0.0 ~ 1.0` | 업로드 · 다운로드 진행률 |
| Indeterminate | `null` | 동기화 (진행률 모름) |
| 숨김 | `visible: false` | 완료 또는 대기 |

### 규칙

- **AppBar bottom 에 둠** — 다른 위치 (Scaffold footer 등) 금지
- **사용자 액션 차단 안 함** — 앱 계속 사용 가능
- **완료 시 자동 숨김** — `visible: false` 로 전환

---

## 5. EmptyView vs LoadingView

로딩과 "데이터 없음" 은 다른 상태. 별도 위젯으로 구분.

```dart
Widget _body() {
  if (state.isLoading) {
    return SkeletonLoading(enabled: true, child: _buildList());
  }
  if (state.items.isEmpty) {
    return EmptyView(
      icon: Icons.receipt_long,
      message: s.emptyExpenses,
      action: TextButton(
        onPressed: vm.addFirst,
        child: Text(s.addFirstExpense),
      ),
    );
  }
  if (state.errorCode != null) {
    return ErrorView(
      message: _localizedError(context, state.errorCode!),
      onRetry: vm.load,
    );
  }
  return _buildList();
}
```

---

## 6. 스플래시 (부팅)

앱 시작 시 `SplashController` + `BootStep` 이 실행되는 구간. 전용 `LoadingView` 사용.

```dart
// lib/common/router/app_router.dart 발췌
GoRoute(
  path: Routes.splash,
  builder: (context, state) =>
      Scaffold(body: LoadingView(message: S.of(context).loading)),
),
```

네이티브 스플래시 (`flutter_native_splash`) → Dart 스플래시 → 첫 라우트. 이 구간엔 **풀스크린 `CircularProgressIndicator` 허용** (특수 예외).

---

## 자주 하는 실수

### ❌ 풀스크린 오버레이

```dart
// 금지
Stack(children: [
  MyScreen(),
  if (isLoading) Container(color: Colors.black54, child: Center(child: CircularProgressIndicator())),
])
```

"앱 멈춤" UX. 대신:
- 버튼 액션이면 → `PrimaryButton(loading: true)`
- 데이터 로딩이면 → `SkeletonLoading(enabled: true)`

### ❌ 별도 스켈레톤 위젯

```dart
// 금지
class SkeletonListItem extends StatelessWidget {
  const SkeletonListItem();
  @override
  Widget build(context) => Container(height: 60, color: Colors.grey[300]);
}
```

실제 UI 와 다른 별도 코드 유지 필요. 대신 `SkeletonLoading(enabled: true, child: 실제ListTile())`.

### ❌ 버튼 옆 스피너

```dart
// 금지
Row(children: [
  ElevatedButton(...),
  if (isLoading) CircularProgressIndicator(),
])
```

버튼 크기가 왔다갔다. 대신 `PrimaryButton(loading: true)` 내부 통합.

### ❌ TopProgressBar 를 AppBar 외 위치

```dart
// 금지
Scaffold(
  body: Column(children: [
    if (isSyncing) TopProgressBar(),  // ← body 안에 두지 말기
    Expanded(child: ...),
  ]),
)
```

레이아웃 일관성. 반드시 `AppBar.bottom`.

---

## 관련 문서

- [`naming.md`](./naming.md) — Loading 관련 위젯 이름
- [`viewmodel-mvvm.md`](./viewmodel-mvvm.md) — `state.isLoading` 관리
- [`ADR-017 · 4가지 로딩 UX 패턴`](../philosophy/adr-017-loading-ux.md) — 근거
