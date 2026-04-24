# ADR-008 · 부팅 단계 추상화 (BootStep + SplashController)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/common/splash/boot_step.dart` (7줄 계약), `lib/common/splash/splash_controller.dart` (39줄) + 각 Kit 이 기여하는 BootStep (`AuthCheckStep` 등).

## 결론부터

앱 시작 시 "토큰 유효성 확인 · PostHog init · 강제 업데이트 체크" 같은 **부팅 단계들** 이 있어요. 이걸 **`BootStep` 인터페이스** 로 추상화하고, 각 Kit 이 자기 단계를 기여하며 `SplashController` 가 순차 실행해요. 단계 추가 · 제거가 **Kit 수준에서 선언적** 이라 `main.dart` 를 건드리지 않고도 초기화 로직을 확장할 수 있어요.

## 왜 이런 고민이 시작됐나?

처음 템플릿 상태에선 `main.dart` 의 `_bootstrap()` 함수에 모든 초기화가 일렬로 쌓여 있었어요.

```dart
Future<void> _bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _initSentry();
  await _checkAuthToken();
  await _initPostHog();
  await _checkForceUpdate();
  // ... 계속 추가 ...
  runApp(...);
}
```

ADR-003 이 FeatureKit 동적 레지스트리를 도입하자마자 이 구조의 문제가 드러났어요.

**문제 1 — Kit 활성화 / 비활성화 시 main.dart 수정 필수**  
`auth_kit` 을 비활성화 하려면 `_checkAuthToken()` 호출을 `main.dart` 에서 제거해야 해요. Kit 선언은 `app_kits.yaml` 에서 했는데 부팅 로직은 `main.dart` 에 묶임 — 일관성 붕괴.

**문제 2 — 부팅 로직이 Kit 과 분리**  
`auth_kit/auth_check_step.dart` 가 "토큰 확인 로직" 을 가지는데, 실제 실행은 `main.dart` 에서 하는 분산 구조. Kit 이 자기 책임을 완결할 수 없음.

**문제 3 — 순서 표현이 암묵적**  
"auth 체크가 먼저? PostHog init 이 먼저?" 를 `main.dart` 의 **코드 순서** 로만 결정. Kit 이 늘어나면 순서 전쟁.

이 결정이 답해야 했던 물음이에요.

> **부팅 단계를 Kit 이 자기 책임으로 소유하되, 순차 실행 · 에러 처리 · 관측성 로깅을 중앙 일괄 관리** 하는 구조는?

## 고민했던 대안들

### Option 1 — main.dart 에 고정 순서로 나열

기존 방식 유지. Kit 마다 "이 함수를 main.dart 에 추가하세요" 를 README 에 적기.

- **장점**: 구현 제로.
- **단점 1**: Kit on/off 시 main.dart 수정 필수 — ADR-003 의 "선언만 바꾸면 됨" 철학 위반.
- **단점 2**: 순서 · 에러 처리 · 관측성 보일러플레이트가 main.dart 에 누적.
- **탈락 이유**: 앱 공장 scale 에 안 맞음.

### Option 2 — Riverpod FutureProvider 체인

`authBootProvider` 같은 FutureProvider 들로 초기화 단계를 표현.

```dart
final authBootProvider = FutureProvider((ref) async {
  await ref.read(authServiceProvider).checkAuthStatus();
});
```

- **장점**: Riverpod 네이티브. 이미 Provider 생태계.
- **단점 1**: FutureProvider 는 **lazy** — 누군가 read 하기 전엔 실행 안 됨. 부팅 시 모든 step 을 `ref.read` 해야 해서 또 main.dart 가 비대해짐.
- **단점 2**: 순서 제어가 간접적. "auth 먼저 PostHog 다음" 을 Provider 의존 그래프로 표현해야 하는데 그게 자연스럽지 않음.
- **단점 3**: 에러 처리 (부팅 실패 시 어떻게?) 가 각 Provider 마다 흩어짐.
- **탈락 이유**: Provider 시스템은 상태 공유용. 부팅 sequence 에는 과함.

### Option 3 — BootStep 인터페이스 + SplashController ★ (채택)

아주 단순한 추상:

