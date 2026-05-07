# FeatureKit Contract

`AppKit` 추상 클래스 + `AppKits` 레지스트리의 **전체 명세**. 각 속성 · 메서드의 역할 · 호출 시점 · 주의점. 설계 근거는 [`ADR-003`](../philosophy/adr-003-featurekit-registry.md) 참조.

---

## AppKit 인터페이스 전체

```dart
// lib/core/kits/app_kit.dart 전체
abstract class AppKit {
  String get name;                                     // 디버그 이름
  List<Type> get requires => const [];                 // 의존 Kit 타입
  int get redirectPriority => 100;                     // 라우팅 우선순위

  List<Override> get providerOverrides => const [];    // Riverpod 기여
  List<RouteBase> get routes => const [];              // go_router 라우트
  List<NavigatorObserver> get navigatorObservers => const [];
  List<BootStep> get bootSteps => const [];            // 스플래시 단계
  RedirectRule? buildRedirect() => null;               // 라우팅 게이트
  Listenable? get refreshListenable => null;           // 라우터 리빌드 트리거

  Future<void> onInit() async {}                       // install 시 호출
  Future<void> onDispose() async {}                    // 롤백 · 테스트 정리
}
```

---

## 각 속성 · 메서드 상세

### `name` — 디버그 이름

- **타입**: `String`
- **호출 시점**: 에러 메시지 · 로그
- **예**: `'AuthKit'`, `'BackendApiKit'`

### `requires` — 의존 Kit 선언

- **타입**: `List<Type>`
- **호출 시점**: `AppKits.install` 시 검증
- **예**: `requires: [BackendApiKit]`
- **주의**: Kit 클래스 Type 만. 다른 Kit 의 Provider · 클래스를 import 하진 않음 (타입만)

### `redirectPriority` — 라우팅 우선순위

- **타입**: `int` (기본 100)
- **규칙**: 낮을수록 먼저 실행
- **권장**: `UpdateKit: 1`, `AuthKit: 10`, `OnboardingKit: 50`
- 상세: [`ADR-018`](../philosophy/adr-018-redirect-priority.md)

### `providerOverrides` — Riverpod 기여

- **타입**: `List<Override>`
- **호출 시점**: `AppKits.allProviderOverrides` 수집 → `ProviderContainer` 생성
- **예**:
  ```dart
  @override
  List<Override> get providerOverrides {
    if (ObservabilityEnv.isSentryEnabled) {
      return [crashServiceProvider.overrideWithValue(SentryCrashService())];
    }
    return [];
  }
  ```

### `routes` — go_router 라우트

- **타입**: `List<RouteBase>`
- **호출 시점**: `AppKits.allRoutes` 수집 → `GoRouter(routes: [...])` 조립
- **예**: `AuthKit` 이 `/login`, `/forgot-password`, `/verify-email` 기여

### `navigatorObservers` — NavigatorObserver 기여

- **타입**: `List<NavigatorObserver>`
- **호출 시점**: `AppKits.allNavigatorObservers` 수집 → go_router 의 `observers` 인자
- **예**: `ObservabilityKit` 의 `AnalyticsNavigatorObserver` (화면 자동 추적)

### `bootSteps` — 부팅 단계

- **타입**: `List<BootStep>`
- **호출 시점**: `AppKits.allBootSteps` 수집 → `SplashController.run()`
- **전제**: `AppKits.attachContainer` 호출 후에야 유의미한 값 반환 (container.read 접근)
- 상세: [`ADR-008`](../philosophy/adr-008-boot-step.md)

### `buildRedirect` — 라우팅 규칙

- **타입**: `RedirectRule? Function()` → 반환값은 `String? Function(BuildContext, GoRouterState)`
- **호출 시점**: 라우팅 평가 시 (refreshListenable 트리거)
- **null 반환**: 개입 안 함 → 다음 Kit 의 rule 실행
- **String 반환**: 해당 경로로 리다이렉트 (첫 non-null 이 최종)
- 상세: [`ADR-018`](../philosophy/adr-018-redirect-priority.md)

### `refreshListenable` — 라우터 리빌드 트리거

- **타입**: `Listenable?`
- **호출 시점**: go_router 의 `refreshListenable` 에 `AppKits.compositeRefreshListenable` 전달
- **역할**: 이 Listenable 이 `notifyListeners` 하면 라우터가 redirect 재평가
- **예**: `AuthKit` 의 `_AuthRefreshBridge` (AuthState 스트림 → ChangeNotifier)

