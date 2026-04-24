# Build First App — 첫 기능 완성 walkthrough

파생 레포를 만들고 **첫 도메인 기능** 을 하나 구현하는 전체 흐름. 예제: **아이템 목록 앱**. 약 2~3시간.

> **가정**: [`Onboarding`](./onboarding.md) 를 마쳐서 시뮬레이터에 템플릿 홈이 떠 있는 상태. 앱 유형은 `backend-auth-app` recipe 선택.

---

## §1 기획 (10분)

만들 앱의 윤곽을 먼저 정해두면 이후 흐름이 꼬이지 않아요.

### 결정할 것

- **앱 유형**: local-only / local-notifier / backend-auth
- **핵심 기능**: 5개 이하 (MVP)
- **첫 기능**: 한 개만 선정 (이 문서에선 "아이템 목록")
- **백엔드 연동 여부**: 있음 / 없음
- **디자인 키 컬러**: HEX 하나 (예: `#FF6B35`)
- **앱 이름**: 사용자에게 보이는 이름

### 예시

| 항목 | 값 |
|------|---|
| 앱 이름 | My Items |
| 유형 | backend-auth (서버 연동 + 로그인) |
| 키 컬러 | `#FF6B35` (오렌지) |
| 첫 기능 | 아이템 CRUD (목록 · 추가 · 수정 · 삭제) |

---

## §2 앱 정체성 설정 (5분)

```bash
./scripts/rename-app.sh my_items com.example.myitems
```

`app_kits.yaml` recipe 복사:

```bash
cp recipes/backend-auth-app.yaml app_kits.yaml
```

`lib/main.dart` 동기화:

```dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  NotificationsKit(),
  DeviceInfoKit(),
  UpdateKit(service: NoUpdateAppUpdateService()),
]);
```

검증:
```bash
dart run tool/configure_app.dart
# Status: OK
```

---

## §3 디자인 시스템 적용 (15분)

### 팔레트 커스터마이징

```dart
// lib/theme/my_items_palette.dart
import 'package:flutter/material.dart';
import 'package:my_items/core/theme/app_palette.dart';

class MyItemsPalette extends AppPalette {
  @override String get id => 'my-items-default';
  @override String get name => 'My Items';
  @override Color get seed => const Color(0xFFFF6B35);  // 오렌지
  @override Color get accent => const Color(0xFF1A1A2E);
}
```

### main.dart 에서 교체

```dart
// lib/main.dart
AppPaletteRegistry.install(MyItemsPalette());
```

`flutter run` → 앱 색상이 오렌지 톤으로 전환됨 확인.

---

## §4 AppConfig 설정 (5분)

```dart
// lib/main.dart
AppConfig.init(
  appSlug: 'my-items',                              // ← 백엔드와 동일
  baseUrl: 'https://api.example.com',
  environment: Environment.dev,
  supportEmail: 'support@example.com',
  privacyUrl: 'https://example.com/privacy',
  termsUrl: 'https://example.com/terms',
  appVersion: '1.0.0',
);
```

환경 변수로 baseUrl 스위칭 (선택):

```dart
baseUrl: String.fromEnvironment('BASE_URL', defaultValue: 'http://localhost:8080'),
```

---

## §5 도메인 모델 정의 (15분)

### 모델 클래스

```dart
// lib/features/item/models/item.dart
class Item {
  final int id;
  final String title;
  final String? description;
  final DateTime createdAt;

  const Item({
    required this.id,
    required this.title,
    this.description,
    required this.createdAt,
  });

  factory Item.fromJson(Map<String, dynamic> json) => Item(
    id: json['id'] as int,
    title: json['title'] as String,
    description: json['description'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'createdAt': createdAt.toIso8601String(),
  };
}
```

---

## §6 Repository (15분)

