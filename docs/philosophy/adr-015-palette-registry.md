# Palette_Registry

**Status**: Accepted. 현재 유효. 2026-04-24 작성 / 2026-05-07 line 수 갱신. `lib/core/theme/app_palette.dart` (88줄, 추상 + DefaultPalette) + `app_palette_registry.dart` (68줄, 중앙 레지스트리 + ValueNotifier). Material 3 `ColorScheme.fromSeed` 기반.

## 결론부터

브랜드 색상은 **시드 색상 하나** (`Color seed`) 와 최소 추가 색상 (`accent`, semantic) 만 선언하면 돼요. Material 3 의 `ColorScheme.fromSeed` 가 Light / Dark 스키마를 자동 생성. 여러 팔레트를 **`AppPaletteRegistry`** 에 등록하고 `ValueNotifier` 로 런타임 교체 가능. 파생 레포는 `MyAppPalette` 하나만 정의 → `AppPaletteRegistry.install(...)` 한 줄로 전체 테마 완료.

## 왜 이런 고민이 시작됐나?

앱 공장에서 각 앱이 **독자 브랜드 색상** 을 가져요. 운동 앱은 활력 주황, 가계부는 안정 파랑, 명상 앱은 차분 보라. 이때 다음 상황들이 부딪혀요.

**상황 A — 앱별 시각적 정체성**  
같은 템플릿 기반 앱 10개가 **똑같은 파란색** 이면 브랜드가 드러나지 않아요. 각 앱이 자기 색을 쉽게 가질 수 있어야.

**상황 B — 설정 변경의 번거로움**  
Flutter 기본 방식은 `ThemeData` 를 `MaterialApp.theme` 에 넘기는 것. 여기에 `primary`, `secondary`, `surface`, `background`, `onPrimary`, `onSecondary`, ... 수십 개 색을 **각각 지정** 하면 새 앱마다 반나절.

**상황 C — Material 3 자동 생성 활용**  
Material 3 에 `ColorScheme.fromSeed(seedColor: ...)` 가 있어 **시드 하나로 톤별 색상 전부 자동 생성**. 이 기능을 템플릿 기본 전제로 둬야 파생 레포 비용이 줄어요.

**상황 D — 런타임 교체 지원**  
설정 화면에서 "밝은 테마 / 어두운 테마" 또는 "파란 테마 / 녹색 테마" 같은 사용자 선택이 있을 수 있음. 앱 재시작 없이 즉시 반영돼야.

이 결정이 답해야 했던 물음이에요.

> **파생 레포가 한 줄로 자기 브랜드 색을 도입하되, 런타임 교체 · 접근성 변형도 지원하는 구조** 는?

## 고민했던 대안들

### Option 1 — 파생 레포가 `ThemeData` 를 직접 만들기

`MaterialApp.theme = ThemeData(primary: ..., secondary: ..., ...)` 로 모든 색 개별 지정.

- **장점**: Flutter 표준. 러닝 커브 최소.
- **단점 1**: 색 수십 개 개별 지정 피로. "`primary` 가 뭐고 `onPrimary` 가 뭐지?" 가 매번.
- **단점 2**: Material 3 의 **tonal palette** (5단계 컨테이너 색 등) 를 수동 계산하는 건 너무 복잡.
- **단점 3**: 런타임 교체 시 전체 `ThemeData` 재구성 → MaterialApp 리빌드 트리거 수동 관리.
- **탈락 이유**: 상황 B · C 위반. 파생 레포 비용이 커요.

### Option 2 — 완전 정적 팔레트 (`const AppColors`)

`static const primary = Color(0xFF...);` 로 중앙 상수 파일. 교체 필요 시 컴파일 타임에만.

- **장점**: 단순. const 라 성능 좋음.
- **단점 1**: **런타임 교체 불가**. 사용자 "테마 전환" 기능 안 됨.
- **단점 2**: 파생 레포에서 `AppColors.primary` 값만 바꾸려면 **template 의 파일 수정** 필요 → cherry-pick 전파 시 충돌.
- **탈락 이유**: 상황 D 위반.

