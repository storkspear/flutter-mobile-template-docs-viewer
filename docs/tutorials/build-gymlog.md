# 튜토리얼: "짐로그" 앱 만들기 (12단계 walkthrough)

> 이 가이드는 **새 개발자가 이 템플릿을 처음 받아 실제 앱을 만들기까지의 전 과정**을, 가상 앱 "짐로그"를 예시로 보여줍니다. README 12단계의 추상적 설명을 구체적인 명령·코드·결과로 재현합니다.

---

## 0. 짐로그 기획 (60초)

| 항목 | 결정 |
|------|------|
| 이름 | 짐로그 (Gymlog) |
| 컨셉 | 솔로 운동인이 매일 운동 세트(중량/횟수)를 기록하고 주/월 볼륨 트렌드를 차트로 확인 |
| 데이터 | **로컬 전용** (백엔드 X, 인증 X) |
| recipe | `recipes/local-only-tracker.yaml` |
| 화면 | 1) 오늘 기록 2) 트렌드(차트) 3) 설정 |
| 색상 | 오렌지 (운동 분위기) |
| 다크모드 | OS 자동 |

이 기획은 **모든 결정을 사전에 내리고** 시작합니다. 결정이 안 되면 어떤 recipe/kit을 골라야 할지 막힙니다.

---

## 1. 'Use this template' → 새 레포 생성

GitHub의 이 저장소 페이지에서 **`Use this template`** → **`Create a new repository`** 버튼.

```bash
git clone git@github.com:<org>/gymlog.git
cd gymlog
```

> ⚠️ **포크(fork)가 아닙니다.** Use this template은 히스토리를 분리한 새 레포를 만듭니다. fork 단어는 쓰지 마세요 — 다음 단계가 헷갈립니다.

---

## 2. `rename-app.sh` 실행 (단계 1)

```bash
./scripts/rename-app.sh gymlog com.storkspear.gymlog
```

bundle ID는 **역방향 도메인 형식**: `com.<your-org>.<slug>`. 영문 소문자/숫자/점만 사용 (하이픈 X).

스크립트가 자동으로 변경하는 것:
- Android `applicationId`, package 디렉토리
- iOS `PRODUCT_BUNDLE_IDENTIFIER`, `CFBundleDisplayName`
- `pubspec.yaml`의 `name`
- `app_kits.yaml`의 `app.name`/`app.slug`
- Android Fastlane Appfile

### ✅ import 경로 자동 치환됨 (2026-04-19 보강 후)

`rename-app.sh`가 단계 10에서 `lib/`와 `test/` 안의 모든 `package:app_template/...` 임포트를 새 앱 이름으로 자동 치환합니다. `flutter analyze`가 바로 그린.

> 📜 **이전 버전(보강 전)에서는** 사용자가 직접 `find lib test -name "*.dart" -exec sed -i '' "s|package:app_template/|package:<new>/|g" {} +`를 돌려야 했습니다. 이제 불필요.

---

## 3. 팔레트 커스터마이징 (단계 2)

`lib/core/theme/gymlog_palette.dart`를 새로 작성:

```dart
import 'package:flutter/material.dart';
import 'app_palette.dart';

class GymLogPalette extends AppPalette {
  @override String get id => 'gymlog';
  @override String get name => 'GymLog';
  @override Color get seed => const Color(0xFFFF6B35); // 오렌지
}
```

이게 끝입니다. **seed 한 줄로 전체 ColorScheme(라이트/다크 모두) 자동 생성**. Material 3가 알아서 처리.

`lib/main.dart`에서 등록:

```dart
// 변경 전
AppPaletteRegistry.install(DefaultPalette());

// 변경 후
AppPaletteRegistry.install(GymLogPalette());
```

상세: [`lib/core/theme/README.md`](../../lib/core/theme/README.md).

---

## 4. `AppConfig.init()` 편집 (단계 3)

`lib/main.dart`의 `AppConfig.init(...)` 인자를 짐로그에 맞게:

```dart
AppConfig.init(
  appSlug: 'gymlog',
  baseUrl: 'http://localhost', // 로컬 앱이라 실제 안 씀 (필수 인자라 placeholder)
  environment: Environment.prod,
  supportEmail: 'support@gymlog.example',
  privacyUrl: 'https://gymlog.example/privacy',
  termsUrl: 'https://gymlog.example/terms', // 선택. null이면 약관 UI 자동 숨김
  appVersion: '1.0.0',
);
```

