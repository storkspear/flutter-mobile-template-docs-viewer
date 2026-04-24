# Loading UX 통합 설계

> 모든 앱에서 일관된 로딩 경험을 제공하기 위한 규약 + 위젯 설계.

---

## 배경

템플릿에 로딩 위젯(LoadingView, SkeletonLoading, PrimaryButton.isLoading)은 있지만,
"어떤 상황에서 어떤 로딩을 쓰라"는 규약이 없다.
fork 후 개발자가 매번 판단하면 앱마다 UX가 달라진다.

---

## 범위

### 포함

1. 로딩 패턴 분류표 (규약)
2. `TopProgressBar` 위젯 신규 구현
3. `flutter_native_splash` 패키지 설정
4. 스켈레톤 로딩 작성 가이드 (규약)
5. UI 작업 가이드 (fork 후 화면 개발 시 체크리스트)
6. `docs/conventions/loading.md` 규약 문서

### 제외

- 오버레이 로딩 (트렌드상 불필요. 버튼 스피너 + 폼 비활성화로 대체)
- 앱(서비스) 스플래시 수정 (현재 SplashScreen은 이미 잘 동작)
- 공통 래퍼 Scaffold (과도한 추상화)
- 스켈레톤 프리셋 위젯 (Skeletonizer가 자동 생성하므로 불필요)

---

## 1. 로딩 패턴 분류표

| 상황 | 패턴 | 위젯 | 비고 |
|------|------|------|------|
| 화면 첫 진입 (데이터 로딩) | Skeleton | `SkeletonLoading` + 실제 레이아웃 | 화면 채움 기준 더미 아이템 |
| 당겨서 새로고침 | Pull-to-refresh 스피너 | `RefreshIndicator` (Flutter 기본) | 코드 예시만 |
| 버튼 액션 (저장/삭제) | 버튼 내 스피너 + 폼 비활성화 | `PrimaryButton.isLoading` + `IgnorePointer` | 이미 있음 |
| 백그라운드 갱신 (비차단) | 최상단 선형 프로그레스 | `TopProgressBar` (신규) | 토스 스타일, status bar 아래 |
| 무한 스크롤 추가 로딩 | 하단 스피너 | `CircularProgressIndicator` | PaginationController 연동, 코드 예시만 |

### 사용하지 않는 패턴

- **풀스크린 블로킹 오버레이**: 촌스럽고 UX 저해. 버튼 스피너 + IgnorePointer로 대체.
- **되돌릴 수 없는 중요 액션(결제/송금)**: 오버레이 대신 전용 처리 화면으로 이동. fork 후 도메인별 구현.

---

## 2. TopProgressBar 위젯

### 목적

백그라운드 데이터 갱신 시 화면 최상단에 가는 선형 프로그레스를 표시한다.
사용자 인터랙션을 차단하지 않으면서 "갱신 중"임을 알린다.

### API

```dart
class TopProgressBar extends StatelessWidget {
  /// true이면 프로그레스 바 표시.
  final bool isLoading;

  /// 프로그레스 바 아래에 표시할 child (보통 Scaffold).
  final Widget child;

  /// 프로그레스 바 색상. 미지정 시 colorScheme.primary.
  final Color? color;
}
```

### 구현

- `Stack`으로 child 위에 `LinearProgressIndicator` 배치.
- `SafeArea`로 status bar 아래에 위치 (토스 스타일).
- `isLoading=false`이면 `SizedBox.shrink()`.
- 높이: Material 3 기본 (4px).
- 애니메이션: `AnimatedSwitcher`로 fade in/out.

### 사용 예시

```dart
TopProgressBar(
  isLoading: state.isRefreshing,
  child: Scaffold(
    appBar: AppBar(title: Text('목록')),
    body: ListView(...),
  ),
)
```

### 파일 위치

`lib/common/widgets/top_progress_bar.dart`

---

## 3. 네이티브 스플래시

### 목적

앱 시작 시 Flutter 엔진 초기화 중에 표시되는 OS 레벨 스플래시.
회사/브랜드 로고를 보여주며, 모든 앱에서 동일하다.

### 진입 플로우

```
1. 네이티브 스플래시 (OS 레벨) — flutter_native_splash
   - 회사 로고
   - Flutter 엔진 초기화 중 표시
   - 0.5~1초

2. 앱 스플래시 (Flutter 레벨) — 현재 SplashScreen (수정 없음)
   - 서비스 로고/브랜딩
   - 토큰 검증, 필수 데이터 로딩
   - 최소 1초 보장
   - 완료 후 → /home 또는 /login
```

### 설정

- `flutter_native_splash` 패키지를 `dev_dependencies`에 추가.
- 프로젝트 루트에 `flutter_native_splash.yaml` 생성:

```yaml
flutter_native_splash:
  color: "#FFFFFF"
  image: assets/splash/logo.png
  android_12:
    image: assets/splash/logo.png
    color: "#FFFFFF"
```

- `assets/splash/` 디렉토리에 placeholder 이미지 배치.

### 이미지 사이즈 가이드

| 용도 | 파일 | 권장 크기 | 비고 |
|------|------|-----------|------|
| 스플래시 로고 | `assets/splash/logo.png` | 1152x1152px | 중앙 288px 영역이 안전 영역. 여백 충분히 확보 |
| Android 12+ | 동일 파일 사용 | 동일 | `android_12` 설정으로 자동 적용 |

> **안전 영역**: Android 12의 adaptive icon은 중앙 1/3만 마스킹 없이 표시된다.
> 1152px 기준 중앙 384px 이내에 핵심 로고를 배치해야 잘리지 않는다.

### 생성 명령

```bash
dart run flutter_native_splash:create
```

