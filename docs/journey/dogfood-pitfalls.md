# Dogfood Pitfalls — 자주 막히는 함정 모음

파생 레포 셋업 · 개발 · 배포 과정에서 **반복적으로 발생하는 함정** 과 해결법. 각 항목은 **증상 · 원인 · 해결** 3단계.

> 여기 없으면 [`FAQ`](./dogfood-faq.md) 나 관련 ADR · 컨벤션 문서 검색.

---

## 셋업 단계

### ❌ `flutter pub get` 실패

**증상**: 네트워크 · SSL 에러 · 버전 불일치로 실패.

**원인**:
- VPN 또는 방화벽이 pub.dev 차단
- `pubspec.lock` 이 다른 Flutter 버전에서 생성됨
- Flutter 버전이 너무 낮음

**해결**:
```bash
flutter --version          # 3.41.8+ 확인
rm pubspec.lock
flutter clean
flutter pub get
```

---

### ❌ iOS `pod install` 실패

**증상**: `CocoaPods could not find compatible versions` 등.

**원인**:
- Xcode 버전 낮음
- CocoaPods repo 오래됨
- M1/M2 Mac 의 Rosetta 이슈

**해결**:
```bash
cd ios
pod repo update
pod install --repo-update

# 여전히 실패 시
rm Podfile.lock
rm -rf Pods
pod install
```

M1/M2:
```bash
arch -x86_64 pod install  # 일부 플러그인이 x86 만 지원 시
```

---

### ❌ Android licenses 미동의

**증상**: `Some Android licenses not accepted`.

**해결**:
```bash
flutter doctor --android-licenses
# y 여러 번 입력
```

---

### ❌ `rename-app.sh` 후 빌드 실패

**증상**: `package:<old_name>/...` import 가 남아있음.

**원인**: 스크립트가 모든 파일을 치환 못 함 (dart 코드 · 생성 파일 등).

**해결** (macOS 기준 — Linux 는 `sed -i` 로):
```bash
# 수동으로 일괄 치환 (macOS BSD sed)
grep -rl 'package:template' lib/ test/ | xargs sed -i '' 's|package:template|package:my_app|g'

# 또는
find . -name '*.dart' -exec sed -i '' 's|package:template|package:my_app|g' {} +
```

---

## 개발 단계

### ❌ `AppKits.install` 후 화면 안 뜸

**증상**: 빌드는 되는데 홈 화면 대신 스플래시에 멈춤.

**원인**:
- `AppKits.attachContainer(container)` 호출 누락
- `install` 리스트에 필수 Kit 빠짐

**해결**: `lib/main.dart` 순서 확인.

```dart
await AppKits.install([...]);           // 1
final container = ProviderContainer(
  overrides: [...AppKits.allProviderOverrides],
);                                       // 2
AppKits.attachContainer(container);      // 3 ← 필수!
SplashController(steps: AppKits.allBootSteps).run();  // 4
```

---

### ❌ "auth_kit requires backend_api_kit" 에러

**증상**: `AppKits.install` 시 StateError.

**원인**: `auth_kit` 만 활성화하고 `backend_api_kit` 뺌.

**해결**: `app_kits.yaml` · `main.dart` 둘 다 `backend_api_kit` 추가.

```yaml
kits:
  backend_api_kit: {}   # ← 추가
  auth_kit: {}
```

```dart
await AppKits.install([
  BackendApiKit(),      // ← 추가
  AuthKit(),
]);
```

---

### ❌ `dart run tool/configure_app.dart` 가 ISSUES FOUND

**증상**: 빌드는 되지만 validator 가 불일치 지적.

**원인**: `app_kits.yaml` 과 `lib/main.dart` 의 Kit 리스트가 다름.

**해결**: 두 파일을 정확히 맞춤. YAML 은 선언 · Dart 는 인스턴스. 같은 Kit 이 양쪽에 있어야 해요.

---

### ❌ Sentry · PostHog 안 찍힘

**증상**: 크래시 · 이벤트가 대시보드에 안 보임.

**원인**:
- DSN · API Key 주입 안 됨 → Debug 폴백으로 동작
- Release 빌드 아님 (Debug 모드)
- PII 차단 필터

**해결**:
```bash
# 환경변수 주입 확인
flutter run \
  --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2) \
  --dart-define=POSTHOG_KEY=$(grep POSTHOG_KEY .env | cut -d= -f2)
```

런타임 확인:
```dart
print('Sentry enabled: ${ObservabilityEnv.isSentryEnabled}');
print('PostHog enabled: ${ObservabilityEnv.isPostHogEnabled}');
```

