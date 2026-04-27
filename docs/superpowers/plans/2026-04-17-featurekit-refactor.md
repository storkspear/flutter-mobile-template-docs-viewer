# rny·sumtally 마이그레이션 가능성 검토 + 템플릿 보강 계획

## Context

사용자는 `/Users/twosun/workspace/template-flutter` 템플릿을 거의 완성했고, 샘플로 `testFlutterUseTemplateApp`을 만들었다. 그러나 기획·개발이 거의 끝난 두 실제 앱(**richandyoung**=rny, **sumtally**)을 이 템플릿으로 하나도 누락 없이 마이그레이션할 수 있는지 확인해야 한다. 더 나아가, 두 앱을 분석해서 "템플릿이 당연히 제공했어야 하는데 빠진 공통 기능"을 식별하고 템플릿을 보강한다.

결론부터: **현재 템플릿은 두 앱 모두를 누락 없이 담을 수 없다.** 구조적 전제 세 가지(백엔드 API 고정, 인증 필수, 로컬 DB 부재)가 두 앱과 충돌한다. 템플릿에 두 축(로컬 앱 모드 + DB 계층) 추가가 필수이며, 여러 공통 기능도 함께 올려야 실제 "재사용 가능한 템플릿"이 된다.

---

## Part 1. 마이그레이션 가능성 진단

### 1.1 두 앱의 공통 성격

| 축 | rny | sumtally | 템플릿 제공? |
|---|---|---|---|
| 백엔드 API | **없음** (Yahoo Finance 공개 API만) | **없음** (완전 로컬) | ❌ 백엔드 필수 전제 |
| 인증 | **없음** (로컬 앱) | **없음** (개인 앱) | ❌ JWT 필수 경로 |
| 로컬 DB | sqflite 7 테이블 | Drift 6 테이블 | ❌ 메모리 캐시만 |
| 상태관리 | StatefulWidget+setState | **Riverpod** ✓ | ✓ Riverpod |
| 라우팅 | 순수 Navigator | **go_router** ✓ | ✓ go_router |
| i18n | 하드코딩 한국어 | 하드코딩 한국어 | ✓ ARB(ko/en) |
| 디자인 토큰 | 자체 AppColors/Spacing | 자체 AppColors/Spacing | ✓ AppPalette 확장 가능 |

### 1.2 현재 템플릿의 구조적 블로커 (전수 목록)

1. **ApiClient `_appPath` 강제** — `lib/common/network/api_client.dart:49-50`이 모든 요청에 `/api/apps/{slug}/` prefix를 붙여서 **외부 공개 API 호출 불가**. rny의 Yahoo Finance, 환율 API에 치명적.
2. **SplashController `checkAuthStatus()` 필수** — `lib/common/splash/splash_controller.dart:47`. 인증 없는 앱에서 의미 없는 경로.
3. **AppRouter 로그인 리다이렉트 하드코딩** — `lib/common/router/app_router.dart:60-80`. 미인증 시 무조건 `/login`으로 보냄. 인증 없는 앱은 영원히 로그인 화면에 갇힘.
4. **`apiClientProvider`가 `tokenStorageProvider`에 의존** — `lib/common/providers.dart:46-52`. 토큰 없는 앱에서도 SecureStorage를 강제로 init해야 함.
5. **로컬 DB 계층 전무** — CacheStore는 메모리 전용. rny(7 테이블, v5까지 마이그레이션), sumtally(6 테이블, v2 마이그레이션) 모두 DB 구조 전체를 앱별로 새로 만들어야 함.
6. **BottomNavShell 부재** — 두 앱 다 하단 탭 셸(rny는 암묵적, sumtally는 4탭+중앙 FAB). 템플릿은 단일 home_screen 스텁만 있음.
7. **백그라운드 태스크/알림 구현체 없음** — rny의 핵심. `NotificationService`는 추상만 있고 Debug 구현뿐.
8. **차트 라이브러리 없음** — rny(syncfusion), sumtally(fl_chart) 모두 차트가 기능의 절반. 통합 가이드 없음.
9. **AdMob, Firebase Core, Remote Config, 강제 업데이트** — rny 필수. 템플릿에 전혀 없음.
10. **온보딩 플로우 프리미티브 없음** — sumtally는 3-step 위자드가 앱의 진입점.
11. **숫자 입력 포맷터 없음** — 두 앱 다 천단위 콤마 입력 처리(`CommaFormatter`)를 자체 구현.

### 1.3 마이그레이션 예상 (앱별)

#### richandyoung (rny)
- **현재 템플릿으로 재사용 가능**: ~15% (디자인 토큰, 공통 위젯 일부, 스플래시 뼈대)
- **반드시 새로 들어와야 하는 것**:
  - 로컬 DB (sqflite 또는 drift)
  - 로컬 알림 스케줄링(timezone 포함)
  - 백그라운드 태스크(workmanager)
  - Firebase Core + Remote Config + 강제 업데이트
  - AdMob 배너
  - syncfusion(또는 fl_chart) 차트 래퍼
  - 권한(permission_handler)
  - 외부 공개 API 호출(비`/api/apps/`) 경로
  - 다중 알림 유형(INSTANT/LONG_TERM/ACCUMULATE) 스케줄 패턴
  - 환율/통화 변환 유틸
- **앱 고유 유지**: 자산 분류기, DCA 엔진, 리밸런싱 계산, 포트폴리오 분석, Yahoo 파서
- **동시 수행될 리팩터링**: StatefulWidget+setState → Riverpod, Navigator → go_router
- **전망**: 템플릿 보강 없이는 **마이그레이션 공수 > 재작성 공수**. 템플릿 보강 후라면 DB/알림/백그라운드/차트/광고 모듈만 써도 30~40% 단축.

