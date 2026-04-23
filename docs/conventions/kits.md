# FeatureKit 아키텍처

이 템플릿은 모든 선택적 기능을 **FeatureKit**으로 캡슐화합니다. 앱마다 필요한 kit만
설치(install)하면 해당 기능의 Provider/라우트/부팅 단계/리다이렉트가 자동으로 조립됩니다.

## 왜 Kit인가

- **앱마다 성격이 극단적으로 다릅니다**: 백엔드+인증 앱, 로컬 전용 앱, 알림 중심 앱, 가계부 앱...
- **모노리식 템플릿은 관리가 어렵습니다**: 사용하지 않는 auth/network 코드가 섞여서 비대해집니다.
- **명시적 조립이 낫습니다**: `main.dart`의 `AppKits.install([...])` 한 곳에서 앱 성격이 결정됩니다.

## 구조

```
lib/
├── core/                  # 모든 앱이 항상 쓰는 것 (theme/widgets/utils/...)
│   └── kits/              # AppKit 추상 계약 + AppKits 레지스트리
├── kits/                  # 선택적 FeatureKit들
│   ├── backend_api_kit/   # Dio + interceptors
│   ├── auth_kit/          # JWT + 로그인
│   ├── local_db_kit/      # Drift
│   ├── nav_shell_kit/     # 하단 탭 + FAB
│   ├── onboarding_kit/    # 다단계 위자드
│   ├── notifications_kit/ # 로컬 예약 알림
│   ├── background_kit/    # workmanager
│   ├── charts_kit/        # fl_chart
│   ├── update_kit/        # 강제 업데이트
│   ├── ads_kit/           # AdMob
│   ├── permissions_kit/   # permission_handler
│   └── device_info_kit/   # device/package info
└── features/              # 앱 고유 화면
```

## AppKit 계약

```dart
abstract class AppKit {
  String get name;                              // 식별 이름
  List<Type> get requires;                      // 의존 Kit
  int get redirectPriority;                     // 낮을수록 먼저 실행
  List<Override> get providerOverrides;         // Riverpod override
  List<RouteBase> get routes;                   // go_router 라우트
  List<NavigatorObserver> get navigatorObservers; // 라우터 observer 기여
  List<BootStep> get bootSteps;                 // 스플래시 부트 단계
  RedirectRule? buildRedirect();                // 리다이렉트 규칙
  Listenable? get refreshListenable;            // 라우터 리빌드 트리거
  Future<void> onInit();                        // install 시점 초기화
  Future<void> onDispose();                     // 해제 시점 (롤백/테스트 reset)
}
```

### `navigatorObservers`

go_router의 `observers`에 전달될 `NavigatorObserver` 목록입니다. 여러 Kit이 동시에 기여하면 install 순서대로 병합됩니다.

```dart
// ObservabilityKit 예시 — 화면 전환을 PostHog에 자동 트래킹
class ObservabilityKit extends AppKit {
  @override
  List<NavigatorObserver> get navigatorObservers => [
    AnalyticsNavigatorObserver(),
  ];
}
```

### `onDispose()`

Kit이 점유한 리소스(스트림 구독, 네이티브 채널 등)를 해제하는 메서드입니다. 두 가지 시점에 호출됩니다:

1. **install 롤백**: `onInit()`이 중간에 실패하면, 이미 성공한 kit들이 역순으로 `onDispose()` 호출된 뒤 레지스트리에서 제거됩니다.
2. **테스트 reset**: `AppKits.resetForTest()` 호출 시 전체 kit이 역순으로 `onDispose()` 호출됩니다.

기본 구현은 no-op(`async {}`)입니다. 리소스를 관리하는 kit만 오버라이드하면 됩니다.

```dart
class NotificationsKit extends AppKit {
  StreamSubscription? _sub;

  @override
  Future<void> onInit() async {
    _sub = notificationStream.listen(_handleNotification);
  }

  @override
  Future<void> onDispose() async {
    await _sub?.cancel();
    _sub = null;
  }
}
```

## 조립

`main.dart`에서 `AppKits.install([...])`로 필요한 kit을 나열합니다. 순서는 의존성 순으로 작성합니다:

```dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(),                            // requires BackendApiKit (자동 검증)
  LocalDbKit(database: () => AppDatabase()),
  NavShellKit(tabs: [...]),
]);
```

- `AppRouter`는 `AppKits.allRoutes` + `redirectRules` + `compositeRefreshListenable` 자동 합성
- `SplashController`는 `AppKits.allBootSteps` 순차 실행
- `ProviderScope`는 `AppKits.allProviderOverrides`로 초기화

### `attachContainer()` — 왜 필요한가