### 🚨 출시 전 필수: 이용약관/개인정보 URL 발급

`example.com` 그대로 두면 **앱 스토어 심사 거부** 가능. 출시 전에 호스팅 결정:
- 가장 빠름: Notion 공개 페이지
- 무료: GitHub Pages (Jekyll)
- 자체: Vercel/Netlify에 정적 HTML

호스팅 후 URL을 `privacyUrl`/`termsUrl`에 주입.

상세: [`lib/core/config/README.md`](../../lib/core/config/README.md).

---

## 5. recipe 적용 + 동기화 (단계 4)

```bash
cp recipes/local-only-tracker.yaml app_kits.yaml
```

### ⚠️ 함정 2: recipe가 rename-app.sh 결과를 덮어씀

recipe 파일에는 `app.name: My Tracker` 같은 placeholder가 들어있습니다. 복사 시 짐로그 이름이 사라집니다. **다시 수정**:

```yaml
# app_kits.yaml
app:
  name: Gymlog
  slug: gymlog
  environment: prod
  palette_class: GymLogPalette  # 위에서 만든 클래스명

kits:
  local_db_kit:
    database_class: AppDatabase
    database_file: lib/database/app_database.dart
  nav_shell_kit: {}
  charts_kit: {}
  observability_kit: {}  # 운영 추적용 — 로컬 앱이어도 권장
```

### `lib/main.dart`의 `AppKits.install([...])` 동기화

yaml과 코드를 **사람이 직접 일치**시켜야 합니다:

```dart
await AppKits.install([
  LocalDbKit(database: AppDatabase.new),
  NavShellKit(tabs: [
    NavTab(label: '오늘', icon: AppIcons.calendar, path: '/',
        builder: (_, __) => const TodayScreen()),
    NavTab(label: '트렌드', icon: AppIcons.chart, path: '/trends',
        builder: (_, __) => const TrendsScreen()),
    NavTab(label: '설정', icon: AppIcons.settings, path: '/settings',
        builder: (_, __) => const GymLogSettingsScreen()),
  ]),
  ObservabilityKit(),
]);
```

> 💡 **NavTab은 `screen`이 아니라 `builder`** (`GoRouterWidgetBuilder`)입니다. 실수하기 쉬운 부분.

### 검증

```bash
dart run tool/configure_app.dart
```

기대 출력:

```
=== Configure App ===
app.name  : Gymlog
app.slug  : gymlog
palette   : GymLogPalette

--- Kits ---
  [x] charts_kit
  [x] local_db_kit
  [x] nav_shell_kit
  [x] observability_kit
  ...

Status: OK
```

> ⚠️ **`Status: OK`는 yaml 자체 정합성만 본 결과**입니다. main.dart의 `AppKits.install` 리스트와의 일치는 검증하지 못합니다. 사람이 마지막으로 한번 더 비교해야 합니다.

상세: [`docs/conventions/kits.md`](../conventions/kits.md).

---

## 6. observability_kit DSN (단계 5)

짐로그가 출시까지 가지 않은 도그푸딩 단계라면 **DSN 주입 스킵**해도 됩니다:

```bash
flutter run  # DSN 없으면 DebugCrashService + DebugAnalyticsService 폴백
```

출시 단계에서는 Sentry/PostHog DSN을 발급받고 `--dart-define`로 주입:

```bash
flutter run \
  --dart-define=SENTRY_DSN=https://...@sentry.io/... \
  --dart-define=POSTHOG_KEY=phc_...
```

상세: [`docs/integrations/sentry.md`](../integrations/sentry.md), [`posthog.md`](../integrations/posthog.md).

---

## 7. 키스토어 + Play Console (단계 6~7)

도그푸딩 단계에서는 **건너뜁니다**. debug 서명으로 시뮬레이터/실기기 테스트 가능.

실제 출시 전:

```bash
./scripts/generate-upload-keystore.sh gymlog
./scripts/upload-secrets-to-github.sh gymlog
```

전제 조건:
- Google Play Developer 계정 ($25 일회성)
- Play Console에 앱 미리 등록

상세: [`docs/integrations/deployment-android.md`](../integrations/deployment-android.md).

---

## 8. FCM (단계 8) — 짐로그는 스킵

짐로그는 백엔드가 없고 알림도 안 쓰니 FCM 불필요. `notifications_kit` 자체를 install 안 함.