```dart
abstract class BootStep {
  String get name;
  Future<void> execute();
}
```

각 Kit 이 `bootSteps` getter 로 자기 BootStep 을 기여하고, `AppKits.allBootSteps` 로 합쳐져 `SplashController` 가 순차 실행.

- **압력 1 해결**: Kit on/off = BootStep 등록/해제. main.dart 수정 0.
- **압력 2 해결**: `auth_check_step.dart` 는 `auth_kit/` 폴더 안. Kit 이 자기 책임 완결.
- **압력 3 해결**: Kit 의 install 순서가 BootStep 실행 순서. `AppKits.install([BackendApiKit(), AuthKit(), ObservabilityKit()])` 에서 auth check 가 observability init 보다 먼저.

## 결정

### BootStep 계약 (7줄)

```dart
// lib/common/splash/boot_step.dart 전체
abstract class BootStep {
  String get name;
  Future<void> execute();
}
```

최소주의 극단. 이름 하나 + 실행 하나. 파라미터 없음 — 필요한 의존성은 Kit 이 주입.

### SplashController (39줄)

```dart
// lib/common/splash/splash_controller.dart 발췌
enum SplashStatus { loading, ready, error }

class SplashResult {
  final SplashStatus status;
  final String? errorMessage;
  // ...
}

class SplashController {
  final List<BootStep> _steps;
  SplashController({List<BootStep> steps = const []}) : _steps = steps;

  Future<SplashResult> run() async {
    try {
      for (final step in _steps) {
        await step.execute();
      }
      return const SplashResult.ready();
    } catch (e) {
      return SplashResult.error(e.toString());
    }
  }
}
```

순차 `await`. 하나가 실패하면 나머지 중단 + `error` 상태 반환. 반환값은 에러 핸들링을 `main.dart` 에 위임.

### Kit 이 BootStep 을 기여

```dart
// lib/core/kits/app_kit.dart
abstract class AppKit {
  List<BootStep> get bootSteps => const [];
  // ...
}
```

```dart
// lib/kits/auth_kit/auth_kit.dart 발췌
@override
List<BootStep> get bootSteps {
  final container = AppKits.maybeContainer;
  if (container == null) return const [];
  return [
    AuthCheckStep(
      authService: container.read(authServiceProvider),
      authState: container.read(authStateProvider),
      crashService: container.read(crashServiceProvider),
    ),
  ];
}
```

### BootStep 구현 예시 (AuthCheckStep)

```dart
// lib/kits/auth_kit/auth_check_step.dart 발췌
class AuthCheckStep implements BootStep {
  final AuthService _authService;
  final AuthStateNotifier _authState;
  final CrashService? _crashService;

  AuthCheckStep({
    required AuthService authService,
    required AuthStateNotifier authState,
    CrashService? crashService,
  }) : _authService = authService,
       _authState = authState,
       _crashService = crashService;

  @override
  String get name => 'AuthCheckStep';

  @override
  Future<void> execute() async {
    try {
      await _authService.checkAuthStatus();
    } catch (e, st) {
      await _crashService?.reportError(e, st);  // ← 리포트만
      _authState.emit(const AuthState.unauthenticated());  // ← fallback
    }
  }
}
```

핵심 설계: **부팅 단계 자체 실패는 앱을 멈추지 않음**. 실패해도 "로그인 안 된 상태" 로 복귀해서 앱이 계속 부팅. crashService 에 non-fatal 로 리포트.

### main.dart 통합

```dart
// lib/main.dart 발췌
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  UpdateKit(service: NoUpdateAppUpdateService()),
  ObservabilityKit(),
]);

final container = ProviderContainer(overrides: [...AppKits.allProviderOverrides]);
AppKits.attachContainer(container);

// 모든 Kit 의 BootStep 수집 → 순차 실행
final boot = await SplashController(steps: AppKits.allBootSteps).run();

if (boot.status == SplashStatus.error) {
  await crashService.reportError(
    StateError('Splash boot failed: ${boot.errorMessage}'),
    StackTrace.current,
    fatal: false,
  );
}

runApp(UncontrolledProviderScope(container: container, child: const App()));
```

### 설계 선택 포인트