#### sumtally
- **현재 템플릿으로 재사용 가능**: ~60% (Riverpod + go_router + 디자인 토큰 + 일부 공통 위젯)
- **반드시 새로 들어와야 하는 것**:
  - 로컬 DB (Drift 권장)
  - 온보딩 3-step 프레임워크
  - BottomNavShell (+중앙 FAB)
  - fl_chart 차트 래퍼
  - CommaFormatter
  - DonutGauge(또는 Gauge 위젯)
  - 날짜 범위/기간 타입(PeriodType: 월/주/일) 유틸
- **앱 고유 유지**: 2단계 태깅(Category→BudgetGroup), ExpenseAllocation 비중 분할, 주간 메모
- **전망**: 템플릿 보강만 잘 되면 **화면 레이어와 비즈니스 로직만 이식**하면 됨. 마이그레이션 공수 대폭 단축.

---

## Part 2. 템플릿 보강 제안 (필수→권장→역제안)

### 🎯 사용자 확정 결정사항

- **DB 라이브러리**: Drift (sumtally 기존 사용 + rny도 이식 대상)
- **모드 분기 방식**: **FeatureKit 구조** (flat common/ → kits/ 재조직). 3-B 역제안 채택.
- **Tier 2 포함 범위**: **전부** (로컬 알림+백그라운드, 차트, 강제 업데이트+AdMob, 권한/디바이스/런처아이콘)

### Tier 1. 마이그레이션 차단 요소 해제 (필수)

#### 1-A. FeatureKit 아키텍처 도입 (새 기본 구조)

**왜 필요**: AppConfig.mode 플래그만으로는 코드가 모두 common/에 섞여 있어서, localOnly 모드인데도 auth/backend 코드가 딸려 들어온다. FeatureKit으로 분리하면 import만으로 바이너리에서 빠지고, 두 앱(로컬 전용) + testFlutterUseTemplateApp(백엔드 인증) 같은 이질적 조합을 깨끗이 표현 가능.

**새 디렉토리 구조**:
```
lib/
├── main.dart
├── app.dart
├── core/                           # 모든 앱 공통 (항상 포함)
│   ├── config/app_config.dart      # 기존 AppConfig (환경/지원이메일 등만, API/Auth 탈거)
│   ├── theme/                       # 기존 theme/ 통째로 이동
│   ├── widgets/                     # 기존 widgets/ (버튼/다이얼로그/스낵바 등)
│   ├── utils/                       # 기존 utils + input_formatters + date_range
│   ├── i18n/                        # 기존 그대로
│   ├── storage/                     # PrefsStorage (SecureStorage는 auth_kit으로)
│   ├── router/                      # Router 골격 (kit들이 routes 기여)
│   └── kit.dart                     # AppKit 추상 클래스
├── kits/
│   ├── backend_api_kit/             # ApiClient + /api/apps/ prefix + interceptors
│   ├── auth_kit/                    # JWT, TokenStorage, AuthService, login screen (backend_api_kit 의존)
│   ├── local_db_kit/                # Drift base + providers + BootStep
│   ├── notifications_kit/           # 로컬 알림 + (선택적) FCM
│   ├── background_kit/              # workmanager 래퍼
│   ├── charts_kit/                  # fl_chart 래퍼 (DonutGauge 등)
│   ├── update_kit/                  # Firebase Remote Config + ForceUpdateDialog
│   ├── ads_kit/                     # google_mobile_ads + BannerAdWidget
│   ├── permissions_kit/             # permission_handler 래퍼
│   ├── device_info_kit/             # device_info_plus + package_info_plus
│   ├── onboarding_kit/              # OnboardingScaffold + 단계 추상화
│   └── nav_shell_kit/               # BottomNavShell (+FAB 옵션)
└── features/                        # 앱 고유 화면 (fork 후 작성)
```

**AppKit 추상 계약**:
```dart
abstract class AppKit {
  String get name;
  List<Override> get providerOverrides;     // Riverpod overrides
  List<RouteBase> get routes;                // go_router 기여
  List<BootStep> get bootSteps;              // Splash에서 실행
  Future<void> onInit();                     // ensureInitialized 이후 실행
  Redirect? buildRedirect();                 // 선택적 리다이렉트 규칙
}
```