```dart
// lib/features/item/item_repository.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:my_items/common/providers.dart';
import 'package:my_items/kits/backend_api_kit/api_client.dart';
import 'package:my_items/kits/backend_api_kit/api_response.dart';

import 'models/item.dart';

class ItemRepository {
  final ApiClient _api;
  ItemRepository({required ApiClient api}) : _api = api;

  Future<PageResponse<Item>> list({int page = 0}) async {
    final res = await _api.get<PageResponse<Item>>(
      '/items',
      query: {'page': page, 'size': 20},
      fromData: (data) => PageResponse.fromJson(data, Item.fromJson),
    );
    return res.data!;
  }

  Future<Item> create(String title, String? description) async {
    final res = await _api.post<Item>(
      '/items',
      body: {'title': title, 'description': description},
      fromData: Item.fromJson,
    );
    return res.data!;
  }

  Future<void> delete(int id) async {
    await _api.delete('/items/$id');
  }
}

final itemRepositoryProvider = Provider<ItemRepository>((ref) {
  return ItemRepository(api: ref.watch(apiClientProvider));
});
```

---

## §7 ViewModel + State (20분)

```dart
// lib/features/item/item_list_view_model.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:my_items/kits/backend_api_kit/api_exception.dart';

import 'item_repository.dart';
import 'models/item.dart';

class ItemListState {
  final bool isLoading;
  final List<Item> items;
  final String? errorCode;
  final String? errorMessage;

  const ItemListState({
    this.isLoading = false,
    this.items = const [],
    this.errorCode,
    this.errorMessage,
  });

  ItemListState copyWith({
    bool? isLoading,
    List<Item>? items,
    String? errorCode,
    String? errorMessage,
  }) {
    return ItemListState(
      isLoading: isLoading ?? this.isLoading,
      items: items ?? this.items,
      errorCode: errorCode,
      errorMessage: errorMessage,
    );
  }
}

class ItemListViewModel extends StateNotifier<ItemListState> {
  final Ref _ref;

  ItemListViewModel(this._ref) : super(const ItemListState());

  Future<void> load() async {
    state = state.copyWith(isLoading: true, errorCode: null, errorMessage: null);
    try {
      final page = await _ref.read(itemRepositoryProvider).list();
      state = state.copyWith(isLoading: false, items: page.content);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorCode: safeErrorCode(e, fallbackCode: 'FETCH_FAILED'),
        errorMessage: safeErrorMessage(e),
      );
    }
  }

  Future<void> refresh() async {
    try {
      final page = await _ref.read(itemRepositoryProvider).list();
      state = state.copyWith(items: page.content);
    } catch (e) {
      state = state.copyWith(errorCode: safeErrorCode(e));
    }
  }

  Future<void> delete(int id) async {
    try {
      await _ref.read(itemRepositoryProvider).delete(id);
      state = state.copyWith(items: state.items.where((i) => i.id != id).toList());
    } catch (e) {
      state = state.copyWith(errorCode: safeErrorCode(e, fallbackCode: 'DELETE_FAILED'));
    }
  }
}

final itemListViewModelProvider = StateNotifierProvider.autoDispose<ItemListViewModel, ItemListState>(
  ItemListViewModel.new,
);
```

---

## §8 Screen (20분)

```dart
// lib/features/item/item_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:my_items/core/i18n/app_localizations.dart';
import 'package:my_items/core/widgets/skeleton_loading.dart';
import 'package:my_items/core/widgets/empty_view.dart';

import 'item_list_view_model.dart';

class ItemListScreen extends ConsumerStatefulWidget {
  const ItemListScreen({super.key});

  @override
  ConsumerState<ItemListScreen> createState() => _ItemListScreenState();
}

class _ItemListScreenState extends ConsumerState<ItemListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(itemListViewModelProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(itemListViewModelProvider);
    final vm = ref.read(itemListViewModelProvider.notifier);
    final s = S.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(s.myItems)),
      body: _buildBody(state, vm, s),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openAddDialog(context, vm),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildBody(ItemListState state, ItemListViewModel vm, S s) {
    if (state.errorCode != null) {
      return Center(child: Text(s.errorGeneric));
    }
    if (state.isLoading) {
      return SkeletonLoading(enabled: true, child: _buildList(state, vm));
    }
    if (state.items.isEmpty) {
      return EmptyView(
        icon: Icons.inbox,
        message: s.noItems,
        action: TextButton(
          onPressed: () => _openAddDialog(context, vm),
          child: Text(s.addFirstItem),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: vm.refresh,
      child: _buildList(state, vm),
    );
  }

  Widget _buildList(ItemListState state, ItemListViewModel vm) {
    return ListView.builder(
      itemCount: state.items.length,
      itemBuilder: (context, i) {
        final item = state.items[i];
        return Dismissible(
          key: ValueKey(item.id),
          onDismissed: (_) => vm.delete(item.id),
          background: Container(color: Colors.red),
          child: ListTile(
            title: Text(item.title),
            subtitle: Text(item.description ?? ''),
          ),
        );
      },
    );
  }

  void _openAddDialog(BuildContext context, ItemListViewModel vm) {
    // 추가 dialog 구현 (생략)
  }
}
```

