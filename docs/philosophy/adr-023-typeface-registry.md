# Typeface_Registry

**Status**: Accepted. 현재 유효. 2026-04-28 기준 `lib/core/theme/app_typeface.dart` (추상 + DefaultTypeface) + `app_typeface_registry.dart` (중앙 레지스트리 + ValueNotifier). `AppPalette` 패턴(ADR-015) 복제.

## 결론부터

폰트는 **타이페이스 식별자 하나** (`AppTypeface.id`) 와 폰트 패밀리 (`fontFamily` + `fontFamilyFallback`) 만 선언하면 돼요. 사이즈/weight 스케일은 본 추상 클래스가 8 단계 기본 (`headlineLarge` … `labelLarge`) 으로 빌드해줘요. 여러 타이페이스를 [`AppTypefaceRegistry`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_typeface_registry.dart) 에 등록하고 `ValueNotifier` 로 런타임 교체 가능. 파생 레포는 `MyAppTypeface` 하나만 정의 → `AppTypefaceRegistry.install(...)` 한 줄로 폰트 적용. 템플릿 기본값은 시스템 폰트 (`DefaultTypeface`) — 자산은 파생 레포가 결정.

## 왜 이런 고민이 시작됐나?

색상은 ADR-015 ([`Palette_Registry`](./adr-015-palette-registry.md)) 로 앱별 분기가 깔끔히 됐어요. 하지만 같은 시점에 **타이포는 정적**:

- `lib/core/theme/app_typography.dart` 가 `static TextTheme textTheme()` 한 메서드. 사이즈/weight 가 const 로 박힘.
- `assets/fonts/` 디렉토리 자체 없음. `pubspec.yaml` 에 fonts 섹션 없음. 시스템 폰트만 사용.
- 즉 **폰트 패밀리** 를 앱별로 바꾸려면 파일 수정 → cherry-pick 충돌 위험.

이때 산업 데이터를 조사하니 (출처 §Prior Art), **브랜드별 분기가 빈번한 토큰은 색상 ★★★ + 폰트 ★★** 두 가지였어요. radius / spacing / line-height 같은 구조 토큰은 회사 통일이 표준 (★ 거의 없음).

힘들이 부딪혀요.

**힘 A — 폰트는 브랜드 정체성**  
운동 앱은 두꺼운 산세리프, 가계부 앱은 가독성 좋은 모던 산세리프, 콘텐츠 앱은 읽기 편한 본문 폰트. 색상만큼은 아니지만 앱마다 자주 다름.

**힘 B — 솔로 친화 (ADR-019)**  
`AppPalette` 패턴을 그대로 복제하면 한 클래스 정의 + 한 줄 install 로 끝. 학습 비용 작음.

**힘 C — 폰트 자산 결정의 부담**  
어느 폰트 (Pretendard / SUIT / Noto / 시스템) 를 기본으로 둘지, 몇 weight 를 묶을지는 매 앱마다 다른 결정. 템플릿이 미리 결정해두면 cherry-pick 시 자산 충돌 위험. **템플릿은 시스템 폰트를 기본**으로 두고 자산 결정은 파생 레포로 위임하는 게 합리.

이 결정이 답해야 했던 물음이에요.

> **타이포 / 폰트를 앱별로 교체 가능하되, 템플릿 자체는 자산 부담 없이 시스템 폰트로 출발하고, 학습 비용은 색상 패턴과 동일한 구조** 로 만들 수 있는가?

## 고민했던 대안들

### Option 1 — `ThemeExtension` (Flutter 공식)

`ThemeData.extensions` 에 타이포 토큰 클래스 등록 → `Theme.of(context).extension<MyType>()` 로 접근.

- **장점**: Flutter 공식 API. 다크/라이트 모드 보간 (`lerp`) 자동.
- **단점 1**: `lerp` 구현 강제. 폰트 패밀리는 String 이라 보간 의미 없음 — 의무 코드만 늘어남.
- **단점 2**: 런타임 교체 시 `ThemeData` 재구성 필요 → MaterialApp 리빌드 트리거 수동.
- **단점 3**: `AppPalette` 와 패턴이 다름 → 학습 비용 두 배.
- **탈락 이유**: ADR-015 의 결정 근거와 동일. 단순함 vs 공식성에서 단순함 선택.

### Option 2 — `google_fonts` 직접 사용

`google_fonts` 패키지로 런타임 다운로드. 폰트 패밀리 결정만 하면 자산 셋업 불필요.