### Option 3 — AppPalette 추상 + AppPaletteRegistry ★ (채택)

`AppPalette` 추상 클래스로 필수 색만 선언. 여러 팔레트를 `AppPaletteRegistry` 에 등록 → `ValueNotifier` 로 현재 팔레트 트래킹 → `MaterialApp` 이 `listenable` 구독으로 자동 리빌드.

- **상황 A 만족**: 파생 레포는 `class MyAppPalette extends AppPalette` 한 클래스 정의.
- **상황 B 만족**: `seed` + `accent` + 4개 semantic 만 지정. `ColorScheme` 전체는 자동 생성.
- **상황 C 만족**: `lightScheme()` · `darkScheme()` 이 `ColorScheme.fromSeed` 호출.
- **상황 D 만족**: `AppPaletteRegistry.use(id)` 로 런타임 교체 → `ValueListenable` 알림 → MaterialApp 리빌드.

## 결정

### AppPalette 추상 클래스

```dart
// lib/core/theme/app_palette.dart 발췌
abstract class AppPalette {
  String get id;                  // 'default' · 'my-app-orange-light'
  String get name;                // 설정 화면 표시명
  bool get supportsDarkMode => true;

  // 필수
  Color get seed;                 // Material 3 시드
  Color get accent => seed;       // CTA 버튼 등

  // 시맨틱 (기본값 제공)
  Color get success => const Color(0xFF22C55E);
  Color get warning => const Color(0xFFF59E0B);
  Color get info => const Color(0xFF3B82F6);
  Color get error => const Color(0xFFDC2626);

  // 중성 (기본값 제공)
  Color get border => const Color(0xFFE2E8F0);
  Color get textMuted => const Color(0xFF94A3B8);
  Color get cardBackground => Colors.white;
  Color get cardBackgroundDark => const Color(0xFF1E293B);

  // Material ColorScheme 자동 생성
  ColorScheme lightScheme() => ColorScheme.fromSeed(seedColor: seed);
  ColorScheme darkScheme() => ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark);

  // 접근성 변형 (선택)
  AppPalette? get highContrastVariant => null;
}

// 템플릿 기본
class DefaultPalette extends AppPalette {
  @override String get id => 'default';
  @override String get name => 'Default';
  @override Color get seed => const Color(0xFF2563EB);  // blue-600
}
```

### AppPaletteRegistry

```dart
// lib/core/theme/app_palette_registry.dart 발췌
class AppPaletteRegistry {
  static final Map<String, AppPalette> _palettes = {};
  static final ValueNotifier<AppPalette?> _current = ValueNotifier(null);

  static void register(AppPalette palette) { /* ... */ }
  static void use(String id) { /* 교체 + ValueNotifier 알림 */ }
  static void install(AppPalette palette) { register(palette); use(palette.id); }

  static AppPalette get current { /* StateError if null */ }
  static Listenable get listenable => _current;
  static ValueListenable<AppPalette?> get currentValue => _current;

  static void resetForTest() { /* 테스트용 */ }
}
```

### 파생 레포의 사용

```dart
// 파생 레포의 lib/theme/my_app_palette.dart
class MyAppPalette extends AppPalette {
  @override String get id => 'my-app-light';
  @override String get name => 'My App (Light)';
  @override Color get seed => const Color(0xFFFF6B35);  // 오렌지
  @override Color get accent => const Color(0xFF1A1A2E);
}

// 파생 레포의 lib/main.dart 발췌
AppPaletteRegistry.install(MyAppPalette());  // ← 이 한 줄만
```

### MaterialApp 구독 (template 내부)

```dart
// lib/app.dart 맥락
class App extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ValueListenableBuilder<AppPalette?>(
      valueListenable: AppPaletteRegistry.currentValue,
      builder: (context, palette, _) {
        if (palette == null) return const SizedBox();  // 설치 전
        return MaterialApp.router(
          theme: ThemeData.from(colorScheme: palette.lightScheme()),
          darkTheme: palette.supportsDarkMode
              ? ThemeData.from(colorScheme: palette.darkScheme())
              : null,
          routerConfig: _router.router,
        );
      },
    );
  }
}
```