**포인트 1 — `BootStep` 인터페이스를 극단적으로 단순하게**  
`execute()` 에 파라미터 없음. ViewModel 스타일 `BuildContext` 주입도 없음. 이유: **의존성은 Kit 의 `bootSteps` getter 에서 container.read 로 주입** 하니까 BootStep 자체는 무지성. 인터페이스가 단순할수록 테스트 · 구현 · 교체가 쉬워요.

**포인트 2 — 실패 시 "앱 멈춤" 이 아닌 "fallback 상태"**  
`SplashController.run()` 은 예외를 catch 해서 `SplashResult.error` 로 반환하지만, 각 BootStep 자체도 **내부에서 try-catch** 해서 graceful degradation. `AuthCheckStep` 은 토큰 확인 실패 → `unauthenticated` 로 emit 해서 앱이 로그인 화면으로. 앱이 멈추는 건 진짜 치명적일 때만.

**포인트 3 — BootStep 순서는 Kit install 순서 + Kit 내부 순서**  
`AppKits.allBootSteps` 는 Kit install 순으로 flatten. 예: `install([BackendApiKit, AuthKit, ObservabilityKit])` → `[auth check, posthog init]` 순서. Kit 간 순서는 install 호출 순. 한 Kit 이 여러 BootStep 을 내면 리스트 순.

**포인트 4 — 관측성 로깅은 중앙에서**  
각 BootStep 이 자기 실행을 로깅하지 않아요. `SplashController.run()` 에서 "step 시작 / 끝 / 실패" 를 공통으로 찍을 수 있는 자리. 현재는 미구현 — 개별 Kit 의 로깅에 맡김. 향후 hook 추가 가능.

**포인트 5 — `bootSteps` getter 는 lazy (container 의존)**  
`AuthKit.bootSteps` getter 가 `AppKits.maybeContainer` 를 확인하고, container 부착 전이면 빈 리스트. `main.dart` 의 `install → container → attach` 순서 이후에 `AppKits.allBootSteps` 를 읽어야 실제 step 목록이 나옴. 이 순서 강제는 ADR-003 의 attachContainer 규약과 일치.

## 이 선택이 가져온 것

### 긍정적 결과

- **main.dart 불변성**: Kit 추가 · 제거해도 `_bootstrap()` 함수 수정 없음. `install([...])` 리스트만 변경.
- **Kit 자체 완결**: `auth_kit/` 폴더만 보면 "이 Kit 이 부팅 시 뭐 하는지" 까지 파악 가능. 코드가 흩어지지 않음.
- **테스트 격리**: `AuthCheckStep` 을 단독으로 테스트. `SplashController([testStep]).run()` 으로 부팅 flow 도 테스트 가능.
- **순서가 명시적**: Kit install 순서가 그대로 부팅 순서. "왜 auth check 가 PostHog init 보다 먼저?" 를 `install` 리스트를 보면 5초 안에 이해.
- **실패 격리**: 한 BootStep 실패해도 graceful fallback. 앱 전체가 멈추지 않음.

### 부정적 결과

- **BootStep 간 의존성 표현 불가**: 현재 구조는 **순서만** 보장. "auth check 가 PostHog init 에 의존" 같은 것을 코드로 표현 못 함. install 순서에 의존.
- **동기 · 비동기 혼합 불가**: 모두 `Future<void> execute()` 라 동기 초기화도 Future 로 감싸야 함. 오버헤드는 미미하지만 순수성 저하.
- **에러 분류 없음**: 현재는 "성공 / 실패" 두 상태만. "warning (부분 실패 하지만 계속 진행)" 같은 표현이 없음. 향후 필요.
- **병렬 실행 불가**: 모든 step 이 순차 `await`. `PostHog init` 과 `force update check` 는 이론상 병렬 가능하지만 현재는 안 함. 필요 시 `SplashController` 개선.

## 교훈

### 교훈 1 — 최소 인터페이스가 유지보수를 쉽게

`BootStep` 을 7줄로 끝낸 게 정답이었어요. 초기엔 `Future<void> execute(BuildContext context, ProviderContainer container)` 같이 파라미터 늘리려 했는데, **Kit 이 container.read 로 알아서 가져가게** 하니 인터페이스가 변하지 않고도 모든 의존성 주입 가능. 4년 지나도 이 인터페이스는 안 바뀔 것 같아요.

