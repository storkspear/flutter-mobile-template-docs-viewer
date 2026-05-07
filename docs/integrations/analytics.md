# 분석 도구 선택 가이드

> **목표**: 본 템플릿이 PostHog 를 default 로 채택한 이유, 다른 도구 (Mixpanel · Amplitude · Firebase Analytics · GA4) 와의 차이, 교체 방법.

**관련 Kit**: [`observability_kit`](../features/observability-kit.md)

---

## 0. 본 템플릿의 기본값: PostHog

**선정 이유** (Phase 1 관측성 도입 시점):

- **무료 플랜이 가장 관대** — 월 1M 이벤트 (Mixpanel 100K, Amplitude 10M but enterprise 좌절)
- **Self-hostable** — 데이터 주권 / GDPR 우려 시 own infra 가능
- **세션 리플레이 / Feature flag / A/B test** 통합 — 별도 도구 추가 없이
- **API 단순함** — `track`, `identify`, `screen` 정도만 알면 충분

**한계**:

- iOS 기본 IDFA 미지원 → 광고 캠페인 attribution 어려움 (대신 `ads_kit` UMP 흐름 + AdMob attribution 사용)
- 한국 시장 도구 (앱스플라이어 / Adjust) 와 직접 통합 어려움

---

## 1. 비교표

| 도구 | 무료 quota | 강점 | 한계 |
|---|---|---|---|
| **PostHog** ✓ default | 1M 이벤트/월 | 통합형 (analytics + feature flag + replay), self-host | 광고 attribution 약함 |
| Mixpanel | 100K 이벤트/월 | 고급 funnel / cohort 분석 UI | 무료 quota 작음 |
| Amplitude | 10M 이벤트/월 (Starter) | enterprise 도구 만큼 강력 | 무료에서 일부 기능 잠금 |
| Firebase Analytics | 무제한 (실시간 지연 있음) | Google 생태계 (Crashlytics 등) 매끄러움 | Flutter 통합 복잡, 데이터 export 비용 |
| GA4 | 무제한 (10M 이벤트 후 sampling) | 웹 + 앱 통합 dashboard | 모바일 앱 UX 약함, sampling 이슈 |

---

## 2. 교체 방법 — `AnalyticsService` 인터페이스 활용

이 템플릿은 `observability_kit` 이 `AnalyticsService` 인터페이스를 정의해두고, PostHog / Debug 두 구현체를 제공해요.

```dart
// lib/core/analytics/analytics_service.dart (인터페이스 일부)
abstract class AnalyticsService {
  Future<void> trackScreen(String name, {Map<String, dynamic>? properties});
  Future<void> trackEvent(String eventName, {Map<String, dynamic>? properties});
  Future<void> identify(String userId, {Map<String, dynamic>? traits});
  Future<void> reset();
}
```

다른 도구를 쓰려면:

1. `MyToolAnalyticsService implements AnalyticsService` 작성
2. `lib/main.dart` 또는 ObservabilityKit 안에서 `analyticsProvider` override
3. (선택) `AnalyticsNavigatorObserver` 도 새 구현체와 호환 확인 — 인터페이스 그대로면 자동 작동

---

## 3. 여러 도구 동시 사용

A/B 테스트 기간이나 마이그레이션 기간엔 fan-out 어댑터 패턴:

```dart
class FanOutAnalyticsService implements AnalyticsService {
  FanOutAnalyticsService(this._delegates);
  final List<AnalyticsService> _delegates;

  @override
  Future<void> trackEvent(String eventName, {Map<String, dynamic>? properties}) async {
    for (final d in _delegates) {
      await d.trackEvent(eventName, properties: properties);
    }
  }
  // ... trackScreen / identify / reset 도 동일 패턴으로 fan-out
}
```

---

## 4. 한국 시장 특화

- **Adjust** / **Appsflyer**: 광고 attribution 이 핵심이면 추가 (PostHog 와 병렬). 둘 다 SDK 가 무거워 (~5MB) 광고 운영 안 하면 비추.
- **AceCounter** / **Naver Analytics**: 일반적이지 않음. 굳이 안 써도 됨.
- **개인정보처리방침**: 어느 도구든 "수집 항목 + 보관 기간 + 위탁사 (PostHog Inc., 미국)" 명시 필요.

---

## 5. 결정 가이드

```
이 앱은 백엔드 API + 사용자 행동 분석이 필요한가?
├── No → DebugAnalyticsService 그대로 유지 (콘솔만)
└── Yes → 광고 attribution 도 필요한가?
        ├── No → PostHog (default) 유지
        └── Yes → PostHog + Adjust/Appsflyer 병렬 (FanOut 패턴)
```

---

## 6. Code References

- [`lib/core/analytics/analytics_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/analytics/analytics_service.dart) — 인터페이스
- [`lib/kits/observability_kit/posthog_analytics_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/posthog_analytics_service.dart) — PostHog 어댑터
- [`docs/integrations/posthog.md`](./posthog.md) — PostHog 셋업 절차
