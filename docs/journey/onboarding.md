# Onboarding — 파생 레포 최초 셋업

파생 레포 생성 → 로컬에서 **앱이 시뮬레이터에 뜨기** 까지의 여정. 약 1시간 예상.

---

## §1 사전 설치 체크리스트

### 필수

- [ ] **Flutter SDK** 3.32.8 이상 — [fvm](https://fvm.app/) 으로 버전 관리 권장
- [ ] **Dart SDK** 3.8.1+ (Flutter 에 번들)
- [ ] **Git** 2.30+
- [ ] **Xcode** (iOS 빌드용) — macOS 전용. App Store 에서 설치
- [ ] **Android Studio** 또는 Android SDK Command-Line Tools
- [ ] **CocoaPods** (iOS 의존성) — `sudo gem install cocoapods`

### 권장

- [ ] **VS Code** + Flutter extension 또는 **IntelliJ IDEA** + Flutter plugin
- [ ] **gh CLI** — GitHub Secrets 업로드 시 유용
- [ ] **jq** — JSON 파싱용 (스크립트에서 사용)

### 확인

```bash
flutter doctor
```

모든 항목이 ✓ 거나, "Connected device" 만 비어있어야 정상. Android licenses · Xcode 설치 이슈는 `flutter doctor --android-licenses` 등으로 해결.

---

## §2 파생 레포 생성

### 1. GitHub 에서 "Use this template"

1. [`flutter-mobile-template`](https://github.com/storkspear/flutter-mobile-template) 접속
2. 우측 상단 **"Use this template"** → "Create a new repository"
3. 새 레포 이름 · 소유자 · 공개 여부 선택
4. 생성

> ⚠️ fork 하지 않아요. "Use this template" 은 히스토리를 끊고 독립 레포를 만듦 ([ADR-001](../philosophy/adr-001-template-cherry-pick.md)).

### 2. 클론

```bash
git clone git@github.com:<your-org>/<your-app>.git
cd <your-app>
```

### 3. git hooks 활성화

```bash
./scripts/setup.sh
# → git config core.hooksPath .githooks
```

commit-msg · pre-push 훅이 자동 적용돼요.

### 4. 템플릿 remote 등록 (선택, cherry-pick 전파용)

```bash
git remote add template https://github.com/storkspear/flutter-mobile-template.git
git fetch template
```

자세한 건 [Migration from Template](../reference/migration-from-template.md).

---

## §3 앱 정체성 설정

### rename-app.sh 실행

```bash
./scripts/rename-app.sh <slug> <bundle_id>

# 예
./scripts/rename-app.sh my_tracker com.example.mytracker
```

변경되는 곳:
- `pubspec.yaml` 의 `name:`
- `android/app/build.gradle.kts` 의 `applicationId`
- `ios/Runner/Info.plist` 의 `CFBundleIdentifier`
- Android Kotlin · iOS Swift 파일의 패키지
- `app_kits.yaml` 의 `app.slug` · `app.name`
- import 경로 (`package:template` → `package:<slug>`)

### 커밋

```bash
git add -A
git commit -m "chore: rename to <slug>"
```

---

## §4 Recipe 선택 (선택)

앱 유형이 명확하면 [recipes/](../reference/recipes.md) 중 하나 복사:

```bash
# 로컬 전용 앱
cp recipes/local-only-tracker.yaml app_kits.yaml

# 로컬 알림 앱
cp recipes/local-notifier-app.yaml app_kits.yaml

# 백엔드 연동 + 인증
cp recipes/backend-auth-app.yaml app_kits.yaml
```

### main.dart 동기화

선택한 recipe 에 맞게 `lib/main.dart` 의 `AppKits.install([...])` 수정.

예 (local-only-tracker):

```dart
// lib/main.dart
await AppKits.install([
  LocalDbKit(database: AppDatabase()),
  OnboardingKit(steps: [...]),
  NavShellKit(tabs: [...]),
  ChartsKit(),
]);
```

### 검증

```bash
dart run tool/configure_app.dart
```

Status: OK 확인.

---

## §5 첫 기동

### 의존성 설치

```bash
flutter pub get
cd ios && pod install && cd ..  # iOS 만
```

### 코드 생성 (필요 시)

`local_db_kit` 쓰면:

```bash
dart run build_runner build --delete-conflicting-outputs
```

i18n:

```bash
flutter gen-l10n
```

### 시뮬레이터 / 에뮬레이터 실행

**iOS**:
```bash
open -a Simulator
```

**Android**:
```bash
# Android Studio → AVD Manager 에서 실행
# 또는
emulator -list-avds
emulator -avd Pixel_8_API_34
```

### 앱 실행

```bash
flutter run
```

처음 실행이면 빌드에 1~2분. 이후엔 hot reload.

### 확인 포인트

- [ ] 시뮬레이터에 앱이 뜸
- [ ] 앱 이름이 `<slug>` 로 표시
- [ ] 스플래시 → 홈 화면
- [ ] `flutter run` 콘솔에 에러 없음

---

## §6 다음 단계

로컬에서 앱이 뜨면 성공. 다음:

1. **Kit 조립 이해**: [Journey 3단계 — Kit 조립](./README.md#3-kit-조립은-어떻게--앱-유형-결정-30분) → 본인 앱 유형 확정
2. **외부 서비스 자격 증명**: Sentry · PostHog · Firebase · 소셜 로그인 ([4단계](./README.md#4-발급은-어디서--외부-서비스-자격-증명-1--2시간))
3. **첫 기능 구현**: [Build First App](./build-first-app.md)
4. **배포 준비**: [Deployment](./deployment.md)

막히면 [Pitfalls](./dogfood-pitfalls.md) 검색 먼저.

---

## 트러블슈팅

### `flutter pub get` 실패

- `pubspec.lock` 삭제 후 재시도
- Flutter 버전 확인 (`flutter --version`)
- 네트워크 / VPN 이슈

### iOS 빌드 실패 (pod install)

```bash
cd ios
pod repo update
pod install --repo-update
```

### Android 빌드 실패 (SDK licenses)

```bash
flutter doctor --android-licenses
# y 여러 번 눌러 수락
```

### `dart run tool/configure_app.dart` 가 ISSUES FOUND

- `app_kits.yaml` 의 Kit 이 `lib/main.dart` 의 `AppKits.install([...])` 와 일치하는지 확인
- `requires` 누락 확인 (예: `auth_kit` 쓰면 `backend_api_kit` 도 활성)

더 많은 함정: [Pitfalls](./dogfood-pitfalls.md)

---

## 📖 책 목차 — Journey 2단계

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | [Architecture 한눈 요약](./architecture.md) | 모듈 구조 한눈 (1단계) |
| → 다음 | [Build First App](./build-first-app.md) | 첫 기능 구현 (5단계) |

**막혔을 때**: [함정](./dogfood-pitfalls.md) / [FAQ](./dogfood-faq.md)
