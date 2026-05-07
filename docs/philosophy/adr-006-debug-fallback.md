# Debug_Fallback

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `AnalyticsService`, `CrashService`, `NotificationService` 3개 인터페이스에 `Debug*` 폴백 제공. 실제 구현체는 `observability_kit`, `notifications_kit` 가 Provider override 로 교체.

## 결론부터

외부 SDK (Sentry · PostHog · FCM 등) 에 의존하는 서비스는 전부 **추상 인터페이스** 로 정의하고, 템플릿은 **Debug 폴백 구현체** 를 기본 제공해요. DSN · API Key 주입이 없거나 Kit 이 활성화되지 않아도 앱은 정상 부팅 → Debug 구현체가 `print` 로 출력만. 파생 레포에서 실제 Kit 활성화 + 환경 변수 주입 시 Provider override 로 진짜 구현체가 자동 연결돼요.

## 왜 이런 고민이 시작됐나?

관측성 · 알림 · 분석 같은 서비스는 **외부 SDK 에 깊게 의존** 해요. Sentry 는 DSN, PostHog 는 API Key, FCM 은 Firebase config 가 있어야 초기화 가능. 그런데 템플릿 상태에선:

- DSN · API Key 가 없고 (실제 값을 커밋 금지 — ADR-001)
- Firebase 프로젝트도 없고
- 파생 레포마다 이 서비스들을 쓸지 말지 **선택**

이때 "외부 서비스가 없는데 앱이 돌아가야" 하는 모순된 상황이 됩니다. 세 압력이 부딪혀요.

**압력 A — 템플릿 부팅 가능성**  
파생 레포 개발자가 `flutter run` 을 치면 **아무 설정 없이도 앱이 떠야** 해요. "Sentry DSN 을 먼저 설정해야 부팅됩니다" 라면 진입 장벽이 너무 커요.

**압력 B — ViewModel 의 서비스 접근 일관성**  
ViewModel 코드가 `analyticsProvider.trackEvent(...)` 같이 호출하는데, 어떤 환경이든 **이 호출이 실패하지 않아야** 해요. null check · try-catch 로 감싸면 사용처 N 곳에서 보일러플레이트 폭발.

**압력 C — 실제 구현체 교체 용이성**  
파생 레포에서 Sentry DSN 을 주입하면 **코드 수정 없이** Debug 구현체가 Sentry 구현체로 swap 돼야 해요. 개발자가 `if (useSentry) ...` 분기를 여기저기 넣으면 안 됨.

이 결정이 답해야 했던 물음이에요.

> **외부 SDK 가 없어도 앱이 돌되, 있으면 자동으로 진짜 구현체로 교체되는 구조** 는 무엇인가?

## 고민했던 대안들

### Option 1 — Nullable Provider

Sentry 가 비활성이면 `crashServiceProvider` 가 `null` 반환.

```dart
final crashServiceProvider = Provider<CrashService?>((ref) {
  return SENTRY_DSN.isNotEmpty ? SentryCrashService() : null;
});

// ViewModel
ref.read(crashServiceProvider)?.reportError(e, st);  // 매번 ?.
```

- **장점**: 타입 시스템이 "없을 수 있음" 을 표현.
- **단점 1**: **호출처 N 곳에서 `?.` 반복**. `analyticsProvider?.trackEvent(...)` 가 100곳이면 100번 null 체크.
- **단점 2**: 호출이 silently no-op 돼서 버그 추적 어려움 — "왜 이벤트가 안 찍히지? Provider 가 null 인가?" 를 매번 확인.
- **탈락 이유**: 압력 B 위반. 호출처가 복잡해짐.

### Option 2 — 조건부 import + Dart `conditional import`

```dart
import 'debug_crash_service.dart'
    if (dart.library.io) 'sentry_crash_service.dart';
```

- **장점**: Dart 공식 기능. 컴파일 시점에 구현체 선택.
- **단점 1**: `conditional import` 는 **플랫폼 조건** 만 지원 (web / io). Sentry DSN 유무 같은 **런타임 값** 은 분기 불가.
- **단점 2**: 그럼에도 Sentry SDK 는 import 되어 바이너리에 포함. tree-shaking 에 도움 안 됨.
- **탈락 이유**: Sentry DSN 유무는 런타임 환경 변수 기반이라 conditional import 로 해결 불가.