---

### ❌ i18n 키 사용 후 컴파일 에러

**증상**: `S.of(context).newKey` 가 빨간 줄.

**원인**: ARB 추가 후 `flutter gen-l10n` 미실행.

**해결**:
```bash
flutter gen-l10n
```

**추가 체크**: `app_ko.arb` · `app_en.arb` 둘 다에 키가 있어야 해요. 한쪽만 있으면 gen-l10n 실패.

---

### ❌ ViewModel 에서 `BuildContext` 쓰려고 함

**증상**: 스낵바 · 다이얼로그를 ViewModel 에서 띄우고 싶음.

**원인**: 디자인 위반. ViewModel 은 UI 에 의존하지 않아요.

**해결**: State 에 플래그를 세팅하고 Screen 이 반응.

```dart
// ViewModel
state = state.copyWith(showSnackbar: true, snackbarMessage: '...');

// Screen
ref.listen(viewModelProvider, (prev, next) {
  if (next.showSnackbar) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(next.snackbarMessage!)));
  }
});
```

---

### ❌ Drift DB 스키마 변경 후 크래시

**증상**: `IllegalStateException: Migration from X to Y not provided`.

**원인**: `schemaVersion` 올렸는데 `onUpgrade` 에 해당 마이그레이션 안 작성.

**해결**:
```dart
@override
int get schemaVersion => 2;  // ← 올림

@override
MigrationStrategy get migration => MigrationStrategy(
  onCreate: (m) => m.createAll(),
  onUpgrade: (m, from, to) async {
    if (from < 2) {
      await m.addColumn(items, items.newColumn);
    }
  },
);
```

> ⚠️ 템플릿엔 Drift schema fingerprint 테스트가 없어요. 파생 레포에서 `local_db_kit` 활성화 후 직접 추가합니다 (자세한 절차는 `local_db_kit` Feature 문서 참조).

---

### ❌ Pull-to-refresh 가 한 번만 동작

**증상**: 첫 새로고침은 되지만 그 이후 안 됨.

**원인**: `onRefresh` 콜백이 `Future` 를 반환하지 않아요.

**해결**:
```dart
RefreshIndicator(
  onRefresh: () async {           // ← async + Future 반환
    await vm.refresh();
  },
  child: ...,
)
```

`RefreshIndicator` 는 `Future` 완료까지 스피너 유지.

---

## 배포 단계

### ❌ Play Console "Upload key not matching"

**증상**: AAB 업로드 시 서명 불일치.

**원인**: Play App Signing 의 upload 인증서와 keystore 가 다름.

**해결**:
1. Play Console → App integrity → App Signing → Upload key certificate 지문 확인
2. 로컬 keystore 지문과 비교:
   ```bash
   keytool -list -v -keystore android/app/upload-keystore.jks -alias upload
   ```
3. 일치 안 하면 keystore 재생성 + Play Console 에 등록

---

### ❌ "Version code already used"

**증상**: AAB 업로드 거부.

**원인**: `pubspec.yaml` 의 `+N` build number 가 Play 에 이미 올라간 값과 같거나 작음.

**해결**: `version: 1.2.3+46` 처럼 `+` 뒤 숫자 증가.

---

### ❌ TestFlight 앱 "Invalid Binary"

**증상**: Upload 후 "Invalid Binary" 이메일.

**원인**:
- 심볼 파일 누락 (bitcode)
- 필수 Capabilities 미추가
- Bundle ID 불일치

**해결**: App Store Connect 의 Activity → 실패 사유 확인. 대부분:
```bash
# Xcode 에서 Product → Archive → Validate App
```

---

### ❌ GHA 배포 성공했는데 Play Console 에 안 보임

**증상**: Actions 는 초록불인데 Play Console 에 없음.

**원인**:
- Service account 권한 부족 (Android Publisher)
- JSON key 만료 · 잘못됨
- Track 이름 오타 (`internal` vs `production`)

**해결**:
```bash
# Fastlane 로그 확인
cat fastlane_error.log
```

---

### ❌ Sentry 스택이 `a.b.c` 로 난독화됨

**증상**: 프로덕션 크래시 원인 추적 불가.

**원인**: `--obfuscate` 는 했는데 심볼 업로드를 안 해요.

**해결**:
```bash
# GHA 에 추가
- run: flutter build appbundle --obfuscate --split-debug-info=build/app/symbols
- run: npx @sentry/cli upload-dif --org $ORG --project $PROJECT build/app/symbols
```

---

