# 분석 도구 통합

`DebugAnalyticsService` → PostHog / Mixpanel / Firebase Analytics 등으로 교체.

## 선택 가이드

| 도구 | 강점 | 언제 |
|------|------|------|
| **PostHog** | 프로덕트 분석 + 세션 리플레이 + 기능 플래그 통합, 자체 호스팅 가능 | B2B/SaaS, 스타트업 |
| **Firebase Analytics** | Google 생태계 통합, 무료, 크래시 리포팅과 자동 연동 | 소비자 앱, MVP |
| **Mixpanel** | 퍼널/리텐션 분석 강함 | 유저 행동 깊이 분석 |

## PostHog 예시

### 1) 의존성

```yaml
dependencies:
  posthog_flutter: ^4.7.0
```

### 2) 구현체

`lib/core/analytics/posthog_analytics_service.dart`:

```dart
import 'package:posthog_flutter/posthog_flutter.dart';

import 'analytics_service.dart';

class PostHogAnalyticsService implements AnalyticsService {
  final _posthog = Posthog();

  @override
  Future<void> trackScreen(String screenName,
      {Map<String, dynamic>? properties}) {
    return _posthog.screen(screenName: screenName, properties: properties);
  }

  @override
  Future<void> trackEvent(String eventName,
      {Map<String, dynamic>? properties}) {
    return _posthog.capture(eventName: eventName, properties: properties);
  }

  @override
  Future<void> identify(String userId, {Map<String, dynamic>? traits}) {
    return _posthog.identify(userId: userId, userProperties: traits);
  }

  @override
  Future<void> reset() => _posthog.reset();
}
```

### 3) 설정

`android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist`에 `POSTHOG_API_KEY`, `POSTHOG_HOST` 추가.

### 4) Provider 교체

```dart
final analyticsProvider = Provider<AnalyticsService>(
  (ref) => PostHogAnalyticsService(),
);
```

## Firebase Analytics 예시

### 1) 의존성

```yaml
dependencies:
  firebase_core: ^3.6.0
  firebase_analytics: ^11.3.3
```

### 2) 구현체

```dart
import 'package:firebase_analytics/firebase_analytics.dart';

import 'analytics_service.dart';

class FirebaseAnalyticsService implements AnalyticsService {
  final _analytics = FirebaseAnalytics.instance;

  @override
  Future<void> trackScreen(String screenName,
      {Map<String, dynamic>? properties}) {
    return _analytics.logScreenView(screenName: screenName);
  }

  @override
  Future<void> trackEvent(String eventName,
      {Map<String, dynamic>? properties}) {
    return _analytics.logEvent(
      name: eventName,
      parameters: properties?.map((k, v) => MapEntry(k, v as Object)),
    );
  }

  @override
  Future<void> identify(String userId, {Map<String, dynamic>? traits}) async {
    await _analytics.setUserId(id: userId);
    if (traits != null) {
      for (final e in traits.entries) {
        await _analytics.setUserProperty(name: e.key, value: e.value?.toString());
      }
    }
  }

  @override
  Future<void> reset() => _analytics.setUserId(id: null);
}
```

## 호출 지점 (템플릿 공통)

- **로그인 성공**: `ref.read(analyticsProvider).identify(userId, traits: {...})`
- **로그아웃**: `ref.read(analyticsProvider).reset()`
- **화면 진입**: GoRouter `observers`에 `AnalyticsNavigatorObserver` 등록 권장 (파생 레포 생성 후 직접 작성)
- **커스텀 이벤트**: ViewModel에서 도메인 액션 성공 시 `trackEvent`

## 주의

- PII(이메일, 전화번호 등) 이벤트 속성에 담지 않는다. 해시 처리 또는 유저 ID만.
- GDPR/개인정보보호법 대상 앱은 동의 획득 전 추적 금지. `reset()`과 opt-out UI 필요.