### Option 3 — 추상 인터페이스 + Debug 폴백 + Provider override ★ (채택)

`AnalyticsService` 같은 추상 클래스 선언. 기본 `Provider` 는 `DebugAnalyticsService` 반환. Kit 이 활성화되면 `providerOverrides` 로 `PostHogAnalyticsService` 등으로 교체.

- **압력 A 만족**: Debug 구현체는 DSN · 환경 변수 없이도 동작 (print 만).
- **압력 B 만족**: ViewModel 은 항상 `AnalyticsService` 타입으로 접근. nullable 아님.
- **압력 C 만족**: Provider override 로 투명하게 swap. 호출처 수정 0.

## 결정

### 1. 추상 인터페이스 (`core/analytics/`)

```dart
// lib/core/analytics/analytics_service.dart 발췌
abstract class AnalyticsService {
  Future<void> trackScreen(String screenName, {Map<String, dynamic>? properties});
  Future<void> trackEvent(String eventName, {Map<String, dynamic>? properties});
  Future<void> identify(String userId, {Map<String, dynamic>? traits});
  Future<void> reset();
}

class DebugAnalyticsService implements AnalyticsService {
  @override
  Future<void> trackScreen(String screenName, {Map<String, dynamic>? properties}) async {
    assert(() {
      print('[Analytics] Screen: $screenName $properties');
      return true;
    }());
  }
  // ...
}
```

```dart
// lib/core/analytics/crash_service.dart 발췌
abstract class CrashService {
  Future<void> init();
  Future<void> reportError(dynamic error, StackTrace? stackTrace, {bool fatal = false});
  Future<void> setUser(String userId, {String? email});
  Future<void> clearUser();
  Future<void> addBreadcrumb(String message, {Map<String, dynamic>? data});
}

class DebugCrashService implements CrashService {
  @override
  Future<void> init() async {
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      reportError(details.exception, details.stack);
      previous?.call(details);  // ← 체인 호출로 Sentry 와 공존 가능
    };
  }

  @override
  Future<void> reportError(dynamic error, StackTrace? stackTrace, {bool fatal = false}) async {
    if (kDebugMode) {
      print('[Crash] ${fatal ? "FATAL " : ""}$error');
      if (stackTrace != null) print(stackTrace);
    }
  }
  // ...
}
```

### 2. 기본 Provider (`common/providers.dart`)

```dart
// lib/common/providers.dart 발췌
final analyticsProvider = Provider<AnalyticsService>(
  (ref) => DebugAnalyticsService(),  // ← 기본은 Debug
);

final crashServiceProvider = Provider<CrashService>(
  (ref) => DebugCrashService(),
);

final notificationServiceProvider = Provider<NotificationService>((ref) {
  final service = DebugNotificationService();
  ref.onDispose(service.dispose);
  return service;
});
```

### 3. Kit 활성화 시 교체 (Provider override)

```dart
// lib/kits/observability_kit/observability_kit.dart 개요
class ObservabilityKit extends AppKit {
  @override
  List<Override> get providerOverrides {
    final overrides = <Override>[];
    if (ObservabilityEnv.isSentryEnabled) {
      overrides.add(crashServiceProvider.overrideWithValue(SentryCrashService()));
    }
    if (ObservabilityEnv.isPostHogEnabled) {
      overrides.add(analyticsProvider.overrideWithValue(PostHogAnalyticsService()));
    }
    return overrides;
  }
}
```

환경 변수 (`--dart-define=SENTRY_DSN=...`) 가 주입되면 `isSentryEnabled == true` → Provider override → ViewModel 에서 `ref.read(crashServiceProvider)` 가 `SentryCrashService` 반환.

### 4. ViewModel 사용 (교체 여부 무관)

```dart
// 어떤 ViewModel
class MyViewModel extends StateNotifier<MyState> {
  final Ref _ref;

  Future<void> doSomething() async {
    try {
      // ...
      await _ref.read(analyticsProvider).trackEvent('did_something');  // ← 항상 존재
    } catch (e, st) {
      await _ref.read(crashServiceProvider).reportError(e, st);
    }
  }
}
```

Debug 환경이면 콘솔 print, 프로덕션 환경이면 Sentry 전송. ViewModel 은 구분 안 함.

### 설계 선택 포인트

