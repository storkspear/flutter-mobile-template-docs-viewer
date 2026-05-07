# Kits 컨벤션

FeatureKit 작성·제거·동기화 가이드. 14개 기본 kit + 파생 레포에서 자체 kit 추가하는 워크플로우.

> 빠른 인덱스: [14개 kit 목록 + 의존 관계도](../features/README.md). 본 문서는 **kit 을 만드는 사람** 입장의 컨벤션이에요.

---

## 1. AppKit 계약 (5분 요약)

`lib/core/kits/app_kit.dart` 에 정의된 추상 클래스. 모든 kit 이 이 contract 를 구현해요.

```dart
abstract class AppKit {
  String get name;                              // 디버그/에러 메시지용
  List<Type> get requires => const [];          // 의존 Kit 타입
  int get redirectPriority => 100;              // 라우터 redirect 우선순위 (낮을수록 강함)
  List<Override> get providerOverrides => const [];
  List<RouteBase> get routes => const [];
  List<NavigatorObserver> get navigatorObservers => const [];
  List<BootStep> get bootSteps => const [];
  RedirectRule? buildRedirect() => null;
  Listenable? get refreshListenable => null;
  Future<void> onInit() async {}
  Future<void> onDispose() async {}
}
```

각 메서드의 역할:

| 메서드 | 언제 사용? |
|---|---|
| `name` | 에러 메시지에 노출 (예: `"AuthKit requires BackendApiKit"`) |
| `requires` | 다른 kit 의 타입을 선언. install 시점에 자동 검증 — 빠지면 `StateError` |
| `providerOverrides` | Riverpod provider 의 실제 구현체 주입. Debug 폴백을 운영용으로 교체할 때 사용 |
| `routes` | GoRouter 에 추가될 라우트. 여러 kit 의 routes 가 합쳐짐 |
| `navigatorObservers` | 화면 전환 hook (예: 분석 자동 추적) |
| `bootSteps` | 스플래시에서 실행할 초기화 작업. 순서대로 await |
| `buildRedirect()` | 라우팅 게이트 (예: 미인증 시 `/login` 으로). priority 순 평가, 첫 non-null 반환 적용 |
| `refreshListenable` | 라우터 재평가 트리거 (auth 상태 변경 등) |
| `onInit` / `onDispose` | install/rollback/resetForTest 시 호출 |

상세 설계는 [`ADR-003 · FeatureKit 동적 레지스트리`](../philosophy/adr-003-featurekit-registry.md), [`docs/architecture/featurekit-contract.md`](../architecture/featurekit-contract.md).

---

## 2. 동기화 3종 (가장 자주 실수하는 곳)

Kit 활성화는 **3곳**에서 일치시켜야 해요:

```
app_kits.yaml          ←→     lib/main.dart                    →    tool/configure_app.dart
(선언적 의도)                  (실제 코드)                          (CI 검증)
   │                              │                                   │
   │  kits:                       │  AppKits.install([                │  Status: OK 확인
   │    auth_kit:                 │    AuthKit(                       │  --audit 시 불일치 → exit 1
   │      providers:              │      providers: const {           │
   │        - email               │        AuthProvider.email,        │
   │        - google              │        AuthProvider.google,       │
   │                              │      },                           │
   │                              │    ),                             │
```

**옳은 흐름**:

1. `app_kits.yaml` 에서 kit 추가/제거
2. `lib/main.dart` 의 `AppKits.install([...])` 동일 변경
3. `dart run tool/configure_app.dart` 로 검증 → `Status: OK` 확인

**불일치 시 출력 예** (의존성 문제):

```
--- Dependency Issues ---
  ✗ auth_kit requires backend_api_kit, which is not enabled
Status: ISSUES FOUND
```

→ `app_kits.yaml` 에 빠진 의존을 추가하거나, 의존하는 kit 을 함께 제거.

> CI 자동화: `dart run tool/configure_app.dart --audit` (불일치 시 `exit 1` — pre-commit / CI 에서 호출 권장).

---

## 3. Kit 의존 관계 규칙

기본 14개 kit 중 의존 관계가 있는 건 **1개뿐**:

```
backend_api_kit (독립)
  ↑
auth_kit (requires: BackendApiKit)
```

나머지 11개는 모두 독립.

### 3-1. 핵심 룰