### ❌ release 빌드 시 `AppConfig.init() release 빌드 검증 실패` StateError

**증상**: `flutter build apk --release` 또는 스토어 빌드 직후 앱이 즉시 죽음. 로그에 다음 메시지:
```
StateError: AppConfig.init() release 빌드 검증 실패:
  - baseUrl: "http://localhost:8080" — localhost 는 release 출시 금지
  - environment: Environment.dev — release 빌드는 staging/prod 로 호출하세요
```

**원인**: 파생 레포가 `lib/main.dart` 의 `AppConfig.init` 인자를 자기 앱 값으로 바꾸지 않고 release 빌드를 한 거예요. `AppConfig` 가 `kReleaseMode` 에서 다음 5가지 dummy 패턴을 자동 검출해요 (근거: `lib/core/config/app_config.dart` 의 `collectReleaseValidationIssues`):

1. `baseUrl` 에 `localhost` 또는 `127.0.0.1` 포함
2. `supportEmail` 이 `@example.com` 으로 끝남
3. `privacyUrl` 에 `example.com` 포함
4. `termsUrl` 에 `example.com` 포함 (null 인 경우 검사 생략)
5. `environment == Environment.dev` (release 는 staging/prod 만 허용)

→ 의도: privacy URL 404 로 App Store 리뷰 거부 / Sentry · PostHog 이벤트가 'dev' 라벨로 박혀 운영 알람 노이즈 혼재 같은 사고를 컴파일 직후에 차단해요.

**해결**: `lib/main.dart` 의 `AppConfig.init` 인자를 자기 앱 값으로 모두 교체:
```dart
AppConfig.init(
  appSlug: 'myapp',
  baseUrl: 'https://api.myapp.com',           // ← 실제 운영 URL
  environment: Environment.prod,                // ← release 는 prod
  supportEmail: 'support@myapp.com',           // ← 실제 메일
  privacyUrl: 'https://myapp.com/privacy',     // ← 실제 페이지
  termsUrl: 'https://myapp.com/terms',
  appVersion: pkgInfo.version,
);
```

dev/profile 빌드는 가드를 통과시키므로 로컬 개발에는 영향 없어요.

---

## 자주 하는 실수 (Claude / AI 코드 생성)

### ❌ ViewModel 에 `ref.watch` 사용

잘못:
```dart
class BadViewModel extends StateNotifier<...> {
  BadViewModel(this._ref) { _ref.watch(...); }  // ← 금지
}
```

**해결**: `ref.read` 만 사용 (단발성 조회). watch 는 ViewModel 을 watch 하는 위젯만.

---

### ❌ `copyWith` 에 nullable 폴백

잘못:
```dart
errorMessage: errorMessage ?? this.errorMessage   // ← 금지
```

**해결**:
```dart
errorMessage: errorMessage   // null 로도 clear 가능
```

---

### ❌ Kit 간 직접 import

잘못:
```dart
// auth_kit 에서
import '../backend_api_kit/api_client.dart';
final client = ApiClient(...);  // ← 금지
```

**해결**: Provider 경유.
```dart
final client = ref.read(apiClientProvider);
```

**예외 — `kit_manifest.requires` 에 선언한 의존**: 동일 kit 내부 결합도가 높은 의존(예: `auth_kit → backend_api_kit` 의 `ApiException` · `ApiClient`)은 manifest 의 `requires` 에 적은 뒤 직접 import 가 허용돼요. 단 **manifest 에 선언 안 한 cross-import 는 금지** — 도구가 잡는 의존성과 코드 실제 의존성이 mismatch 되면 다른 recipe 로 출발한 파생 레포가 컴파일 실패해요.

**실제 사례**: `auth_kit/ui/login/login_screen.dart` 가 `observability_kit/dogfooding_panel.dart` 를 `kDebugMode` 가드 안에서 직접 import 한 적이 있었어요. `auth_kit/kit_manifest.yaml` 의 `requires` 에는 `backend_api_kit` 만 있어서, `backend-auth-app` recipe (observability_kit 미포함) 로 출발하면 컴파일 실패. 디버그 도구는 한 화면(home)에서만 노출하는 게 안전해요.

---

## 추가 리소스

- [`FAQ`](./dogfood-faq.md) — 자주 묻는 질문
- [`Conventions`](../conventions/) — 코딩 규약
- [`Features 인덱스`](../features/README.md) — Kit 별 체크리스트

막혔는데 해결 안 되면 GitHub Issue 에 등록 — 같은 함정이 다음 파생 레포에선 이 문서에 추가되도록.