**main.dart 사용 패턴**:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppPalette.init(MyPalette());
  AppConfig.init(appName: 'Sumtally', environment: Environment.prod);

  await AppKits.install([
    LocalDbKit(database: () => SumtallyDatabase()),
    OnboardingKit(),
    NavShellKit(tabs: sumtallyTabs),
    ChartsKit(),
  ]);

  runApp(AppKits.buildRoot());
}
```

**rny에서의 사용 예시**:
```dart
await AppKits.install([
  LocalDbKit(database: () => RnyDatabase()),
  NotificationsKit.local(),
  BackgroundKit(),
  UpdateKit.firebaseRemoteConfig(minVersionKey: 'rny_min_version'),
  AdsKit(config: RnyAdConfig()),
  PermissionsKit(),
  DeviceInfoKit(),
  ChartsKit(),
  NavShellKit(tabs: rnyTabs),
]);
```

**testFlutterUseTemplateApp 기존 샘플**:
```dart
await AppKits.install([
  BackendApiKit(appSlug: 'template', baseUrl: 'https://api.example.com'),
  AuthKit.jwt(socials: [AppleAuth(), GoogleAuth()]),
  NotificationsKit.localPlusFcm(),
  DeviceInfoKit(),
]);
```

### 1-A-Flow. localOnly vs backendAuth 로직 플로우 (핵심)

**원칙**: "모드" 변수 없음. **설치된 Kit 조합으로 자동 파생**.

```dart
// AppKits 헬퍼
bool get hasAuth => has<AuthKit>();
bool get hasBackend => has<BackendApiKit>();
```

**부트 시퀀스**:
```
runApp() → Splash 표시 → SplashController.run() 시작
  │
  ├─ 모든 설치된 Kit의 bootSteps를 수집해 순차 실행
  ├─ [LocalDbKit]      DbMigrationStep         ← 항상 먼저
  ├─ [AuthKit]         AuthCheckStep           ← 토큰 유효성, AuthState 방출
  ├─ [UpdateKit]       ForceUpdateStep         ← Remote Config, 강제시 다이얼로그
  ├─ [NotificationsKit] NotificationInitStep   ← 채널 등록, 권한
  ├─ [BackgroundKit]   BackgroundRegisterStep  ← workmanager 등록
  │
  └─ 완료 → Router redirect → 첫 화면
```

**localOnly (sumtally)**:
```
Splash → DbMigration → (Auth 없음) → Redirect → onboarded? /home : /onboarding
```

**backendAuth (testFlutterUseTemplateApp)**:
```
Splash → DbMigration(선택) → AuthCheck → Redirect → authed? /home : /login
```

**라우터 리다이렉트 체인** (`core/router/app_router.dart`):
```dart
GoRouter _build() {
  return GoRouter(
    refreshListenable: _compositeRefresh,  // 모든 kit의 refresh listenable 합성
    redirect: (ctx, state) {
      for (final rule in _collectedRedirects) {    // 우선순위 순
        final result = rule(ctx, state);
        if (result != null) return result;
      }
      return null;
    },
    routes: _collectedRoutes,                // 모든 kit의 routes 합성
  );
}
```

**리다이렉트 우선순위 (고정)**:
1. `UpdateKit` — 강제 업데이트 화면에서 다른 이동 차단
2. `AuthKit` — 미인증 → /login
3. `OnboardingKit` — 미완료 → /onboarding
4. (없으면 null)

- localOnly + onboarding: 1·2 부재 → 3만 작동
- backendAuth: 1·2·3 모두 순서대로

**API 호출 흐름**:

| 상황 | 동작 |
|---|---|
| BackendApiKit 미설치 (sumtally) | `apiClientProvider` 자체가 미등록. read 시 ProviderNotFound (의도된 fast-fail) |
| BackendApiKit 미설치 + 외부 API (rny Yahoo) | `externalApiClientProvider.family(ExternalApiConfig)` 사용. `/api/apps/` prefix 없음 |
| BackendApiKit 설치 + AuthKit 설치 | ApiClient 정상 작동, AuthInterceptor가 토큰 첨부 |
| BackendApiKit 설치 + AuthKit 미설치 | ApiClient 작동하되 AuthInterceptor 체인에서 빠짐 (공개 백엔드 API 앱용) |

**사용 예시**:

sumtally 같은 로컬 앱:
```dart
await AppKits.install([
  LocalDbKit(database: () => SumtallyDatabase()),
  OnboardingKit(steps: [BudgetStep(), GroupStep(), CategoryStep()]),
  NavShellKit(tabs: sumtallyTabs),
  ChartsKit(),
]);
```

rny 같은 알림 중심 로컬 앱:
```dart
await AppKits.install([
  LocalDbKit(database: () => RnyDatabase()),
  NotificationsKit.local(),
  BackgroundKit(dailyTasks: [RebalanceCheckTask()]),
  UpdateKit.firebaseRemoteConfig(),
  AdsKit(config: RnyAdConfig()),
  PermissionsKit(),
  ChartsKit(),
  NavShellKit(tabs: rnyTabs),
]);
```

백엔드+인증 앱 (기존 샘플):
```dart
await AppKits.install([
  BackendApiKit(appSlug: 'template', baseUrl: env.baseUrl),
  AuthKit.jwt(socials: [AppleAuth(), GoogleAuth()]),
  NotificationsKit.localPlusFcm(),
]);
```

**테스트 전략**:
- Kit의 redirect 규칙은 순수 함수 `(AuthStatus, String path) → String?`로 유지 → 기존 `computeAuthRedirect` 테스트 패턴 그대로.
- `AppKits.installForTest([...])` 헬퍼로 테스트마다 다른 구성 주입.
- 미설치 Kit의 Provider를 호출하면 ProviderNotFound가 나야 함(계약 테스트).

### 1-A-Install. "Use this template" 배포 시 Kit 설치 여부 판단

**원칙**: GitHub "Use this template"은 모든 kit 코드를 통째로 복사. "설치 여부"는 두 축.

| 축 | 판단 주체 | 영향 |
|---|---|---|
| 런타임(기능 활성화) | `main.dart`의 `AppKits.install([...])` 리스트 | routes/redirects/bootSteps 수집 여부 결정 |
| 바이너리(코드 잔존) | `lib/kits/{name}/` 디렉토리 + `pubspec.yaml` | 앱 크기, 빌드 시간에만 영향 |

**런타임 판정만이 진실의 출처**. `AppKits.has<AuthKit>()`는 `main.dart`에서 install 여부를 본다. 코드가 lib/kits에 남아있어도 install되지 않으면 없는 것으로 취급.

**AppKits 구현 스케치**:
```dart
abstract class AppKit {
  String get name;
  List<Type> get requires => const [];      // 의존 Kit 타입
  int get redirectPriority => 100;
  List<Override> get providerOverrides => const [];
  List<RouteBase> get routes => const [];
  List<BootStep> get bootSteps => const [];
  RedirectRule? buildRedirect() => null;
  Future<void> onInit() async {}
}

