# Contract Testing

**Kit 의 불변 속성** 을 검증하는 테스트. `{kit_name}_contract_test.dart` 규약.

---

## 왜 계약 테스트?

각 Kit 은 다른 Kit · 라우터 · 스플래시와 **암묵적 계약** 을 맺어요:

- `requires` — 다른 Kit 이 의존함
- `redirectPriority` — 라우터가 정렬함
- `routes` — GoRouter 에 등록됨
- `bootSteps` — SplashController 가 실행함

이 속성들을 실수로 바꾸면 **다른 컴포넌트가 조용히 깨져요**. 컴파일 에러 안 남.

계약 테스트가 `**의도된 변경인지 리뷰** 를 강제**. 수정 시 테스트가 깨져서 "이거 정말 맞나?" 한 번 더 확인.

---

## 표준 양식

각 Kit 의 `test/kits/<kit_name>/<kit_name>_contract_test.dart`:

```dart
// test/kits/auth_kit/auth_kit_contract_test.dart
void main() {
  tearDown(() => AppKits.resetForTest());

  group('AuthKit contract', () {
    // 1. name
    test('name is AuthKit', () {
      expect(AuthKit().name, 'AuthKit');
    });

    // 2. requires
    test('requires BackendApiKit', () {
      expect(AuthKit().requires, contains(BackendApiKit));
    });

    // 3. redirectPriority
    test('redirectPriority is 10', () {
      expect(AuthKit().redirectPriority, 10);
    });

    // 4. routes
    test('contributes /login, /forgot-password, /verify-email', () {
      final paths = AuthKit().routes.whereType<GoRoute>().map((r) => r.path);
      expect(paths, containsAll(['/login', '/forgot-password', '/verify-email']));
    });

    // 5. bootSteps (container 필요)
    test('contributes AuthCheckStep after container attached', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PrefsStorage();
      await prefs.init();

      final kit = AuthKit();
      await AppKits.install([BackendApiKit(), kit]);
      final container = ProviderContainer(overrides: [
        ...AppKits.allProviderOverrides,
        prefsStorageProvider.overrideWithValue(prefs),
        secureStorageProvider.overrideWithValue(FakeSecureStorage()),
      ]);
      AppKits.attachContainer(container);

      final steps = kit.bootSteps;
      expect(steps.whereType<AuthCheckStep>(), hasLength(1));

      container.dispose();
    });

    // 6. providerOverrides (선택)
    test('contributes providerOverrides when conditions met', () {
      // ObservabilityKit 같이 조건부 override 가 있는 Kit
    });
  });
}
```

---

## 각 검증 항목 설명

### `name`

디버그용이라 단순 string 비교.

### `requires`

**리스트 순서 무관**. `contains` 사용.

```dart
expect(AuthKit().requires, contains(BackendApiKit));
// 여러 의존이 있으면:
expect(kit.requires, containsAll([BackendApiKit, LocalDbKit]));
```

### `redirectPriority`

정수 비교. 값이 **의도적으로** 정해진 것 (UpdateKit=1, AuthKit=10, OnboardingKit=50) 이라 테스트가 수치 고정.

### `routes`

라우트 path 추출 후 `containsAll`.

```dart
final paths = kit.routes.whereType<GoRoute>().map((r) => r.path);
expect(paths, containsAll(['/login', '/verify-email']));
```

### `bootSteps`

**container 부착 후** 확인. 그전엔 빈 리스트 반환하는 Kit 이 많음 (ADR-008 참조).

```dart
// 부착 전
expect(kit.bootSteps, isEmpty);

// 부착 후
AppKits.attachContainer(container);
expect(kit.bootSteps, hasLength(1));
expect(kit.bootSteps.first, isA<AuthCheckStep>());
```

### `providerOverrides`

조건부 기여가 있는 Kit (예: `ObservabilityKit`):

```dart
test('overrides crashService when Sentry DSN provided', () {
  // ObservabilityEnv.sentryDsn 이 설정된 환경에서만
  final kit = ObservabilityKit();
  expect(kit.providerOverrides, isNotEmpty);
});
```

### `navigatorObservers`

```dart
test('contributes AnalyticsNavigatorObserver', () {
  expect(kit.navigatorObservers, hasLength(1));
});
```

### `refreshListenable`

```dart
test('exposes refreshListenable tied to authState', () {
  await AppKits.install([BackendApiKit(), AuthKit()]);
  final container = ProviderContainer(overrides: [...]);
  AppKits.attachContainer(container);

  expect(AuthKit().refreshListenable, isNotNull);
});
```

---

## resetForTest 는 tearDown 필수

```dart
tearDown(() {
  AppKits.resetForTest();
});
```

다음 테스트에 이전 상태 누적 금지.

---

## contract vs 기능 테스트 구분

| 계약 테스트 | 기능 테스트 |
|-----------|-----------|
| `_contract_test.dart` | `_service_test.dart` · `_view_model_test.dart` |
| 불변 속성 (requires · priority) | 실제 동작 (signIn · refreshToken) |
| 수 줄 | 수십 줄 |
| 빠름 (ms) | 느림 (네트워크 mock 등) |

---

## CI 에서

계약 테스트는 **Critical**. 깨지면 다른 Kit 이 영향받음. `ci.yml` 에서 전체 실행:

```bash
flutter test test/kits/**/_contract_test.dart
```

또는 전체 테스트에 포함 (기본).

---

## 계약 변경 시 워크플로우

1. `AuthKit.redirectPriority` 를 10 → 15 로 바꾸고 싶음
2. 계약 테스트가 fail → "정말 맞나?" 리뷰
3. 맞으면 테스트 값도 15 로 갱신
4. **다른 Kit 과의 상호작용** 확인 (우선순위 충돌)
5. PR 리뷰에서 이 변경 명시적 언급

---

## 관련 문서

- [`testing-strategy.md`](./testing-strategy.md) — 4 레이어 개요
- [`FeatureKit Contract`](../architecture/featurekit-contract.md) — 검증 대상 속성들
- [`ADR-003 · FeatureKit`](../philosophy/adr-003-featurekit-registry.md)
