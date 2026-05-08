# Scripts

루트의 `factory` 통합 dispatcher + `scripts/` 에 있는 bash 도구 + `tool/` 의 Dart 스크립트.

---

## factory (root)

통합 명령어 dispatcher. `./factory install` 로 symlink 등록 후 어디서든 `<repo> <cmd>` 호출.

| 명령 | 용도 | 실행 시점 |
|------|------|---------|
| `./factory install` | `~/.local/bin/<repo>` symlink 등록 | clone 직후 1회 |
| `<repo> test` | 개발 준비 검증 (7 step) | 셋업 완료 후 / 수시 |
| `<repo> test --no-backend` | template-spring 미실행 환경 | 백엔드 없이 점검 |
| `<repo> test --skip-tests` | flutter test 생략 (빠른 점검) | 정적 분석만 확인 |
| `<repo> test --with-build` | apk debug 빌드 포함 | 배포 직전 점검 |
| `<repo> --help` | 명령 목록 + 사용법 | 항상 |

env-verb dispatch — 첫 인자가 `local`/`prod`/`all` 이면 env, 아니면 default `local`. verb `test` 는 짝 백엔드 (`template-spring`) 와 동일 — 양쪽 운영 시 일관 명령어.

---

## scripts/ (bash)

| 파일 | 용도 | 실행 시점 |
|------|------|---------|
| `lib/common.sh` | 공용 헬퍼 (info/ok/warn/fail/section) | factory 및 다른 sh 가 source |
| `readiness-check.sh` | 개발 준비 7 step 검증 | factory 의 first verb |
| `setup.sh` | git hooks 활성화 | clone 직후 1회 |
| `rename-app.sh` | 앱 이름 · Bundle ID 일괄 치환 | 파생 레포 생성 시 |
| `regenerate-assets.sh` | 런처 아이콘 + 스플래시 재생성 | 아이콘 · 스플래시 변경 후 |
| `coverage.sh` | 테스트 커버리지 측정 + HTML 리포트 | 월 1회 정기 점검 |
| `generate-upload-keystore.sh` | Android 업로드 keystore 생성 | 첫 Android 배포 전 |
| `batch-backup-keystores.sh` | 여러 앱 keystore 백업 | 정기 운영 |
| `upload-secrets-to-github.sh` | keystore · 자격증명 GHA Secrets 업로드 | 첫 배포 전 · 키 갱신 시 |
| `sync-docs.sh` | docs/ → docs-template-flutter mirror | docs 변경 push 시 (CI) |

---

## factory + test verb

### factory

env-verb 패턴 통합 dispatcher (~250 LOC bash).

```bash
# 첫 사용 (clone 직후)
./factory install                       # ~/.local/bin/<repo> symlink 등록
./factory install --symlink=mt          # 사용자 alias 로 등록 (긴 레포명 단축)

# 이후 어디서든
<repo> test                             # default = local
<repo> local test                       # env 명시
<repo> --help                           # 명령 목록
```

**메타 레포 가드**: `git remote get-url origin` 이 `*/template-flutter` 면 `install` 차단 — 메타 레포 자체에선 직접 `./factory <cmd>` 호출만 허용.

### test verb (개발 준비 검증)

7 step fail-fast 검증. 짝 백엔드 (`template-spring`) 의 `<repo> test` 와 동일 명령어 — 양쪽 운영 일관성.

```bash
<repo> test                             # default 동작
<repo> test --no-backend                # template-spring 미실행 환경
<repo> test --skip-tests                # flutter test 생략 (빠른 점검)
<repo> test --with-build                # apk debug 빌드 추가 (~35s)
<repo> test --verbose                   # 각 step 의 raw 출력
```

내부적으로 `scripts/readiness-check.sh` 호출. 직접 호출도 가능 (`bash scripts/readiness-check.sh`) 하지만 factory 경유 권장.

