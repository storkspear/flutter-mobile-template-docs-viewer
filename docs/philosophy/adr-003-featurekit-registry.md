# ADR-003 · FeatureKit 동적 레지스트리

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/core/kits/app_kit.dart` (55줄 계약) + `lib/core/kits/app_kits.dart` (178줄 레지스트리) + 13개 Kit 구현.

## 결론부터

FeatureKit 은 **앱 하나의 기능 단위 (인증 · 네트워크 · 알림 · 관측성 등) 를 독립적으로 착탈할 수 있게 만든 플러그인 패턴** 이에요. 각 Kit 은 `AppKit` 추상 클래스의 계약 (Provider override · 라우트 · 부팅 단계 · 리다이렉트 규칙) 을 구현하고, `AppKits.install([...])` 로 런타임에 조립돼요. 앱마다 필요한 Kit 조합이 다르다는 현실을 **"코드는 한 벌, 조합은 앱마다 다르게"** 로 해결한 결정이에요.

> 참고로 이 패턴은 Android 의 Jetpack Startup `Initializer` 나 Spring Boot 의 `AutoConfiguration` 과 같은 아이디어예요. Flutter 에는 표준이 없어서 직접 만든 셈이에요.

## 왜 이런 고민이 시작됐나?

프롤로그의 `앱 공장 전략` 을 떠올리면, 이 결정이 어디서 출발했는지 보여요. 솔로 개발자 한 명이 다음과 같은 앱들을 연달아 찍어내는 상황을 가정해봐요.

- **앱 A**: 로컬 전용 습관 트래커 — 서버 · 로그인 없음. 로컬 DB + 차트만 필요
- **앱 B**: 로컬 알림 타이머 — 서버 없음. 알림 + 권한 관리만 필요
- **앱 C**: 백엔드 연동 SNS — 서버 · 로그인 · 푸시 · 관측성 전부 필요

세 앱이 **공통으로 쓰는 것 (테마 · 네트워크 계층 · 저장소)** 과 **앱마다 다른 것 (DB · 알림 · 인증 · 광고)** 이 뒤섞여 있어요. 이때 두 방향의 힘이 부딪혀요.

**힘 A — 공통 코드 재사용**  
매 앱마다 `AuthService` · `ApiClient` · `NotificationService` 를 다시 짜면 안 돼요. 프롤로그 제약 2 (시간 희소) 가 무너져요. 한 번 잘 만들고 모든 앱이 가져다 써야 해요.

**힘 B — 불필요한 코드 제거**  
앱 A 에 `ApiClient` · `AuthService` 가 실행 파일에 포함되면 **로컬 전용이라는 정체성** 이 흐려지고, 사용하지도 않는 SDK 가 바이너리 크기와 startup 시간을 늘려요. 파생 레포에서 "아 이거 안 쓰니까 삭제" 를 매번 하면 또 제약 2 위반.

두 힘은 상충해 보여요. "공통으로 만들자" 와 "앱마다 다르게" 가 정반대 방향이니까요. 이 결정이 답해야 했던 물음이 바로 이거예요.

> **공통 코드는 한 벌로 유지하되, 각 앱이 자기가 필요한 조각만 켜고 나머지는 꺼두는 구조** 가 가능한가?

## 고민했던 대안들

아래 3가지 선택지를 검토했고, 그중 3번을 채택했어요.

### Option 1 — 모든 Kit 을 항상 포함 + 런타임 플래그

`AppConfig` 의 `useAuth: false` 같은 bool 플래그로 기능을 끄는 방식.

- **장점**: 구현 단순. `if (config.useAuth) ...` 만 추가하면 됨.
- **단점 1**: 바이너리에는 여전히 모든 코드가 포함돼요. 앱 A 에 `sign_in_with_apple` · `google_sign_in` 플러그인이 깔려 있는 상태 — 앱 크기 증가 + 스토어 리뷰 시 "왜 로그인 SDK 가 있나요?" 같은 지적.
- **단점 2**: Provider override · 라우트 · BootStep 같은 **조립 시점 구조물** 을 런타임 플래그로 다루려면 코드가 if 범벅이 돼요. 결국 모듈 경계가 녹아요.
- **탈락 이유**: 힘 B (바이너리 크기 · 정체성) 를 정면 위반.

### Option 2 — 앱별 독립 Flutter 프로젝트

각 앱이 처음부터 자기 `pubspec.yaml` 을 가지고, 공통 코드는 `git subtree` 나 monorepo 로 공유.

- **장점**: 각 앱이 정말로 자기가 쓰는 코드만 포함.
- **단점 1**: 공통 코드 업데이트 시 N 개 앱에 각각 `git subtree pull` 해야 함 — 솔로 운영에선 지옥.
- **단점 2**: 공통 패키지를 `pub.dev` 에 퍼블리시하는 방법은 개인 org 라면 사설 레지스트리 필요 + 릴리스 주기 복잡.
- **단점 3**: 파생 레포 간 **API 표류** 가 빠르게 발생 — "어? 앱 B 는 ApiClient 가 옛날 버전이네?" 같은 상황이 잦음.
- **탈락 이유**: 제약 2 (시간) 를 반복 지출하게 만들어요.

### Option 3 — `AppKit` 계약 + 런타임 레지스트리 ★ (채택)

공통 코드는 한 레포 (`flutter-mobile-template`) 에 모두 두되, 각 앱 (파생 레포) 은 `app_kits.yaml` 과 `main.dart` 에서 **자기가 쓸 Kit 만 선언적으로 등록**. 미선언 Kit 은 tree-shaking 으로 최종 바이너리에서 제거돼요.

- **힘 A 만족**: 템플릿 원본이 단일 진실. 파생 레포는 `Use this template` 후 선언만 바꿈.
- **힘 B 만족**: Dart 의 tree-shaking 이 `AppKits.install([...])` 에 없는 Kit 의 클래스 · import 를 실행 파일에서 제거. 바이너리 경량화.
- **추가 이점**: Kit 간 의존 관계 (`requires: [BackendApiKit]`) 를 install 시점에 검증 → "로그인 넣어놓고 네트워크 Kit 빼먹음" 같은 실수를 런타임 에러로 잡음.

## 결정

`AppKit` 추상 클래스 + `AppKits` 정적 레지스트리로 구성해요.

### AppKit 계약

```dart
// lib/core/kits/app_kit.dart 전체
abstract class AppKit {
  String get name;                                   // 디버그 이름
  List<Type> get requires => const [];               // 의존 Kit 타입
  int get redirectPriority => 100;                   // 라우팅 게이트 우선순위