`ProviderContainer`는 `install` 이후에 생성됩니다. Kit의 `bootSteps`와 `refreshListenable`은 provider를 읽어야 하므로, 컨테이너가 생긴 직후 레지스트리에 바인딩해야 합니다.

```dart
// main.dart의 정확한 순서
await AppKits.install([...]);               // 1. Kit 등록 + onInit()

final container = ProviderContainer(        // 2. 컨테이너 생성
  overrides: AppKits.allProviderOverrides,
);

AppKits.attachContainer(container);         // 3. 바인딩 — 이후 bootSteps가 provider 읽기 가능
```

순서가 바뀌면 `bootSteps` 안에서 `AppKits.container`에 접근할 때 `StateError`가 발생합니다.

### install 실패 시 롤백

`onInit()` 실행 도중 예외가 발생하면 **이 호출에서 추가된 kit만 롤백**됩니다. 이미 성공한 kit들은 역순으로 `onDispose()`가 호출된 뒤 레지스트리에서 제거됩니다.

```
install([A, B, C])
  A.onInit() ✅
  B.onInit() ✅
  C.onInit() ❌ 예외 발생
    → C는 onInit 미완료이므로 onDispose 호출 안 함
    → B.onDispose() 호출
    → A.onDispose() 호출
    → A, B, C 레지스트리에서 제거
    → 원 예외 rethrow
```

## Kit 의존 관계도

각 kit의 `requires` (코드 의존)와 `redirectPriority` (라우팅 게이트 순서)를 한눈에 확인할 수 있습니다:

```
┌─────────────────────────────────────────────────────────────┐
│  redirect 우선순위 (낮을수록 먼저 실행)                          │
│                                                              │
│   1  ──▶  UpdateKit         (강제 업데이트 → /update)         │
│  10  ──▶  AuthKit           (미인증 → /login)                 │
│  50  ──▶  OnboardingKit     (미완료 → /onboarding)            │
│ 100  ──▶  (기본값, 게이트 없음)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  코드 의존 (requires) — install 순서 영향                      │
│                                                              │
│   AuthKit ──requires──▶ BackendApiKit                       │
│                                                              │
│   (그 외 모든 kit은 서로 독립)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 표 형식

| Kit | requires | redirectPriority | 비고 |
|-----|----------|------------------|------|
| `update_kit` | — | **1** | 가장 먼저 — 업데이트 강제 시 다른 게이트 차단 |
| `backend_api_kit` | — | 100 | HTTP 클라이언트, 다른 kit이 의존 |
| `auth_kit` | `backend_api_kit` | **10** | 인증 미통과 시 /login 리다이렉트 |
| `onboarding_kit` | — | **50** | 인증 통과 후 미완료면 /onboarding |
| `nav_shell_kit` | — | 100 | 하단 탭 셸, 게이트 없음 |
| `notifications_kit` | — | 100 | 푸시 + 로컬 알림 |
| `observability_kit` | — | 100 | Sentry/PostHog (DSN 없으면 Debug 폴백) |
| `local_db_kit` | — | 100 | Drift, 도메인이 DB 필요할 때만 |
| `background_kit` | — | 100 | workmanager |
| `charts_kit` | — | 100 | fl_chart |
| `ads_kit` | — | 100 | AdMob (UMP 동의 함께 다뤄야 함) |
| `permissions_kit` | — | 100 | 런타임 권한 헬퍼 |
| `device_info_kit` | — | 100 | 기기/패키지 정보 |

### 적용 규칙

- **install 순서**: 의존하는 kit이 먼저 옵니다. 즉 `BackendApiKit() → AuthKit()` 순입니다. 어기면 `AppKits.install`이 `StateError`로 거부합니다.
- **redirect 합성**: `redirectPriority` 오름차순으로 평가합니다. 첫 번째로 redirect를 반환하는 게이트가 승리합니다.
- **새 게이트 추가 시**: 기존 1/10/50 사이에 끼우거나 51 이상으로 설정합니다. 1·10·50은 변경 금지입니다 (UI 흐름이 깨집니다).
- **kit 제거 시**: `requires`로 의존받는 상위 kit이 있으면 같이 제거합니다 (예: BackendApiKit 빼면 AuthKit도).

---

## 선언적 구성 (`app_kits.yaml`)

루트의 `app_kits.yaml`이 **활성 kit 의도의 진실 출처**입니다. `lib/main.dart`의
`AppKits.install([...])`는 그 의도를 코드로 옮긴 것입니다.

```yaml
kits:
  backend_api_kit: {}
  auth_kit: {}
  local_db_kit:
    database_class: AppDatabase
    database_file: lib/database/app_database.dart
