# Loading UX Conventions

---

## 로딩 패턴 분류표

| 상황 | 패턴 | 위젯 | 비고 |
|------|------|------|------|
| 화면 첫 진입 (데이터 로딩) | Skeleton | `SkeletonLoading` + 실제 레이아웃 | 화면 채움 기준 더미 아이템 |
| 당겨서 새로고침 | Pull-to-refresh 스피너 | `RefreshIndicator` (Flutter 기본) | body를 감싸는 형태 |
| 버튼 액션 (저장/삭제) | 버튼 내 스피너 + 폼 비활성화 | `PrimaryButton(isLoading: true)` + `IgnorePointer` | `isLoading=true` 시 버튼 자동 비활성화 |
| 백그라운드 갱신 (비차단) | 최상단 선형 프로그레스 | `TopProgressBar` | 토스 스타일, status bar 아래 |
| 무한 스크롤 추가 로딩 | 하단 스피너 | `CircularProgressIndicator.adaptive()` | `PaginationController` 연동 |

### 사용하지 않는 패턴

- **풀스크린 블로킹 오버레이**: 촌스럽고 UX를 저해합니다. 버튼 스피너 + `IgnorePointer`로 대체합니다.
- **되돌릴 수 없는 중요 액션 (결제/송금)**: 오버레이 대신 전용 처리 화면으로 이동합니다. 파생 레포 생성 후 도메인별로 구현합니다.

---

## 스켈레톤 로딩 작성 규칙

### 규칙 1: 실제 레이아웃과 동일한 구조를 씁니다

`SkeletonLoading`은 `Skeletonizer`를 래핑합니다. `enabled: true`일 때 child 위젯 트리를 그대로 shimmer 처리하므로, **더미 데이터로 실제 레이아웃을 렌더링**하면 됩니다. 별도의 스켈레톤 위젯을 만들지 않습니다.

```dart
// 좋은 예 — 실제 레이아웃 재사용
SkeletonLoading(
  enabled: state.isLoading,
  child: ListView.builder(
    itemCount: state.isLoading ? 6 : state.items.length,
    itemBuilder: (context, index) {
      final item = state.isLoading
          ? Expense.empty()   // 더미 데이터
          : state.items[index];
      return ExpenseListTile(item: item);
    },
  ),
)

// 나쁜 예 — 별도 스켈레톤 위젯
if (state.isLoading)
  const _SkeletonWidget()   // 구조가 실제와 다를 수 있음
else
  ListView.builder(...)
```

### 규칙 2: 더미 아이템 개수는 화면 채움 기준

| 화면 유형 | 더미 아이템 수 |
|-----------|---------------|
| 리스트 (`ListView`) | 5 ~ 8개 |
| 카드 그리드 (`GridView`) | 4 ~ 6개 |
| 상세 화면 | 1개 |
| 수평 스크롤 카드 | 3개 |

화면을 가득 채우는 개수를 선택합니다. 빈 공간이 보이면 어색합니다.

### 규칙 3: 뼈대 형태 자동 매칭

`Skeletonizer`는 위젯 타입을 보고 자동으로 shimmer 형태를 결정합니다.

| 원본 위젯 | Skeleton 형태 |
|-----------|--------------|
| `Text` | 사각형 (글자 너비 기준) |
| `CircleAvatar` | 원형 |
| `Image`, `CachedNetworkImage` | 둥근 사각형 |
| `Icon` | 원형 |
| `Container`, `SizedBox` | 사각형 |

더미 데이터는 빈 문자열보다 실제 데이터와 비슷한 길이를 씁니다. 글자 길이가 shimmer 너비를 결정하기 때문입니다.

```dart
// 좋은 예 — 실제 데이터와 비슷한 더미
Expense.empty() // title: '주간 식비', amount: 0

// 나쁜 예 — 빈 문자열 더미
Expense(title: '', amount: 0)  // shimmer가 너무 좁아짐
```

### 규칙 4: Bone 위젯으로 미세 조정

자동 매칭으로 부족할 때는 `Bone` 위젯으로 shimmer 형태를 직접 지정합니다.

```dart
// Bone.text — 텍스트 shimmer, width는 글자 수 기준 (em)
Bone.text(words: 3)           // 단어 3개 분량의 텍스트 shimmer

// Bone.circle — 원형 shimmer
Bone.circle(size: 40)         // 지름 40px 원형

// Bone.square — 사각형 shimmer
Bone.square(size: 80)         // 80x80px 사각형

// Bone — 커스텀 크기
Bone(width: 120, height: 16, borderRadius: BorderRadius.circular(4))
```

---

## 화면 개발 시 로딩 체크리스트

화면을 개발할 때 아래 순서로 확인합니다.

```
1. 데이터 로딩이 있는가?
   └─ YES → SkeletonLoading으로 첫 진입 로딩 처리
   └─ NO  → 건너뜀

2. 데이터를 갱신할 수 있는가?
   ├─ 사용자가 수동으로 새로고침 → RefreshIndicator (body 감싸기)
   └─ 앱이 자동으로 백그라운드 갱신 → TopProgressBar (Scaffold 감싸기)

3. 페이지네이션(무한 스크롤)이 있는가?
   └─ YES → PaginationController + 리스트 하단 CircularProgressIndicator

4. 폼 제출(저장/삭제/전송)이 있는가?
   └─ YES → PrimaryButton(isLoading: state.isSubmitting)
           + IgnorePointer(ignoring: state.isSubmitting, child: Form(...))

5. 실패 처리는?
   ├─ 목록/화면 전체 에러 → ErrorView(message: ..., onRetry: ...)
   └─ 단건 액션 에러 → AppSnackBar.show(context, message: ..., type: SnackBarType.error)
```

