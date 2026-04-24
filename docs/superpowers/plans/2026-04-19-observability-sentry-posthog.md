# 관측성 도입 (Sentry + PostHog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 템플릿의 비어있는 관측성을 Sentry(크래시/에러) + PostHog(사용자 행동)로 채워, fork한 앱이 출시 즉시 크래시 리포팅과 이벤트 추적을 받을 수 있게 한다.

**Architecture:** 기존 FeatureKit 패턴(ads_kit 등)을 따라 **`observability_kit`으로 분리**한다. 핵심 원칙:
- 기존 `CrashService` / `AnalyticsService` 인터페이스는 `lib/core/analytics/`에 유지 (기본 Debug 구현체 + override 지점).
- 실 구현체(`SentryCrashService`, `PostHogAnalyticsService`), observer, env 래퍼, `ObservabilityKit` AppKit 서브클래스는 **모두 `lib/kits/observability_kit/`에 배치**.
- `AppKits.install([..., ObservabilityKit()])` 설치 시에만 `crashServiceProvider`/`analyticsProvider`가 Sentry/PostHog 구현체로 교체됨. 미설치 시 Debug로 남음.
- `main.dart`는 `ObservabilityEnv.isSentryEnabled`이 true일 때만 `SentryFlutter.init`으로 runZonedGuarded 래핑, 아니면 plain bootstrap.
- DSN/Key 부재 시 kit이 설치돼 있어도 해당 서비스는 Debug로 자동 폴백.
- PostHog 화면 자동 추적은 `GoRouter.observers`에 kit의 `AnalyticsNavigatorObserver`를 연결.
- `app.dart`의 `authStreamProvider` 리스너가 로그인/로그아웃 시점에 `identify`/`setUser`/`reset`/`clearUser`를 호출.

**Tech Stack:** Flutter 3.32 / Riverpod / GoRouter / `sentry_flutter` ^8.x / `posthog_flutter` ^4.x / `--dart-define` 기반 환경 변수 주입

---

## File Structure (Kit-based 재설계)

**Create (관측성 kit 디렉토리):**
- `lib/kits/observability_kit/observability_kit.dart` — `ObservabilityKit extends AppKit`
- `lib/kits/observability_kit/observability_env.dart` — `--dart-define` 래퍼 (DSN/Key)
- `lib/kits/observability_kit/sentry_crash_service.dart` — Sentry 구현체
- `lib/kits/observability_kit/posthog_analytics_service.dart` — PostHog 구현체
- `lib/kits/observability_kit/analytics_navigator_observer.dart` — 화면 추적 옵저버
- `lib/kits/observability_kit/kit_manifest.yaml` — 매니페스트 (외부 deps 선언)
- `lib/kits/observability_kit/README.md` — fork 시 활성화 가이드
- `.env.example` — 개발자용 템플릿 **(✅ Task 1에서 완료됨)**
- `test/kits/observability_kit/observability_env_test.dart`
- `test/kits/observability_kit/sentry_crash_service_test.dart`
- `test/kits/observability_kit/posthog_analytics_service_test.dart`
- `test/kits/observability_kit/analytics_navigator_observer_test.dart`

**Delete:**
- `lib/core/config/observability_env.dart` (Task 2에서 여기 생성됐지만 kit으로 이동)
- `test/core/config/observability_env_test.dart` (kit/ 하위로 이동)

**Modify:**
- `pubspec.yaml` — `sentry_flutter`, `posthog_flutter` 의존성 **(✅ Task 1 완료)**
- `.gitignore` — `.env`, `key.properties`, Firebase config 등 **(✅ Task 1 완료)**
- `lib/main.dart` — `ObservabilityEnv.isSentryEnabled`일 때만 `SentryFlutter.init` 래핑 + `AppKits.install`에 `ObservabilityKit()` 추가
- `lib/common/router/app_router.dart` — Kit이 기여한 observers를 `GoRouter.observers`에 연결 (via `AppKits.allNavigatorObservers` 또는 직접 주입)
- `lib/app.dart` — `authStreamProvider` 리스너에서 `crashServiceProvider`/`analyticsProvider` 통해 identify/setUser 호출 (Kit 설치 여부 무관 — Debug 구현체도 호출은 받되 no-op)
- `lib/core/kits/app_kit.dart` — (필요 시) `List<NavigatorObserver> get navigatorObservers` getter 추가 → kit이 observer 기여 가능
- `lib/core/kits/app_kits.dart` — (필요 시) `allNavigatorObservers` 수집 로직
- `app_kits.yaml` — 주석 예시에 `observability_kit: {}` 추가

---

## Task 1: 의존성 + .gitignore + .env.example

**Files:**
- Modify: `pubspec.yaml:9` (dependencies 섹션 끝)
- Modify: `.gitignore` (append)
- Create: `.env.example`