class AppKits {
  static final List<AppKit> _installed = [];
  static final Map<Type, AppKit> _lookup = {};

  static Future<void> install(List<AppKit> kits) async {
    for (final k in kits) {
      _installed.add(k);
      _lookup[k.runtimeType] = k;
    }
    _validateDependencies();   // 누락 의존 즉시 실패
    for (final k in kits) { await k.onInit(); }
  }

  static bool has<T extends AppKit>() => _lookup.containsKey(T);
  static T? get<T extends AppKit>() => _lookup[T] as T?;

  static void _validateDependencies() {
    for (final kit in _installed) {
      for (final required in kit.requires) {
        if (!_lookup.containsKey(required)) {
          throw StateError(
            '${kit.name} requires ${required} to be installed first. '
            'Add it to AppKits.install([...]).',
          );
        }
      }
    }
  }
}

class AuthKit extends AppKit {
  @override List<Type> get requires => const [BackendApiKit];
  // ...
}
```

**fork 후 사용자가 하는 일 (3단계)**:

레벨 1 — 빠른 시작 (`main.dart`만 편집):
- install 리스트 교체. 동작은 완벽.
- 비용: `lib/kits/` 코드 잔존 + pubspec dep 설치됨 → 빌드·바이너리 크기.

레벨 2 — 정리 (`scripts/remove_kit.sh <kit_name>`):
- `lib/kits/{name}/` 디렉토리 삭제
- `pubspec.yaml`에서 해당 kit manifest의 패키지 라인 제거
- `main.dart` import 체크(경고)
- 각 kit은 `kits/{name}/kit_manifest.yaml`에 자신의 pubspec 의존성 목록 선언 → 스크립트가 이를 읽어 정리.

레벨 3 — 커스텀 Kit 추가:
- `lib/kits/my_feature_kit/`에 `AppKit` 구현체 작성
- `main.dart`에서 install에 포함
- 앱 고유 도메인 기능도 kit로 격리 가능 (RnyNotificationsKit이 NotificationsKit 상속 등)

### 1-A-Configure. `app_kits.yaml` 선언형 설정 + `configure_app` 스크립트

**문제**: `main.dart`에서 AppKits.install을 사람이 외우고 치면 누락 위험. pubspec/gradle/plist도 수동 편집해야 함.

**해법**: 프로젝트 루트에 `app_kits.yaml` 하나가 **앱 구성의 진실의 출처**. 스크립트가 나머지를 자동 처리.

**1) `app_kits.yaml` 스펙**:
```yaml
app:
  name: Sumtally
  slug: sumtally
  environment: prod                    # dev | staging | prod
  bundle_id_android: com.sumtally.app
  bundle_id_ios: com.sumtally.app
  support_email: support@sumtally.com
  privacy_url: https://sumtally.com/privacy
  launcher_icon_path: assets/icons/launcher.png
  splash_image_path: assets/splash/logo.png
  palette_class: SumtallyPalette
  palette_file: lib/palettes/sumtally_palette.dart

firebase:                                # 선택적
  android: android/app/google-services.json
  ios: ios/Runner/GoogleService-Info.plist

kits:
  local_db_kit:
    database_class: SumtallyDatabase
    database_file: lib/database/sumtally_database.dart
  onboarding_kit:
    steps: [BudgetStep, GroupStep, CategoryStep]
  nav_shell_kit:
    tabs: [HomeTab, CalendarTab, HistoryTab, StatsTab]
    center_fab: true
  charts_kit: {}
  # 목록에 없는 kit은 자동 제거됨
```

**2) `tool/configure_app.dart` 실행 모드**:
- `--dry-run` — 변경사항 diff만 출력 (기본)
- `--apply` — 실제 변경 (git dirty면 거부, `--force`로 오버라이드)
- `--audit` — CI용. 현재 코드가 yaml과 일치하지 않으면 non-zero exit

**3) 스크립트 책임 범위**:
1. **Validate**: kit 의존성(`requires`) 확인, 참조 클래스 파일 존재 확인, 중복 태그 검출
2. **Generate main.dart**: 마커 `// <configure:kits-begin>`…`// <configure:kits-end>` 사이만 재생성 (나머지 사용자 커스텀 코드 보존)
3. **Prune kits**: 미사용 `lib/kits/{name}/` 디렉토리 삭제
4. **Prune pubspec**: 각 kit의 `kit_manifest.yaml`에 선언된 pubspec 의존성만 남김
5. **Native config**:
   - Android: `android/app/build.gradle`의 `applicationId` 치환
   - iOS: `ios/Runner/Info.plist`의 `CFBundleIdentifier` 치환
6. **Firebase copy**: `firebase:` 블록이 있으면 파일 복사/검증
7. **Assets**: 런처 아이콘/스플래시 경로 → `flutter_launcher_icons.yaml`, `flutter_native_splash.yaml` 갱신
8. **Codegen**: `flutter pub get` → `dart run build_runner build --delete-conflicting-outputs` (drift, freezed 등)

**4) 안전장치**:
- `--apply` 시 git working tree가 dirty이면 중단 (`--force`로 우회)
- kit 디렉토리 삭제는 `rm -rf`가 아니라 staging 디렉토리로 이동 후 사용자 확인
- main.dart 마커 외 영역은 절대 건드리지 않음 (AST 파싱이 아니라 마커 기반 단순 치환)