| 케이스 | 허용 여부 | 예시 |
|---|---|---|
| `kit_manifest.requires` 에 **선언한 kit** 의 **type import** | ✅ | `import '.../backend_api_kit/api_exception.dart'` 로 `ApiException` 사용 |
| 다른 kit 의 **인스턴스 접근** | ❌ 직접 생성 금지<br>✅ provider 경유 | `ref.read(apiClientProvider)` (○) <br>`ApiClient(...)` 직접 생성 (✗) |
| **미선언 kit** 의 cross-import (manifest `requires` 에 없는 kit) | ❌ **절대 금지** | `auth_kit` 이 manifest 선언 없이 `observability_kit/dogfooding_panel.dart` import → 그 recipe 에 observability 빠지면 컴파일 실패 |
| `core/` import (인터페이스/공용 위젯) | ✅ 항상 허용 | `core/storage/token_storage.dart`, `core/widgets/...` |

### 3-2. 왜 type import 는 허용하는가

`ApiException`, `ErrorCode` 같은 **타입은 provider 로 접근할 방법이 없어요** — 클래스 이름 자체가 import 필요.

```dart
// ❌ 불가능 — 타입은 provider 가 못 줌
final exception = ref.read(...);  // 무엇을 read?

// ✅ 정답 — 타입 import 후 provider 로 인스턴스만 받음
import 'package:app_template/kits/backend_api_kit/api_exception.dart';
import 'package:app_template/kits/backend_api_kit/error_code.dart';

try {
  await ref.read(apiClientProvider).post(...);  // 인스턴스는 provider 경유
} on ApiException catch (e) {                    // 타입은 직접 import
  if (e.code == ErrorCode.unauthorized) { ... }
}
```

이래야 `requires` 가 진실의 출처 — manifest 만 보면 누가 누구에게 의존하는지 명확하고, recipe 조합 시 빠진 kit 이 자동으로 install 단계에서 잡혀요.

### 3-3. 미선언 cross-import 가 위험한 이유

manifest `requires` 에 적지 않은 kit 을 import 하면 **다른 recipe 로 출발한 파생 레포에서 컴파일 실패**.

실제 사례 (2026-05-06 fix 됨):
- `auth_kit/ui/login/login_screen.dart` 가 `observability_kit/dogfooding_panel.dart` 를 `kDebugMode` 가드 안에서 직접 import
- `auth_kit/kit_manifest.yaml` 의 `requires` 에는 `backend_api_kit` 만 — observability 없음
- recipe `backend-auth-app.yaml` (observability 미포함) 로 출발한 파생 레포가 즉시 컴파일 실패
- → 디버그 도구는 home_screen 한 곳만 노출 (login 에선 제거)

이 규칙이 깨지면 사이즈 영향, 의존 관계 캐스케이드, 테스트 격리, recipe 호환성 모두 문제 발생. 자세한 근거는 [`ADR-002 · Layered Modules`](../philosophy/adr-002-layered-modules.md), [`ADR-003 · FeatureKit Registry`](../philosophy/adr-003-featurekit-registry.md).

---

## 4. 새 Kit 만들기 (파생 레포에서)

도메인 특화 기능을 kit 으로 분리하고 싶을 때. 예: 결제 (`payment_kit`), 위치 추적 (`location_kit`).

### 4-1. 디렉토리 구조

```
lib/kits/payment_kit/
├── payment_kit.dart                # AppKit 구현 (필수)
├── kit_manifest.yaml               # 메타데이터 (필수)
├── README.md                       # 표준 양식 (필수)
├── payment_service.dart            # 도메인 서비스 인터페이스
├── stripe_payment_service.dart     # 실제 구현체
├── debug_payment_service.dart      # Debug 폴백 (Sentry 패턴 따라)
└── ui/
    ├── checkout_screen.dart
    └── checkout_view_model.dart
```

### 4-2. `kit_manifest.yaml` 표준 양식

```yaml
name: payment_kit
description: 결제 (Stripe 통합) + 영수증 화면
dependencies:
  - http
  - stripe_sdk
requires:
  - BackendApiKit         # 결제 결과 백엔드 동기화 필요
```

> `requires` 는 사람이 읽기 위한 메타데이터. 실제 검증은 Dart 코드의 `AppKit.requires` getter 가 담당. 두 곳을 일치시켜요.

### 4-3. `payment_kit.dart` 골격