---

## §9 i18n 키 추가 (10분)

```json
// lib/core/i18n/app_ko.arb
{
  "myItems": "내 아이템",
  "noItems": "아이템이 없어요",
  "addFirstItem": "첫 아이템 추가하기",
  "errorGeneric": "오류가 발생했어요"
}
```

```json
// lib/core/i18n/app_en.arb
{
  "myItems": "My Items",
  "noItems": "No items yet",
  "addFirstItem": "Add your first item",
  "errorGeneric": "Something went wrong"
}
```

```bash
flutter gen-l10n
```

---

## §10 라우팅 추가 (10분)

```dart
// lib/common/router/app_router.dart (파생 레포에서 확장)
GoRoute(
  path: '/items',
  builder: (context, state) => const ItemListScreen(),
),
```

또는 `NavShellKit` 의 탭으로:

```dart
NavShellKit(tabs: [
  NavTab(path: '/items', icon: Icons.list, label: s.myItems),
  NavTab(path: '/settings', icon: Icons.settings, label: s.settings),
]),
```

---

## §11 테스트 (20분)

### ViewModel 테스트

```dart
// test/features/item/item_list_view_model_test.dart
void main() {
  group('ItemListViewModel', () {
    late ProviderContainer container;
    late MockItemRepository repo;

    setUp(() {
      repo = MockItemRepository();
      container = ProviderContainer(overrides: [
        itemRepositoryProvider.overrideWithValue(repo),
      ]);
    });

    tearDown(() => container.dispose());

    test('load populates items', () async {
      when(repo.list()).thenAnswer((_) async => PageResponse(
        content: [Item(id: 1, title: 'Test', createdAt: DateTime.now())],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      ));

      await container.read(itemListViewModelProvider.notifier).load();

      expect(container.read(itemListViewModelProvider).items, hasLength(1));
    });
  });
}
```

---

## §12 실행 · 검증

```bash
flutter run
```

- [ ] 로그인 화면 (auth_kit) 자동 리다이렉트
- [ ] 로그인 후 홈 · 아이템 목록 탭 접근
- [ ] 초기 로딩 Skeleton 표시
- [ ] 빈 상태 시 EmptyView
- [ ] 아이템 추가 · 삭제 동작
- [ ] 에러 시 메시지 표시
- [ ] Pull-to-refresh 동작
- [ ] i18n 키 정상 표시 (한국어 · 영어 전환)

---

## 다음 단계

- 더 많은 화면 추가
- 인증 후 자동 redirect · 토큰 refresh 확인
- PostHog 이벤트 트래킹
- 배포 ([`Deployment`](./deployment.md))

---

## 📖 책 목차 — Journey 5단계

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | [`Onboarding`](./onboarding.md) | 파생 레포 최초 셋업 (2단계) |
| → 다음 | [`Deployment`](./deployment.md) | 배포 준비 · 첫 운영 배포 (6 · 7단계) |

**막혔을 때**: [`함정`](./dogfood-pitfalls.md) / [`FAQ`](./dogfood-faq.md)