**5) 레시피와의 결합** (3-C):
```
recipes/
├── local-only-tracker.yaml    # sumtally류 베이스
├── local-notifier-app.yaml    # rny류 베이스
└── backend-auth-app.yaml      # testFlutterUseTemplateApp류 베이스
```
`dart run tool/apply_recipe.dart local-only-tracker` → 레시피를 `app_kits.yaml`로 복사 후 `configure --apply` 자동 실행.

**6) `main.dart` 템플릿 (마커 포함)**:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppPalette.init(
    // <configure:palette-begin>
    SumtallyPalette(),
    // <configure:palette-end>
  );
  AppConfig.init(
    // <configure:config-begin>
    appName: 'Sumtally',
    appSlug: 'sumtally',
    environment: Environment.prod,
    supportEmail: 'support@sumtally.com',
    privacyUrl: 'https://sumtally.com/privacy',
    // <configure:config-end>
  );

  await AppKits.install([
    // <configure:kits-begin>
    LocalDbKit(database: () => SumtallyDatabase()),
    OnboardingKit(steps: [BudgetStep(), GroupStep(), CategoryStep()]),
    NavShellKit(tabs: [HomeTab(), CalendarTab(), HistoryTab(), StatsTab()], centerFab: true),
    ChartsKit(),
    // <configure:kits-end>
  ]);

  runApp(AppKits.buildRoot());
}
```

**7) fork 직후 워크플로 (업데이트)**:
```markdown
## fork 직후 할 일
1. app_kits.yaml 편집 (또는 `dart run tool/apply_recipe.dart <recipe>` 실행)
2. `dart run tool/configure_app.dart --apply` 실행
3. lib/palettes/ 에 브랜드 팔레트 파일 작성
4. lib/database/ 에 Drift 데이터베이스 파일 작성 (local_db_kit 사용 시)
5. lib/features/ 에 앱 고유 화면 작성
6. CI에 `dart run tool/configure_app.dart --audit` 추가
```

**8) CI 가드**:
- PR에서 `configure --audit` 실행 → yaml과 코드가 불일치하면 fail
- 개발자가 main.dart를 임의 편집했을 때 감지
- yaml 스키마 검증(kit 이름 오타, 누락 필드)도 여기서

**Kit Manifest 예시** (`lib/kits/backend_api_kit/kit_manifest.yaml`):
```yaml
name: backend_api_kit
description: Dio 기반 백엔드 API 클라이언트 + 인터셉터
dependencies:
  - dio: ^5.7.0