```dart
import 'package:app_template/core/kits/app_kit.dart';
import 'package:app_template/kits/backend_api_kit/backend_api_kit.dart';
import 'package:app_template/kits/payment_kit/payment_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'payment_service.dart';

/// Provider — Debug 폴백이 default. PaymentKit 이 실구현으로 override.
final paymentServiceProvider = Provider<PaymentService>(
  (_) => DebugPaymentService(),  // DSN 미주입 시 콘솔만
);

class PaymentKit extends AppKit {
  PaymentKit({required this.stripePublishableKey});
  final String stripePublishableKey;

  @override
  String get name => 'PaymentKit';

  @override
  List<Type> get requires => const [BackendApiKit];

  @override
  List<Override> get providerOverrides => [
    paymentServiceProvider.overrideWithValue(
      StripePaymentService(publishableKey: stripePublishableKey),
    ),
  ];

  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: '/checkout',
      builder: (_, __) => const CheckoutScreen(),
    ),
  ];

  @override
  Future<void> onInit() async {
    Stripe.publishableKey = stripePublishableKey;
    await Stripe.instance.applySettings();
  }
}
```

### 4-4. README.md 표준 양식

기본 구조 (기존 kit README 따라):

```markdown
# payment_kit

한 줄 요약 + 의존 kit 명시.

## 개요
- 핵심 기능 4~5개 bullet
- 의존성 패키지 1~2개

## 활성화
- app_kits.yaml + main.dart 코드 예시 2개

## 제공 기능
- Service · Provider · 화면 · BootStep 표

## 핵심 API
- 자주 쓰는 메서드 시그니처

## 일반 사용 예
- ViewModel/Screen 에서의 호출 패턴

## 파생 레포 체크리스트
- 외부 키 발급/콘솔 설정/플랫폼별 설정

## 제거 (필요 시)
- pubspec / app_kits.yaml / main.dart / providers / 권한 정리

## 테스트
- 어떤 테스트 파일에서 어떤 면을 검증하는지
```

### 4-5. 등록

1. `app_kits.yaml`:
   ```yaml
   kits:
     payment_kit:
       publishable_key: pk_test_xxx  # 또는 dart-define 으로
   ```
2. `lib/main.dart`:
   ```dart
   await AppKits.install([
     BackendApiKit(),
     PaymentKit(
       stripePublishableKey: const String.fromEnvironment('STRIPE_KEY'),
     ),
     // ...
   ]);
   ```
3. `dart run tool/configure_app.dart` → `Status: OK` 확인

### 4-6. 테스트

- **계약 테스트** (`test/kits/payment_kit/payment_kit_contract_test.dart`):
  - `name`, `requires`, `redirectPriority` 같은 메타가 변경되지 않는지 확인
- **서비스 테스트** (`test/kits/payment_kit/stripe_payment_service_test.dart`):
  - HTTP mock 으로 결제 흐름 검증
- **위젯 테스트**:
  - CheckoutScreen 의 로딩 / 성공 / 에러 상태

---

## 5. Kit 제거하기

기존 kit 을 더 이상 안 쓰게 된 경우. 예: 광고 모델 → 구독 모델 전환 시 `ads_kit` 제거.

### 체크리스트

- [ ] **`app_kits.yaml`** 에서 해당 kit 항목 주석 처리 또는 삭제
- [ ] **`lib/main.dart`** 의 `AppKits.install([...])` 에서 인스턴스 제거
- [ ] **import** 정리 — IDE 가 unused 표시
- [ ] **Provider 사용처** — 해당 kit 이 export 했던 provider 를 쓰던 코드 정리
- [ ] **권한** — `AndroidManifest.xml`, `Info.plist` 의 해당 kit 전용 권한 제거 (예: ads_kit 의 ATT)
- [ ] **i18n** — 해당 kit UI 가 썼던 ARB 키 정리
- [ ] **pubspec.yaml** — 해당 kit 만 쓰던 의존성 제거 (다른 kit 도 쓰면 유지)
  - ⚠️ pubspec 에 남겨두면 native 플러그인 .aar 이 APK 에 그대로 포함됨 ([features/README.md tree-shaking 주의 참조](../features/README.md))
- [ ] `dart run tool/configure_app.dart` → `Status: OK`
- [ ] `flutter analyze` warning 0 건
- [ ] `flutter test` 그린

각 kit 의 `README.md` "제거" 섹션에 kit 별 추가 주의사항이 있을 수 있어요.

---

## 6. 라우팅 / Redirect 규칙 작성

`buildRedirect()` 가 라우터 게이트의 핵심.

### 6-1. priority 정책

낮을수록 먼저 평가 = 더 강한 차단. 기본값 `100`.