- **장점**: 셋업 1 줄. Google Fonts 풀 (Noto Sans KR 포함) 즉시 사용.
- **단점 1**: 첫 실행 네트워크 의존. 캐시 없을 때 시스템 폰트 fallback (브랜드 깨짐).
- **단점 2**: 프로덕션은 [`allowRuntimeFetching = false`](https://pub.dev/packages/google_fonts) 권장 → 결국 자산 번들 모드. 즉 패키지 1 개 의존성 + 같은 결정 부담.
- **단점 3**: 추상화 부재. 앱별 폰트 분기를 어떻게 표현할지 별도 정책 필요.
- **탈락 이유**: 추상화 자체를 우회하는 게 아니라 **자산 결정의 위치만** 옮기는 셈. 본 ADR 은 자산 결정을 파생 레포로 위임하므로 패키지 의존성을 강제할 필요 없음. 파생 레포가 원하면 자체 도입.

### Option 3 — `AppTypeface` 추상 + `AppTypefaceRegistry` ★ (채택)

`AppTypeface` 추상 클래스로 필수 항목 (id, name, fontFamily) 만 선언. 사이즈/weight 스케일은 본 추상의 `buildTextTheme()` 이 기본 8 단계 빌드. 여러 타이페이스를 `AppTypefaceRegistry` 에 등록 → `ValueNotifier` 로 현재 타이페이스 트래킹 → `MaterialApp` 이 listenable 구독으로 자동 리빌드.

- **힘 A 만족**: 파생 레포는 `class MyAppTypeface extends AppTypeface` 한 클래스 정의.
- **힘 B 만족**: ADR-015 패턴 복제 — 두 번째 학습 비용 0.
- **힘 C 만족**: `DefaultTypeface()` 시스템 폰트로 출발. 자산 결정은 파생 레포가 필요할 때만.

## 결정

### AppTypeface 추상 클래스

```dart
// lib/core/theme/app_typeface.dart 발췌
abstract class AppTypeface {
  String get id;                                   // 'system' / 'pretendard'
  String get name;                                 // 설정 화면 표시명
  String? get fontFamily => null;                  // null = 시스템 기본
  List<String> get fontFamilyFallback => const []; // 한글 fallback 등

  /// 사이즈/weight 스케일 8 단계를 본인 fontFamily 에 적용.
  /// 사이즈 자체를 바꾸려면 override.
  TextTheme buildTextTheme() { /* headlineLarge 28 ... labelLarge 14 */ }
}

// 템플릿 기본 — 시스템 폰트
class DefaultTypeface extends AppTypeface {
  @override String get id => 'system';
  @override String get name => 'System';
  // fontFamily = null → iOS=SF Pro, Android=Roboto
}
```

### AppTypefaceRegistry

```dart
// lib/core/theme/app_typeface_registry.dart 발췌
class AppTypefaceRegistry {
  static final Map<String, AppTypeface> _typefaces = {};
  static final ValueNotifier<AppTypeface?> _current = ValueNotifier(null);

  static void register(AppTypeface t) { /* id 중복 시 StateError */ }
  static void use(String id) { /* 미등록 시 StateError, 동일 id 재지정 시 알림 X */ }
  static void install(AppTypeface t) { register(t); use(t.id); }

  static AppTypeface get current { /* install 전 호출 시 StateError */ }
  static Listenable get listenable => _current;
  static ValueListenable<AppTypeface?> get currentValue => _current;

  @visibleForTesting
  static void resetForTest() { /* 테스트용 */ }
}
```

### 파생 레포의 사용

```dart
// 파생 레포의 lib/theme/my_app_typeface.dart
class MyAppTypeface extends AppTypeface {
  @override String get id => 'pretendard';
  @override String get name => 'Pretendard';
  @override String? get fontFamily => 'Pretendard';
  @override List<String> get fontFamilyFallback =>
      const ['Apple SD Gothic Neo', 'Noto Sans CJK KR'];
}

// 파생 레포의 lib/main.dart 발췌
AppTypefaceRegistry.install(MyAppTypeface());  // ← 이 한 줄
```

폰트 자산을 같이 추가할 때:

1. `assets/fonts/` 에 ttf 파일 배치 (예: `Pretendard-Regular.ttf` 외 4 weight)
2. `pubspec.yaml` 의 `flutter:` 섹션에 폰트 등록
3. `MyAppTypeface` 의 `fontFamily` 가 pubspec 의 family 와 일치

### MaterialApp 구독 (template 내부)

```dart
// lib/app.dart 맥락
return AnimatedBuilder(
  animation: Listenable.merge([
    AppPaletteRegistry.listenable,
    AppTypefaceRegistry.listenable,
  ]),
  builder: (context, _) => MaterialApp.router(
    theme: AppTheme.light(),  // 내부에서 AppTypography.textTheme() 호출
    darkTheme: AppTheme.dark(),
    routerConfig: _appRouter.router,
  ),
);
```

`AppTypography.textTheme()` 은 `AppTypefaceRegistry.current.buildTextTheme()` 에 위임 — 위젯 코드 입장에서 `Theme.of(context).textTheme.*` 진입 경로는 그대로 (출처 변경 무영향).

### 설계 선택 포인트

**포인트 1 — 색상 패턴 그대로 복제**  
ADR-015 의 `AppPalette` + `AppPaletteRegistry` 와 인터페이스 시그니처가 동일. `register / use / install / current / listenable / resetForTest`. 학습 비용 0 이 명시적 목표.

**포인트 2 — 사이즈/weight 는 추상에 박음, fontFamily 만 게터**  
Material 3 / Apple HIG 의 사이즈 스케일이 산업 표준이고 앱별로 거의 안 다름. 매 앱마다 28dp 를 27dp 로 바꾸지 않음. `buildTextTheme()` 이 기본 8 단계를 빌드 + 본인 `fontFamily` 만 끼워넣음.

**포인트 3 — fontFamilyFallback 명시적 게터**  
한국어 글리프 fallback 을 명확히 의도한 노출. iOS=Apple SD Gothic Neo, Android=Noto Sans CJK KR 등 OS 기본 fallback 의존이 일반적이지만, 라틴+한글 두 폰트 묶음 패턴도 가능하게 인터페이스에서 인정.

**포인트 4 — `DefaultTypeface` 는 시스템 폰트**  
템플릿이 자산을 가지지 않음. cherry-pick 시 자산 충돌 가능성 0. 파생 레포가 폰트 결정 시점에 자산 추가.

**포인트 5 — 설치 전 접근 시 StateError**  
`AppTypefaceRegistry.current` 는 `install` 전에 호출되면 StateError. main.dart 에서 깜빡 실수 즉시 잡음 (`AppPalette` 와 동일 정책).

## 이 선택이 가져온 것

### 긍정적 결과

- **파생 레포 한 줄**: `AppTypefaceRegistry.install(MyAppTypeface())` 만. 나머지 자동.
- **위젯 무수정**: `Theme.of(context).textTheme.*` 경로 그대로. 12 개 공통 위젯 모두 시그니처 변화 없음.
- **테스트 격리**: `resetForTest()` 로 각 테스트가 독립 상태 (10 케이스 신규).
- **자산 부담 0 으로 출발**: 템플릿이 시스템 폰트로 동작 → IPA 변화 없음.
- **`AppPalette` 와 대칭 회복**: 색·폰트 두 토큰만 앱별 분기 라는 깔끔한 모델 (ADR-019 솔로 친화).

### 부정적 결과

- **`fontFamily` 변경 시 자산 별도 추가 필요**: `'Pretendard'` 라고 적었다고 폰트가 마법처럼 들어오지 않음. pubspec.yaml + assets/fonts/ 셋업 필요. 가이드는 [`docs/conventions/theme-tokens.md`](../conventions/theme-tokens.md) 의 "타이포 (폰트) 교체" 섹션 참조.
- **사이즈 스케일은 통일**: 앱별 사이즈 다름이 진짜 필요해지면 `buildTextTheme()` override 로 가능하지만, 그 시점엔 디자인 시스템 자체 재고가 필요할 수도.
- **Variable Font 미검증**: Flutter 모바일 채택률 25~35% (출처 §Prior Art). 본 ADR 은 Static 4 weight 기준. Variable 도입은 향후 별도 ADR.

## 교훈

### 교훈 1 — 패턴 복제는 학습 비용을 0 으로 만든다

`AppPalette` / `AppPaletteRegistry` 가 이미 자리잡은 상태에서 동일 시그니처 (`register / use / install / current`) 로 `AppTypeface` / `AppTypefaceRegistry` 를 만들었더니, 사용자가 새로 익힐 게 없음. 한 패턴이 검증되면 동일 형태로 확장.

**교훈**: 두 번째 추상화는 **첫 번째와 같은 모양으로**. 차이를 만들고 싶으면 진짜 다른 이유가 있을 때만.

### 교훈 2 — "지금 자산 안 가지기" 의 가치

폰트 자산을 템플릿이 미리 결정해두면 cherry-pick 시 분쟁의 씨앗. `DefaultTypeface()` (시스템 폰트) 로 출발 + 자산은 파생 레포가 필요할 때 결정 — 이 게으른 디폴트가 ADR-019 (솔로 친화) 정신과 일치.

**교훈**: 파생 레포가 결정해도 되는 것을 템플릿이 미리 박지 말 것. 추상 자리만 비워두면 됨.

### 교훈 3 — 산업 표준은 따르되, 자기 모델에 맞게 해석

조사 결과 (Material 3 / Apple HIG / IBM Carbon / W3C DTCG) 는 "회사 통일 + 사이즈 변형" 패턴이 표준. 솔로 앱 공장은 "한 회사 N제품" 이 아니라 "독립 브랜드 N개" 라 색·폰트만 분기 + 구조 토큰 통일이라는 변형 모델 채택. 표준을 그대로 따르는 게 아니라 **자기 맥락에 맞춰 변형**.

**교훈**: 산업 표준 = 권위가 아니라 데이터. 자기 모델의 가정 (예: N≤5 솔로 운영) 을 명시하고 그 위에서 표준을 변형.

## 관련 사례 (Prior Art)

- [Material Design 3 — Buttons specs](https://m3.material.io/components/buttons/specs) — 컴포넌트 크기 산업 표준 (Button 48dp, FAB 3 변형)
- [Material Design 3 — Design tokens](https://m3.material.io/foundations/design-tokens) — 색상 중심 토큰화, 사이즈 스케일은 표준 권고
- [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) — 44pt 최소 터치 타겟 + 고정 1 사이즈 원칙
- [IBM Carbon Design System — Button style](https://carbondesignsystem.com/components/button/style/) — sm/md/lg 3 변형 모델
- [W3C Design Tokens Format Module (2025.10 first stable)](https://www.designtokens.org/tr/drafts/format/) — Reference / Semantic / Component 3 계층 + Theme variant 표준
- [Flutter `ThemeExtension`](https://api.flutter.dev/flutter/material/ThemeExtension-class.html) — 본 ADR 이 채택하지 않은 Flutter 공식 대안
- [`google_fonts` package](https://pub.dev/packages/google_fonts) — 본 ADR 이 채택하지 않은 런타임 다운로드 대안
- [Pretendard](https://github.com/orioncactus/pretendard) / [SUIT](https://noonnu.cc/en/font_page/845) / [Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) / [Spoqa Han Sans Neo](https://spoqa.github.io/spoqa-han-sans/en-US/) — 한국어 무료 폰트 (모두 SIL OFL 1.1)
- [Flutter fonts cookbook](https://docs.flutter.dev/cookbook/design/fonts) — assets 정적 번들 셋업 가이드

## Code References

**타이페이스 인프라**
- [`lib/core/theme/app_typeface.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_typeface.dart) — 추상 + DefaultTypeface
- [`lib/core/theme/app_typeface_registry.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_typeface_registry.dart) — 중앙 레지스트리

**연동 지점**
- [`lib/core/theme/app_typography.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/theme/app_typography.dart) — `Registry.current.buildTextTheme()` 로 위임
- [`lib/app.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/app.dart) — `AnimatedBuilder` + `Listenable.merge` 로 팔레트/타이페이스 동시 watch
- [`lib/main.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/main.dart) — `AppTypefaceRegistry.install(DefaultTypeface())` 호출

**테스트**
- [`test/core/theme/app_typeface_registry_test.dart`](https://github.com/storkspear/template-flutter/blob/main/test/core/theme/app_typeface_registry_test.dart) — 등록 / 교체 / 중복 에러 / listenable
- [`test/core/theme/app_typography_test.dart`](https://github.com/storkspear/template-flutter/blob/main/test/core/theme/app_typography_test.dart) — Registry 위임 + 사이즈 스케일 회귀

**관련 ADR**:
- [`ADR-015`](./adr-015-palette-registry.md) — 본 ADR 이 복제한 패턴 원본 (색상)
- [`ADR-019`](./adr-019-solo-friendly.md) — 솔로 친화 — 자산 부담 0 으로 출발하는 디폴트의 근거
- [`ADR-002`](./adr-002-layered-modules.md) — 타이페이스가 `core/theme/` 에 있는 이유