| Step | 검증 |
|---|---|
| 1 | Flutter env (`flutter doctor`) |
| 2 | Dependencies (`flutter pub get`) |
| 3 | Config audit (`dart run tool/configure_app.dart --audit`) |
| 4 | Code analysis (`flutter analyze`) |
| 5 | Format check (`dart format --output=none --set-exit-if-changed lib/ test/`) |
| 6 | Tests (`flutter test --reporter=compact`) — `--skip-tests` 로 생략 가능 |
| 7 | Backend ping (`$BASE_URL/actuator/health`) — `--no-backend` 로 생략 가능 |
| 8 | Build smoke (`flutter build apk --debug`) — `--with-build` 로 활성 |

마지막 출력이 "🎉 개발할 준비가 완료되었습니다" 면 코딩 시작 가능.

**환경변수**: `BASE_URL` (default: `http://localhost:8080`)

---

## setup.sh

```bash
#!/bin/bash
# git hooks 활성화
git config core.hooksPath .githooks
```

**1회 실행**. `.githooks/commit-msg` · `.githooks/pre-commit` · `.githooks/pre-push` 자동 적용.

```bash
./scripts/setup.sh
```

---

## coverage.sh

### 용도

`flutter test --coverage` 실행 + `lcov` 설치 시 HTML 리포트 자동 생성 + 브라우저 오픈.
**CI 게이트가 아닌 수동 측정 도구** — 한 달에 한 번 정도 돌려서 "테스트가 안 닿는 코드 영역" 가시화.

### 사용법

```bash
./scripts/coverage.sh             # 측정 + HTML 리포트 + 브라우저 오픈
./scripts/coverage.sh --no-open   # 측정만 (CI/원격 환경)
```

### 의존성

- `lcov` (선택) — 미설치 시 lcov.info 생성 + 단순 라인 요약만 출력
  - macOS: `brew install lcov`
  - Ubuntu: `sudo apt install lcov`

### 산출물

- `coverage/lcov.info` — 원본 커버리지 데이터 (`.gitignore` 처리됨)
- `coverage/html/` — HTML 리포트 (lcov 설치 시)

### 게이트가 아닌 이유

솔로 운영 컨텍스트에서 임계값 자동 차단보다 **시각화 + 정기 점검** 이 ROI 좋다고 판단. 자세한 트레이드오프는 별도 ADR 없음 (단순 도구라 결정 가벼움).

---

## rename-app.sh

### 용도

파생 레포 생성 직후 앱 정체성 일괄 변경.

### 사용법

```bash
./scripts/rename-app.sh <slug> <bundle_id>

# 예
./scripts/rename-app.sh my_tracker com.example.mytracker
```

### 변경 범위

- `pubspec.yaml` 의 `name:` → `<APP_NAME>` (slug 의 `-` 를 `_` 로 변환)
- `lib/main.dart` 의 `AppConfig.init(appSlug: ...)` → `<slug>`
- `android/app/build.gradle.kts` 의 `namespace` · `applicationId` → `<bundle_id>`
- `android/app/src/main/AndroidManifest.xml` 의 `android:label` → `<DisplayName>`
- Android Kotlin 파일의 `package` 선언 + 디렉토리 이동
- `ios/Runner.xcodeproj/project.pbxproj` 의 `PRODUCT_BUNDLE_IDENTIFIER` → `<bundle_id>`
  (`Info.plist` 의 `CFBundleIdentifier` 는 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수 참조라 자동 반영. iOS Swift 파일은 건드리지 않음.)
- `ios/Runner/Info.plist` 의 `CFBundleDisplayName` · `CFBundleName`
- `app_kits.yaml` 의 `app.name` · `app.slug`
- `android/fastlane/Appfile` 의 `package_name` → `<bundle_id>`
- import 경로 (`package:app_template/...` → `package:<APP_NAME>/...`, lib/ + test/ 일괄)

### 주의

- **번들 ID 는 unique + 되돌리기 어려움**. App Store · Play Store 등록 후 변경 불가.
- 스토어 등록 전에 마지막으로 체크.

---

## regenerate-assets.sh

### 용도