### fork 후 체크리스트 추가 항목

- `assets/splash/logo.png` 교체 (회사 로고)
- `flutter_native_splash.yaml`의 `color` 변경 (브랜드 배경색)
- `dart run flutter_native_splash:create` 재실행

---

## 4. 스켈레톤 로딩 작성 가이드

Skeletonizer가 실제 위젯을 자동으로 뼈대로 변환하므로, 별도 스켈레톤 레이아웃을 만들지 않는다.

### 규칙 1: 실제 레이아웃과 동일한 구조를 쓴다

```dart
// 좋은 예: 실제 화면 구조 그대로
SkeletonLoading(
  enabled: isLoading,
  child: ListView.builder(
    itemCount: 6,
    itemBuilder: (_, i) => MyActualListTile(item: dummyItem),
  ),
)

// 나쁜 예: 스켈레톤 전용 레이아웃을 따로 만듦
if (isLoading) SkeletonLayout() else ActualLayout()
```

### 규칙 2: 더미 아이템 개수는 화면 채움 기준

- 리스트: 화면에 보이는 만큼 (보통 5~8개)
- 카드 그리드: 4~6개
- 상세 화면: 실제 레이아웃 1개

### 규칙 3: 뼈대 형태 매칭

Skeletonizer가 위젯 타입에 따라 자동으로 변환한다:

| 위젯 | 뼈대 형태 |
|------|-----------|
| `Text` | 사각형 (자동) |
| `CircleAvatar` | 원형 (자동) |
| `ClipRRect` / `Image` | 모서리 둥근 사각형 (자동) |
| `Icon` | 사각형 (자동) |

### 규칙 4: Bone 위젯으로 미세 조정

특정 영역의 뼈대 형태를 직접 지정하고 싶을 때:

```dart
Bone.text(words: 3)    // 3단어 길이 텍스트 뼈대
Bone.circle(size: 48)  // 48px 원형 뼈대
Bone.square(size: 80)  // 80px 사각형 뼈대
```

---

## 5. UI 작업 가이드 — 화면 개발 시 로딩 체크리스트

새 화면을 만들 때 아래 순서로 로딩 처리를 결정한다.

```
1. 이 화면에 데이터 로딩이 있는가?
   ├─ Yes → SkeletonLoading으로 첫 로딩 처리
   └─ No  → 로딩 불필요 (settings 같은 정적 화면)

2. 데이터 갱신(새로고침)이 가능한가?
   ├─ 사용자가 직접 → RefreshIndicator 감싸기
   └─ 자동/백그라운드 → TopProgressBar 사용

3. 목록이 페이지네이션인가?
   ├─ Yes → PaginationController + 하단 스피너
   └─ No  → 전체 로딩 1회

4. 폼 제출 액션이 있는가?
   ├─ Yes → PrimaryButton.isLoading + IgnorePointer로 폼 비활성화
   └─ No  → 해당 없음

5. 로딩 실패 시?
   ├─ 목록 화면 → ErrorView + 재시도 버튼
   └─ 단건 액션 → AppSnackBar(type: error)
```

### 전형적인 데이터 목록 화면 코드 구조

```dart
class ItemListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(itemListProvider);

    // 1. 첫 로딩 → 스켈레톤
    if (state.isFirstLoad) {
      return SkeletonLoading(enabled: true, child: _buildList(dummyItems));
    }

    // 2. 에러 → ErrorView
    if (state.error != null && state.items.isEmpty) {
      return ErrorView(
        message: S.of(context).errorLoadFailed,
        onRetry: () => ref.read(itemListProvider.notifier).loadFirst(),
      );
    }

    // 3. 비어있음 → EmptyView
    if (state.items.isEmpty) {
      return EmptyView(title: S.of(context).emptyMessage);
    }

    // 4. 데이터 있음 → 새로고침 가능 목록
    return TopProgressBar(
      isLoading: state.isRefreshing,
      child: RefreshIndicator(
        onRefresh: () => ref.read(itemListProvider.notifier).refresh(),
        child: _buildList(state.items),
      ),
    );
  }
}
```

### 폼 제출 패턴

```dart
// IgnorePointer로 폼 전체 입력 차단 + 버튼 스피너
IgnorePointer(
  ignoring: state.isLoading,
  child: Column(
    children: [
      AppTextField(controller: _emailCtrl),
      AppTextField(controller: _passwordCtrl),
      PrimaryButton(
        text: S.of(context).save,
        isLoading: state.isLoading,
        onPressed: () => viewModel.submit(),
      ),
    ],
  ),
)
```

### 무한 스크롤 하단 로딩

```dart
// 리스트 마지막 아이템 아래에 로딩 인디케이터
if (index == items.length) {
  return const Padding(
    padding: EdgeInsets.all(16),
    child: Center(child: CircularProgressIndicator.adaptive()),
  );
}
```

---

## 구현 목록

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `TopProgressBar` 위젯 구현 | `lib/common/widgets/top_progress_bar.dart` |
| 2 | `TopProgressBar` 위젯 테스트 | `test/common/widgets/top_progress_bar_test.dart` |
| 3 | `flutter_native_splash` 패키지 추가 | `pubspec.yaml` |
| 4 | `flutter_native_splash.yaml` 설정 파일 생성 | 프로젝트 루트 |
| 5 | `assets/splash/` placeholder 이미지 배치 | `assets/splash/logo.png` |
| 6 | `pubspec.yaml`에 `assets/splash/` 추가 | `pubspec.yaml` |
| 7 | `docs/conventions/loading.md` 규약 문서 작성 | `docs/conventions/` |
| 8 | README.md fork 후 체크리스트에 네이티브 스플래시 항목 추가 | `README.md` |
