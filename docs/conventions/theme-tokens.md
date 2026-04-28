# Theme Tokens 컨벤션

새 위젯이나 화면을 만들 때 색·간격·타이포·아이콘을 **어디서 가져오는가** 의 규칙. 위젯이 다크/라이트 자동 적응하고, 팔레트 교체 시 자동 리빌드되려면 출처 선택이 일관돼야 해요. 규약 근거는 [`ADR-015 · 팔레트 런타임 교체`](../philosophy/adr-015-palette-registry.md) 참조.

---

## 결론부터

| 토큰 | 게터 | 다크 자동 적응 |
|---|---|---|
| Material 3 톤 (primary · secondary · error · outline · surface*) | `Theme.of(context).colorScheme.*` | 예 |
| 시맨틱 (success · warning · info · error 배경) | `AppPaletteRegistry.current.*` | 아니오 — 단일 색 |
| 브랜드 시드 / accent | `AppPaletteRegistry.current.seed` / `.accent` | 아니오 |
| 간격 · 라운딩 · 컴포넌트 크기 | `AppSpacing.*` | 해당 없음 |
| 타이포 | `Theme.of(context).textTheme.*` | 자동 |
| 아이콘 | `AppIcons.*` | 해당 없음 |

기본 규칙: **다크 자동 적응이 필요하면 `Theme.of(context)`** , 브랜드 결정 색이면 `AppPaletteRegistry.current` .

---

## 분기 규칙

### `Theme.of(context).colorScheme.*` 를 써요

Material 3 의 `ColorScheme.fromSeed` 가 시드 한 개에서 라이트 / 다크 두 개 톤 세트를 자동 생성하기 때문이에요. 시스템 모드를 따라 `Theme.of` 가 알맞은 쪽을 돌려줘요.

- **에러 색 톤**: `colorScheme.error` (다크에선 부드러운 빨강, 라이트에선 진한 빨강 — 자동)
- **버튼 / 강조 면**: `colorScheme.primary` , `colorScheme.onPrimary`
- **카드 / 섹션 배경**: `colorScheme.surface` , `colorScheme.surfaceContainer*`
- **구분선 / 비활성 텍스트**: `colorScheme.outline` , `colorScheme.onSurfaceVariant`

### `AppPaletteRegistry.current.*` 를 써요

ColorScheme 외부의 색상을 **브랜드가 결정** 하는 경우에 한정해요.

- **success / warning / info / error (배경 사용 한정)**: 알림 / 토스트 / 배지의 강한 색.
- **seed 직접**: 차트 라인 색, 네비 활성 표시 등 **브랜드 톤 그대로** 노출하려는 경우.
- **accent / textMuted / border**: 디자인 시스템 외 보조 톤.

> ⚠️ 시맨틱 색상은 다크 변형이 없어요. **배경으로만** 쓰고 텍스트는 흰색 / 검은색 분기로 대비 확보. 다크에서 가독성이 중요한 텍스트라면 `colorScheme.error` 같은 M3 톤이 우선.

---

## 그라운드 사례 (현 코드 인용)

```dart
// lib/core/widgets/app_dialog.dart 발췌
backgroundColor: Theme.of(context).colorScheme.error,  // M3 톤 — 라이트/다크 자동
```

```dart
// lib/core/widgets/error_view.dart 발췌
Icon(AppIcons.error, size: 64, color: theme.colorScheme.error),  // 동일
```

```dart
// lib/core/widgets/app_snackbar.dart 발췌
final p = AppPaletteRegistry.current;  // semantic 배경 — 브랜드 결정
return switch (type) {
  SnackBarType.success => (LucideIcons.circleCheck, p.success),
  SnackBarType.warning => (LucideIcons.triangleAlert, p.warning),
  SnackBarType.error   => (LucideIcons.circleX,      p.error),
};
```