`flutter_launcher_icons.yaml` · `flutter_native_splash.yaml` 변경 후 아이콘 · 스플래시 재생성.

### 사용법

```bash
./scripts/regenerate-assets.sh
```

내부적으로:

```bash
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

### 커스터마이징

아이콘 / 스플래시 이미지 경로는 각 YAML 파일에서:

```yaml
# flutter_launcher_icons.yaml
flutter_launcher_icons:
  android: "launcher_icon"
  ios: true
  image_path: "assets/icons/app_icon.png"  # ← 여기
  min_sdk_android: 21
  adaptive_icon_background: "#FFFFFF"
  adaptive_icon_foreground: "assets/icons/app_icon_foreground.png"
```

---

## generate-upload-keystore.sh

### 용도

Android 업로드 keystore 생성 (Play App Signing 에 등록할 키).

### 사용법

```bash
./scripts/generate-upload-keystore.sh
```

대화형 입력:
- 이름 · 조직 · 도시 등
- keystore 비밀번호
- 키 alias 비밀번호

### 출력

`android/app/upload-keystore.jks` — **커밋 금지** (이미 `.gitignore`)

### 백업 필수

이 파일을 잃으면 **Play Store 에 같은 앱을 다시 업로드 불가**. Play App Signing 으로 복구 가능하지만 지원 요청 필요 · 시간 소요.

- Bitwarden · 1Password 에 base64 인코딩해서 저장
- 물리 USB 에 사본

---

## batch-backup-keystores.sh

### 용도

여러 앱의 keystore 를 한 번에 백업 (앱 공장 운영 시).

### 사용법

```bash
./scripts/batch-backup-keystores.sh ~/backup-keys
```

`~/backup-keys/` 디렉토리에 각 앱 keystore 를 타임스탬프와 함께 복사.

---

## upload-secrets-to-github.sh

### 용도

`.env` · keystore · 자격증명을 GitHub Secrets 에 일괄 업로드.

### 사용법

```bash
./scripts/upload-secrets-to-github.sh
```

내부:
1. `.env` 파싱 → 각 키를 `gh secret set` 으로
2. keystore 파일 base64 인코딩 → `ANDROID_KEYSTORE_BASE64`
3. Play Console JSON 키 읽기 → `PLAY_STORE_JSON_KEY`

### 전제

- `gh` CLI 설치 + `gh auth login` 완료
- 레포에 write 권한

---

## tool/ (Dart)

| 파일 | 용도 |
|------|------|
| `configure_app.dart` | `app_kits.yaml` ↔ `main.dart` 정합성 검증 |

### configure_app.dart

```bash
# 현재 상태 리포트
dart run tool/configure_app.dart

# CI 용 (불일치 시 exit 1)
dart run tool/configure_app.dart --audit
```

출력 예:

```
=== Configure App ===
app.name  : Template App
app.slug  : template
palette   : DefaultPalette

--- Kits ---
  [x] auth_kit
  [x] backend_api_kit
  [x] observability_kit
  [x] update_kit
  [ ] ads_kit (available, not enabled)
  ...

Status: OK
```

### 의존성 검증

```
--- Dependency Issues ---
  ✗ auth_kit requires backend_api_kit, which is not enabled
Status: ISSUES FOUND
```

자세한 건 [`ADR-004`](../philosophy/adr-004-manual-sync-ci-audit.md) · [`Conventions Overview`](../conventions/README.md).

---

## 새 스크립트 추가 가이드

새 `scripts/*.sh` 작성 시:

```bash
#!/bin/bash
set -euo pipefail   # 에러 시 즉시 종료

# 설명 주석
# 사용법 출력

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <arg>"
  exit 1
fi

# 실제 로직
```

실행 권한: `chmod +x scripts/new-script.sh`

---

## 관련 문서

- [`recipes.md`](./recipes.md) — Recipe 복사 → rename-app 흐름
- [`Android Deployment`](../infra/android-deployment.md) — 배포에서 스크립트 활용
- [`Secrets Management`](../infra/secrets-management.md)