---

## 코드 예시

### 전형적인 데이터 목록 화면

스켈레톤 → 에러 → 빈 화면 → 데이터 + 새로고침 순서로 분기합니다.

```dart
class ExpenseListScreen extends ConsumerWidget {
  const ExpenseListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(expenseListProvider);
    final vm = ref.read(expenseListProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('지출 목록')),
      body: _buildBody(context, state, vm),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ExpenseListState state,
    ExpenseListViewModel vm,
  ) {
    // 에러 (첫 로딩 실패)
    if (state.error != null && state.items.isEmpty) {
      return ErrorView(
        message: state.error!,
        onRetry: vm.load,
      );
    }

    // 스켈레톤 + 실제 목록 (isLoading=true면 shimmer, false면 실제 데이터)
    return SkeletonLoading(
      enabled: state.isLoading,
      child: RefreshIndicator(
        onRefresh: vm.refresh,
        child: state.items.isEmpty && !state.isLoading
            ? const EmptyView(message: '지출 내역이 없습니다')
            : ListView.builder(
                itemCount: state.isLoading ? 6 : state.items.length,
                itemBuilder: (context, index) {
                  final item = state.isLoading
                      ? Expense.empty()
                      : state.items[index];
                  return ExpenseListTile(expense: item);
                },
              ),
      ),
    );
  }
}
```

### 폼 제출 패턴

`IgnorePointer`로 폼 전체를 비활성화하고, 버튼에 `isLoading`을 전달합니다.

```dart
class ExpenseFormScreen extends ConsumerWidget {
  const ExpenseFormScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(expenseFormProvider);
    final vm = ref.read(expenseFormProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('지출 등록')),
      body: IgnorePointer(
        // 제출 중 전체 폼 입력 차단
        ignoring: state.isSubmitting,
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            children: [
              AppTextField(
                label: '금액',
                onChanged: vm.setAmount,
              ),
              AppTextField(
                label: '메모',
                onChanged: vm.setNote,
              ),
              const Spacer(),
              PrimaryButton(
                text: '저장',
                isLoading: state.isSubmitting,
                onPressed: () => vm.submit(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 무한 스크롤 하단 로딩

`PaginationController`가 페이지를 관리하고, 리스트 마지막 아이템으로 스피너를 추가합니다.

```dart
Widget _buildList(ExpenseListState state, ExpenseListViewModel vm) {
  final hasMore = state.pagination.hasMore;
  final isLoadingMore = state.pagination.isLoadingMore;
  final itemCount = state.items.length + (hasMore ? 1 : 0);

  return NotificationListener<ScrollNotification>(
    onNotification: (notification) {
      if (notification is ScrollEndNotification &&
          notification.metrics.extentAfter < 200) {
        vm.loadMore();
      }
      return false;
    },
    child: ListView.builder(
      itemCount: itemCount,
      itemBuilder: (context, index) {
        // 마지막 아이템 = 하단 스피너
        if (index == state.items.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator.adaptive()),
          );
        }
        return ExpenseListTile(expense: state.items[index]);
      },
    ),
  );
}
```

---

## 네이티브 스플래시

### 앱 진입 플로우

```
1. 네이티브 스플래시 (OS 레벨) — flutter_native_splash
   - 회사/서비스 로고 표시
   - Flutter 엔진 초기화 중 (Dart VM 시작 전) 자동 표시
   - 표시 시간: 약 0.5 ~ 1초 (기기 성능에 따라 다름)

2. pre-runApp 부팅 (Dart 레벨) — SplashController
   - lib/main.dart에서 runApp() 호출 전에 await
   - 토큰 검증, DB 마이그레이션, 업데이트 확인 등 BootStep 순차 실행
   - 완료 후 앱이 첫 라우트로 직접 이동
```

현재 템플릿은 **pre-runApp 방식**입니다 (`lib/main.dart`의 `SplashController.run()` await).
네이티브 스플래시 동안 BootStep이 실행되므로 Flutter 레벨에서 별도 스플래시 화면이
필요하지 않습니다. 커스텀 로고 애니메이션이 필요한 앱은 이 플로우 대신 별도 splash 라우트를
구성해 커스터마이징할 수 있습니다.

### 네이티브 스플래시 이미지 가이드

| 항목 | 사양 |
|------|------|
| 이미지 크기 | 1152 × 1152 px |
| 로고 안전 영역 | 중앙 384 × 384 px 이내 |
| 배경색 | `flutter_native_splash.yaml`의 `color` 필드와 일치 |
| Android 12+ | 아이콘이 원형으로 마스킹됨 — 로고를 원 안에 배치 |
| iOS | 배경색 + 이미지로 구성 (배경 전체 색 권장) |

Android 12+는 adaptive icon 규칙을 따릅니다. 아이콘 주변 여백을 충분히 두어 원형 마스킹 후에도 로고가 잘리지 않게 합니다.

### 생성 명령

```sh
# pubspec.yaml 또는 flutter_native_splash.yaml 설정 후 실행
dart run flutter_native_splash:create
```

설정 파일 예시 (`flutter_native_splash.yaml`):

```yaml
flutter_native_splash:
  color: "#FFFFFF"
  image: assets/splash/splash_logo.png
  android_12:
    image: assets/splash/splash_logo.png
    icon_background_color: "#FFFFFF"
  fullscreen: false
```
