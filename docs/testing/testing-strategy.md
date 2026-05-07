# Testing Strategy

4 레이어 테스트 전략 — **Unit · Kit 계약 · 조립 통합 · 마이그레이션 지문**. 각 레이어의 검증 대상이 다르고, 도구도 다름. Kit 계약 테스트의 상세 패턴은 [`contract-testing.md`](./contract-testing.md) 참조.

---

## 레이어 개요

```
┌─────────────────────────────────────────┐
│  1. Unit (가장 많음)                       │
│     Service · ViewModel · Util · Widget   │
│     → AppKits.install 없이 실행            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  2. Kit 계약                              │
│     {kit}_contract_test.dart              │
│     → Kit 의 불변 속성 (requires 등)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  3. 조립 통합                              │
│     main_assembly_test.dart               │
│     → 실제 main.dart 흐름 재현             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  4. 마이그레이션 지문                       │
│     Drift 스키마 변경 자동 감지             │
└─────────────────────────────────────────┘
```

---

## 1. Unit

### Service (가장 단순)

```dart
void main() {
  group('AuthService', () {
    late FakeApiClient apiClient;
    late AuthStateNotifier authState;
    late AuthService service;

    setUp(() {
      apiClient = FakeApiClient();
      authState = AuthStateNotifier();
      service = AuthService(apiClient: apiClient, authState: authState, /* ... */);
    });

    tearDown(() => authState.dispose());

    test('signIn succeeds with valid credentials', () async {
      apiClient.postResponse = {'accessToken': 'a', 'refreshToken': 'r'};
      await service.signInWithEmail(email: 'x@y.com', password: 'pw');
      expect(authState.current.isAuthenticated, true);
    });
  });
}
```

### ViewModel (ProviderContainer 필요)

```dart
void main() {
  group('LoginViewModel', () {
    late ProviderContainer container;
    late MockAuthService mockAuth;

    setUp(() {
      mockAuth = MockAuthService();
      container = ProviderContainer(overrides: [
        authServiceProvider.overrideWithValue(mockAuth),
      ]);
    });

    tearDown(() => container.dispose());

    test('error state set on failure', () async {
      when(mockAuth.signInWithEmail(...))
        .thenThrow(const ApiException(code: 'ATH_001', message: '...'));

      await container.read(loginViewModelProvider.notifier)
        .signInWithEmail('x@y.com', 'wrong');

      expect(container.read(loginViewModelProvider).errorCode, 'ATH_001');
    });
  });
}
```

### Widget (특수 상황만)

대부분의 UI 검증은 ViewModel 테스트로 충분. Widget 테스트는:
- 복잡한 Gesture · 애니메이션
- 플랫폼별 분기 (iOS vs Android)
- Golden 이미지 비교

```dart
testWidgets('PrimaryButton shows spinner when loading', (tester) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: PrimaryButton(label: 'OK', loading: true, onPressed: () {})),
  ));
  expect(find.byType(CircularProgressIndicator), findsOneWidget);
});
```

---

## 2. Kit 계약 테스트

각 Kit 의 `{kit_name}_contract_test.dart` 에서 **불변 속성** 검증:

```dart
void main() {
  tearDown(() => AppKits.resetForTest());

  group('AuthKit contract', () {
    test('requires BackendApiKit', () {
      expect(AuthKit().requires, contains(BackendApiKit));
    });

    test('redirectPriority is 10', () {
      expect(AuthKit().redirectPriority, 10);
    });

    test('contributes /login route', () {
      final paths = AuthKit().routes.whereType<GoRoute>().map((r) => r.path);
      expect(paths, containsAll(['/login', '/forgot-password', '/verify-email']));
    });
  });
}
```

### 왜 계약 테스트?

Kit 의 `requires`, `redirectPriority`, `routes` 같은 **외부 의존적 속성** 은 실수로 바꾸면 다른 Kit · 라우터가 깨짐. 계약 테스트가 **의도된 변경인지 검토** 를 강제.

상세는 [`contract-testing.md`](./contract-testing.md).

---

## 3. 조립 통합 테스트

실제 `main.dart` 흐름 재현:

