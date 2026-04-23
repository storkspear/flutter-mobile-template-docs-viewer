# Sentry 통합

`observability_kit`을 통해 템플릿에 기본 내장되어 있다. 파생 레포 생성 후 DSN만 주입하면 자동으로 크래시/에러가 Sentry 대시보드로 전송된다.

## 구조

- `lib/kits/observability_kit/sentry_crash_service.dart` — `CrashService` 인터페이스를 Sentry로 구현한 래퍼
- `lib/kits/observability_kit/observability_kit.dart` — `ObservabilityEnv.isSentryEnabled`가 true일 때만 `crashServiceProvider`를 `SentryCrashService`로 override
- `lib/main.dart` — DSN이 주입되면 `SentryFlutter.init`으로 감싸 `runZonedGuarded` + `FlutterError.onError` + `PlatformDispatcher.onError`를 자동 훅

## 파생 레포 생성 후 세팅 순서

### 1) Sentry 프로젝트 생성 → DSN 복사

- https://sentry.io → Create Project → Platform: **Flutter**
- Settings → SDK Setup → **Client Keys (DSN)** 에서 DSN 복사
- DSN 형태: `https://<public_key>@<host>.ingest.us.sentry.io/<project_id>`

### 2) Spike Protection 켜기 (필수)

Settings → Subscription → **Spike Protection: ON**. 버그 폭주로 무료 한도(5천/월)가 하루 만에 소진되는 사고 방지.

### 3) DSN 주입

**로컬 개발:** `.env` (gitignore됨):
```
SENTRY_DSN=https://abc123@o123456.ingest.us.sentry.io/789
```

실행 시:
```bash
flutter run --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2)
```

**CI/배포:** Phase 2(배포 자동화) 단계에서 GitHub Actions Secrets로 주입. 현재 관측 단계에서는 로컬 `.env`로 충분.

### 4) 검증

```bash
flutter run --dart-define=SENTRY_DSN=<your_dsn>
```

앱 실행 후 임시로 `throw Exception('sentry test')` 한 번 넣고 실행 → 1~2분 내 Sentry 대시보드에 이슈 출현.

## 설정 튜닝

`lib/main.dart`의 `SentryFlutter.init` 콜백:

```dart
options.environment = AppConfig.instance.environment.name;  // dev/staging/prod
options.release = AppConfig.instance.appVersion;
options.tracesSampleRate = 0.2;   // 성능 추적 20%만 (폭주 방지)
options.sendDefaultPii = false;   // IP 등 자동 수집 차단 (GDPR)
```

### 이벤트 폭주 대응

무료 한도(5천/월)가 빠르게 소진될 때:

1. **sampleRate 낮춤** — `options.sampleRate = 0.3` (30%만 전송)
2. **beforeSend 필터링** — 노이즈 이벤트 차단:
   ```dart
   options.beforeSend = (event, hint) {
     final type = event.exceptions?.firstOrNull?.type;
     if (type == 'SocketException' || type == 'TimeoutException') {
       return null;  // 네트워크 끊김은 유저 환경 문제 — 무시
     }
     return event;
   };
   ```
3. Sentry 대시보드의 **Inbound Filters**에서 추가 필터 설정

## 로그인/로그아웃 자동 연동

`lib/app.dart`의 `authStreamProvider` 리스너가 자동으로 호출:
- 로그인 시: `crashService.setUser(userId, email: ...)` — 이후 크래시에 유저 컨텍스트 첨부
- 로그아웃 시: `crashService.clearUser()`

## 수동 이벤트 보고

ViewModel이나 서비스에서:
```dart
try {
  await someDangerousOperation();
} catch (e, s) {
  ref.read(crashServiceProvider).reportError(e, s);
}
```

Breadcrumb:
```dart
ref.read(crashServiceProvider).addBreadcrumb(
  'user_tapped_pay_button',
  data: {'cart_size': 3, 'amount': 9900},
);
```

## 심볼 업로드 — 자동 (Android)

Android 릴리스 빌드는 `android/fastlane/Fastfile`의 `upload_sentry_mapping` lane이 자동 처리한다. 3가지를 Sentry로 전송:

1. **ProGuard mapping** (`mapping.txt`) — R8이 난독화한 Kotlin/Java 심볼 복원용
2. **Dart debug symbols** (`build/symbols/`) — `--obfuscate`로 난독화된 Dart 프레임 복원용
3. **Release 마커** — Sentry 대시보드의 릴리스별 크래시 집계

이 모든 동작은 `.github/workflows/release-android.yml`이 태그 push 시 자동 실행. 수동 실행이 필요하면:
```bash
cd android
SENTRY_ORG=<org> SENTRY_PROJECT=<project> SENTRY_AUTH_TOKEN=<token> \
  bundle exec fastlane android upload_sentry_mapping version:<version>
```

**필요한 Auth Token 권한**: `project:read`, `project:releases`, `project:write`

## dSYM 업로드 (iOS, Phase 2b 예정)

iOS는 Phase 2b에서 `ios/fastlane/Fastfile`에 동일 패턴으로 추가 예정.

## DSN이 없을 때

`ObservabilityEnv.isSentryEnabled`가 false면 `DebugCrashService`로 폴백 — 콘솔에 에러가 출력될 뿐 Sentry로 전송되지 않는다. 로컬 개발/CI에서 무해.

## 옵트아웃 (kit 제거)

Sentry/PostHog가 불필요한 앱:

1. `app_kits.yaml`에서 `observability_kit: {}` 제거
2. `lib/main.dart`의 `AppKits.install([...])`에서 `ObservabilityKit()` 제거
3. (선택) `pubspec.yaml`에서 `sentry_flutter`, `posthog_flutter` 제거

kit만 제거해도 SDK 코드는 호출되지 않는다. pubspec dep 제거는 바이너리 사이즈 줄이는 용도.