  List<Override> get providerOverrides => const [];  // Riverpod 기여
  List<RouteBase> get routes => const [];            // go_router 기여
  List<NavigatorObserver> get navigatorObservers => const [];
  List<BootStep> get bootSteps => const [];          // 스플래시 기여
  RedirectRule? buildRedirect() => null;             // 라우팅 게이트
  Listenable? get refreshListenable => null;         // 라우터 리빌드 트리거

  Future<void> onInit() async {}                     // install 시 호출
  Future<void> onDispose() async {}                  // 롤백 · 테스트 정리
}
```

각 Kit 은 자기 관심사만 기여해요. `AuthKit` 은 `authServiceProvider` override + `/login` 라우트 + `AuthCheckStep` + 인증 리다이렉트 규칙을 반환, `BackendApiKit` 은 `apiClientProvider` override + 인터셉터 설치만 반환.

### AppKits 레지스트리

```dart
// lib/core/kits/app_kits.dart 발췌
class AppKits {
  static final List<AppKit> _installed = [];
  static final Map<Type, AppKit> _lookup = {};

  static Future<void> install(List<AppKit> kits) async {
    // 1. 중복 체크 (같은 타입 두 번 → StateError)
    // 2. _validateDependencies() → requires 검증
    // 3. 순서대로 onInit() 호출
    // 4. 실패 시 역순 onDispose + 롤백
  }

  static List<Override> get allProviderOverrides => ...;
  static List<RouteBase> get allRoutes => ...;
  static List<BootStep> get allBootSteps => ...;
  static List<RedirectRule> get redirectRules => ...; // priority 정렬
  static Listenable? get compositeRefreshListenable => ...; // merge
}
```

### 실제 조립 (main.dart)

```dart
// lib/main.dart 발췌
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  UpdateKit(service: NoUpdateAppUpdateService()),
  ObservabilityKit(),
]);