```dart
// lib/kits/charts_kit/app_line_chart.dart 발췌
final color = lineColor ?? AppPaletteRegistry.current.seed;  // 브랜드 시드 직접
```

---

## 새 위젯 체크리스트

새 `app_*.dart` 또는 kit UI 위젯을 만들 때:

- [ ] 색상 출처를 위 표대로 분기.
- [ ] 간격은 `AppSpacing.xs/sm/md/lg/xl/xxl` 토큰만. 매직 넘버 (e.g. `padding: 17`) 금지.
- [ ] 라운딩은 `AppSpacing.borderRadiusSm/Md/Lg` .
- [ ] 타이포는 `Theme.of(context).textTheme.*` . `TextStyle(fontSize: 14, ...)` 직접 작성 금지.
- [ ] 아이콘은 `AppIcons.*` 참조 (Lucide 어댑터). raw `Icons.*` 금지.
- [ ] 다크모드 분기를 직접 `Theme.of(context).brightness` 로 하기 전에, `Theme.of(context)` 게터가 자동 적응해주는 색이 있는지 먼저 확인.
- [ ] 컴포넌트 크기 (`buttonHeight` , `iconSize*` , `avatarSize*`) 는 `AppSpacing` 의 정수 토큰 사용.

---

## 흔한 실수

**(1) `colorScheme.error` 와 `palette.error` 혼용**  
같은 빨강이지만 출처가 달라요. M3 톤이 자동 적응하므로 **텍스트 / 아이콘 색** 은 `colorScheme.error` , **알림 배경** 은 `palette.error` .

**(2) `Theme.of(context).primaryColor` 사용**  
deprecated. M3 에서는 `colorScheme.primary` 를 써요.

**(3) 카드 배경에 `cardBackground` 직접 참조**  
`AppPalette.cardBackground` / `cardBackgroundDark` 는 **파생 레포 확장점** 으로만 살려두는 게터예요 (ADR-015 참조). 템플릿 위젯은 `colorScheme.surface*` 계열을 써요.

**(4) `AppPaletteRegistry.current` 캐싱**  
한 위젯에서 여러 번 쓸 땐 빌드 메서드 시작에서 한 번 받아 변수에 담아요. 단, 다른 빌드 사이클로 캐싱하면 팔레트 교체 시 stale.

```dart
@override
Widget build(BuildContext context) {
  final palette = AppPaletteRegistry.current;  // 빌드 1회
  // ... palette.seed, palette.success 등 반복 사용
}
```

---

## 새 토큰을 추가할 때

`AppSpacing` / `AppPalette` 에 새 토큰을 추가하려면:

1. **이름이 일관**: `AppSpacing.xs/sm/md/lg/xl/xxl` 같은 스케일을 깨지 마세요.
2. **다크 변형 필요**: 변형이 다르면 게터 두 개로 (`xxxLight` / `xxxDark`) 또는 `Theme.of(context).brightness` 로 분기.
3. **palette 게터 추가는 신중**: 시맨틱이 명확하지 않으면 위젯 인자로 외부 주입하는 쪽이 나아요.
4. **테스트**: `app_palette_registry_test.dart` 에 새 게터 기본값 검증 한 줄 추가.

---

## 타이포 (폰트) 교체

폰트 패밀리는 `AppTypeface` + `AppTypefaceRegistry` 로 앱별 분기해요 ([`ADR-023`](../philosophy/adr-023-typeface-registry.md)). 템플릿 기본은 시스템 폰트 (iOS=SF Pro, Android=Roboto) 라 자산 부담 0 으로 출발.

파생 레포가 자체 폰트로 교체하려면:

1. **자산 추가**: `assets/fonts/` 디렉토리에 ttf 파일 배치 (예: `Pretendard-Regular.ttf` 외 4 weight).
2. **`pubspec.yaml`** 의 `flutter:` 섹션에 폰트 등록.
   ```yaml
   flutter:
     fonts:
       - family: Pretendard
         fonts:
           - asset: assets/fonts/Pretendard-Regular.ttf
             weight: 400
           - asset: assets/fonts/Pretendard-Medium.ttf
             weight: 500
           - asset: assets/fonts/Pretendard-Bold.ttf
             weight: 700
           - asset: assets/fonts/Pretendard-Black.ttf
             weight: 900
   ```
