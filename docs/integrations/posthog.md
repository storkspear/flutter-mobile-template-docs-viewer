# PostHog 통합

`observability_kit`을 통해 템플릿에 기본 내장되어 있다. 파생 레포 생성 후 Project API Key만 주입하면 화면 조회/커스텀 이벤트가 자동으로 PostHog 대시보드로 전송된다.

## 구조

- `lib/kits/observability_kit/posthog_analytics_service.dart` — `AnalyticsService` 인터페이스를 PostHog로 구현한 래퍼
- `lib/kits/observability_kit/analytics_navigator_observer.dart` — `GoRouter.observers`에 연결되어 화면 push/pop 시 자동으로 `trackScreen` 호출
- `lib/kits/observability_kit/observability_kit.dart`:
  - `ObservabilityEnv.isPostHogEnabled`가 true일 때 `analyticsProvider`를 `PostHogAnalyticsService`로 override
  - `_PostHogInitStep` BootStep이 스플래시 단계에서 `Posthog().setup(...)` 호출

## 파생 레포 생성 후 세팅 순서

### 1) PostHog 프로젝트 생성 → API Key 복사

- https://posthog.com 가입 (Free plan 추천 — 100만 이벤트/월 무료)
- Region: **US Cloud** 또는 **EU Cloud** (가입 후 변경 불가)
- 가입 직후 프로젝트 자동 생성
- **Project Settings → Project API Key** 복사 (`phc_...` 형태)

### 2) API Key 주입

**.env** (gitignore됨):
```
POSTHOG_KEY=phc_xxxxxxxxxxxx
POSTHOG_HOST=https://us.i.posthog.com  # EU면 https://eu.i.posthog.com
```

실행 시:
```bash
flutter run \
  --dart-define=POSTHOG_KEY=$(grep POSTHOG_KEY .env | cut -d= -f2) \
  --dart-define=POSTHOG_HOST=$(grep POSTHOG_HOST .env | cut -d= -f2)
```

### 3) 검증

앱 실행 후 몇 화면 이동 → 1~2분 내 PostHog 대시보드 **Activity** 탭에 이벤트 출현.

## 자동으로 추적되는 것

- **앱 생명주기**: `captureApplicationLifecycleEvents = true` 설정으로 앱 시작/포그라운드/백그라운드 자동 수집
- **화면 진입**: `AnalyticsNavigatorObserver`가 GoRoute push/pop 시 `route.settings.name`을 screen name으로 기록
  - 예: `/settings`, `/home`, `/login`

## 수동 이벤트 추적

비즈니스 액션은 ViewModel/서비스에서 명시적으로:

```dart
ref.read(analyticsProvider).trackEvent(
  'purchase_completed',
  properties: {'amount': 9900, 'plan': 'premium'},
);
```

## 로그인/로그아웃 자동 연동

`lib/app.dart`의 `authStreamProvider` 리스너가 자동 호출:
- 로그인 시: `analytics.identify(userId, traits: {'email': ..., 'role': ...})`
- 로그아웃 시: `analytics.reset()` — 이전 유저 연결 해제

## 이벤트 이름 규칙 (권장)

```
<object>_<action>        예: purchase_completed, onboarding_skipped
```

screen name:
```
<path>                   예: /home, /settings, /profile/edit
```

## 화면 이름 커스터마이징

기본은 `route.settings.name` (GoRoute의 `path`). 더 의미 있는 이름 쓰려면 `AnalyticsNavigatorObserver`를 확장해 `GoRouterState.name` (GoRoute의 `name` 파라미터)을 사용하도록 수정.

## PII 주의

- 이메일/전화번호 같은 PII는 event properties에 담지 말 것 — `identify(userId, traits)`의 traits에만
- GDPR/개인정보보호법 대상 앱은 **동의 획득 전 추적 금지**:
  - 동의 안 한 유저: `analyticsProvider.overrideWithValue(DebugAnalyticsService())`로 런타임 교체
  - 또는 Opt-out UI: `PostHog().disable()` 호출

## 한도 관리

PostHog 무료 100만 이벤트/월 — DAU 1만까지는 여유. 폭주 방지:

- **Session Replay 무료는 5천 세션/월** — DAU 200명 × 30일이면 한도 초과 → Session Replay 기능 꺼두기:
  ```dart
  final config = PostHogConfig(key)
    ..host = host
    ..sessionReplay = false;  // 명시적 비활성화
  ```
- Feature Flag 무료 100만 요청/월 — 사용 안 하면 무관

## Host 설정

- US Cloud: `https://us.i.posthog.com`
- EU Cloud: `https://eu.i.posthog.com`
- Self-hosted: 본인 호스트 URL

가입 시 선택한 region과 일치해야 한다. 틀리면 이벤트 사라짐.

## Key가 없을 때

`ObservabilityEnv.isPostHogEnabled`가 false면 `DebugAnalyticsService`로 폴백 + PostHog SDK 초기화 스킵. 콘솔에 `[Analytics]` 로그만 출력.

## 옵트아웃 (kit 제거)

PostHog 불필요 시: `app_kits.yaml`과 `lib/main.dart`에서 `observability_kit` 제거. 자세한 방법은 `sentry.md` 참고.