```

### 두 파일 동기화 (중요)

`app_kits.yaml`과 `lib/main.dart`의 install 리스트는 **사람이 수동으로 일치**시켜야 합니다. 한쪽만 수정하면 빌드는 통과하지만 의도와 다른 동작이 발생합니다.

**올바른 워크플로우**:

1. `app_kits.yaml`에서 kit 추가/제거
2. `lib/main.dart`의 `AppKits.install([...])`에 동일 변경 적용
3. `dart run tool/configure_app.dart` 실행 → `Status: OK` 확인
4. `flutter analyze` + `flutter test`로 회귀 검증

### configure_app.dart 출력 읽기

**정상**:
```
=== Configure App ===
app.name  : Template App
app.slug  : template
palette   : DefaultPalette

--- Kits ---
  [x] auth_kit
  [x] backend_api_kit
  [x] observability_kit
  [x] update_kit
  [ ] ads_kit (available, not enabled)
  [ ] local_db_kit (available, not enabled)
  ... (그 외 미활성 kit)

Status: OK
```

`[x]` 활성, `[ ]` 사용 가능하지만 비활성, `[!]` yaml에 선언됐지만 `lib/kits/` 디렉토리에 없음.

**의존성 누락**:
```
--- Kits ---
  [x] auth_kit
  [ ] backend_api_kit (available, not enabled)

--- Dependency Issues ---
  ✗ auth_kit requires backend_api_kit, which is not enabled

Status: ISSUES FOUND
```
→ 수정: `app_kits.yaml`에 `backend_api_kit: {}` 추가하고 `main.dart`에도 `BackendApiKit()` 끼워 넣습니다. (또는 auth_kit 비활성화)

**오타/존재하지 않는 kit**:
```
--- Kits ---
  [!] auht_kit (not found in lib/kits/)

Status: ISSUES FOUND
```
→ 수정: 오타 정정 (`auht_kit` → `auth_kit`).

### configure_app.dart의 한계

이 도구는 **`app_kits.yaml` 자체의 정합성**만 검증합니다 (kit 존재 여부, requires 충족).
`lib/main.dart`의 `AppKits.install` 리스트와의 일치는 **검증하지 않습니다**. 동기화는 사람의 책임이며, 빠뜨리면:
- yaml에는 있는데 main.dart에 없음 → 해당 kit 라우트/provider 모두 비활성 (앱은 정상 빌드, 동작만 누락)
- main.dart에는 있는데 yaml에 없음 → 실제로는 활성 (선언/실행 불일치, 다음 사람이 헷갈림)

CI에서는 `dart run tool/configure_app.dart --audit`로 yaml 정합성을 가드합니다. main.dart 동기화 자동 검증은 향후 확장 예정입니다.

## 레시피

자주 쓰는 조합을 `recipes/`에 사전 정의합니다:

| 레시피 | 용도 |
|---|---|
| `local-only-tracker.yaml` | sumtally류 가계부/로그 앱 |
| `local-notifier-app.yaml` | rny류 알림 중심 로컬 앱 |
| `backend-auth-app.yaml`   | 백엔드+JWT 앱 (기본 샘플) |

## 테스트에서 Kit 사용

### `AppKits.resetForTest()`

각 테스트가 끝나면 레지스트리를 초기화해야 다음 테스트와 상태가 섞이지 않습니다. `resetForTest()`는 전체 kit을 역순으로 `onDispose()` 호출한 뒤 레지스트리와 컨테이너를 초기화합니다.

```dart
tearDown(() async {
  await AppKits.resetForTest();
});
```

### Provider 오버라이드 패턴

테스트에서 특정 서비스를 mock으로 교체할 때는 kit install 시 `providerOverrides`로 주입합니다.

```dart
setUp(() async {
  await AppKits.install([
    BackendApiKit(baseUrl: 'http://localhost:8080'),
    AuthKit(),
  ]);

  final container = ProviderContainer(
    overrides: [
      ...AppKits.allProviderOverrides,
      crashServiceProvider.overrideWithValue(FakeCrashService()),  // mock 주입
    ],
  );
  AppKits.attachContainer(container);
});