**교훈**: 인터페이스 설계 시 **"외부에서 필요할 것 같은 것" 보다 "구현체가 진짜 필요로 하는 최소"** 를 택하세요. 필요 시 구현체가 자기 해결.

### 교훈 2 — 부팅 실패는 "앱 멈춤" 보다 "fallback" 이 좋다

초기엔 `AuthCheckStep` 이 실패하면 예외가 전파되어 앱이 크래시. 그러자 "Sentry 서버가 잠시 200 대신 500 을 내면 앱이 못 뜨는" 웃픈 상황 발생. 지금은 **부팅 실패는 로그만 남기고 fallback 상태로 진행**. 앱 가용성 크게 개선.

**교훈**: 외부 의존성 (API · 저장소 · 플러그인) 은 부팅 시점에도 실패 가능. **graceful degradation** 을 기본으로. 앱이 부팅되기만 하면 사용자는 로그인부터 다시 할 수 있음.

### 교훈 3 — 부팅 단계 관측성은 중요

BootStep 이 실패해도 `crashService` 가 off 면 원인 모름. `[Splash] running AuthCheckStep` · `[Splash] step failed after 423ms` 같은 로그를 콘솔에 찍어두는 게 디버깅에 결정적. 현재는 각 BootStep 이 자기 알아서 찍는데, `SplashController` 중앙에서 강제로 찍는 게 나았을 것.

**교훈**: 부팅 같은 **시간적으로 1회성** 이벤트는 관측성을 **중앙에서 강제** 해야 일관적. 분산 로깅은 놓치기 쉬움.

## 관련 사례 (Prior Art)

- [Android Jetpack Startup](https://developer.android.com/jetpack/androidx/releases/startup) — `Initializer` 인터페이스. 본 ADR 의 개념적 원천
- [iOS AppDelegate Lifecycle](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/1623053-application) — didFinishLaunchingWithOptions 의 step 들
- [Spring Boot ApplicationRunner / CommandLineRunner](https://docs.spring.io/spring-boot/reference/features/spring-application.html#features.spring-application.application-runner) — 부팅 단계 hook
- [Flutter `flutter_native_splash` 패키지](https://pub.dev/packages/flutter_native_splash) — 네이티브 스플래시와의 연결점
- [Rx `Observable.concat`](https://reactivex.io/documentation/operators/concat.html) — 순차 실행의 reactive 버전

## Code References

**계약 + 실행기**
- [`lib/common/splash/boot_step.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/splash/boot_step.dart) — 7줄 인터페이스
- [`lib/common/splash/splash_controller.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/splash/splash_controller.dart) — 39줄 실행기

**Kit 측 기여**
- [`lib/core/kits/app_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kit.dart) — `bootSteps` getter 정의
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kits.dart) — `allBootSteps` 합성

**BootStep 구현 예시**
- [`lib/kits/auth_kit/auth_check_step.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/auth_check_step.dart) — 토큰 유효성 확인
- [`lib/kits/observability_kit/posthog_init_step.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/posthog_init_step.dart) — PostHog 초기화 (존재하는 경우)
- [`lib/kits/update_kit/force_update_step.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/update_kit/force_update_step.dart) — 강제 업데이트 체크 (존재하는 경우)

**main.dart 통합**
- [`lib/main.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/main.dart) — `SplashController(steps: AppKits.allBootSteps).run()`

**관련 ADR**:
- [`ADR-003 · FeatureKit 동적 레지스트리`](./adr-003-featurekit-registry.md) — Kit 의 `bootSteps` 기여 메커니즘
- [`ADR-006 · 인터페이스 기반 서비스 교체 + Debug 폴백`](./adr-006-debug-fallback.md) — BootStep 이 `crashService?` 로 non-fatal 리포트
- [`ADR-017 · 4가지 로딩 UX 패턴`](./adr-017-loading-ux.md) — 부팅 중 스플래시 UI 표현
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — "앱 부팅 시 뭐가 실행되는지" 를 Kit 별로 모은 이점