dev_dependencies: []
requires: []
```

**수정/이동될 파일**:
- `lib/common/config/app_config.dart` → `lib/core/config/app_config.dart` (auth·API 필드 제거)
- `lib/common/network/` 전체 → `lib/kits/backend_api_kit/`
- `lib/common/auth/` 전체 → `lib/kits/auth_kit/`
- `lib/common/providers.dart` → kit별 `providers.dart`로 분해
- `lib/common/router/app_router.dart` → `lib/core/router/app_router.dart` (kit 수집 로직으로 재작성)
- `lib/common/splash/splash_controller.dart` → `lib/core/splash/` (kit bootSteps 수집)
- `lib/features/login/` → `lib/kits/auth_kit/ui/login_screen.dart`
- `docs/conventions/architecture.md` → **FeatureKit 아키텍처** 섹션 새로 작성, 기존 "common/" 설명 대체

#### 1-B. 로컬 DB 계층 도입 (Drift 권장)
**왜 Drift**: sumtally가 이미 사용 중이고 코드 생성 기반 타입 안전·마이그레이션·Riverpod 궁합이 좋음. rny가 sqflite인 건 레거시 이유일 뿐 Drift가 상위호환.

**추가할 것**:
- `lib/common/database/app_database_base.dart` — Drift `GeneratedDatabase` 래핑 추상 클래스 + 경로/마이그레이션 헬퍼.
- `lib/common/database/db_providers.dart` — `databaseProvider`(앱별 구현 override), `daoProvider.family<Dao>(typeToken)` 패턴.
- `BootStep` 구현체: `DatabaseMigrationStep` — Splash에서 자동 실행.
- `CacheStore` 구현체: `DriftCacheStore` — 기존 CachePolicy API 유지하며 DB 백엔드 사용.
- `docs/conventions/database.md` — 테이블 네이밍, DAO 패턴, 마이그레이션 규칙.

**pubspec 추가**: `drift: ^2.23`, `sqlite3_flutter_libs: ^0.5`, `path_provider: ^2.1`, dev에 `drift_dev`, `build_runner`.

#### 1-C. BottomNavShell (하단 탭 + 선택적 중앙 FAB)
**왜 필요**: sumtally, rny 모두 실질적으로 탭 구조. 템플릿에 없어서 매번 재작성.

**추가할 것**:
- `lib/common/widgets/bottom_nav_shell.dart` — `go_router`의 `StatefulShellRoute.indexedStack` 기반. 탭 정의(`NavTab` 리스트)와 중앙 액션 버튼(선택) 지원.
- `lib/common/router/nav_shell_builder.dart` — ShellRoute 빌더 헬퍼.
- `features/home` 스텁을 2탭짜리 예시로 교체(Home/Settings).

#### 1-D. 숫자·통화 입력 포맷터
**왜 필요**: rny(수량 입력), sumtally(금액 입력) 모두 콤마 포맷터 자체 구현.

**추가할 것**:
- `lib/common/utils/input_formatters.dart`:
  - `CommaNumberFormatter` — 1,234,567 정수
  - `DecimalInputFormatter` — 소수점 허용(자릿수 제한)
  - `CurrencyInputFormatter` — 통화 기호 + 콤마
  - `PercentInputFormatter` — 0~100 범위

#### 1-E. 온보딩 위자드 프리미티브
**왜 필요**: sumtally의 3-step(예산→그룹→카테고리) 플로우는 개인앱에서 흔함. 재사용 가능한 뼈대가 있으면 rny 초기 설정(알림 권한, 첫 포트폴리오)도 태워 넣기 쉬움.

**추가할 것**:
- `lib/common/onboarding/onboarding_scaffold.dart` — 단계 표시기(dots/progress), 좌우 이동, 스킵 버튼, 완료 콜백.
- `OnboardingStep` 추상 클래스.
- `onboardingCompleteProvider` — PrefsStorage 기반 플래그.
- 라우터 redirect에 `mode == localOnly && !onboarded`이면 `/onboarding` 강제 지원.

---

### Tier 2. 공통 편의 기능 (권장)

#### 2-A. 로컬 알림 서비스 구체 구현체
- `flutter_local_notifications` + `timezone` 기반 `LocalNotificationService implements NotificationService`.
- `schedule(id, title, body, at: DateTime, payload)`, `cancelById()`, `getPending()`.
- Android 13+ 알림 권한 요청 래퍼.
- **위치**: `lib/common/notifications/local_notification_service.dart`
- **docs**: `docs/integrations/local-notifications.md`

#### 2-B. 백그라운드 태스크 래퍼 (workmanager)
- `BackgroundTaskScheduler` — 태스크 이름·주기·콜백 등록 API.
- `@pragma('vm:entry-point')` callbackDispatcher 표준 패턴.
- **위치**: `lib/common/background/background_scheduler.dart`

#### 2-C. 차트 위젯 계층
- `fl_chart` 기반(더 가벼우므로 템플릿 기본으로). syncfusion은 rny에서 필요시 추가.
- `DonutGauge`(0~100%, 그래디언트, 중앙 라벨) — sumtally의 커스텀 위젯을 공통화.
- `AppPieChart`(카테고리 비중), `AppLineChart`(기간 추이), `AppBarChart`(누적 막대).
- **위치**: `lib/common/charts/`

#### 2-D. 강제 업데이트 플로우
- `AppUpdateService` (abstract) + `RemoteConfigUpdateService` (Firebase 구현).
- `ForceUpdateDialog` 위젯 (앱스토어/플레이스토어 링크).
- Splash `BootStep`으로 연결.
- **위치**: `lib/common/update/`

#### 2-E. AdMob 통합 (google_mobile_ads)
- `BannerAdWidget` — 로딩 실패 시 높이 0 collapse, 테스트 ID 기본.
- `AdConfig` — 플랫폼별 단위 ID 주입.
- **위치**: `lib/common/ads/`

#### 2-F. 권한 헬퍼 (permission_handler)
- `PermissionHelper.ensure(Permission)` — 거부 시 설정 이동 제안 다이얼로그.
- **위치**: `lib/common/permissions/permission_helper.dart`

#### 2-G. 디바이스/패키지 정보
- `DeviceInfoService` (device_info_plus + package_info_plus 래핑).
- 앱 버전, 플랫폼, OS 버전 한 번에.
- **위치**: `lib/common/device/device_info_service.dart`

#### 2-H. Launcher Icons 설정
- `flutter_launcher_icons.yaml` 템플릿 + README fork 체크리스트 업데이트.
- 현재 native_splash만 있고 icons는 누락.

#### 2-I. 날짜 범위/PeriodType 유틸
- `PeriodType { daily, weekly, monthly, yearly, custom }`.
- `DateRange.of(PeriodType, {DateTime anchor})` — 월의 첫날·마지막 날, 주의 월~일 등 계산.
- 두 앱 모두 사용.
- **위치**: `lib/common/utils/date_range.dart` (기존 `date_formatter.dart` 옆)

---

### Tier 3. 역제안 (새 아이디어)

#### 3-A. `AppPalette` "팩 시스템" ✅ 채택 (상세 설계 확정)

현재는 `DefaultPalette` 싱글톤. Pack을 등록/교체할 수 있는 Registry 패턴으로 전환.

**핵심 API**:
```dart
abstract class AppPalette {
  String get id;
  String get name;
  bool get supportsDarkMode => true;
  Color get seed;
  // accent, success, warning, error, info, border, textMuted, cardBackground ...
  ColorScheme lightScheme() => ColorScheme.fromSeed(seedColor: seed);
  ColorScheme darkScheme()  => ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark);
  AppPalette? get highContrastVariant => null;
}

class AppPaletteRegistry {
  static void register(AppPalette palette);
  static void use(String id);                   // 런타임 교체, notifier 방출
  static AppPalette get current;
  static List<AppPalette> get all;
  static Listenable get listenable;             // MaterialApp에서 listen → 테마 리빌드
}
```

**`app_kits.yaml` 스펙 확장**:
```yaml
palettes:
  - class: SumtallyPalette
    file: lib/palettes/sumtally_palette.dart
    default: true
  - class: SumtallyHighContrastPalette
    file: lib/palettes/sumtally_high_contrast_palette.dart
