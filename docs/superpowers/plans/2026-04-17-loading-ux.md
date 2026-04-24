# Loading UX 통합 구현 플랜

> **Status:** ✅ 완료 (2026-04-17 FeatureKit 리팩터링 머지 `8081318`에 흡수 반영). 실제 경로는 `lib/common/*` → `lib/core/*`로 이동되었다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 앱에서 일관된 로딩 UX를 제공하기 위한 위젯 추가 + 규약 문서 작성 + 네이티브 스플래시 설정.

**Architecture:** 기존 위젯(LoadingView, SkeletonLoading, PrimaryButton)은 수정하지 않는다. TopProgressBar 위젯 1개만 신규 추가하고, 나머지는 규약 문서(docs/conventions/loading.md)로 가이드한다. flutter_native_splash 패키지를 dev_dependencies에 추가하고 설정 파일을 생성한다.

**Tech Stack:** Flutter, Skeletonizer, flutter_native_splash

**Spec:** `docs/superpowers/specs/2026-04-17-loading-ux-design.md`

---

## 파일 구조

| 동작 | 파일 | 역할 |
|------|------|------|
| Create | `lib/core/widgets/top_progress_bar.dart` | 최상단 LinearProgressIndicator 래퍼 |
| Create | `test/core/widgets/top_progress_bar_test.dart` | TopProgressBar 위젯 테스트 |
| Create | `flutter_native_splash.yaml` | 네이티브 스플래시 설정 |
| Create | `assets/splash/logo.png` | placeholder 스플래시 로고 |
| Create | `docs/conventions/loading.md` | 로딩 UX 규약 문서 |
| Modify | `pubspec.yaml` | flutter_native_splash 패키지 + assets/splash/ 추가 |
| Modify | `README.md` | fork 후 체크리스트에 네이티브 스플래시 항목 추가 |

---

### Task 1: TopProgressBar 위젯 구현

**Files:**
- Create: `lib/core/widgets/top_progress_bar.dart`

- [x] **Step 1: 위젯 파일 생성**

```dart
import 'package:flutter/material.dart';

/// 화면 최상단 선형 프로그레스 바 (토스 스타일).
///
/// 백그라운드 데이터 갱신 시 status bar 바로 아래에 가는 프로그레스를 표시한다.
/// 사용자 인터랙션을 차단하지 않으면서 "갱신 중"임을 알린다.
///
/// 사용법:
/// ```dart
/// TopProgressBar(
///   isLoading: state.isRefreshing,
///   child: Scaffold(
///     appBar: AppBar(title: Text('목록')),
///     body: ListView(...),
///   ),
/// )
/// ```
class TopProgressBar extends StatelessWidget {
  /// true이면 프로그레스 바 표시.
  final bool isLoading;

  /// 프로그레스 바 아래에 표시할 child (보통 Scaffold).
  final Widget child;

  /// 프로그레스 바 색상. 미지정 시 colorScheme.primary.
  final Color? color;

  const TopProgressBar({
    super.key,
    required this.isLoading,
    required this.child,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: LinearProgressIndicator(
                color: color,
              ),
            ),
          ),
      ],
    );
  }
}
```

- [x] **Step 2: 커밋**

```bash
git add lib/core/widgets/top_progress_bar.dart
git commit -m "feat: TopProgressBar 위젯 구현 (토스 스타일 최상단 프로그레스)"
```

---

### Task 2: TopProgressBar 위젯 테스트

**Files:**
- Create: `test/core/widgets/top_progress_bar_test.dart`

- [x] **Step 1: 테스트 파일 생성**

```dart
import 'package:app_template/core/widgets/top_progress_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/widget_test_helpers.dart';

/// TopProgressBar 위젯 테스트.
///
/// TopProgressBar는 백그라운드 갱신 시 화면 최상단에 LinearProgressIndicator를
/// 표시하는 래퍼 위젯이다.
///
/// 핵심 분기: isLoading 유무에 따라 프로그레스 바 표시/숨김.
void main() {
  group('TopProgressBar', () {
    testWidgets('isLoading=true → LinearProgressIndicator 표시', (tester) async {
      await tester.pumpWidget(harness(
        const TopProgressBar(
          isLoading: true,
          child: Scaffold(body: Text('내용')),
        ),
      ));

      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.text('내용'), findsOneWidget);
    });

    testWidgets('isLoading=false → LinearProgressIndicator 미표시', (tester) async {
      await tester.pumpWidget(harness(
        const TopProgressBar(
          isLoading: false,
          child: Scaffold(body: Text('내용')),
        ),
      ));

      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(find.text('내용'), findsOneWidget);
    });

    testWidgets('child 위젯 항상 렌더링', (tester) async {
      // isLoading 상태와 무관하게 child는 항상 표시되어야 한다.
      // TopProgressBar는 비차단(non-blocking) 로딩이므로.
      await tester.pumpWidget(harness(
        const TopProgressBar(
          isLoading: true,
          child: Scaffold(body: Text('차단되지 않는 내용')),
        ),
      ));

      expect(find.text('차단되지 않는 내용'), findsOneWidget);
    });

    testWidgets('커스텀 color 적용', (tester) async {
      await tester.pumpWidget(harness(
        const TopProgressBar(
          isLoading: true,
          color: Colors.red,
          child: Scaffold(body: Text('내용')),
        ),
      ));

      final indicator = tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator),
      );
      expect(indicator.color, Colors.red);
    });

    testWidgets('color=null → 기본 색상 (colorScheme.primary)', (tester) async {
      await tester.pumpWidget(harness(
        const TopProgressBar(
          isLoading: true,
          child: Scaffold(body: Text('내용')),
        ),
      ));

      final indicator = tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator),
      );
      expect(indicator.color, isNull); // null이면 Flutter가 colorScheme.primary 사용
    });
  });
}
```

- [x] **Step 2: 테스트 실행**

Run: `flutter test test/core/widgets/top_progress_bar_test.dart`
Expected: ALL PASS (5 tests)

- [x] **Step 3: 커밋**

```bash
git add test/core/widgets/top_progress_bar_test.dart
git commit -m "test: TopProgressBar 위젯 테스트 추가"
```

---

### Task 3: flutter_native_splash 패키지 + 설정

**Files:**
- Modify: `pubspec.yaml`
- Create: `flutter_native_splash.yaml`
- Create: `assets/splash/logo.png`

- [x] **Step 1: pubspec.yaml에 패키지 + 에셋 추가**

`pubspec.yaml`의 `dev_dependencies`에 추가:

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  flutter_native_splash: ^2.4.4
```