final container = ProviderContainer(
  overrides: [
    ...AppKits.allProviderOverrides,                 // ← 모든 Kit 기여 자동 수집
    prefsStorageProvider.overrideWithValue(prefsStorage),
  ],
);
AppKits.attachContainer(container);                   // ← BootStep/Listenable 이 container 를 lazy read 하게
```

### 설계 선택 포인트

**포인트 1 — Type 기반 의존 선언**  
`requires` 가 `List<Type>` 이에요. `List<String>` 대신 `Type` 을 택한 이유는 **컴파일 시점에 오타를 잡기 위함** 이에요. `requires: [BackendApiKit]` 은 해당 클래스가 import 되어야 컴파일되므로, `requires: ['backned_api_kit']` 같은 오타가 원천 차단돼요.

**포인트 2 — 우선순위 정렬 (redirectPriority)**  
여러 Kit 이 리다이렉트 규칙을 가지면 충돌이 나요 (예: AuthKit 이 `/login` 으로 보내는데 UpdateKit 은 `/force-update` 로 보냄). 낮은 숫자가 먼저 실행되는 **안정 정렬** 로 해결: `UpdateKit=1 → AuthKit=10 → OnboardingKit=50`. 동일 우선순위는 install 순서가 결정.

**포인트 3 — 롤백 메커니즘**  
`onInit` 중 한 Kit 이 실패하면 이미 초기화된 Kit 들을 **역순으로 onDispose** 한 뒤 레지스트리에서 제거. 반쪽 초기화 상태를 남기지 않아요. 테스트에선 `resetForTest()` 가 같은 일을 해서 상태 누적을 막아요.

**포인트 4 — 컨테이너 부착 시점**  
`install` 후 `ProviderContainer` 생성 → `attachContainer` 호출 순서가 강제돼요. BootStep 이나 `refreshListenable` 이 provider 를 읽어야 할 때 컨테이너가 없으면 `StateError` 를 내서 실수를 빠르게 알려줘요.

## 이 선택이 가져온 것

### 긍정적 결과

- **앱별 맞춤 조립**: `app_kits.yaml` 의 주석 처리만으로 Kit on/off. 파생 레포에서 3줄 편집으로 "완전 로컬 앱" ↔ "백엔드 연동 앱" 전환.
- **의존성 검증 자동**: `AuthKit` 을 넣고 `BackendApiKit` 을 빼먹으면 `install` 시점에 `StateError: AuthKit requires BackendApiKit...` 로 바로 멈춤.
- **tree-shaking 효과**: 미등록 Kit 의 SDK (`sign_in_with_apple`, `google_mobile_ads` 등) 가 최종 바이너리에서 제거됨. 로컬 전용 앱 크기가 10~15MB 작아져요.
- **테스트 격리**: `AppKits.resetForTest()` 로 각 테스트가 독립 상태에서 시작. install 순서 버그도 테스트에서 재현 가능.
- **3개 recipe 샘플**: `recipes/local-only-tracker.yaml` / `local-notifier-app.yaml` / `backend-auth-app.yaml` 로 첫 시작 시 복사 → 수정만 하면 돼요.

### 부정적 결과

- **두 곳 수동 동기화**: `app_kits.yaml` (선언) 과 `lib/main.dart` (실제 install) 을 사람이 맞춰야 해요. 한쪽만 수정하면 빌드는 되는데 동작은 달라지는 함정. → ADR-004 에서 CI 검증 (`configure_app.dart --audit`) 으로 보완.
- **러닝 커브**: "왜 Kit 하나 추가하는데 AppKit extends + Provider override + Routes + BootStep 다 구현해야 하지?" 라는 초기 혼란. 각 Kit README 의 "새 Kit 만들기" 섹션으로 완화.
- **Flutter 에 표준 아님**: Android `Initializer` 처럼 플랫폼이 제공하는 개념이 아니라 이 템플릿 고유 패턴. 이 레포 밖으로 나가면 다시 설명해야 해요.
- **컨테이너 부착 순서 실수 가능**: `install → container → attach` 순서를 어기면 `StateError`. 새 개발자가 한 번은 겪어요.

## 교훈

### 교훈 1 — "선언만 바꿔도 안전해야" 가 엄청 비싸다

`app_kits.yaml` 한 줄 주석만으로 Kit 이 꺼지려면, **그 Kit 에 의존하는 다른 Kit 이 같이 꺼져야** 하고 **runtime 에러 없이 깔끔해야** 해요. 이걸 위해 `requires` 검증 · 롤백 · tree-shaking 친화적 설계 모두 필요했어요. "단순히 `if` 문 추가하면 될 걸" 하고 시작했다가 레지스트리 178줄 + 테스트 다수가 붙었어요.

**교훈**: 선언적 조립의 단순함은 비선언적 복잡함을 내부에 숨긴 결과예요. "선언 안전성" 을 목표로 잡으면 꽤 깊게 파게 됩니다.

### 교훈 2 — 컨테이너 부착 시점이 혼란의 주범

처음엔 `AppKits.install` 이 내부에서 `ProviderContainer` 까지 만들게 했어요. 그랬더니 `main.dart` 에서 `prefsStorageProvider.overrideWithValue(prefsStorage)` 같은 **Kit 외부 override** 를 끼워 넣을 자리가 없었어요. 결국 "install → container 는 바깥에서 생성 → attachContainer 호출" 3단계로 풀었는데, 이 순서를 어기면 BootStep 안의 `container.read` 가 StateError 를 냅니다.

**교훈**: "Kit 내부 기여" 와 "앱 전체 override" 는 성격이 다르니 조립 책임을 분리해야 해요. 단 분리하면 순서 강제가 필요해지고, 순서 강제는 사용자가 지켜야 해요. 문서로 풀 수밖에 없어요.

### 교훈 3 — redirectPriority 숫자는 배수로 띄워라

UpdateKit(1) · AuthKit(10) · OnboardingKit(50) 처럼 숫자를 띄워두니, 나중에 "업데이트 강제 다음 · 인증 이전" 에 들어갈 새 게이트가 필요할 때 `5` 를 쓰면 돼요. 연속된 숫자 (1, 2, 3) 였으면 전체를 재할당해야 했어요.

**교훈**: 우선순위 숫자에는 **미래를 위한 간격** 을 남겨두세요. `1 → 10 → 50 → 100` 처럼.

## 관련 사례 (Prior Art)

- [Jetpack Startup (Android)](https://developer.android.com/jetpack/androidx/releases/startup) — `Initializer` 로 app startup 의존성을 선언적으로 조립
- [Spring Boot AutoConfiguration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html) — classpath 에 있는 starter 만 조건부 활성화
- [NestJS Module](https://docs.nestjs.com/modules) — `imports: [...]` 로 모듈 조립, `providers` / `controllers` 기여
- [Flutter Riverpod `overrides`](https://riverpod.dev/docs/concepts/scopes) — Provider 트리를 ScopedOverride 로 변형. 본 ADR 은 이를 Kit 단위로 묶은 것
- [BLoC · get_it Module 패턴](https://pub.dev/packages/get_it) — DI 컨테이너에 모듈 단위 등록. 본 ADR 은 Riverpod 로 치환한 변형

## Code References

**핵심 구현** (템플릿 원본)
- [`lib/core/kits/app_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kit.dart) — `AppKit` 추상 클래스 · `RedirectRule` typedef (55줄)
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kits.dart) — 레지스트리 · 롤백 · 우선순위 정렬 (178줄)
- [`lib/main.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/main.dart) — `install → container → attach` 실제 호출 순서
- [`app_kits.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/app_kits.yaml) — 활성 Kit 선언 (YAML 진실 출처)
- [`tool/configure_app.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/tool/configure_app.dart) — YAML ↔ Dart 정합성 검증 (ADR-004 참조)

**Kit 구현 예시**
- [`lib/kits/auth_kit/auth_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/auth_kit.dart) — `requires: [BackendApiKit]` · `redirectPriority: 10` · `bootSteps: [AuthCheckStep()]` 모두 기여
- [`lib/kits/backend_api_kit/backend_api_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/backend_api_kit.dart) — provider only 기여
- [`lib/kits/observability_kit/observability_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/observability_kit/observability_kit.dart) — 환경 변수 기반 조건부 override
- [`lib/kits/update_kit/update_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/update_kit/update_kit.dart) — `redirectPriority: 1` 최우선 게이트

**Recipe 샘플**
- [`recipes/local-only-tracker.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/local-only-tracker.yaml)
- [`recipes/local-notifier-app.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/local-notifier-app.yaml)
- [`recipes/backend-auth-app.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/backend-auth-app.yaml)

**관련 ADR**:
- [ADR-002 · 3계층 모듈 구조](./adr-002-layered-modules.md) — core / kits / common / features 중 `kits/` 의 존재 이유
- [ADR-004 · YAML ↔ Dart 수동 동기화 + CI 검증](./adr-004-manual-sync-ci-audit.md) — 두 곳 동기화의 위험을 기계가 잡음
- [ADR-008 · 부팅 단계 추상화](./adr-008-boot-step.md) — Kit 이 기여하는 BootStep 이 어떻게 실행되는지
- [ADR-018 · Kit 별 라우팅 우선순위](./adr-018-redirect-priority.md) — `redirectPriority` 사용법 상세
- [ADR-021 · Multi-Recipe 구성](./adr-021-multi-recipe.md) — 3개 샘플 recipe 의 선택 기준
