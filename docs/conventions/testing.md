# 테스트 전략

이 템플릿의 테스트는 크게 세 레이어로 나뉩니다. 각 레이어가 무엇을 검증하는지 이해하면, 새 코드를 작성할 때 어느 수준의 테스트를 작성해야 하는지 바로 결정할 수 있습니다.

| 레이어 | 위치 | 목적 |
|--------|------|------|
| **단위 테스트** | `test/core/`, `test/kits/` | ViewModel·Service 로직, 개별 클래스 동작 |
| **Kit 조립 테스트** | `test/integration/` | main.dart 경로 검증 (install → container → attach → splash) |
| **계약 테스트** | `test/kits/{kit}/*_contract_test.dart` | Kit 메타(requires, redirectPriority) 불변 보장 |

---

## 1. Kit 조립 테스트 — `AppKits.resetForTest()`

Kit을 사용하는 모든 테스트는 `setUp`/`tearDown`에서 레지스트리를 초기화해야 합니다. 초기화하지 않으면 테스트 간 상태가 누적되어 순서에 따라 결과가 달라집니다.

```dart
setUp(() async {
  await AppKits.resetForTest();
});

// 또는 tearDown에서 정리
tearDown(() async {
  await AppKits.resetForTest();
});
```

`resetForTest()`는 설치된 Kit을 역순으로 `onDispose()` 호출한 뒤 레지스트리와 컨테이너를 모두 초기화합니다.

### main.dart 조립 경로 전체 검증

`test/integration/main_assembly_test.dart`가 실제 앱 진입점과 동일한 순서(`install → container → attach → splash`)를 검증합니다. 새 Kit을 추가할 때 이 테스트가 통과하면 조립이 정상임을 보장합니다.

```dart
test('install → container → attach → provider read 성공', () async {
  // 1. Kit 설치
  await AppKits.install([
    LocalDbKit(database: () => fakeDb),
    NotificationsKit(service: alertSvc),
  ]);

  // 2. 컨테이너 생성 (allProviderOverrides 반드시 포함)
  final container = ProviderContainer(
    overrides: [
      ...AppKits.allProviderOverrides,
      prefsStorageProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);

  // 3. 컨테이너 바인딩
  AppKits.attachContainer(container);

  // 4. Kit이 기여한 Provider 검증
  final db = container.read(databaseProvider);
  expect(identical(db, fakeDb), isTrue);
});
```

`allProviderOverrides`를 container에 넘기지 않으면 Kit-owned provider가 `StateError`로 실패합니다. 이 실수는 단위 테스트에서는 잡히지 않으므로(자체 container를 따로 생성하기 때문) 조립 테스트가 반드시 필요합니다.

---

## 2. Provider 오버라이드 패턴

Kit이 설치된 상태에서 특정 서비스만 가짜(Fake/Mock)로 바꾸려면, `ProviderContainer` 생성 시 `overrides` 리스트에 추가합니다.

```dart
setUp(() async {
  await AppKits.install([
    BackendApiKit(baseUrl: 'http://localhost:8080'),
    AuthKit(),
  ]);

  final container = ProviderContainer(
    overrides: [
      ...AppKits.allProviderOverrides,
      crashServiceProvider.overrideWithValue(FakeCrashService()),
    ],
  );
  addTearDown(container.dispose);
  AppKits.attachContainer(container);
});

tearDown(() async {
  await AppKits.resetForTest();
});
```

Kit의 override보다 뒤에 추가하면 덮어쓰기가 됩니다. 순서가 중요합니다.

---

## 3. Kit 없이 단위 테스트

ViewModel이나 Service는 Kit 없이 `ProviderContainer`를 직접 생성해서 테스트합니다. `AppKits.install`이 없으므로 `resetForTest()`도 필요 없습니다.

```dart
test('로그인 성공 시 상태가 authenticated로 변경됩니다', () async {
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

## 4. 테스트 헬퍼

`test/helpers/`에 공용 헬퍼가 준비되어 있습니다. 직접 구현하기 전에 먼저 확인하세요.

### `FakeSecureStorage`

플랫폼 채널 없이 메모리에서 동작하는 `SecureStorage` 구현체입니다. 토큰 저장/조회를 검증할 때 사용합니다.

```dart
final secureStorage = FakeSecureStorage();
final tokenStorage = TokenStorage(storage: secureStorage);

// 초기값 직접 주입
secureStorage.seed({'access_token': buildTestJwt()});
```

### `buildTestJwt()`

서명 검증이 없는 테스트용 JWT 문자열을 생성합니다. 토큰 파싱 로직(`CurrentUser` 변환 등)을 검증할 때 사용합니다.

```dart
final jwt = buildTestJwt(
  userId: 42,
  email: 'tester@example.com',
  appSlug: 'test-app',
  exp: DateTime.now().add(const Duration(hours: 1))
       .millisecondsSinceEpoch ~/ 1000,
);
```

### `MockDioAdapter`

실제 HTTP 요청 없이 응답을 주입하는 Dio 어댑터입니다. `ApiClient`의 네트워크 레이어를 테스트할 때 사용합니다.

```dart
final adapter = MockDioAdapter();
apiClient.dio.httpClientAdapter = adapter;

// GET 응답 주입
adapter.onGet(
  '/expenses',
  MockResponse.ok({'data': [...], 'error': null}),
);

// 에러 응답 주입
adapter.onPost(
  '/auth/email/signin',
  MockResponse.ok({
    'data': null,
    'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Wrong password'},
  }),
);
```

---

## 5. Kit 계약 테스트

각 Kit 디렉토리의 `*_contract_test.dart`는 Kit의 메타 정보(`requires`, `redirectPriority`, `name`)가 의도한 값과 일치하는지 검증합니다. Kit의 핵심 계약이 실수로 바뀌는 것을 방지합니다.

```dart
// test/kits/auth_kit/auth_kit_contract_test.dart
test('AuthKit 계약', () async {
  await AppKits.install([BackendApiKit(), AuthKit()]);

  final kit = AppKits.get<AuthKit>()!;
  expect(kit.name, 'auth_kit');
  expect(kit.requires, contains(BackendApiKit));
  expect(kit.redirectPriority, 10);
});
```

새 Kit을 작성할 때 반드시 계약 테스트를 함께 작성합니다.

---

## 6. 마이그레이션 지문 테스트

`test/migration_fingerprint/`는 Drift 스키마 변경을 추적합니다. DB 스키마를 변경하면 이 테스트가 실패하며, 마이그레이션 step을 작성하고 지문을 업데이트해야 통과합니다.

```bash
# 지문 업데이트 (스키마 변경 후)
dart run build_runner build --delete-conflicting-outputs
flutter test test/migration_fingerprint/
```

스키마 변경 없이 이 테스트가 실패하면 실수로 모델이 바뀐 것입니다.

---

## 7. 테스트 실행 명령

```bash
# 전체 실행
flutter test --reporter=expanded

# 특정 파일
flutter test test/integration/main_assembly_test.dart

# 특정 그룹
flutter test --name "AppKits.install"

# 커버리지
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
```

커밋 전에는 `flutter analyze && flutter test` 조합을 반드시 실행합니다. CI가 동일 커맨드로 검증합니다.