`flutter` 섹션의 `assets`에 추가:

```yaml
  assets:
    - assets/images/
    - assets/splash/
```

- [x] **Step 2: flutter_native_splash.yaml 설정 파일 생성**

프로젝트 루트에 생성:

```yaml
flutter_native_splash:
  # 배경색. fork 후 브랜드 색상으로 변경.
  color: "#FFFFFF"

  # 스플래시 로고 이미지.
  # 권장 크기: 1152x1152px.
  # 안전 영역: 중앙 384px 이내에 핵심 로고 배치 (Android 12 마스킹 대응).
  image: assets/splash/logo.png

  # Android 12+ 전용 설정.
  android_12:
    image: assets/splash/logo.png
    color: "#FFFFFF"
```

- [x] **Step 3: placeholder 이미지 생성**

`assets/splash/` 디렉토리 생성 + 1x1 투명 PNG를 placeholder로 배치.
실제 로고는 나중에 교체한다.

```bash
mkdir -p assets/splash
# 1x1 투명 PNG 생성 (placeholder)
python3 -c "
import base64, pathlib
# 1x1 transparent PNG
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
pathlib.Path('assets/splash/logo.png').write_bytes(png)
"
```

- [x] **Step 4: flutter pub get 실행**

Run: `flutter pub get`
Expected: 성공

- [x] **Step 5: 커밋**

```bash
git add pubspec.yaml pubspec.lock flutter_native_splash.yaml assets/splash/
git commit -m "feat: flutter_native_splash 패키지 + 설정 추가"
```

---

### Task 4: docs/conventions/loading.md 규약 문서 작성

**Files:**
- Create: `docs/conventions/loading.md`

- [x] **Step 1: 규약 문서 작성**

`docs/conventions/loading.md` — 스펙 문서의 섹션 1, 4, 5를 규약 형태로 정리.
내용:
- 로딩 패턴 분류표 (5가지 상황별)
- 사용하지 않는 패턴 (오버레이)
- 스켈레톤 로딩 작성 규칙 4개
- UI 작업 가이드 체크리스트
- 전형적 화면 코드 구조 (목록, 폼, 무한 스크롤)
- 네이티브 스플래시 이미지 가이드

스펙 문서(`docs/superpowers/specs/2026-04-17-loading-ux-design.md`)의 해당 섹션 내용을 그대로 가져오되, 규약 문서 형식(conventions/ 디렉토리의 다른 문서와 일관성)으로 정리한다.

- [x] **Step 2: 커밋**

```bash
git add docs/conventions/loading.md
git commit -m "docs: 로딩 UX 규약 문서 작성 (conventions/loading.md)"
```

---

### Task 5: README.md fork 후 체크리스트 업데이트

**Files:**
- Modify: `README.md`

- [x] **Step 1: fork 후 체크리스트에 네이티브 스플래시 항목 추가**

`README.md`의 `## fork 후 체크리스트` 테이블에 항목 추가:

기존 9번(앱 아이콘 교체)과 10번(도메인 코드 작성) 사이에 삽입:

```markdown
| 9 | 앱 아이콘 교체 | `android/`, `ios/` |
| 10 | 네이티브 스플래시 로고 교체 + 재생성 | `assets/splash/`, `flutter_native_splash.yaml` |
| 11 | 도메인 코드 작성 시작 | `features/` |
```

- [x] **Step 2: 관련 문서 섹션에 loading.md 추가**

`README.md` 하단 `## 관련 문서` 섹션에 추가:

```markdown
- [`docs/conventions/loading.md`](./docs/conventions/loading.md) — 로딩 UX 규약
```

- [x] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: README fork 체크리스트에 네이티브 스플래시 + loading 규약 추가"
```

---

## 검증

모든 Task 완료 후:

```bash
# 1. 전체 테스트 통과 확인
flutter test

# 2. 패키지 정상 설치 확인
flutter pub get

# 3. 신규 파일 존재 확인
ls lib/core/widgets/top_progress_bar.dart
ls test/core/widgets/top_progress_bar_test.dart
ls flutter_native_splash.yaml
ls assets/splash/logo.png
ls docs/conventions/loading.md
```