알림이 필요한 앱이라면 [`docs/integrations/fcm.md`](../integrations/fcm.md).

---

## 9. 도메인 코드 — 가장 큰 단계 (단계 11)

여기가 본 작업입니다. 짐로그는:
1. Drift 데이터베이스 (Workouts + Sets 테이블)
2. 3개 화면 (오늘 / 트렌드 / 설정)
3. ReviewTrigger 시그널 위치 결정

### 9.1 Drift 스키마

`lib/database/app_database.dart`:

```dart
import 'package:drift/drift.dart';
import '../kits/local_db_kit/db_paths.dart';

part 'app_database.g.dart';

class Workouts extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get date => dateTime()();
  TextColumn get name => text().withLength(min: 1, max: 60)();
}

@DataClassName('WorkoutSet')  // 'Set'은 dart:core와 충돌 — 이름 재지정 필수
class Sets extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get workoutId =>
      integer().references(Workouts, #id, onDelete: KeyAction.cascade)();
  RealColumn get weight => real()();
  IntColumn get reps => integer()();
}

@DriftDatabase(tables: [Workouts, Sets])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(lazyNativeDatabase('gymlog.sqlite'));

  @override
  int get schemaVersion => 1;

  // 비즈니스 쿼리 — Stream으로 노출하면 화면이 자동 리빌드
  Stream<List<Workout>> watchToday() {
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final end = start.add(const Duration(days: 1));
    return (select(workouts)
          ..where((w) => w.date.isBetweenValues(start, end))
          ..orderBy([(w) => OrderingTerm.desc(w.date)]))
        .watch();
  }

  Future<int> addWorkout(String name) =>
      into(workouts).insert(WorkoutsCompanion.insert(
        date: DateTime.now(), name: name,
      ));
  // ... addSet, dailyVolumes, deleteWorkout 등
}
```

### 9.2 Drift 코드젠

```bash
dart run build_runner build --delete-conflicting-outputs
```

`lib/database/app_database.g.dart`가 자동 생성됩니다 (커밋하지 말고 `.gitignore`에 등록 권장 — 빌드 산출물).

### 9.3 화면 작성

각 화면은 `ConsumerWidget`로 만들고, DB는 `databaseProvider`로 접근:

```dart
final _appDbProvider =
    Provider<AppDatabase>((ref) => ref.watch(databaseProvider) as AppDatabase);

class TodayScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final db = ref.watch(_appDbProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('오늘 운동')),
      body: StreamBuilder<List<Workout>>(
        stream: db.watchToday(),
        builder: (context, snap) {
          // ...
        },
      ),
    );
  }
}
```

> 💡 **공통 위젯 활용**: `EmptyView(title:, subtitle:)`, `PrimaryButton`, `AppTextField`, `AppDialog.confirm` 등이 이미 들어있어 디자인 일관성 자동. [`lib/core/widgets/README.md`](../../lib/core/widgets/README.md) 참조.

### 9.4 ReviewTrigger 시그널 — 어디에?

핵심: **사용자가 "성공"을 느끼는 직후**에만 signal. 짐로그에서는 "세트 추가 성공" 직후가 자연스러움:

```dart
Future<void> _addSet(...) async {
  await db.addSet(workoutId: workoutId, weight: w, reps: r);
  // 5회 누적 + 60일 쿨다운 + 연 3회 한도가 모두 만족할 때만 다이얼로그 노출
  await ref.read(reviewTriggerProvider).signal('set_logged');
}
```

**금지** — 다음 위치에선 signal 호출하지 마세요:
- 앱 시작 직후 (사용자 정서 중립)
- 에러/실패 직후 (1점 폭격 위험)
- 동일 화면에서 매번

상세: [`lib/core/review/README.md`](../../lib/core/review/README.md).

---

## 10. 권한 매트릭스 검증 (단계 10)