### `onInit` — 설치 후크

- **타입**: `Future<void>`
- **호출 시점**: `install([...])` 중 해당 Kit 설치 직후, container 생성 전
- **용도**: Kit 내부 초기화 (채널 등록 등)
- **제한**: container 아직 없음 → Provider 접근 불가

### `onDispose` — 정리 후크

- **타입**: `Future<void>`
- **호출 시점**:
  1. `install` 실패 시 역순 롤백
  2. `resetForTest()` 호출 시
- **용도**: 스트림 구독 해제 · 네이티브 채널 정리
- **예외 처리**: 내부에서 throw 해도 상위에서 삼킴 (best-effort)

---

## AppKits 레지스트리 API

```dart
class AppKits {
  // 설치
  static Future<void> install(List<AppKit> kits);

  // 컨테이너 부착
  static void attachContainer(ProviderContainer container);
  static ProviderContainer get container;                 // nullable 아님 (Error if null)
  static ProviderContainer? get maybeContainer;

  // 조회
  static bool has<T extends AppKit>();
  static T? get<T extends AppKit>();
  static List<AppKit> get all;                            // 설치 순서

  // 기여 수집
  static List<Override> get allProviderOverrides;
  static List<RouteBase> get allRoutes;
  static List<BootStep> get allBootSteps;
  static List<NavigatorObserver> get allNavigatorObservers;
  static Listenable? get compositeRefreshListenable;
  static List<RedirectRule> get redirectRules;            // priority 정렬

  // 테스트
  @visibleForTesting
  static Future<void> resetForTest();
}
```

---

## 호출 순서 (main.dart)

```
1. WidgetsFlutterBinding.ensureInitialized()
2. AppPaletteRegistry.install(DefaultPalette())
   AppTypefaceRegistry.install(DefaultTypeface())
3. AppConfig.init(...)
4. (조건부) SentryFlutter.init  — appRunner 로 _bootstrap 실행
5. PrefsStorage().init()
6. AppKits.install([BackendApiKit(), AuthKit(), ...])
   ├─ 중복 체크
   ├─ requires 의존성 검증
   ├─ 각 Kit.onInit()
   └─ 실패 시 역순 rollback
7. final container = ProviderContainer(overrides: [...AppKits.allProviderOverrides, ...])
8. AppKits.attachContainer(container)
9. container.read(crashServiceProvider).init()
10. SplashController(steps: AppKits.allBootSteps).run()
11. runApp(UncontrolledProviderScope(container: container, child: const App()))
```

**순서 강제**: 7 ↔ 8 바뀌면 BootStep 에서 `container.read` 가 StateError.

---

## 새 Kit 작성 템플릿

```dart
// lib/kits/my_kit/my_kit.dart
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/kits/app_kit.dart';
import '../../common/splash/boot_step.dart';

class MyKit extends AppKit {
  @override String get name => 'MyKit';
  @override List<Type> get requires => const [];         // 의존 Kit 있으면 추가
  @override int get redirectPriority => 100;             // 기본값

  @override
  List<Override> get providerOverrides => [];            // 필요 시

  @override
  List<RouteBase> get routes => [];                      // 라우트 있으면

  @override
  List<BootStep> get bootSteps => [];                    // 부팅 단계 있으면

  @override
  RedirectRule? buildRedirect() => null;                 // 라우팅 게이트 있으면

  @override
  Future<void> onInit() async {}                         // 필요 시

  @override
  Future<void> onDispose() async {}                      // 정리 필요 시
}
```

함께 작성:
- `lib/kits/my_kit/kit_manifest.yaml`
- `lib/kits/my_kit/README.md`
- `test/kits/my_kit/my_kit_contract_test.dart`

---

## Code References

- [`lib/core/kits/app_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/kits/app_kit.dart) — 54줄 전체
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/kits/app_kits.dart) — 184줄 레지스트리

---

## 관련 문서

- [`ADR-003 · FeatureKit`](../philosophy/adr-003-featurekit-registry.md) — 설계 근거
- [`ADR-008 · BootStep`](../philosophy/adr-008-boot-step.md) — bootSteps 상세
- [`ADR-018 · redirectPriority`](../philosophy/adr-018-redirect-priority.md)
- [`boot-sequence.md`](./boot-sequence.md) — 실제 부팅 흐름
- [`Features 인덱스`](../features/README.md) — 14개 Kit 구현체