- [ ] **Step 1: pubspec.yaml에 의존성 추가**

`pubspec.yaml` 67번 라인 `intl: ^0.20.2` 아래에 추가:

```yaml
  # Observability
  sentry_flutter: ^8.9.0
  posthog_flutter: ^4.10.1
```

- [ ] **Step 2: 의존성 설치**

Run: `cd /Users/sch/devel/workspace/flutter-mobile-template && flutter pub get`
Expected: `Got dependencies!` 메시지, 에러 없음

- [ ] **Step 3: .gitignore 확장**

`.gitignore` 파일 맨 아래에 추가:

```gitignore

# Environment variables (runtime secrets + client identifiers)
.env
.env.local
.env.production
.env.*.local
!.env.example

# Firebase / Google Services (앱 공장 fork 시 각자 발급)
android/app/google-services.json
ios/Runner/GoogleService-Info.plist

# Android signing
android/key.properties
android/app/upload-keystore.jks
*.jks
*.keystore

# iOS signing
ios/Runner.xcworkspace/xcuserdata/
ios/fastlane/report.xml
```

- [ ] **Step 4: .env.example 생성**

Create `.env.example`:

```bash
# 이 파일은 커밋됨. 실제 값은 .env 또는 --dart-define으로 주입.
#
# 로컬 개발:
#   cp .env.example .env   (실제 값 채우고)
#   flutter run \
#     --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2) \
#     --dart-define=POSTHOG_KEY=$(grep POSTHOG_KEY .env | cut -d= -f2)
#
# CI: GitHub Secrets로 주입 (Phase 3 배포 단계에서 구성)

# Sentry (https://sentry.io → Settings → SDK Setup → Client Keys)
SENTRY_DSN=

# PostHog (https://posthog.com → Project Settings → Project API Key)
POSTHOG_KEY=
POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/sch/devel/workspace/flutter-mobile-template
git add pubspec.yaml pubspec.lock .gitignore .env.example
git commit -m "chore(observability): add sentry_flutter + posthog_flutter deps and env template"
```

---

## Task 2: observability_env.dart — `--dart-define` 래퍼

**Files:**
- Create: `lib/core/config/observability_env.dart`
- Test: `test/core/config/observability_env_test.dart`

- [ ] **Step 1: 실패 테스트 먼저 작성**