tearDown(() async {
  await AppKits.resetForTest();
});
```

### Kit 없이 단위 테스트

ViewModel/Service 단위 테스트는 kit install 없이 `ProviderContainer`를 직접 생성해 사용합니다.

```dart
test('로그인 성공 시 상태가 authenticated로 변경', () async {
  final container = ProviderContainer(
    overrides: [
      authServiceProvider.overrideWithValue(FakeAuthService()),
    ],
  );
  addTearDown(container.dispose);

  final vm = container.read(loginViewModelProvider.notifier);
  await vm.login(email: 'test@example.com', password: '1234');

  expect(container.read(loginViewModelProvider).isAuthenticated, isTrue);
});
```

---

## Kit 내부 폴더 구조

Kit이 여러 파일로 구성될 때의 표준 레이아웃입니다:

```
lib/kits/my_kit/
├── my_kit.dart              # AppKit 구현체 (진입점)
├── my_service.dart          # 핵심 비즈니스 로직 (인터페이스)
├── my_service_impl.dart     # 실제 구현 (프로덕션)
├── my_service_debug.dart    # Debug 폴백 구현 (DSN/키 없을 때)
├── interceptors/            # Dio interceptor (backend_api_kit 패턴)
│   └── my_interceptor.dart
├── ui/                      # Kit이 제공하는 화면 (선택)
│   ├── my_screen.dart
│   └── my_view_model.dart
└── README.md                # Kit 온보딩 문서
```

**규칙:**
- `my_kit.dart`가 진입점입니다. 외부는 이 파일만 import합니다.
- 인터페이스(`my_service.dart`)와 구현체(`my_service_impl.dart`)를 분리해 테스트에서 mock 교체가 가능하게 합니다.
- private helper는 파일명 앞에 `_` 없이, class에만 `_`를 적용합니다.
- `ui/` 하위 파일은 kit 외부에서 직접 사용 가능합니다 (라우트 등록 시 필요).

## 새 Kit 작성

1. `lib/kits/my_kit/` 디렉토리 생성
2. `my_kit.dart`에 `AppKit` 구현 + 필요한 Provider/서비스
3. `kit_manifest.yaml`에 이름/설명/의존성 선언
4. `test/kits/my_kit/` 테스트 (AppKit 메타 + 실제 동작)
5. README.md 작성 (아래 **Kit README 표준 양식** 따름)

Kit은 서로 독립적이어야 합니다. 다른 Kit의 Provider를 읽어야 하면 `requires`로 명시합니다.

## Kit README 표준 양식

`lib/kits/{kit}/README.md`는 아래 섹션을 순서대로 포함합니다. 파생 레포 개발자의 온보딩
기준(30분 안에 도입 여부 결정)으로 작성합니다.

```markdown
# {kit_name}

{1-2줄 요약: 이 kit이 무엇을 해결하고 어떤 앱에 적합한지}

## 제공

- `{ClassName}` — {역할 1줄}
- `{providerName}` — {어느 시점에 어떤 값을 내놓는지}
- ... (공개 API만. private helper 제외)

## 의존

- 다른 kit: `{OtherKit}` (requires 선언 기준)
- 플랫폼 권한: `{ANDROID_PERMISSION}`, iOS {Info.plist 키} (있다면)
- 플러그인: `{package_name}` (pubspec.yaml에 이미 선언됨)

## 사용법

```dart
await AppKits.install([
  MyKit(
    // 최소 구성
  ),
]);

// feature에서 사용
final value = ref.watch(myKitProvider);
```

## 파생 레포 커스터마이징

- 기본 구현을 {실제 구현체}로 교체: `ref.overrideWithValue(...)`
- {옵션 1}: 설명
- {옵션 2}: 설명

## 제거

- `app_kits.yaml`에서 `my_kit:` 라인 주석 처리
- `main.dart`의 `AppKits.install([...])`에서 `MyKit()` 제거
- 해당 kit을 import하는 `features/` 코드도 함께 삭제
- 디렉토리 삭제는 선택 (되돌리기 쉽게 남겨둬도 OK)

## 테스트

- 단위 테스트: `test/kits/{kit}/{kit}_test.dart`
- Contract 테스트(있다면): kit 메타 + install 검증
```

위 섹션 중 해당 없는 것은 생략 가능합니다(예: 의존 플랫폼 권한 없을 때). 하지만
**제공 / 사용법 / 제거** 3개는 필수입니다.

## Kit 제거 가이드

개발자가 특정 kit을 빼고 싶을 때의 표준 절차입니다:

1. **선언 비활성화**: `app_kits.yaml`의 해당 `{kit_name}:` 라인을 주석 처리합니다.
2. **조립에서 제거**: `lib/main.dart`의 `AppKits.install([...])`에서 해당 `Kit()` 인스턴스를 제거합니다.
3. **사용처 정리**: `features/` 내에서 해당 kit의 Provider/위젯을 import하는 코드를 제거합니다.
4. **검증**: `flutter analyze` + `flutter test` → 그린이면 완료입니다.
5. **디렉토리 처리** (선택): 확실히 불필요하면 `lib/kits/{kit}/` 디렉토리를 삭제합니다. 파생 레포 히스토리가
   혼란스러우면 남겨둬도 무방합니다 — `app_kits.yaml`에서 주석 처리된 상태로 보존합니다.

**주의**: `requires` 의존성이 있는 다른 kit(예: AuthKit → BackendApiKit)을 제거하면 해당 상위 kit도 함께 정리해야 합니다.
