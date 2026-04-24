# ADR-017 · 4가지 로딩 UX 패턴

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/core/widgets/` 에 `SkeletonLoading` · `TopProgressBar` · `LoadingView` · `PrimaryButton` (스피너 내장) 등 로딩 관련 위젯. `skeletonizer` 패키지 기반.

## 결론부터

로딩 상황을 **4가지 UX 패턴** 으로 규약화했어요 — **Skeleton** (첫 진입) · **Pull-to-refresh** (새로고침) · **버튼 스피너 + IgnorePointer** (버튼 액션) · **TopProgressBar** (백그라운드 작업). **풀스크린 블로킹 스피너 금지**. 각 패턴이 다른 맥락에 쓰여서, 개발자가 "지금 어떤 로딩?" 만 판단하면 자연스럽게 통일된 UX 가 나와요.

## 왜 이런 고민이 시작됐나?

로딩 UX 가 일관되지 않으면 같은 앱 안에서도 **화면마다 다른 경험** 이 생겨요.

- 홈 화면: 풀스크린 `CircularProgressIndicator`
- 설정 화면: skeleton
- 프로필 화면: 아무것도 없이 빈 화면
- 로그인 버튼 누르면: 전체 UI 가 회색 오버레이 + 스피너

이런 **뒤섞인 경험** 은 프로답지 못하고, 무엇보다 **개발자가 매번 "이번엔 어떻게?"** 결정해야 해서 시간 소모. 압력들이 부딪혀요.

**압력 A — UX 일관성**  
같은 앱에서 같은 종류의 로딩은 같은 UI. 화면 별 편차가 있으면 브랜드 인상 저하.

**압력 B — 맥락별 적절한 피드백**  
"첫 진입" 과 "버튼 눌러서 저장" 은 다른 맥락. 같은 스피너 UI 로 처리하면 어색. 맥락별 패턴 필요.

**압력 C — 풀스크린 블로킹의 UX 저해**  
풀스크린 오버레이 + 스피너는 "앱이 멈춘 것처럼 느껴짐" — 사용자가 뒤로가기 · 다른 탭으로 이탈 시도. 모바일 UX 금기 중 하나.

**압력 D — 개발자의 결정 피로**  
매번 "이 화면엔 어떤 로딩?" 이 되면 시간 소모. 몇 개 패턴으로 **선택지를 강제로 좁혀** 야 결정 비용 낮아짐.

이 결정이 답해야 했던 물음이에요.

> **모든 로딩 상황을 몇 개 패턴으로 축소하되, 패턴 안에서 맥락별 적절한 피드백을 제공하려면 어떻게 하는가?**

## 고민했던 대안들

### Option 1 — 각 화면이 자유롭게

디자인 가이드 없이 개발자가 매번 선택.

- **장점**: 유연.
- **단점 1**: 일관성 상실. 앱 내 UX 편차.
- **단점 2**: 결정 피로 누적.
- **탈락 이유**: 압력 A · D 정면 위반.

### Option 2 — 풀스크린 스피너 한 가지

모든 로딩에 `Center(child: CircularProgressIndicator())`.

- **장점**: 결정 제로.
- **단점 1**: 압력 C 정면 위반. 풀스크린 블로킹이 모든 맥락에 과해요.
- **단점 2**: 버튼 누른 직후 갑자기 화면 전체가 회색 → UX 불친절.
- **탈락 이유**: 맥락을 무시한 획일화.

### Option 3 — 4가지 패턴 규약화 ★ (채택)

맥락별로 4개 패턴 선택. 그 밖의 케이스는 "이 4개 중 무엇에 해당?" 판단.

- **압력 A 만족**: 같은 맥락 → 같은 패턴 → 일관성.
- **압력 B 만족**: 맥락별 적절한 피드백.
- **압력 C 만족**: 풀스크린 스피너 금지.
- **압력 D 만족**: 4개 선택지만 있음 → 결정 짧게.

## 결정

### 4가지 패턴

| 맥락 | 패턴 | 위젯 | 왜 이걸? |
|------|------|------|---------|
| **첫 진입** (목록 · 상세 처음 로딩) | Skeleton | `SkeletonLoading` | 레이아웃 유지 → 콘텐츠 위치 예측 가능 |
| **새로고침** (이미 데이터 있음) | Pull-to-refresh | `RefreshIndicator` | 사용자 주도 액션 → 즉각 피드백 |
| **버튼 액션** (로그인 · 저장) | 버튼 스피너 + IgnorePointer | `PrimaryButton(loading: true)` | 동작 중임을 버튼에 국한 |
| **백그라운드** (동기화 · 업로드) | TopProgressBar | `TopProgressBar` | 앱 사용 계속 가능 + 작업 중 표시 |

### 1. Skeleton (첫 진입)

```dart
// 사용 예
SkeletonLoading(
  enabled: isLoading,
  child: ListView.builder(
    itemCount: items.isEmpty ? 6 : items.length,  // 로딩 중엔 더미 6개
    itemBuilder: (_, i) => ListTile(
      title: Text(items.isEmpty ? 'Placeholder' : items[i].title),
      subtitle: Text(items.isEmpty ? 'Placeholder subtitle' : items[i].subtitle),
    ),
  ),
)
```

`skeletonizer` 패키지가 자동으로 shimmer 효과 + 텍스트 blur. **실제 UI 레이아웃** 이 그대로 유지돼서 로딩 완료 시 요소가 튀지 않음.

**금지**: 별도 스켈레톤 위젯 작성. `SkeletonBox(...)` 같은 것 만들지 말고 **실제 위젯을 그대로 쓰면서 enabled 로 감쌈**.

### 2. Pull-to-refresh (새로고침)

```dart
RefreshIndicator(
  onRefresh: () => ref.read(myViewModelProvider.notifier).refresh(),
  child: ListView(children: [...]),
)
```

사용자가 **명시적으로 당겨야** 작동. 진행률 표시는 `RefreshIndicator` 가 자동 — 개발자 추가 코드 없음.

### 3. 버튼 스피너 + IgnorePointer

```dart
PrimaryButton(
  label: S.of(context).save,
  loading: state.isLoading,         // ← true 면 내부 스피너 + IgnorePointer
  onPressed: () => vm.save(),
)
```

`PrimaryButton` 위젯이 내부적으로:
- 스피너 표시 (label 대신)
- `IgnorePointer` 로 중복 탭 방지

전체 화면 오버레이 없음. **버튼만 "작업 중" 상태** 로 표현 — 사용자는 다른 필드 수정 등 계속 가능.

### 4. TopProgressBar (백그라운드)

```dart
Scaffold(
  appBar: AppBar(
    title: Text('홈'),
    bottom: TopProgressBar(visible: state.isSyncing, value: state.syncProgress),
  ),
  body: ...,
)
```

AppBar 하단의 얇은 선형 progress. **0% / 지정값 / indeterminate** 모두 지원. 사용자는 계속 앱 사용 가능, 작업 진행이 시각적으로만.

### 금지 사항

- ❌ 풀스크린 스피너 오버레이 (회색 배경 + 가운데 CircularProgressIndicator) — "앱 멈춤" 같은 UX
- ❌ 버튼 옆에 별도 스피너 위젯 — 버튼 내부에 통합이 더 깔끔
- ❌ `null` 데이터에 `Text('')` — skeleton 또는 `EmptyView` 명시적 사용

### 설계 선택 포인트

**포인트 1 — Skeleton 은 "실제 위젯 + 더미 데이터"**  
`SkeletonBox(width: 200, height: 20)` 같이 **별도 스켈레톤 위젯** 만들지 않음. 실제 `ListTile` 을 더미 데이터로 채우고 `SkeletonLoading(enabled: true)` 로 감싸기. 이유: 실제 위젯과 로딩 위젯이 **같은 레이아웃** 이라 완료 시 튐 없음.

**포인트 2 — 버튼 스피너는 `PrimaryButton` 내부에**  
버튼 옆에 별도 스피너 위젯 두면 레이아웃이 왔다갔다. 버튼 내부에 스피너 integrate → 버튼 크기 불변 + 라벨만 교체.

**포인트 3 — `TopProgressBar` 는 백그라운드 전용**  
사용자 명시적 액션은 버튼 스피너, 사용자 모르게 자동 처리는 TopProgressBar. 이 구분이 "개입 여부" 신호.

**포인트 4 — 로딩 상태는 ViewModel 에 bool**  
`state.isLoading: bool`. 복잡한 `Status.idle / loading / error / success` enum 도 가능하지만 대부분 bool 로 충분. 에러는 별도 `errorCode` 필드.

**포인트 5 — EmptyView 는 로딩과 구분**  
"데이터 없음" 은 로딩 아님. 별도 `EmptyView(message, icon, action)` 위젯. 로딩 → 데이터 없음 → `EmptyView` 명시적 전환.

## 이 선택이 가져온 것

### 긍정적 결과

- **앱 전체 UX 일관**: 모든 화면의 로딩이 4가지 중 하나. 사용자가 패턴 학습 후 예상 가능.
- **결정 피로 감소**: "이 화면 로딩?" → "4개 중 무엇?" 으로 축소.
- **풀스크린 블로킹 원천 차단**: 없음. 모든 로딩이 비-블로킹.
- **버튼 이중 탭 방지**: `PrimaryButton(loading: true)` 이 IgnorePointer 포함.
- **Skeleton 으로 레이아웃 튐 없음**: 로딩 완료 시 요소 크기가 그대로 확정.

### 부정적 결과

- **4가지 분류가 애매한 케이스**: "폼 제출 중 필드 불활성화" 는 버튼 스피너? 전체 IgnorePointer? 경계 모호.
- **Skeleton 더미 데이터 관리 피로**: `items.isEmpty ? placeholder : items[i]` 같은 조건문 반복. helper 추출 가능.
- **`PrimaryButton` 외 버튼 쓸 때**: 본 템플릿의 `PrimaryButton` 만 스피너 내장. `OutlinedButton` · `TextButton` 에도 같은 기능이 필요하면 각각 wrapper 필요.
- **TopProgressBar 를 어디에 둘지 결정**: AppBar bottom? Scaffold persistentFooterButtons? 규약은 AppBar bottom 이지만 실수 가능.

## 교훈

### 교훈 1 — "선택지를 좁히는 것" 이 디자인

개발자는 자유를 원하지만, **일관성은 선택지 축소** 에서 나와요. "원하는대로 하세요" 가 아니라 "이 4개 중 고르세요" 가 디자인 시스템의 본질. 제약이 오히려 속도를 높임.

**교훈**: 디자인 시스템의 가치는 **"뭘 허용" 이 아니라 "뭘 금지"**. 금지된 패턴이 명확할수록 일관성.

### 교훈 2 — 풀스크린 스피너는 UX 재앙

처음엔 간단하다고 `Center(CircularProgressIndicator())` 를 풀스크린으로. 사용자 테스트에서 "앱이 멈춘 것 같다" · "뒤로가기 눌렀다" 피드백. 버튼 내 스피너 + IgnorePointer 조합으로 바꾸자 **이탈률 감소**.

**교훈**: 모바일 UX 에선 **"사용자가 계속 컨트롤 가능한" 느낌** 이 중요. 전체 블로킹은 최후 수단.

### 교훈 3 — Skeleton 은 실제 UI 를 복제하지 말고 감쌀 것

초기엔 `SkeletonListItem` 같은 별도 위젯 작성. 실제 `ListItem` 업데이트 시 Skeleton 도 같이 수정해야 — **중복 유지 부담**. `Skeletonizer(enabled: true, child: 실제위젯)` 방식이 DRY + 레이아웃 일치.

**교훈**: Skeleton 은 **"더미가 아니라 실제 + 효과"**. shimmer 효과가 텍스트 / 이미지를 자동 처리.

## 관련 사례 (Prior Art)

- [Material Design 3 — Progress indicators](https://m3.material.io/components/progress-indicators/overview) — 공식 가이드
- [Skeletonizer 패키지](https://pub.dev/packages/skeletonizer) — 본 ADR 이 채택한 라이브러리
- [Nielsen Norman Group — Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/) — 0.1s / 1s / 10s 경계와 UX
- [Apple Human Interface Guidelines — Loading](https://developer.apple.com/design/human-interface-guidelines/loading) — iOS 관용
- [Android Material Design 의 ProgressIndicator](https://m3.material.io/components/progress-indicators/implementation/android)

## Code References

**4가지 패턴 위젯**
- [`lib/core/widgets/skeleton_loading.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/skeleton_loading.dart) — Skeletonizer 래퍼
- [`lib/core/widgets/top_progress_bar.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/top_progress_bar.dart) — AppBar 하단 progress
- [`lib/core/widgets/primary_button.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/primary_button.dart) — 스피너 내장 버튼
- [`lib/core/widgets/loading_view.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/loading_view.dart) — 스플래시 등 특수 케이스

**기타 상태 위젯**
- [`lib/core/widgets/empty_view.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/empty_view.dart) — 데이터 없음
- [`lib/core/widgets/error_view.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/widgets/error_view.dart) — 에러 상태

**사용 예시**
- [`lib/common/router/app_router.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/router/app_router.dart) — splash 라우트에서 `LoadingView` 사용
- [`lib/kits/auth_kit/ui/login/login_screen.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/ui/login/login_screen.dart) — `PrimaryButton(loading: ...)` 사용

**관련 ADR**:
- [`ADR-002 · 3계층 모듈 구조`](./adr-002-layered-modules.md) — 위젯이 `core/widgets/` 에 있는 이유
- [`ADR-005 · Riverpod + MVVM`](./adr-005-riverpod-mvvm.md) — `state.isLoading` 을 ViewModel 이 관리
- [`ADR-015 · 팔레트 런타임 교체`](./adr-015-palette-registry.md) — 로딩 위젯의 색상 (progress tint 등) 이 팔레트 기반