Create `test/core/config/observability_env_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/core/config/observability_env.dart';

void main() {
  group('ObservabilityEnv', () {
    test('returns empty strings when no dart-define is provided (default)', () {
      expect(ObservabilityEnv.sentryDsn, '');
      expect(ObservabilityEnv.postHogKey, '');
      expect(ObservabilityEnv.postHogHost, 'https://us.i.posthog.com');
    });

    test('isSentryEnabled is false when DSN is empty', () {
      expect(ObservabilityEnv.isSentryEnabled, isFalse);
    });

    test('isPostHogEnabled is false when key is empty', () {
      expect(ObservabilityEnv.isPostHogEnabled, isFalse);
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/sch/devel/workspace/flutter-mobile-template && flutter test test/core/config/observability_env_test.dart`
Expected: FAIL — `observability_env.dart` 파일 없음 (Target of URI doesn't exist)

- [ ] **Step 3: observability_env.dart 구현**

Create `lib/core/config/observability_env.dart`:

```dart
/// 관측성 SDK가 필요로 하는 환경 변수를 한 곳에서 읽는다.
///
/// 값은 빌드 시점에 `--dart-define=SENTRY_DSN=...` 형태로 주입된다.
/// 주입 없이 빌드하면 빈 문자열이 되고, 해당 SDK는 초기화되지 않는다
/// (main.dart에서 Debug 구현체로 폴백).
///
/// 예시:
/// ```
/// flutter run \
///   --dart-define=SENTRY_DSN=https://abc@o123.ingest.sentry.io/456 \
///   --dart-define=POSTHOG_KEY=phc_xxx
/// ```
class ObservabilityEnv {
  const ObservabilityEnv._();

  static const String sentryDsn =
      String.fromEnvironment('SENTRY_DSN', defaultValue: '');

  static const String postHogKey =
      String.fromEnvironment('POSTHOG_KEY', defaultValue: '');

  static const String postHogHost = String.fromEnvironment(
    'POSTHOG_HOST',
    defaultValue: 'https://us.i.posthog.com',
  );

  static bool get isSentryEnabled => sentryDsn.isNotEmpty;
  static bool get isPostHogEnabled => postHogKey.isNotEmpty;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/sch/devel/workspace/flutter-mobile-template && flutter test test/core/config/observability_env_test.dart`
Expected: All tests PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/core/config/observability_env.dart test/core/config/observability_env_test.dart
git commit -m "feat(observability): add ObservabilityEnv wrapper for --dart-define values"
```

---

## Task 3: SentryCrashService 구현

**Files:**
- Create: `lib/core/analytics/sentry_crash_service.dart`
- Test: `test/core/analytics/sentry_crash_service_test.dart`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/core/analytics/sentry_crash_service_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/core/analytics/crash_service.dart';
import 'package:app_template/core/analytics/sentry_crash_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SentryCrashService', () {
    test('implements CrashService interface', () {
      final service = SentryCrashService();
      expect(service, isA<CrashService>());
    });

    test('methods do not throw when Sentry is not initialized', () async {
      // Sentry.init을 호출하지 않은 상태에서 각 메서드가 조용히 동작해야 한다
      // (테스트 환경에서는 Sentry SDK가 no-op 모드).
      final service = SentryCrashService();
      await expectLater(
        service.reportError(Exception('test'), StackTrace.current),
        completes,
      );
      await expectLater(
        service.setUser('user-1', email: 'a@b.com'),
        completes,
      );
      await expectLater(service.clearUser(), completes);
      await expectLater(
        service.addBreadcrumb('tapped_button', data: {'id': 'save'}),
        completes,
      );
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `flutter test test/core/analytics/sentry_crash_service_test.dart`
Expected: FAIL — `sentry_crash_service.dart` 없음

- [ ] **Step 3: SentryCrashService 구현**

Create `lib/core/analytics/sentry_crash_service.dart`:

```dart
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'crash_service.dart';

/// Sentry 기반 CrashService 구현.
///
/// `Sentry.init(...)` 또는 `SentryFlutter.init(...)`는 앱 진입점
/// (main.dart)에서 한 번만 호출된다. 이 서비스는 이미 초기화된
/// 정적 Sentry 전역 함수를 감싸 기존 `CrashService` 계약에 맞춘다.
///
/// `FlutterError.onError` 글로벌 훅은 `SentryFlutter.init`가 자동 설치하므로
/// 본 서비스의 `init()`은 추가 훅만 체인 호출하는 기본 구현을 위임한다.
class SentryCrashService implements CrashService {
  @override
  Future<void> init() async {
    // SentryFlutter.init이 이미 FlutterError.onError와 PlatformDispatcher.onError를
    // 설치했음. 여기선 추가 훅 없이 바로 반환.
  }

  @override
  Future<void> reportError(
    dynamic error,
    StackTrace? stackTrace, {
    bool fatal = false,
  }) async {
    await Sentry.captureException(
      error,
      stackTrace: stackTrace,
      hint: fatal ? Hint.withMap({'fatal': true}) : null,
    );
  }

  @override
  Future<void> setUser(String userId, {String? email}) async {
    await Sentry.configureScope(
      (scope) => scope.setUser(SentryUser(id: userId, email: email)),
    );
  }

  @override
  Future<void> clearUser() async {
    await Sentry.configureScope((scope) => scope.setUser(null));
  }

  @override
  Future<void> addBreadcrumb(
    String message, {
    Map<String, dynamic>? data,
  }) async {
    await Sentry.addBreadcrumb(
      Breadcrumb(message: message, data: data, timestamp: DateTime.now()),
    );
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `flutter test test/core/analytics/sentry_crash_service_test.dart`
Expected: All tests PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/core/analytics/sentry_crash_service.dart test/core/analytics/sentry_crash_service_test.dart
git commit -m "feat(observability): add SentryCrashService implementation"
```

---

## Task 4: PostHogAnalyticsService 구현

**Files:**
- Create: `lib/core/analytics/posthog_analytics_service.dart`
- Test: `test/core/analytics/posthog_analytics_service_test.dart`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/core/analytics/posthog_analytics_service_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/core/analytics/analytics_service.dart';
import 'package:app_template/core/analytics/posthog_analytics_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PostHogAnalyticsService', () {
    test('implements AnalyticsService interface', () {
      final service = PostHogAnalyticsService();
      expect(service, isA<AnalyticsService>());
    });

    test('methods complete without throwing when SDK is uninitialized', () async {
      final service = PostHogAnalyticsService();
      await expectLater(
        service.trackScreen('home', properties: {'k': 'v'}),
        completes,
      );
      await expectLater(
        service.trackEvent('tap_save', properties: {'id': 1}),
        completes,
      );
      await expectLater(
        service.identify('user-1', traits: {'plan': 'free'}),
        completes,
      );
      await expectLater(service.reset(), completes);
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `flutter test test/core/analytics/posthog_analytics_service_test.dart`
Expected: FAIL — 파일 없음

- [ ] **Step 3: PostHogAnalyticsService 구현**

Create `lib/core/analytics/posthog_analytics_service.dart`:

```dart
import 'package:posthog_flutter/posthog_flutter.dart';

import 'analytics_service.dart';

/// PostHog 기반 AnalyticsService 구현.
///
/// `Posthog().setup(PostHogConfig(...))` 또는 기본값 초기화는 `main.dart`가
/// 책임진다. 본 서비스는 초기화된 싱글톤에 위임하는 얇은 래퍼.
///
/// PostHog SDK는 초기화 전 호출 시 내부적으로 큐잉 또는 무시 처리하므로
/// 초기화 여부를 본 서비스가 검증할 필요는 없다.
class PostHogAnalyticsService implements AnalyticsService {
  final Posthog _client = Posthog();

  @override
  Future<void> trackScreen(
    String screenName, {
    Map<String, dynamic>? properties,
  }) async {
    await _client.screen(
      screenName: screenName,
      properties: properties == null ? null : Map<String, Object>.from(properties),
    );
  }

  @override
  Future<void> trackEvent(
    String eventName, {
    Map<String, dynamic>? properties,
  }) async {
    await _client.capture(
      eventName: eventName,
      properties: properties == null ? null : Map<String, Object>.from(properties),
    );
  }

  @override
  Future<void> identify(
    String userId, {
    Map<String, dynamic>? traits,
  }) async {
    await _client.identify(
      userId: userId,
      userProperties: traits == null ? null : Map<String, Object>.from(traits),
    );
  }

  @override
  Future<void> reset() async {
    await _client.reset();
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `flutter test test/core/analytics/posthog_analytics_service_test.dart`
Expected: All tests PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/core/analytics/posthog_analytics_service.dart test/core/analytics/posthog_analytics_service_test.dart
git commit -m "feat(observability): add PostHogAnalyticsService implementation"
```

---

## Task 5: AnalyticsNavigatorObserver — 화면 자동 추적

**Files:**
- Create: `lib/core/analytics/analytics_navigator_observer.dart`
- Test: `test/core/analytics/analytics_navigator_observer_test.dart`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/core/analytics/analytics_navigator_observer_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/core/analytics/analytics_service.dart';
import 'package:app_template/core/analytics/analytics_navigator_observer.dart';

class _RecordingAnalytics implements AnalyticsService {
  final List<(String, Map<String, dynamic>?)> screenCalls = [];

  @override
  Future<void> trackScreen(String screenName, {Map<String, dynamic>? properties}) async {
    screenCalls.add((screenName, properties));
  }

  @override
  Future<void> trackEvent(String eventName, {Map<String, dynamic>? properties}) async {}
  @override
  Future<void> identify(String userId, {Map<String, dynamic>? traits}) async {}
  @override
  Future<void> reset() async {}
}

void main() {
  group('AnalyticsNavigatorObserver', () {
    test('records screen name from route.settings.name on push', () {
      final analytics = _RecordingAnalytics();
      final observer = AnalyticsNavigatorObserver(analytics: analytics);

      final pushed = MaterialPageRoute(
        builder: (_) => const SizedBox(),
        settings: const RouteSettings(name: '/settings'),
      );

      observer.didPush(pushed, null);

      expect(analytics.screenCalls, hasLength(1));
      expect(analytics.screenCalls.first.$1, '/settings');
    });

    test('ignores routes with null name', () {
      final analytics = _RecordingAnalytics();
      final observer = AnalyticsNavigatorObserver(analytics: analytics);

      final pushed = MaterialPageRoute(builder: (_) => const SizedBox());
      observer.didPush(pushed, null);

      expect(analytics.screenCalls, isEmpty);
    });

    test('records screen on didReplace using new route name', () {
      final analytics = _RecordingAnalytics();
      final observer = AnalyticsNavigatorObserver(analytics: analytics);

      final oldRoute = MaterialPageRoute(
        builder: (_) => const SizedBox(),
        settings: const RouteSettings(name: '/a'),
      );
      final newRoute = MaterialPageRoute(
        builder: (_) => const SizedBox(),
        settings: const RouteSettings(name: '/b'),
      );

      observer.didReplace(newRoute: newRoute, oldRoute: oldRoute);

      expect(analytics.screenCalls.single.$1, '/b');
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `flutter test test/core/analytics/analytics_navigator_observer_test.dart`
Expected: FAIL — 파일 없음

- [ ] **Step 3: AnalyticsNavigatorObserver 구현**

Create `lib/core/analytics/analytics_navigator_observer.dart`:

```dart
import 'package:flutter/material.dart';

import 'analytics_service.dart';

/// go_router의 `observers`에 끼워 넣어 push/replace 시 자동으로
/// `analytics.trackScreen(route.settings.name)`을 호출한다.
///
/// 이름 없는 익명 라우트는 무시한다 (대시보드 노이즈 방지).
class AnalyticsNavigatorObserver extends NavigatorObserver {
  final AnalyticsService analytics;

  AnalyticsNavigatorObserver({required this.analytics});

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _track(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _track(newRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    // previousRoute는 "돌아간" 화면이므로 이것도 trackScreen 대상
    if (previousRoute != null) _track(previousRoute);
  }

  void _track(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == null || name.isEmpty) return;
    analytics.trackScreen(name);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `flutter test test/core/analytics/analytics_navigator_observer_test.dart`
Expected: All tests PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/core/analytics/analytics_navigator_observer.dart test/core/analytics/analytics_navigator_observer_test.dart
git commit -m "feat(observability): add AnalyticsNavigatorObserver for auto screen tracking"
```

---

## Task 6: app_router.dart — 옵저버 연결

**Files:**
- Modify: `lib/common/router/app_router.dart:17-40` — `GoRouter` 생성자에 `observers` 추가, `AppRouter` 생성자에 `analytics` 파라미터 추가

- [ ] **Step 1: AppRouter에 analytics 주입**

`lib/common/router/app_router.dart` 전체를 다음으로 교체:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/analytics/analytics_navigator_observer.dart';
import '../../core/analytics/analytics_service.dart';
import '../../core/i18n/app_localizations.dart';
import '../../core/kits/app_kits.dart';
import '../../core/widgets/loading_view.dart';
import '../../features/home/home_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../kits/auth_kit/auth_state.dart';
import 'routes.dart';

/// 앱 라우터. 기본 라우트(splash/home/settings) + 설치된 Kit의
/// 라우트·리다이렉트·refreshListenable을 합성한다.
class AppRouter {
  late final GoRouter router;

  AppRouter({required AnalyticsService analytics}) {
    router = GoRouter(
      initialLocation: Routes.splash,
      refreshListenable: AppKits.compositeRefreshListenable,
      redirect: _composedRedirect,
      observers: [AnalyticsNavigatorObserver(analytics: analytics)],
      routes: [
        GoRoute(
          path: Routes.splash,
          builder: (context, state) => Scaffold(
            body: LoadingView(message: S.of(context).loading),
          ),
        ),
        GoRoute(
          path: Routes.home,
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: Routes.settings,
          builder: (context, state) => const SettingsScreen(),
        ),
        ...AppKits.allRoutes,
      ],
    );
  }

  String? _composedRedirect(BuildContext context, GoRouterState state) {
    for (final rule in AppKits.redirectRules) {
      final result = rule(context, state);
      if (result != null) return result;
    }
    if (state.matchedLocation == Routes.splash) {
      return Routes.home;
    }
    return null;
  }
}

/// 레거시: AuthKit 없이 auth 리다이렉트 로직만 단독 테스트용으로 유지.
@visibleForTesting
String? computeAuthRedirect({
  required AuthStatus authStatus,
  required String currentPath,
}) {
  if (currentPath == Routes.splash) {
    if (authStatus == AuthStatus.unknown) return null;
    return authStatus == AuthStatus.authenticated
        ? Routes.home
        : Routes.login;
  }
  if (authStatus == AuthStatus.unknown) return Routes.splash;
  final isOnLoginPage = currentPath == Routes.login;
  final isAuthenticated = authStatus == AuthStatus.authenticated;
  if (!isAuthenticated && !isOnLoginPage) return Routes.login;
  if (isAuthenticated && isOnLoginPage) return Routes.home;
  return null;
}
```

- [ ] **Step 2: 테스트 실행 — 라우터 관련 기존 테스트 통과 확인**

Run: `flutter test test/ 2>&1 | tail -40`
Expected: 라우터 관련 테스트 중 AppRouter 직접 생성하는 곳이 있다면 깨질 수 있음. 있으면 `AppRouter(analytics: DebugAnalyticsService())`로 수정.

- [ ] **Step 3: (깨진 테스트 있다면) 수정**

깨진 테스트 파일에서 `AppRouter()` → `AppRouter(analytics: DebugAnalyticsService())` 로 교체. `DebugAnalyticsService` import 추가.

- [ ] **Step 4: 전체 테스트 재실행**

Run: `flutter test test/`
Expected: 전체 PASS (또는 이 변경과 무관한 기존 실패만 잔존)

- [ ] **Step 5: 커밋**

```bash
git add lib/common/router/app_router.dart test/
git commit -m "feat(observability): wire AnalyticsNavigatorObserver into GoRouter"
```

---

## Task 7: app.dart — auth 상태 변화 시 identify/setUser

**Files:**
- Modify: `lib/app.dart:20-50` — `_AppState`에 analytics/crash 주입, authStreamProvider 리스너에서 호출

- [ ] **Step 1: app.dart 전체 교체**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'common/providers.dart';
import 'common/router/app_router.dart';
import 'core/config/app_config.dart';
import 'core/i18n/app_localizations.dart';
import 'core/theme/app_palette.dart';
import 'core/theme/app_palette_registry.dart';
import 'core/theme/app_theme.dart';
import 'kits/auth_kit/auth_state.dart';
import 'kits/update_kit/update_kit.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> {
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();
    _appRouter = AppRouter(analytics: ref.read(analyticsProvider));
  }

  @override
  Widget build(BuildContext context) {
    // authStreamProvider 구독을 유지하되, 앱 build를 재실행시키지 않도록 listen 사용.
    // 동시에 로그인/로그아웃 시 관측성 서비스에 사용자 정보를 전파한다.
    ref.listen(authStreamProvider, (previous, next) {
      next.whenData((state) {
        final analytics = ref.read(analyticsProvider);
        final crash = ref.read(crashServiceProvider);
        switch (state.status) {
          case AuthStatus.authenticated:
            final user = state.user;
            if (user != null) {
              analytics.identify(
                user.userId.toString(),
                traits: {'email': user.email, 'role': user.role},
              );
              crash.setUser(user.userId.toString(), email: user.email);
            }
          case AuthStatus.unauthenticated:
            analytics.reset();
            crash.clearUser();
          case AuthStatus.unknown:
            // 부팅 중: 아직 아무것도 안 함
            break;
        }
      });
    });

    return ValueListenableBuilder<AppPalette?>(
      valueListenable: AppPaletteRegistry.currentValue,
      builder: (context, _, __) => MaterialApp.router(
        title: AppConfig.instance.appSlug,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.system,
        localizationsDelegates: S.localizationsDelegates,
        supportedLocales: S.supportedLocales,
        routerConfig: _appRouter.router,
        builder: (context, child) => _ForceUpdateGate(child: child),
      ),
    );
  }
}

/// UpdateKit이 강제 업데이트 신호를 보내면 전체 화면을 [ForceUpdateDialog]로 덮는다.
class _ForceUpdateGate extends StatelessWidget {
  final Widget? child;

  const _ForceUpdateGate({required this.child});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<UpdateInfo?>(
      valueListenable: forceUpdateInfoNotifier,
      builder: (context, info, _) {
        if (info == null) return child ?? const SizedBox.shrink();
        return Stack(
          children: [
            if (child != null) child!,
            const ModalBarrier(dismissible: false, color: Colors.black54),
            Center(child: ForceUpdateDialog(info: info)),
          ],
        );
      },
    );
  }
}
```

- [ ] **Step 2: 정적 분석 실행**

Run: `flutter analyze lib/app.dart`
Expected: No issues found

- [ ] **Step 3: 전체 테스트 실행 — 리그레션 없음 확인**

Run: `flutter test test/`
Expected: 기존과 동일한 통과 개수

- [ ] **Step 4: 커밋**

```bash
git add lib/app.dart
git commit -m "feat(observability): propagate auth state to analytics+crash services"
```

---

## Task 8: main.dart 통합 — Sentry init + runZonedGuarded + provider override

**Files:**
- Modify: `lib/main.dart` 전체

- [ ] **Step 1: main.dart 교체**

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app.dart';
import 'common/providers.dart';
import 'common/splash/splash_controller.dart';
import 'core/analytics/posthog_analytics_service.dart';
import 'core/analytics/sentry_crash_service.dart';
import 'core/config/app_config.dart';
import 'core/config/observability_env.dart';
import 'core/kits/app_kits.dart';
import 'core/storage/prefs_storage.dart';
import 'core/theme/app_palette.dart';
import 'core/theme/app_palette_registry.dart';
import 'kits/auth_kit/auth_kit.dart';
import 'kits/backend_api_kit/backend_api_kit.dart';
import 'kits/update_kit/update_kit.dart';

void main() async {
  // runZonedGuarded로 감싸 비동기 에러까지 Sentry가 포착.
  // SentryFlutter.init이 내부적으로 Zone을 세팅하므로 DSN이 있을 땐
  // Sentry에 위임하고, 없을 땐 기본 경로로 내려간다.
  if (ObservabilityEnv.isSentryEnabled) {
    await SentryFlutter.init(
      (options) {
        options.dsn = ObservabilityEnv.sentryDsn;
        options.environment = AppConfig.instance.environment.name;
        options.release = AppConfig.instance.appVersion;
        options.tracesSampleRate = 0.2;
        options.sendDefaultPii = false;
      },
      appRunner: _bootstrap,
    );
  } else {
    await _bootstrap();
  }
}

Future<void> _bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  // --- 팔레트 ---
  AppPaletteRegistry.install(DefaultPalette());

  // --- 앱 설정 ---
  AppConfig.init(
    appSlug: 'template',
    baseUrl: 'http://localhost:8080',
    environment: Environment.dev,
    supportEmail: 'support@example.com',
    privacyUrl: 'https://example.com/privacy',
    appVersion: '1.0.0',
  );

  // --- PostHog 초기화 (키 있을 때만) ---
  if (ObservabilityEnv.isPostHogEnabled) {
    final config = PostHogConfig(ObservabilityEnv.postHogKey)
      ..host = ObservabilityEnv.postHogHost
      ..debug = false
      ..captureApplicationLifecycleEvents = true;
    await Posthog().setup(config);
  }

  // --- PrefsStorage 사전 초기화 ---
  final prefsStorage = PrefsStorage();
  await prefsStorage.init();

  // --- Kit 설치 ---
  await AppKits.install([
    BackendApiKit(),
    AuthKit(),
    UpdateKit(service: NoUpdateAppUpdateService()),
  ]);

  // --- Observability Provider override 합성 ---
  final observabilityOverrides = <Override>[
    if (ObservabilityEnv.isSentryEnabled)
      crashServiceProvider.overrideWithValue(SentryCrashService()),
    if (ObservabilityEnv.isPostHogEnabled)
      analyticsProvider.overrideWithValue(PostHogAnalyticsService()),
  ];

  final container = ProviderContainer(
    overrides: [
      ...AppKits.allProviderOverrides,
      ...observabilityOverrides,
      prefsStorageProvider.overrideWithValue(prefsStorage),
    ],
  );

  AppKits.attachContainer(container);

  // --- CrashService 초기화 ---
  final crashService = container.read(crashServiceProvider);
  await crashService.init();

  // --- 스플래시 부트 ---
  final boot = await SplashController(steps: AppKits.allBootSteps).run();
  if (boot.status == SplashStatus.error) {
    await crashService.reportError(
      StateError('Splash boot failed: ${boot.errorMessage}'),
      StackTrace.current,
      fatal: false,
    );
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const App(),
    ),
  );
}
```

- [ ] **Step 2: 정적 분석**

Run: `flutter analyze lib/main.dart`
Expected: No issues found

- [ ] **Step 3: 디버그 빌드로 실행 가능 검증 (키 없이)**

Run: `flutter build apk --debug`
Expected: BUILD SUCCESSFUL (DSN/Key 없이도 빌드 성공, Debug 구현체로 폴백)

- [ ] **Step 4: 디버그 빌드로 실행 가능 검증 (키 있이)**

Run:
```bash
flutter build apk --debug \
  --dart-define=SENTRY_DSN=https://fbd7598cb819313853fa06f47570b4f7@o4511243821056000.ingest.us.sentry.io/4511243834556416 \
  --dart-define=POSTHOG_KEY=phc_sgGPNh4q6bcVeoYhcmyVGZuZCoQwXsrjCrtVL8WheCZm
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 전체 테스트**

Run: `flutter test test/`
Expected: 기존과 동일한 통과 개수 (리그레션 없음)

- [ ] **Step 6: 커밋**

```bash
git add lib/main.dart
git commit -m "feat(observability): integrate Sentry+PostHog in main.dart with safe fallback"
```

---

## Task 9: 동작 검증 — 실제 이벤트가 대시보드에 보이는지

**Files:** (코드 변경 없음 — 런타임 검증만)

- [ ] **Step 1: 실제 DSN/Key로 iOS 시뮬레이터 또는 Android 에뮬레이터 실행**

Run:
```bash
flutter run \
  --dart-define=SENTRY_DSN=https://fbd7598cb819313853fa06f47570b4f7@o4511243821056000.ingest.us.sentry.io/4511243834556416 \
  --dart-define=POSTHOG_KEY=phc_sgGPNh4q6bcVeoYhcmyVGZuZCoQwXsrjCrtVL8WheCZm
```

- [ ] **Step 2: 고의 크래시 발생 (dev 빌드에서만 일시적으로)**

`lib/features/home/home_screen.dart`에 디버그 버튼 임시 추가 (커밋 안 함):
```dart
ElevatedButton(
  onPressed: () => throw Exception('Sentry test crash'),
  child: const Text('TEST CRASH'),
),
```
버튼 눌러서 크래시 발생.

- [ ] **Step 3: Sentry 대시보드 확인**

https://storkspear.sentry.io/issues/?project=4511243834556416 방문.
Expected: `Sentry test crash` Exception이 1~2분 내에 새 이슈로 표시됨.

- [ ] **Step 4: PostHog 대시보드 확인**

PostHog → Activity 탭 방문.
Expected: `home` 또는 `/home` screen 이벤트가 보임.

- [ ] **Step 5: 임시 크래시 버튼 제거**

home_screen.dart에서 테스트 버튼 삭제. (커밋하지 않은 변경이므로 `git checkout lib/features/home/home_screen.dart`)

- [ ] **Step 6: 성공 스크린샷 또는 메모 — 검증 완료 표기**

본 단계는 런타임 수동 검증이므로 코드 커밋 없음. 플랜에 통과 표시.

---

## Task 10: 문서화

**Files:**
- Create: `docs/integrations/sentry.md`
- Create: `docs/integrations/posthog.md`

- [ ] **Step 1: docs/integrations/sentry.md 작성**

```markdown
# Sentry 통합

## 개요

템플릿은 `lib/core/analytics/sentry_crash_service.dart`에서 `CrashService`를
Sentry로 구현한다. DSN이 주입되지 않으면 `DebugCrashService`로 자동 폴백한다.

## fork 후 세팅 순서

1. https://sentry.io 에 새 Project 생성 (Platform: Flutter)
2. Settings → SDK Setup → Client Keys (DSN)에서 DSN 복사
3. 로컬 `.env`에 `SENTRY_DSN=...` 저장 (커밋 금지)
4. 실행 시 `--dart-define=SENTRY_DSN=$SENTRY_DSN` 주입
5. CI에서는 GitHub Secrets로 동일하게 주입 (배포 단계 구성)

## Sample Rate & 필터링

`main.dart`에서 `options.tracesSampleRate = 0.2`로 초기값 설정.
프로덕션에서 이벤트 폭주 시:
- `options.beforeSend`로 노이즈 이벤트(SocketException 등) 차단
- Sentry 대시보드에서 Spike Protection 활성화 (이미 ON이어야 함)

## Release 버전 매핑

`options.release = AppConfig.instance.appVersion`로 자동 설정.
배포 단계에서는 `sentry-cli releases` 명령으로 자동 등록 예정.
```

- [ ] **Step 2: docs/integrations/posthog.md 작성**

```markdown
# PostHog 통합

## 개요

`lib/core/analytics/posthog_analytics_service.dart`에서 `AnalyticsService`를
PostHog로 구현한다. `GoRouter.observers`에 연결된
`AnalyticsNavigatorObserver`가 화면 push/pop을 자동 추적한다.

## fork 후 세팅 순서

1. https://posthog.com 에 새 Project 생성 (Free plan)
2. Project settings → Project API Key 복사
3. `.env`에 `POSTHOG_KEY=phc_...` 저장
4. 실행 시 `--dart-define=POSTHOG_KEY=$POSTHOG_KEY` 주입
5. (선택) `--dart-define=POSTHOG_HOST=https://eu.i.posthog.com` 으로 region 변경

## 화면 자동 추적

GoRoute의 `path`가 screen name으로 쓰인다 (예: `/settings`, `/login`).
익명 라우트는 무시됨. 커스텀 이름을 주려면 `GoRoute(name: 'home', ...)`
이후 `route.settings.name`이 아닌 `GoRouterState.fullPath`를 사용하도록
`AnalyticsNavigatorObserver` 확장 필요 (현재 스펙 밖).

## 커스텀 이벤트 추적

ViewModel이나 서비스 레이어에서:
```dart
ref.read(analyticsProvider).trackEvent('purchase_completed', properties: {
  'amount': 9900,
});
```

## 유저 식별

`app.dart`의 `authStreamProvider` 리스너가 로그인 시 `identify`,
로그아웃 시 `reset`을 자동 호출한다.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/integrations/sentry.md docs/integrations/posthog.md
git commit -m "docs(observability): add Sentry and PostHog integration guides"
```

---

## Self-Review Notes (계획 작성자 기록)

- **Spec coverage**: 6개 테스크(env 래퍼, Sentry 서비스, PostHog 서비스, observer, router 연결, app.dart 연결, main.dart 통합)가 관측성 전체를 덮음. 문서화(Task 10)까지 포함.
- **Placeholder scan**: 모든 step에 실코드 블록 또는 exact command 포함, TBD/TODO 없음.
- **Type consistency**: `AnalyticsService`/`CrashService` 인터페이스 시그니처 기존 코드 그대로 유지, 신규 구현체는 그 시그니처에 맞춤. `CurrentUser`의 `userId`(int)는 문자열로 변환하여 전달.
- **Fallback 안전성**: 키가 없으면 Debug 구현체로 떨어지므로 로컬 개발/CI 환경에서 추가 비밀 없이 동작.
- **리스크**: `posthog_flutter` v4.x의 `Posthog().setup()` API가 버전별로 조금씩 다를 수 있음 → Task 1에서 `flutter pub get` 후 `.pub-cache`의 실제 API 서명을 Task 4 구현 전에 확인하는 것이 안전.