팔레트 변경 시 `ValueListenableBuilder` 가 자동 리빌드.

### 설계 선택 포인트

**포인트 1 — 시드 하나에 최대한 의존**  
`seed` 만 필수, 나머지는 기본값 제공. 파생 레포가 "가장 적게 쓰고 가장 많이 얻는" 구조. Material 3 의 tonal palette 생성 알고리즘이 대부분 커버.

**포인트 2 — semantic 색상은 플랫 기본값 + 오버라이드**  
success / warning / info / error 는 **Material 3 가 자동 생성하지 않아요** — 대체로 초록 · 주황 · 파랑 · 빨강이 관용적. 기본값 상수 제공 + 원하면 override. 반복 설정 부담 없음.

**포인트 3 — `id` 는 `String` 하이픈-소문자 권장**  
`registerable / use` 기반이라 `id` 는 안정적 문자열. `'my-app-light'` · `'my-app-dark'` 같이 소문자 하이픈. URL / DB 값과 호환.

**포인트 4 — `ValueNotifier` 로 리빌드 트리거**  
Riverpod 의 Provider 는 `AppPaletteRegistry` 자체의 상태가 아니라 "팔레트 교체 이벤트" 를 위해 쓰기엔 과해요. `ValueNotifier` 가 충분. MaterialApp 이 `ValueListenableBuilder` 로 구독.

**포인트 5 — `install` vs `register + use` 분리**  
단일 팔레트만 쓰는 앱은 `install(MyAppPalette())` 로 끝. 복수 팔레트 쓰는 앱 (테마 선택 화면 있는 앱) 은 `register(A); register(B); use(A.id);` 로 세밀 제어. 두 API 제공.

**포인트 6 — 설치 전 접근 시 StateError**  
`AppPaletteRegistry.current` 는 `install` 전에 호출되면 StateError. "main.dart 에서 깜빡" 실수를 런타임에 즉시 잡음.

## 이 선택이 가져온 것

### 긍정적 결과

- **파생 레포 한 줄**: `AppPaletteRegistry.install(MyAppPalette())` 만. 나머지 자동.
- **Material 3 tonal palette 공짜**: 시드 하나로 `primary`, `primaryContainer`, `onPrimary`, ... 수십 개 자동 생성.
- **런타임 교체**: 설정 화면의 "테마 선택" 이 `use(id)` 한 줄로 작동.
- **다크모드 자동**: `supportsDarkMode = true` 면 `darkScheme()` 이 시드에서 자동 생성.
- **접근성 확장점**: `highContrastVariant` 로 고대비 버전 제공 가능 (향후).
- **파생 레포 확장점**: `supportsDarkMode` · `cardBackground` / `cardBackgroundDark` 게터도 같은 성격. 템플릿은 직접 소비하지 않고, 파생 레포가 라이트 전용 팔레트나 자체 카드 위젯을 만들 때 토큰으로 활용 — 살아있지만 잠재적인 약속.
- **테스트 격리**: `resetForTest()` 로 각 테스트가 독립 상태.

### 부정적 결과

- **Material 3 tonal palette 의 한계**: 시드 색상이 **극단적** (검은색에 가까운 회색 등) 이면 `fromSeed` 결과가 예상 밖. 대부분 브랜드 색상은 적절한 채도라 문제 없지만, edge case 있음.
- **접근성 · 디자인 시스템 완전 제어 불가**: 극도의 커스텀 (예: 기업 브랜드 가이드라인 준수) 필요 시 `seed` + 기본값만으론 부족. `lightScheme()` 을 override 해서 직접 `ColorScheme(primary: ..., ...)` 지정 필요.
- **ColorScheme 외 색 (success 등) 은 `Theme.of(context).extension` 쓰지 않음**: Flutter 공식 권장은 `ThemeExtension` 으로 커스텀 색. 본 ADR 은 `palette.success` 같이 직접 접근하는 관용 — 단순하지만 Flutter 표준은 아님.
- **팔레트 여러 개 등록의 실수**: 같은 id 두 번 `register` 하면 StateError. 실수로 중복하면 빌드 깨짐.