3. **`MyAppTypeface`** 정의 (`lib/theme/my_app_typeface.dart`).
   ```dart
   class MyAppTypeface extends AppTypeface {
     @override String get id => 'pretendard';
     @override String get name => 'Pretendard';
     @override String? get fontFamily => 'Pretendard';
     @override List<String> get fontFamilyFallback =>
         const ['Apple SD Gothic Neo', 'Noto Sans CJK KR'];
   }
   ```
4. **`main.dart`** 에서 install — `DefaultTypeface` 대신 `MyAppTypeface`.
   ```dart
   AppTypefaceRegistry.install(MyAppTypeface());
   ```

사이즈 / weight 스케일을 바꾸려면 `buildTextTheme()` 을 override. 단 산업 표준 (Material 3 / Apple HIG) 에서 사이즈 스케일은 회사 통일이 일반적이라 변경 신중.

### 한국어 무료 폰트 후보 (모두 SIL OFL 1.1)

| 폰트 | 4 weight 합 | Variable | 비고 |
|---|---|---|---|
| SUIT | ~680 KB | 1.5 MB (9 weight) | 최경량 |
| Pretendard | ~1.5 MB | 6.5 MB (9 weight) | Inter 기반, 한국 인디 표준 |
| Spoqa Han Sans Neo | ~1.8 MB | 미지원 | 클래식 |
| Noto Sans KR | ~19.7 MB | △ (CJK) | 글리프 완전, subsetting 필요 |

자세한 비교 / 출처는 [`ADR-023`](../philosophy/adr-023-typeface-registry.md) §Prior Art.

---

## 이번에 안 한 것 (의도)

다음은 의도적으로 도입하지 않았어요. 솔로 친화 (ADR-019) + 산업 표준 데이터에 따라.

- **`AppDimens` / 간격·radius·buttonHeight 추상화** — 산업 표준은 이런 구조 토큰을 회사 전체 통일. 앱별 분기 빈도 ★ 거의 없음. 변경 거의 없으므로 cherry-pick 부담 극히 적음. 진짜 필요해지면 그때 ADR 로 추가.
- **컴포넌트 사이즈 변형 (`size: sm/md/lg`)** — Carbon/Polaris 패턴이지만 12 개 위젯 시그니처 변경 = cherry-pick 안전성 ↓. 실증 후 재고.
- **Variable Font 도입** — Flutter 모바일 채택률 25~35%, 본 레포 미검증. Static 4 weight 가 실무 안전망.
- **Storybook (Widgetbook)** — 위젯 12 개 규모에 카탈로그 인프라 과함.
- **Dark/Light별 폰트 분기** — brightness 와 폰트는 무관.
- **다국어 폰트 자동 분기 (KR vs EN)** — 한국어 폰트가 라틴 글리프 보유.

---

## 관련

- [`ADR-015 · 팔레트 런타임 교체`](../philosophy/adr-015-palette-registry.md) — 팔레트 분리 / 런타임 교체의 근거
- [`ADR-023 · 폰트 런타임 교체`](../philosophy/adr-023-typeface-registry.md) — 타이페이스 분리 / 런타임 교체의 근거
- [`ADR-002 · 3계층 모듈 구조`](../philosophy/adr-002-layered-modules.md) — 토큰이 `core/theme/` 에 있는 이유
- [`ADR-019 · 솔로 친화적 운영`](../philosophy/adr-019-solo-friendly.md) — 토큰 추상화 한계선의 상위 기준
- [`Loading UX`](./loading-ux.md) — 로딩 상태 위젯이 따라야 할 별도 규약