| priority | 사용처 |
|---|---|
| `1` | UpdateKit (강제 업데이트) — 다른 모든 게이트 위에 |
| `10` | AuthKit (미인증 시 `/login`) |
| `50` | OnboardingKit (첫 실행 시 `/onboarding`) |
| `100` | 기본 (대부분 kit) |

새 게이트 추가 시 충돌 없도록 우선순위 신중 결정. 상세는 [`ADR-018 · Redirect Priority`](../philosophy/adr-018-redirect-priority.md).

### 6-2. RedirectRule 시그니처

```dart
typedef RedirectRule = String? Function(BuildContext context, GoRouterState state);
```

- 반환 `null` → 이 kit 은 이 요청에 개입 안 함 → 다음 priority kit 평가
- 반환 `String` → 그 경로로 리다이렉트 → 평가 종료

### 6-3. 예시

```dart
@override
RedirectRule? buildRedirect() {
  return (context, state) {
    final container = AppKits.maybeContainer;
    if (container == null) return null;  // 부팅 중

    final auth = container.read(authStreamProvider);
    return auth.maybeWhen(
      data: (s) {
        if (s.isUnauthenticated && !state.matchedLocation.startsWith('/login')) {
          return '/login';
        }
        return null;
      },
      orElse: () => null,
    );
  };
}
```

### 6-4. refreshListenable

라우터가 언제 redirect 를 다시 평가할지 결정. auth 상태가 바뀌면 자동으로 redirect 재평가.

```dart
@override
Listenable? get refreshListenable => _bridge ??= _AuthRefreshBridge(/* ... */);
```

상세 패턴은 `lib/kits/auth_kit/auth_kit.dart` 의 `_AuthRefreshBridge` 참고.

---

## 7. BootStep 작성

스플래시 단계에서 순차 실행. 실패해도 앱 부팅은 막지 않는 게 권장 (필수 단계는 main.dart 에서 직접 await).

```dart
class _MyKitInitStep implements BootStep {
  _MyKitInitStep(this._service);
  final MyService _service;

  @override
  String get name => 'MyKitInitStep';  // 실패 시 SplashResult.errorMessage 에 노출

  @override
  Future<void> execute() async {
    await _service.init();
    // 실패해도 좋다면 try/catch 로 swallow
  }
}
```

상세는 [`ADR-008 · Boot Step`](../philosophy/adr-008-boot-step.md).

---

## 8. 자주 막히는 함정

CLAUDE.md §7 의 함정과 동일. 본 문서에서 강조:

1. **`AppKits.install` 누락** — 새 kit 만들고 main.dart 에 안 끼우면 모든 라우트/provider 가 사라진 듯 보임
2. **`AppKits.attachContainer` 호출 순서** — ProviderContainer 생성 직후 호출해야 bootStep 내부에서 `container.read` 가능
3. **미선언 kit cross-import** — manifest `requires` 에 없는 kit 의 import 는 다른 recipe 채택 시 컴파일 실패. 선언한 kit 의 type import 는 OK, 인스턴스는 provider 경유 (§3 참고)
4. **`tool/configure_app.dart --audit`** 안 돌리고 커밋 — 의존성 누락이 런타임에야 발견됨
5. **proguard-rules.pro 갱신 누락** — kit 추가 시 native 의존이 있으면 release 빌드에서 `NoClassDefFoundError`
6. **i18n 누락** — kit UI 가 새 문자열 쓰면 ko/en ARB 양쪽에 추가 + `flutter gen-l10n`

---

## 9. 관련 문서

- [`features/README.md`](../features/README.md) — 14개 kit 목록 + 의존 관계도 + 활성화 가이드
- [`architecture/featurekit-contract.md`](../architecture/featurekit-contract.md) — AppKit 인터페이스 전체 명세
- [`ADR-002 · Layered Modules`](../philosophy/adr-002-layered-modules.md) — 의존 방향
- [`ADR-003 · FeatureKit Registry`](../philosophy/adr-003-featurekit-registry.md) — 동적 레지스트리 설계
- [`ADR-004 · Manual Sync + CI Audit`](../philosophy/adr-004-manual-sync-ci-audit.md) — yaml↔dart 동기화 전략
- [`ADR-008 · Boot Step`](../philosophy/adr-008-boot-step.md) — 부팅 단계 추상화
- [`ADR-018 · Redirect Priority`](../philosophy/adr-018-redirect-priority.md) — 라우팅 우선순위
- [`architecture.md`](./architecture.md) — MVVM, 모듈 의존 방향, 에러 처리
- [`naming.md`](./naming.md) — 파일/클래스/Provider 명명 규칙