## 교훈

### 교훈 1 — "시드 하나" 의 위력

Material 2 시절엔 `primary`, `primaryLight`, `primaryDark`, `accent`, ... 개별 지정. Material 3 의 `ColorScheme.fromSeed` 는 하나의 시드에서 **색상 체계 전체를 알고리즘 생성** — 디자이너가 각 tone 을 수동으로 뽑을 필요 없음. 이 기능을 기본 전제로 두니 파생 레포 onboarding 비용이 극적으로 감소.

**교훈**: 최신 Material 3 · iOS 17 같은 플랫폼의 **자동 생성 기능** 을 활용. "완전 수동 제어" 를 기본으로 두지 말기.

### 교훈 2 — 런타임 교체는 `ValueNotifier` 로 충분

Riverpod Provider 로 팔레트를 감싸볼까 고민했어요. 하지만 **팔레트는 앱 전체에서 딱 하나** 라 Provider 트리 전체를 재구성하는 건 과해요. `ValueNotifier` + `ValueListenableBuilder` 가 가볍고 Flutter 공식 API — 외부 의존 없음.

**교훈**: "글로벌 단일 상태 교체" 는 Provider 아닌 `ValueNotifier` 가 낫습니다. Provider 는 다양한 타입의 DI 에 쓰는 게 맞음.

### 교훈 3 — `install` 편의 메서드의 가치

단일 팔레트 케이스가 대다수. `register` + `use` 를 매번 쓰면 피로. `install` 한 줄로 끝나는 편의 메서드가 **"파생 레포에서 가장 자주 쓰는 API"** 가 됐어요. 복수 팔레트는 여전히 `register` · `use` 로 제어 가능.

**교훈**: 자주 쓰는 시나리오엔 **편의 메서드** 를 제공. 고급 시나리오 API 는 유지.

## 관련 사례 (Prior Art)

- [Material Design 3 — Color System](https://m3.material.io/styles/color/system/overview) — 본 ADR 의 기반 디자인 시스템
- [Flutter `ColorScheme.fromSeed` API](https://api.flutter.dev/flutter/material/ColorScheme/ColorScheme.fromSeed.html)
- [Material Theme Builder](https://m3.material.io/theme-builder) — 시드에서 스키마 생성 시각화 도구
- [Flutter `ThemeExtension` (공식 커스텀 색)](https://api.flutter.dev/flutter/material/ThemeExtension-class.html) — 본 ADR 이 **채택하지 않은** 대안
- [iOS `UIColor.systemTintColor` 과의 비교](https://developer.apple.com/documentation/uikit/uicolor) — 플랫폼별 "시스템 색" 관용

## Code References

**팔레트 인프라**
- [`lib/core/theme/app_palette.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_palette.dart) — 88줄 추상 + DefaultPalette
- [`lib/core/theme/app_palette_registry.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_palette_registry.dart) — 68줄 레지스트리

**디자인 토큰 (팔레트 외 간격 · 타이포 등)**
- [`lib/core/theme/app_spacing.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_spacing.dart)
- [`lib/core/theme/app_typography.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_typography.dart)

**통합 지점**
- [`lib/app.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/app.dart) — MaterialApp 이 `ValueListenableBuilder` 로 구독
- [`lib/main.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/main.dart) — `AppPaletteRegistry.install(DefaultPalette())` 호출

**테스트**
- [`test/core/theme/app_palette_registry_test.dart`](https://github.com/storkspear/template-flutter/blob/main/test/core/theme/app_palette_registry_test.dart) — 등록 · 교체 · 중복 에러

**관련 ADR**:
- [`ADR-002 · 3계층 모듈 구조`](./adr-002-layered-modules.md) — 팔레트가 `core/theme/` 에 있는 이유
- [`ADR-001 · GitHub Template + cherry-pick`](./adr-001-template-cherry-pick.md) — 파생 레포가 자체 팔레트 소유하는 맥락
- [`ADR-017 · 4가지 로딩 UX 패턴`](./adr-017-loading-ux.md) — 디자인 시스템 전체의 일관성