**포인트 1 — Debug 구현체는 `assert` 로 감싸 production build 에서 제거**  
`print` 를 프로덕션 빌드까지 남기면 불필요한 I/O. `assert(() { print(...); return true; }())` 관용으로 **debug 빌드에서만** 실행. Release 빌드는 no-op.

**포인트 2 — `FlutterError.onError` 는 체인 호출**  
`DebugCrashService.init()` 이 `FlutterError.onError` 를 덮어쓰면 **먼저 등록된 Sentry 핸들러가 사라져요**. 그래서 `previous?.call(details)` 로 체인 호출. 순서는 Sentry 가 먼저 init 되고 Debug 가 뒤에 래핑되는 구조.

**포인트 3 — 인터페이스 위치 — 보통 `core/`, 단일 Kit 내부 인터페이스는 Kit 폴더 허용**  
**여러 Kit · ViewModel 이 공유하는 인터페이스** 는 `core/` 에 둬요. `AnalyticsService` · `CrashService` 는 모든 Kit 에서 호출되니 `core/analytics/` 에 두고, 실제 `PostHogAnalyticsService` 는 `kits/observability_kit/` 에 분리해서 ADR-002 의 의존 방향 규칙 (kits → core) 을 지켜요.

반면 **단일 Kit 내부에서만 쓰이는 인터페이스** (예: `NotificationService` — `notifications_kit` 외에는 호출자가 없음) 는 해당 Kit 폴더 (`lib/kits/notifications_kit/notification_service.dart`) 에 정의해요. core 에 두면 오히려 "필요 없는 추상이 core 에 노출" 되는 셈이라 실용성을 우선해요. 의존 방향은 여전히 단방향 (`features → common → kits → core`) 으로 유지돼요.

**포인트 4 — `Debug*` 네이밍 관용**  
`NoopAnalyticsService` · `FakeAnalyticsService` 대신 `DebugAnalyticsService` 로 명명. 이유는 **개발 중엔 print 로 가시성을 제공** 하니까 완전 no-op 이 아님. "디버그 빌드용 구현" 이라는 의도를 이름에 담음.

**포인트 5 — Provider 는 항상 존재, override 만 바뀜**  
`analyticsProvider` 자체는 providers.dart 에 무조건 선언. `ObservabilityKit` 이 없어도 `ref.read(analyticsProvider)` 는 Debug 구현체 반환. **Kit 이 "추가 기능" 이 아니라 "구현체 swap"** 역할을 해요.

## 이 선택이 가져온 것

### 긍정적 결과

- **첫 실행 장벽 0**: 파생 레포 `flutter run` → 아무 환경 변수 없이도 부팅. Sentry · PostHog · Firebase 설정은 나중에.
- **ViewModel 코드 불변**: 환경에 무관하게 `ref.read(analyticsProvider).trackEvent(...)`. 조건 분기 · null 체크 0.
- **테스트 용이성**: 테스트에서 `analyticsProvider.overrideWithValue(MockAnalytics())` 한 줄. 실제 Sentry SDK 로딩 없이 단위 테스트 가능.
- **개발 중 가시성**: `DebugAnalyticsService` 가 콘솔에 이벤트 · 에러 출력 → "어 트래킹이 제대로 돼?" 로컬 검증이 쉬움.
- **점진적 Kit 활성화**: 처음엔 observability_kit 꺼두고 나중에 활성화. 호출 코드 변경 없음.

### 부정적 결과

- **"Debug 로 돌아가는 걸 프로덕션으로 착각"**: 배포 전 DSN 주입 여부를 **개발자가 직접 확인** 해야 함. "Sentry 가 안 찍혀요" 이슈의 80% 가 DSN 주입 누락.
- **인터페이스 변경 비용**: `AnalyticsService.trackEvent` 시그니처 바꾸면 Debug · Sentry · PostHog 구현체 3개 모두 수정.
- **매 Kit 마다 인터페이스 설계 피로**: 새 외부 서비스 추가 시 "이 서비스의 최소 인터페이스는?" 고민 필요. 너무 좁으면 확장 어려움, 너무 넓으면 Debug 구현 부담.
- **Debug 구현 누락 시 Null Pointer**: 새 메서드를 인터페이스에 추가 후 Debug 구현에 빼먹으면 `NoSuchMethodError`. abstract method 는 dart analyzer 가 잡지만 default 구현 놓치기 쉬움.

## 교훈

### 교훈 1 — "인터페이스 + 구현 분리" 의 진짜 이득은 **"동작 가능 범위 넓히기"**