```

**`configure_app` 자동 생성 코드** (main.dart 마커 영역):
```dart
// <configure:palette-begin>
AppPaletteRegistry.register(SumtallyPalette());
AppPaletteRegistry.register(SumtallyHighContrastPalette());
AppPaletteRegistry.use('sumtally-light');
// <configure:palette-end>
```

**app.dart — 테마 자동 리빌드**:
```dart
ValueListenableBuilder<AppPalette?>(
  valueListenable: AppPaletteRegistry.listenable,
  builder: (ctx, palette, _) => MaterialApp.router(
    theme: AppTheme.build(palette!.lightScheme()),
    darkTheme: AppTheme.build(palette.darkScheme()),
    themeMode: ref.watch(themeModeProvider),
    routerConfig: AppKits.buildRouter(),
  ),
);
```

**기존 코드 마이그레이션**:
- `AppPalette.init(MyPalette())` → `AppPaletteRegistry.register(MyPalette()); AppPaletteRegistry.use(myPaletteId)`
- `AppPalette.instance.seed` → `AppPaletteRegistry.current.seed`
- 스크립트로 자동 치환 (`tool/migrate_palette.dart`).

**이득**:
- 다크모드·고대비 접근성 팩까지 같은 구조
- 사용자 설정에서 팔레트 선택 가능(화이트라벨링)
- Kit 구조와 자연스러운 결합 (SettingsKit이 팔레트 스위처 제공 가능)

#### 3-B. "FeatureKit" 개념 도입
공통 코드를 단순히 `common/` 아래 쌓지 말고, **선택적 on/off 기능팩**으로 묶기:
```
lib/common/kits/
  ├── auth_kit/        (JWT + social)
  ├── backend_api_kit/ (/api/apps/ prefix)
  ├── local_db_kit/    (Drift + providers)
  ├── notifications_kit/ (local + FCM)
  ├── background_kit/  (workmanager)
  ├── ads_kit/         (admob)
  ├── charts_kit/      (fl_chart wrappers)
  └── update_kit/      (force update)