```dart
void main() {
  tearDown(() {
    AppKits.resetForTest();
    AppPaletteRegistry.resetForTest();
  });

  test('main assembly completes', () async {
    AppConfig.init(/* ... */);
    AppPaletteRegistry.install(DefaultPalette());

    await AppKits.install([
      BackendApiKit(),
      AuthKit(),
      UpdateKit(service: NoUpdateAppUpdateService()),
      ObservabilityKit(),
    ]);

    // PrefsStorage 는 SharedPreferences mock 으로 init.
    SharedPreferences.setMockInitialValues({});
    final prefs = PrefsStorage();
    await prefs.init();

    final container = ProviderContainer(overrides: [
      ...AppKits.allProviderOverrides,
      prefsStorageProvider.overrideWithValue(prefs),
      secureStorageProvider.overrideWithValue(FakeSecureStorage()),
    ]);
    AppKits.attachContainer(container);

    final boot = await SplashController(steps: AppKits.allBootSteps).run();
    expect(boot.status, isNot(SplashStatus.error));

    container.dispose();
  });
}
```

### 검증 포인트

- 모든 Kit 이 `install` 성공
- `requires` 검증 통과
- BootStep 이 실패하지 않음
- 최종 상태 (`authState`, `forceUpdate` 등) 가 기대대로

---

## 4. 마이그레이션 지문

Drift 스키마 변경 자동 감지. `local_db_kit` 활성 시만.

```dart
// test/migration_fingerprint/app_database_fingerprint_test.dart
void main() {
  test('schema fingerprint matches snapshot', () async {
    final db = AppDatabase.forTesting();
    final schema = await db.customSelect('SELECT sql FROM sqlite_schema').get();
    // drift_dev 가 snapshot 비교
  });
}
```

### 스키마 변경 시

```bash
# 1. 의도한 변경인지 확인 — fingerprint 테스트가 실패해야 정상 (스키마 hash 가 바뀜)
flutter test test/migration_fingerprint/

# 2. schemaVersion 올림 + onUpgrade 작성 (lib/database/app_database.dart)

# 3. 지문 snapshot 갱신 — 테스트 코드의 expected hash 를 새 값으로 교체
#    (drift_dev schema dump 로 자동 추출 가능)
dart run drift_dev schema dump lib/database/app_database.dart drift_schemas/

# 4. 갱신된 지문 + 마이그레이션 코드 함께 커밋
```

---

## 커버리지 목표

| 레이어 | 목표 커버리지 |
|------|------------|
| Service · ViewModel | 80%+ |
| Kit 계약 | 핵심 Kit (현재 `auth_kit` · `backend_api_kit` · `payment_kit`) 우선. 메타가 단순한 Kit 은 통합 테스트로 흡수 |
| 조립 통합 | 1개 유효 (smoke test 수준 — `test/integration/main_assembly_test.dart`) |
| 마이그레이션 지문 | 전 스키마 버전 (Drift 사용 시) |
| Widget (golden) | 주요 화면만 (선택) |

```bash
flutter test --coverage
# coverage/lcov.info 생성
# genhtml coverage/lcov.info -o coverage/html  (HTML 리포트)
```

---

## 테스트 데이터 · 헬퍼

`test/helpers/` 에 공용:

- `FakeSecureStorage` — Map 기반 SecureStorage (`fake_secure_storage.dart`)
- `MockDioAdapter` — Dio 응답 조작 (`mock_dio_adapter.dart`)
- `TestJwt.generate(...)` — 테스트용 JWT (`test_jwt.dart`)

`PrefsStorage` 는 별도 fake 없이 표준 패턴으로:
```dart
SharedPreferences.setMockInitialValues({});
final prefs = PrefsStorage();
await prefs.init();
```

모든 테스트가 이걸 재사용 → 일관성.

---

## CI 통합

`.github/workflows/ci.yml` 에서:

```yaml
- run: flutter test --reporter=expanded --coverage
- uses: codecov/codecov-action@v4
  with:
    file: coverage/lcov.info
```

Codecov 에 커버리지 리포트 업로드 (선택).

---

## 관련 문서

- [`contract-testing.md`](./contract-testing.md) — Kit 계약 테스트 상세
- [`conventions/architecture.md`](../conventions/architecture.md) — MVVM · 의존 방향 (테스트 대상 패턴 출처)
- [`ADR-003 · FeatureKit`](../philosophy/adr-003-featurekit-registry.md)