초기엔 "테스트 용이성" 때문에 인터페이스를 도입했어요. 하지만 실제 가치는 **"아무 환경에서나 앱이 돌게"** 였어요. 신입 개발자가 레포 클론 → `flutter run` → 바로 화면 → 나중에 Sentry 설정. 이 진입장벽 0 이 앱 공장의 scale 에 결정적.

**교훈**: 인터페이스 분리의 가치는 테스트만이 아니에요. **"외부 의존 없이 돌 수 있는 최소 기능"** 을 만드는 것이 더 큰 가치.

### 교훈 2 — `FlutterError.onError` 덮어쓰기 주의

처음엔 `DebugCrashService.init()` 이 단순히 `FlutterError.onError = ...` 로 덮어썼어요. 그 결과 Sentry 가 먼저 init 됐더라도 Debug 가 Sentry 핸들러를 **무효화** 시키는 버그. 몇 시간 디버깅 후 `previous?.call(details)` 체인 관용을 발견.

**교훈**: 전역 훅 (FlutterError.onError, zoneSpecification 등) 은 **덮어쓰지 말고 체인 호출**. 먼저 등록된 것을 보존하는 습관.

### 교훈 3 — `--dart-define` 확인이 어려움

Sentry 가 안 찍혀서 "Sentry SDK 버그?" 의심했는데 원인은 `--dart-define=SENTRY_DSN=...` 누락. 런타임 검증 로직 (`ObservabilityEnv.isSentryEnabled`) 을 추가해서 부팅 로그에 `[Observability] Sentry: enabled/disabled` 를 출력하니 디버깅 30분 → 5초.

**교훈**: 환경 변수 기반 기능은 **부팅 시 상태 로그** 를 반드시 출력. "어 이게 켜진 건가?" 를 5초 안에 확인 가능하게.

## 관련 사례 (Prior Art)

- [Riverpod `overrideWith` 공식 가이드](https://riverpod.dev/docs/essentials/testing#testing-a-provider) — Provider 교체 패턴의 기반
- [Dependency Injection in Flutter](https://flutter.dev/blog/2021/12/09/dependency-injection-flutter) — 공식 블로그의 DI 관점
- [Sentry Flutter 공식 통합](https://docs.sentry.io/platforms/flutter/) — `SentryCrashService` 구현의 기반
- [PostHog Flutter 공식 통합](https://posthog.com/docs/libraries/flutter) — 동일
- [Null Object Pattern (Martin Fowler)](https://martinfowler.com/bliki/NullObject.html) — Debug 구현체의 개념적 뿌리

## Code References

**추상 인터페이스 (core 레이어)**
- [`lib/core/analytics/analytics_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/analytics/analytics_service.dart) — 추상 + Debug 구현
- [`lib/core/analytics/crash_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/analytics/crash_service.dart) — 추상 + Debug 구현

**기본 Provider**
- [`lib/common/providers.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/common/providers.dart) — `analyticsProvider` · `crashServiceProvider` · `notificationServiceProvider` Debug 기본

**실제 구현체 (kits 레이어)**
- [`lib/kits/observability_kit/sentry_crash_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/sentry_crash_service.dart)
- [`lib/kits/observability_kit/posthog_analytics_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/posthog_analytics_service.dart)
- [`lib/kits/observability_kit/observability_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/observability_kit.dart) — `providerOverrides` 로 교체
- [`lib/kits/observability_kit/observability_env.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/observability_env.dart) — 환경 변수 감지

**notifications_kit 의 같은 패턴**
- [`lib/kits/notifications_kit/notification_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/notification_service.dart) — 추상 + Debug
- [`lib/kits/notifications_kit/fcm_notification_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/fcm_notification_service.dart) — FCM 구현

**관련 ADR**:
- [`ADR-002 · 3계층 모듈 구조`](./adr-002-layered-modules.md) — 인터페이스를 `core/` 에 두는 이유
- [`ADR-003 · FeatureKit 동적 레지스트리`](./adr-003-featurekit-registry.md) — Kit 이 `providerOverrides` 로 교체하는 메커니즘
- [`ADR-005 · Riverpod + MVVM`](./adr-005-riverpod-mvvm.md) — Provider override 가 동작하는 DI 기반
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — "진입장벽 0" 이 솔로 운영에 가치 있는 이유
