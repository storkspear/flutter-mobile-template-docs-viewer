# Boot Sequence

앱 시작 시 실행되는 **전체 순서도**. `main()` → 첫 화면 표시까지. 근거는 [ADR-008 · 부팅 단계 추상화](../philosophy/adr-008-boot-step.md).

---

## 전체 흐름

```
┌─────────────────────────────────────────┐
│  main() 진입                              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
    ┌────────────────────────────┐
    │ ObservabilityEnv 확인        │
    │ (Sentry DSN 주입 여부)        │
    └────────┬───────────┬────────┘
             │           │
      DSN 있음        DSN 없음
             │           │
             ▼           ▼
  ┌──────────────┐  ┌──────────┐
  │ SentryFlutter│  │ plain    │
  │   .init(     │  │ bootstrap│
  │  appRunner:  │  └────┬─────┘
  │  _bootstrap) │       │
  └──────┬───────┘       │
         │               │
         └───────┬───────┘
                 ▼
      ┌────────────────────┐
      │   _bootstrap()      │
      └──────────┬──────────┘
                 │
                 ▼
1. WidgetsFlutterBinding.ensureInitialized()
                 │
                 ▼
2. AppPaletteRegistry.install(DefaultPalette())
                 │
                 ▼
3. AppConfig.init(
     appSlug: 'template',
     baseUrl: 'http://localhost:8080',
     environment: Environment.dev,
     ...
   )
                 │
                 ▼
4. PrefsStorage().init()   (SharedPreferences 초기화)
                 │
                 ▼
5. AppKits.install([
     BackendApiKit(),
     AuthKit(),
     UpdateKit(service: NoUpdateAppUpdateService()),
     ObservabilityKit(),
   ])
   │
   ├─ 중복 타입 검증
   ├─ requires 의존성 검증
   ├─ 각 Kit.onInit() 순서대로
   └─ 실패 시 역순 rollback
                 │
                 ▼
6. ProviderContainer 생성
   container = ProviderContainer(
     overrides: [
       ...AppKits.allProviderOverrides,     // Kit 이 기여
       prefsStorageProvider.overrideWithValue(prefsStorage),
     ],
   )
                 │
                 ▼
7. AppKits.attachContainer(container)
   (이제 bootSteps · refreshListenable 이 container.read 가능)
                 │
                 ▼
8. CrashService 초기화
   container.read(crashServiceProvider).init()
   (ObservabilityKit 활성 + SENTRY_DSN 주입 → SentryCrashService)
   (그 외 → DebugCrashService)
                 │
                 ▼
9. SplashController(steps: AppKits.allBootSteps).run()
   │
   ├─ AuthKit 이 기여한 AuthCheckStep
   │    │
   │    ├─ tokenStorage.repairIfPartial()     (반쪽 상태 복구)
   │    ├─ tokenStorage.hasTokens()
   │    │   ├─ true  → authService.fetchCurrentUser()
   │    │   │          ├─ 성공 → authState.emit(authenticated)
   │    │   │          └─ 실패 → authState.emit(unauthenticated)
   │    │   └─ false → authState.emit(unauthenticated)
   │    
   ├─ ObservabilityKit 의 PostHogInitStep
   │    └─ PostHog SDK 초기화 (POSTHOG_KEY 주입 시)
   │
   ├─ UpdateKit 의 ForceUpdateCheckStep
   │    └─ service.isUpdateRequired() 확인 → AppUpdateNotifier 갱신
   │
   └─ (기타 활성 Kit 의 BootStep)
                 │
                 ▼
   SplashResult 반환
   │
   ├─ status: ready → 계속 진행
   └─ status: error → crashService.reportError (non-fatal) + 계속 진행
                 │
                 ▼
10. runApp(
      UncontrolledProviderScope(
        container: container,
        child: const App(),
      )
    )
                 │
                 ▼
    App (MaterialApp.router)
        │
        ├─ ValueListenableBuilder (AppPaletteRegistry 구독)
        ├─ MaterialApp.router (AppRouter.router)
        │    │
        │    ├─ initialLocation: /splash
        │    ├─ refreshListenable: AppKits.compositeRefreshListenable
        │    └─ redirect: _composedRedirect
        │         │
        │         ├─ 우선순위 정렬된 redirectRules 순회
        │         ├─ 첫 non-null 반환값 = 리다이렉트
        │         │   (UpdateKit → AuthKit → OnboardingKit → ...)
        │         └─ 모두 null → 기본 로직 (splash → home)
        │
        └─ 첫 화면 렌더링
```

---

## 단계별 설명

### 1. Sentry 래핑

`ObservabilityEnv.isSentryEnabled` 확인. DSN 주입되어 있으면 `SentryFlutter.init(...)` 이 내부적으로 `runZonedGuarded` 세팅 → **비동기 에러까지 자동 포착**.

### 2. Flutter 바인딩 · 팔레트 · 설정 · SharedPreferences

순서가 중요해요:
- 바인딩 먼저 (기타 `Platform.` 호출 전제)
- 팔레트 먼저 (MaterialApp 이 구독할 Notifier)
- AppConfig 는 Kit 들이 참조하므로 Kit 설치 전
- PrefsStorage 는 Provider override 로 주입되므로 container 생성 전

### 3. Kit 설치

여기서 각 Kit 의 `onInit` 이 실행. 예: `BackendApiKit.onInit` 은 Dio 인스턴스 생성 등.

### 4. ProviderContainer + attachContainer

ADR-003 의 3단계 패턴:
- `install` (Kit 등록 + onInit)
- `ProviderContainer` 생성 (모든 override 수집)
- `attachContainer` (bootSteps 에게 container 노출)

순서 깨지면 런타임 StateError.

### 5. BootStep 실행

`SplashController.run()` 이 순차 `await`. 한 step 실패해도 앱은 계속 — graceful degradation.

### 6. runApp

`UncontrolledProviderScope` 로 외부에서 만든 container 를 Flutter 트리에 주입.

### 7. 첫 리다이렉트

initialLocation `/splash` → refreshListenable 이 곧 초기 notify → `_composedRedirect` 실행 → AuthKit rule 이 상태에 따라 `/home` 또는 `/login` 반환 → 이동.

---

## 에러 처리

각 단계별 실패 대응:

| 단계 | 실패 시 |
|------|--------|
| SentryFlutter.init | 예외 발생 시 Debug 모드로 폴백 (Sentry 없이 계속) |
| AppKits.install | rollback 후 throw — 앱 시작 불가 (치명) |
| BootStep 실행 | Result.error 반환 + crashService 리포트, 앱 계속 |
| runApp | Flutter 프레임워크가 자체 처리 |

---

## 코드 참조

- [`lib/main.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/main.dart) — 전체 부팅 코드 (95줄)
- [`lib/app.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/app.dart) — MaterialApp 구성
- [`lib/common/splash/splash_controller.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/splash/splash_controller.dart)
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kits.dart) — install · attachContainer

---

## 관련 문서

- [ADR-008 · BootStep](../philosophy/adr-008-boot-step.md)
- [ADR-003 · FeatureKit](../philosophy/adr-003-featurekit-registry.md)
- [`featurekit-contract.md`](./featurekit-contract.md)
- [observability_kit](../features/observability-kit.md) — Sentry 래핑 조건
