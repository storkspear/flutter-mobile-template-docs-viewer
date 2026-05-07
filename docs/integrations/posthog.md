# PostHog 통합

> **목표**: PostHog API Key 발급 → 주입 → 화면 자동 추적 이벤트 1개 이상 수신 확인까지.

**관련 Kit**: [`observability_kit`](../features/observability-kit.md)

---

## 0. PostHog 가 하는 일

사용자 행동 분석 (이벤트 / 스크린뷰 / funnel / retention). 우리 템플릿은:

- 화면 전환 자동 추적 — `AnalyticsNavigatorObserver` 가 GoRouter `observers` 에 연결됨
- API Key 미주입 시 `DebugAnalyticsService` 로 폴백 — 콘솔만, 외부 전송 없음
- 호스트 기본값: `https://us.i.posthog.com` (US 리전). EU 사용 시 `POSTHOG_HOST` 별도 주입

---

## 1. PostHog 콘솔에서 키 발급

1. https://posthog.com 가입 (무료 — 월 1M 이벤트)
2. **New Project** → 이름 입력 (앱 슬러그 권장)
3. **Project Settings** → **Project API Key** 복사 — 형태: `phc_...`
4. 리전 확인 — US 면 기본값 그대로, EU 면 `POSTHOG_HOST=https://eu.i.posthog.com` 도 함께 주입

---

## 2. 로컬 / CI 주입

```bash
flutter run \
  --dart-define=POSTHOG_KEY=phc_xxxxx \
  --dart-define=POSTHOG_HOST=https://us.i.posthog.com  # 옵션, US 기본값
```

GHA Secrets 에 `POSTHOG_KEY` (옵션: `POSTHOG_HOST`) 추가 후 release workflow 에서 동일 dart-define.

---

## 3. 동작 확인

### 3-1. 화면 전환 자동 추적

릴리스 빌드 실행 → 앱 안에서 화면 2~3개 이동.
PostHog **Activity → Live events** 에서 `$screen` 이벤트 1분 내 도착 확인.

### 3-2. 커스텀 이벤트

```dart
ref.read(analyticsProvider).trackEvent(
  'button_pressed',
  properties: {'button_id': 'subscribe_premium'},
);
```

### 3-3. Dogfooding 패널

`lib/kits/observability_kit/dogfooding_panel.dart` 의 "Send test event" 버튼이 PostHog 와 Sentry 동시 검증.

---

## 4. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 이벤트가 안 옴 | API Key 미주입 (Debug 폴백) | 콘솔에서 `[DebugAnalyticsService]` 로그면 키 안 들어간 것 |
| EU 사용자 데이터인데 US 리전에 도착 | `POSTHOG_HOST` 미설정 | `POSTHOG_HOST=https://eu.i.posthog.com` 추가 |
| 화면 전환 자동 추적 안 됨 | NavigatorObserver 미연결 | `lib/common/router/app_router.dart` 의 `observers:` 리스트 확인 |
| 사용자 식별 안 됨 | `identify(userId)` 호출 안 함 | 로그인 직후 `analyticsProvider` 의 `identify(...)` 호출 |

---

## 5. 개인정보 / GDPR

- PostHog 는 IP 기반 위치 추정만, IDFA / GAID 직접 사용 X → ATT 다이얼로그 불필요
- 로그아웃 시 `reset()` 호출 권장 — 다음 사용자와 식별 분리
- 한국 시장 앱은 개인정보처리방침에 "PostHog (Hong Kong / US)" 수집·이용 명시 권장

---

## 6. 파생 레포 체크리스트

- [ ] PostHog 프로젝트 생성 + API Key 발급
- [ ] `.env` + GHA Secrets 에 `POSTHOG_KEY` 등록
- [ ] (EU 사용자 비중 큼) `POSTHOG_HOST=https://eu.i.posthog.com` 추가
- [ ] 릴리스 빌드 1회 후 Live events 에 `$screen` 도착 확인
- [ ] 로그인 흐름에서 `identify()`, 로그아웃에서 `reset()` 호출 확인

---

## 7. Code References

- [`lib/kits/observability_kit/posthog_analytics_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/posthog_analytics_service.dart)
- [`lib/kits/observability_kit/analytics_navigator_observer.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/analytics_navigator_observer.dart)
- [`lib/kits/observability_kit/observability_env.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/observability_env.dart)