[README의 권한 매트릭스](../../README.md#kit별-필요-권한-매트릭스)를 보고 활성 kit별로 추가 권한이 필요한지 확인.

짐로그의 활성 kit:
- `local_db_kit` → 권한 X
- `nav_shell_kit` → 권한 X (UI only)
- `charts_kit` → 권한 X (UI only)
- `observability_kit` → INTERNET (자동)

→ **짐로그는 추가 권한 선언 불필요**. AndroidManifest.xml/Info.plist 그대로 OK.

> 💡 **광고를 추가한다면** `ads_kit` 활성 + Info.plist의 `NSUserTrackingUsageDescription` 텍스트를 짐로그 톤에 맞게 수정 (현재 템플릿 기본값 그대로 두면 ATT 다이얼로그가 어색해 보일 수 있음).

---

## 11. 검증 (배포 전 마지막)

```bash
flutter analyze --no-fatal-infos  # 0 issues
flutter test                       # all tests pass (template kit 테스트 그대로 작동)
dart run tool/configure_app.dart   # Status: OK
flutter run                        # 시뮬레이터/실기기에서 직접 사용해보기
```

이 4개가 모두 그린이면 OK.

---

## 12. 배포 (단계 12)

도그푸딩 단계에서는 진행 X. 출시 시:

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions의 `release-android.yml`이 자동으로:
1. AAB 빌드 (난독화 + Sentry 심볼)
2. Play Internal 트랙에 업로드
3. Sentry release 생성

전제: 단계 6~7에서 GHA Secrets 등록 완료.

상세: [`docs/integrations/deployment-android.md`](../integrations/deployment-android.md).

---

## 짐로그 도그푸딩에서 발견한 함정 정리

| # | 함정 | 해결 |
|---|------|------|
| 1 | ~~rename-app.sh가 `package:app_template/` import 안 바꿈~~ | ✅ **2026-04-19 보강**: rename-app.sh가 자동 치환 |
| 2 | recipe 복사 시 `app.name`/`slug`가 placeholder로 덮어써짐 | 복사 후 다시 짐로그로 수정 |
| 3 | NavTab은 `screen`이 아니라 `builder` | `builder: (_, __) => const TodayScreen()` |
| 4 | `OnboardingKit()`은 `prefs/steps` 필수 | 안 쓸 거면 install에서 빼기 |
| 5 | EmptyView 본문 파라미터는 `message`가 아니라 `subtitle` (icon은 기본값 있음) | `EmptyView(title:, subtitle:, icon: AppIcons.x)` 형태 |
| 6 | `configure_app.dart`는 yaml만 검증, main.dart 동기화는 사람 책임 | 마지막에 두 파일 비교 |
| 7 | features/home, features/settings 기존 스텁은 인증 흐름용 | 짐로그 같은 로컬 앱은 자체 SettingsScreen 작성 |
| 8 | `lib/database/app_database.g.dart`는 빌드 산출물 | `.gitignore`에 등록 권장 |
| 9 | Drift 테이블 이름이 Dart 빌트인과 충돌 (`Sets` → `Set`이 dart core `Set<T>`와 충돌) | `@DataClassName('WorkoutSet')` 어노테이션으로 데이터 클래스 이름 변경 |
| 10 | 광고 안 쓰는 앱(`ads_kit` 비활성)인데 `google_mobile_ads` 패키지가 link되어 있어 SDK가 자동 init → ATT 다이얼로그까지 자동 노출 | Info.plist에서 `NSUserTrackingUsageDescription` 키 제거 (없으면 ATT 다이얼로그 안 뜸) + 완전히 제거하려면 pubspec에서 `google_mobile_ads`/`app_tracking_transparency` 의존성도 함께 제거 |

---

## 다음 단계 (짐로그 출시 전 본격 작업)

이 가이드는 12단계 walkthrough까지. 실제 출시 전 추가:

1. **앱 아이콘/스플래시** — `assets/icon/` 교체 후 `./scripts/regenerate-assets.sh`
2. **이용약관/개인정보 URL 호스팅** — Notion/GitHub Pages 등
3. **Google Play Developer 가입** ($25)
4. **키스토어 발급 + GHA Secrets 등록** (단계 6~7 본격 진행)
5. **Sentry/PostHog 프로젝트 발급** + `--dart-define` 주입
6. **앱 스크린샷 + Play Console 메타데이터** (스토어 등록)

대략 1~2일 추가 작업.

---

## 참고 문서

- [`README.md`](../../README.md) — 12단계 체크리스트 원본
- [`CLAUDE.md`](../../CLAUDE.md) — 5분 요약 (자주 막히는 지점 7가지)
- [`docs/philosophy.md`](../philosophy.md) — 왜 이렇게 만들었는지
- [`docs/conventions/kits.md`](../conventions/kits.md) — Kit 의존 관계도 + yaml↔main.dart 동기화 가이드
- [`docs/conventions/architecture.md`](../conventions/architecture.md) — MVVM + 모듈 의존 방향