```
- `AppKits.enable([localDbKit, notificationsKit, adsKit])` in main.
- 각 kit가 자기 providers/routes/boot steps를 제공.
- `testFlutterUseTemplateApp`처럼 쓰지 않는 kit는 import조차 되지 않아 코드 크기 관리.
- **이득**: 두 앱을 모두 담으려면 템플릿이 비대해질 수밖에 없는데, kit 패턴이면 선택적 활성화로 해결.

#### 3-C. `testFlutterUseTemplateApp` 외에 "레시피" 디렉토리
템플릿 fork 후 "흔한 구성"별 예제 커밋:
- `recipes/local-only-tracker/` (sumtally 같은 앱)
- `recipes/local-notifier-app/` (rny 같은 앱)
- `recipes/backend-auth-app/` (현재 샘플)
각 레시피는 별도 git 브랜치 또는 주석 달린 snippet. fork 직후 `scripts/apply_recipe.sh local-only-tracker` 같은 형태로 초기 세팅까지.

#### 3-D. JSON 직렬화 규약 통일
- rny는 `toMap/fromMap` 수동, sumtally는 Drift 자동 생성.
- 템플릿은 `freezed + json_serializable` 기본 dev_dependency로 포함 → 서버 API DTO에 대해 예시 모델 하나 제공.
- 이게 있으면 "새 모델 하나 추가할 때 toJson/fromJson 수동 작성"을 없앨 수 있어 일관성 상승.

#### 3-E. `CacheStore`를 "저장소 어댑터"로 승격
현재 캐시 정책만 있는데, 로컬 우선 앱은 **저장소 계층 자체**가 필요. 그래서 범용 `KeyValueStore` 인터페이스(memory/prefs/secure/drift 어댑터)를 두고, 기존 CacheStore는 그 위의 TTL 레이어로 재정의. 이러면 DB 없이도 "오프라인 저장"이 쉬워짐.

#### 3-F. 에러 바운더리 + 글로벌 토스트 게이트
현재는 각 ViewModel catch. 추가:
- `AppErrorBoundary` 위젯 — `FlutterError.onError` + `PlatformDispatcher.onError` 연결, 화면 전환·재시도 UI.
- `ApiException` → `AppSnackBar.error(context, ...)` 자동 라우팅 유틸 (opt-in).

#### 3-G. "분석/크래시" 더미가 아닌 no-op과 debug 분리
현재 `DebugAnalyticsService`가 콘솔 출력. **prod 빌드 기본값은 NoOp**로 바꾸고, 개발 중 명시적으로 Debug 주입. 실수로 콘솔 스팸 나가는 일 방지.

#### 3-H. API 응답 규약 문서화 수준 강화
`ApiResponse<T>` + `PageResponse<T>` + `SearchRequestBuilder`는 훌륭하지만 **서버 쪽 규약이 없으면 못 씀**. `docs/conventions/api-contract.md`에 OpenAPI 예시(YAML) 또는 대표 endpoint 3~4개의 request/response 샘플을 추가.

---

## Part 3. 실행 우선순위 (제안)

| 순서 | 작업 | 근거 |
|---|---|---|
| 1 | 1-A 앱 모드 분기 (localOnly 지원) | 모든 후속 작업의 전제 |
| 2 | 1-B 로컬 DB(Drift) 계층 | 두 앱 다 DB 없이 마이그레이션 불가 |
| 3 | 1-C BottomNavShell | 레이아웃 뼈대, 샘플앱에 바로 적용 가능 |
| 4 | 1-D 숫자 포맷터 + 1-E 온보딩 | 작은 단위 작업, 금방 끝남 |
| 5 | 2-A 로컬 알림 + 2-B 백그라운드 | rny 마이그레이션 게이트 |
| 6 | 2-C 차트 + 2-I 날짜 범위 | 두 앱 공통 UI 요구 |
| 7 | 2-D 강제 업데이트 + 2-E AdMob + 2-F 권한 | rny 마이그레이션 완주 |
| 8 | 3-B FeatureKit 리팩터링 | 위 것들이 안착된 뒤 구조 재정리 |
| 9 | 3-C 레시피 디렉토리 | 마지막에 문서화 |

## Critical Files (변경될 파일들)

**Core 구조**:
- `/Users/twosun/workspace/template-flutter/lib/common/config/app_config.dart` — AppMode 추가
- `/Users/twosun/workspace/template-flutter/lib/common/providers.dart` — 모드별 분기, DB provider 추가
- `/Users/twosun/workspace/template-flutter/lib/common/network/api_client.dart` — appScoped 플래그
- `/Users/twosun/workspace/template-flutter/lib/common/router/app_router.dart` — 모드별 redirect
- `/Users/twosun/workspace/template-flutter/lib/common/splash/splash_controller.dart` — 조건부 auth 단계

**신규**:
- `lib/common/database/` (전체)
- `lib/common/widgets/bottom_nav_shell.dart`
- `lib/common/utils/input_formatters.dart`
- `lib/common/utils/date_range.dart`
- `lib/common/onboarding/` (전체)
- `lib/common/notifications/local_notification_service.dart`
- `lib/common/background/background_scheduler.dart`
- `lib/common/charts/` (전체)
- `lib/common/update/` (전체)
- `lib/common/ads/` (전체)
- `lib/common/permissions/permission_helper.dart`
- `lib/common/device/device_info_service.dart`
- `flutter_launcher_icons.yaml`

**Pubspec**:
- `/Users/twosun/workspace/template-flutter/pubspec.yaml` — drift, sqlite3_flutter_libs, path_provider, flutter_local_notifications, timezone, workmanager, firebase_core, firebase_remote_config, google_mobile_ads, permission_handler, package_info_plus, device_info_plus, fl_chart, flutter_launcher_icons, freezed, json_serializable, build_runner, drift_dev 추가

**문서**:
- `docs/conventions/architecture.md` — 모드 섹션 추가
- `docs/conventions/database.md` — 신규
- `docs/integrations/local-notifications.md` — 신규
- `docs/integrations/background-tasks.md` — 신규
- `docs/integrations/charts.md` — 신규
- `docs/integrations/ads.md` — 신규
- `README.md` fork 체크리스트 업데이트

## 재사용 가능한 기존 구성

이미 템플릿에 있어서 그대로 활용되는 것:
- `lib/common/theme/app_palette.dart` (확장 클래스만 추가)
- `lib/common/theme/app_spacing.dart`, `app_typography.dart`, `app_shadows.dart`, `app_icons.dart`
- `lib/common/widgets/` (PrimaryButton/SecondaryButton/AppTextField/AppDialog/AppBottomSheet/AppSnackBar/LoadingView/EmptyView/ErrorView/SkeletonLoading/TopProgressBar/AppBackHandler)
- `lib/common/utils/form_validators.dart`, `currency_formatter.dart`, `date_formatter.dart`, `debouncer.dart`, `app_launcher.dart`
- `lib/common/splash/` 골격 (BootStep 확장 지점 유지)
- `lib/common/cache/` 골격 (Drift 어댑터만 추가)

## Verification (검증 방법)

각 Tier 작업 후:

1. **단위 테스트**: 신규 유틸/포맷터/DateRange는 unit test 필수.
2. **통합 확인**: `testFlutterUseTemplateApp`에 새 기능을 적용해서 동작 확인.
3. **두 앱 마이그레이션 "지문" 테스트**:
   - sumtally의 `BudgetGroup` 테이블 + DAO를 Drift 계층 위에 얹어보기 → 성공하면 DB 계층 통과.
   - rny의 "매일 08:00 알림" 시나리오를 BackgroundTaskScheduler + LocalNotificationService로 구현 → 성공하면 알림 계층 통과.
   - sumtally의 3-step 온보딩을 OnboardingScaffold로 구현 → 성공하면 온보딩 통과.
4. **AppMode 회귀 테스트**: `localOnly` 모드에서 스플래시→홈 도달, `backendAuth` 모드에서 기존 login 흐름 유지.
5. **`flutter analyze`** 무경고.
6. **빌드 크기 확인**: 모든 kit 포함 시와 최소 구성 시 APK 크기 차이 확인(3-B FeatureKit 정당성).

---

## 요약 답변 (사용자 질문에 직답)

- **"지금 템플릿으로 rny, sumtally 누락 없이 마이그레이션 가능?"** → **아니오**. 구조적 블로커 3개(백엔드 API 전제, 인증 필수, 로컬 DB 부재) 때문에 sumtally는 부분 가능, rny는 거의 재작성 수준.
- **"템플릿에 공통 코드로 뭐가 더 올라가면 좋겠는지?"** → Tier 1 다섯 가지(AppMode, DB, BottomNavShell, InputFormatters, Onboarding)는 **필수**. Tier 2 아홉 가지(알림/백그라운드/차트/업데이트/광고/권한/디바이스정보/런처아이콘/날짜범위)는 권장.
- **"역제안 있으면?"** → FeatureKit 구조(3-B), Palette Pack(3-A), Recipe 디렉토리(3-C), freezed 기본화(3-D), KeyValueStore 어댑터(3-E), 에러 바운더리(3-F), NoOp 기본(3-G), API 규약 문서화(3-H) 등 여덟 가지.
