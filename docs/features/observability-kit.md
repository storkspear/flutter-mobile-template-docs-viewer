# observability_kit

**Sentry 크래시 리포팅 + PostHog 사용자 분석 번들**. DSN · API Key 주입이 없으면 Debug 폴백으로 동작 (앱은 정상 부팅).

---

## 개요

- **Sentry**: 크래시 · 에러 리포트 · 트레이싱 · 심볼 복원
- **PostHog**: 이벤트 분석 · 화면 추적 · 세션 리플레이
- **Debug 폴백** ([`ADR-006`](../philosophy/adr-006-debug-fallback.md)): DSN 없으면 콘솔 출력만
- **자동 화면 추적**: `AnalyticsNavigatorObserver` 가 go_router 경로 감지

---

## 활성화

```yaml
# app_kits.yaml
kits:
  observability_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  // ...
  ObservabilityKit(),
]);
```

### 환경 변수 주입 (운영)

```bash
flutter run \
  --dart-define=SENTRY_DSN=https://xxx@sentry.io/yyy \
  --dart-define=POSTHOG_KEY=phc_xxx \
  --dart-define=POSTHOG_HOST=https://app.posthog.com
```

**없으면** Debug 구현체로 동작 — 콘솔 로그만. 앱은 정상 부팅.

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `SentryCrashService` | `CrashService` 구현체. `reportError` · `setUser` · `breadcrumb` |
| `PostHogAnalyticsService` | `AnalyticsService` 구현체. `trackScreen` · `trackEvent` · `identify` |
| `AnalyticsNavigatorObserver` | go_router 경로 변경 감지 → `trackScreen` 자동 호출 |
| `ObservabilityEnv` | `isSentryEnabled` · `isPostHogEnabled` 환경 변수 감지 |
| BootStep: `PostHogInitStep` | 앱 시작 시 PostHog 초기화 |

---

## 핵심 API

### 크래시 수동 리포트

```dart
try {
  // ...
} catch (e, st) {
  await ref.read(crashServiceProvider).reportError(e, st, fatal: false);
}
```

### 커스텀 이벤트

```dart
await ref.read(analyticsProvider).trackEvent(
  'purchase_completed',
  properties: {
    'product_id': productId,
    'amount': amount,
  },
);
```

### 유저 식별

```dart
// 로그인 시
await ref.read(analyticsProvider).identify(userId, traits: {'email': email});
await ref.read(crashServiceProvider).setUser(userId, email: email);

// 로그아웃 시
await ref.read(analyticsProvider).reset();
await ref.read(crashServiceProvider).clearUser();
```

### breadcrumb

```dart
await ref.read(crashServiceProvider).addBreadcrumb(
  'User clicked save button',
  data: {'screen': 'expense_edit'},
);
```

---

## Sentry 설정

### DSN 주입

```bash
--dart-define=SENTRY_DSN=https://xxx@sentry.io/yyy
```

### main.dart 의 조건부 래핑

```dart
void main() async {
  if (ObservabilityEnv.isSentryEnabled) {
    await SentryFlutter.init((options) {
      options.dsn = ObservabilityEnv.sentryDsn;
      options.environment = AppConfig.instance.environment.name;
      options.release = AppConfig.instance.appVersion;
      options.tracesSampleRate = 0.2;
      options.sendDefaultPii = false;  // ← IP · 쿠키 자동 수집 차단
    }, appRunner: _bootstrap);
  } else {
    await _bootstrap();  // Debug 폴백
  }
}
```

### 심볼 업로드 (난독화 스택 복원)

```yaml
# .github/workflows/release-android.yml
- name: Build AAB with obfuscation
  run: |
    flutter build appbundle --obfuscate --split-debug-info=build/app/symbols

- name: Upload symbols to Sentry
  run: npx @sentry/cli upload-dif --org $ORG --project $PROJECT build/app/symbols
```

---

## PostHog 설정

### API Key 주입

```bash
--dart-define=POSTHOG_KEY=phc_xxx
--dart-define=POSTHOG_HOST=https://app.posthog.com
```

### 자동 화면 추적

`AnalyticsNavigatorObserver` 가 go_router 의 NavigatorObserver 로 설치됨 → 모든 경로 변경 시 `trackScreen` 자동 호출.

```dart
// AppRouter 내부 (자동)
GoRouter(
  observers: [
    ...AppKits.allNavigatorObservers,  // ← observability_kit 이 기여
  ],
  // ...
)
```

### PII 주의

```dart
// ❌ 금지
await analytics.trackEvent('search', properties: {
  'query': userInput,  // ← 주소 · 카드 번호 등 민감 정보 가능
});

// ✅ 익명화
await analytics.trackEvent('search', properties: {
  'query_length': userInput.length,  // ← 길이만
});
```

---

## 파생 레포 체크리스트

### Sentry

- [ ] [Sentry](https://sentry.io) 프로젝트 생성 (Flutter)
- [ ] DSN 복사 → `.env` + GitHub Secrets (`SENTRY_DSN`)
- [ ] Auth token 발급 → GitHub Secrets (`SENTRY_AUTH_TOKEN`)
- [ ] Organization · Project slug → GitHub Secrets (`SENTRY_ORG`, `SENTRY_PROJECT`)
- [ ] Release 워크플로우에서 `--obfuscate` + 심볼 업로드 확인

### PostHog

- [ ] [PostHog](https://posthog.com) 프로젝트 생성
- [ ] API Key (Project API Key) 복사 → `.env` + GitHub Secrets (`POSTHOG_KEY`)
- [ ] Host 확인 (EU 는 `eu.posthog.com`, US 는 `app.posthog.com`)
- [ ] 분석 대시보드에 첫 이벤트 들어오는지 확인

### 로컬 테스트

```bash
flutter run \
  --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2) \
  --dart-define=POSTHOG_KEY=$(grep POSTHOG_KEY .env | cut -d= -f2)
```

---

## Code References

- [`lib/kits/observability_kit/observability_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/observability_kit.dart)
- [`lib/kits/observability_kit/sentry_crash_service.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/sentry_crash_service.dart)
- [`lib/kits/observability_kit/posthog_analytics_service.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/posthog_analytics_service.dart)
- [`lib/kits/observability_kit/analytics_navigator_observer.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/analytics_navigator_observer.dart)
- [`lib/kits/observability_kit/observability_env.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/observability_env.dart)

---

## 관련 문서

- [`ADR-006 · Debug 폴백`](../philosophy/adr-006-debug-fallback.md)
- [`ADR-019 · 솔로 친화적 운영`](../philosophy/adr-019-solo-friendly.md) — 관리형 서비스 선호
- [`ADR-020 · 보안 방어선`](../philosophy/adr-020-security-hardening.md) — 심볼 업로드
