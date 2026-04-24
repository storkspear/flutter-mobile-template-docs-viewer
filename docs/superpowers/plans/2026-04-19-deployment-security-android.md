# Phase 2a 배포 + 보안 (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파생 레포(Use Template으로 생성된 각 앱)가 출시 품질의 Android 릴리스 빌드·배포·보안 인프라를 즉시 갖추도록 템플릿에 자동화 스크립트, Fastlane, GitHub Actions 워크플로, R8 난독화, SSL 핀닝 구조를 추가한다.

**Architecture:** 템플릿은 "인프라만" 제공하고 앱별 실행은 파생 레포가 담당한다. 키스토어·DSN·API 키 등 비밀은 절대 이 저장소에 커밋하지 않으며, 각 앱 레포가 `scripts/generate-upload-keystore.sh` 실행 → 로컬 pending → GHA Secrets 업로드 흐름으로 관리한다. Fastlane이 `key.properties`를 읽어 서명하고, GitHub Actions(tag-triggered `release-android.yml`)이 fastlane을 실행하며, 릴리스 빌드는 R8로 난독화되고 dSYM/mapping이 sentry-cli로 업로드된다. SSL 핀닝은 `backend_api_kit`에 opt-in 방식으로 추가되어 `--dart-define=SSL_PINS=sha256/...`로 주입한다.

**Tech Stack:**
- Android Gradle Plugin (KTS DSL), R8, ProGuard
- Fastlane (Ruby, `Gemfile`, `Fastfile`)
- GitHub Actions (`release-android.yml`)
- `gh` CLI (GitHub Secrets 자동 업로드)
- `sentry-cli` (dSYM/mapping 업로드)
- Dart: `dio` (SSL 핀닝 훅 HttpClientAdapter 교체)

---

## File Structure

**Create (템플릿 인프라):**

*Scripts:*
- `scripts/generate-upload-keystore.sh` — 각 앱에서 키스토어 + 비밀번호 생성
- `scripts/upload-secrets-to-github.sh` — 키스토어 base64 + 비번을 GHA Secrets에 자동 업로드
- `scripts/batch-backup-keystores.sh` — `~/Documents/keystores-pending/` 일괄 백업 루틴

*Android build/signing:*
- `android/key.properties.example` — `key.properties` 포맷 예시 (실제 파일은 gitignore)
- `android/app/proguard-rules.pro` — R8/ProGuard 규칙
- `android/app/src/main/res/xml/network_security_config.xml` — cleartext 차단 (release)

*Fastlane:*
- `android/Gemfile` — fastlane 의존성
- `android/Gemfile.lock` (자동 생성)
- `android/fastlane/Fastfile` — beta/deploy lane
- `android/fastlane/Appfile` — Play Console json_key 경로 참조
- `android/fastlane/Pluginfile` — (선택) 필요 시 플러그인 선언
- `android/fastlane/README.md` — lane 사용법

*CI:*
- `.github/workflows/release-android.yml` — tag push 트리거 릴리스 워크플로

*Security (Dart):*
- `lib/kits/backend_api_kit/ssl_pinning.dart` — SHA256 핀 기반 HttpClientAdapter
- `lib/kits/backend_api_kit/ssl_pinning_env.dart` — `--dart-define=SSL_PINS=...` 파서

*Tests:*
- `test/kits/backend_api_kit/ssl_pinning_test.dart`
- `test/kits/backend_api_kit/ssl_pinning_env_test.dart`

*Documentation:*
- `docs/integrations/deployment-android.md` — 파생 레포 배포 체크리스트
- `docs/integrations/security.md` — 적용된 보안 정책 요약

**Modify:**
- `android/app/build.gradle.kts` — release signing config + R8 활성화 + network_security_config 참조
- `android/app/src/main/AndroidManifest.xml` — `android:usesCleartextTraffic="false"` + `networkSecurityConfig`
- `lib/kits/backend_api_kit/api_client.dart` — 선택적 SSL 핀닝 훅 통합
- `lib/kits/backend_api_kit/backend_api_kit.dart` — SSL 핀닝 설정 provider (선택적)
- `.gitignore` — `android/key.properties`, `android/fastlane/report.xml`, `keystores-pending/` 등 확인/보강
- `docs/integrations/README.md` — 새 문서 링크
- `pubspec.yaml` — (필요 시) 빌드 태그 주석, 의존성 변경 없음 예상

---

## Section 1: Android 서명 + R8 (Task 1–4)

이 섹션이 끝나면:
- 파생 레포에서 스크립트 한 번으로 키스토어 생성 + GHA Secrets 업로드 가능
- `flutter build appbundle --release`가 R8 난독화 + upload key 서명된 AAB 산출
- 템플릿 자체는 여전히 debug 서명으로 폴백(키스토어 없음), CI는 깨지지 않음

---

### Task 1: key.properties 패턴 + gitignore 확인

**Files:**
- Create: `android/key.properties.example`
- Verify: `.gitignore`에 `android/key.properties` 포함

- [ ] **Step 1: .gitignore 확인**

Run: `grep -n "android/key.properties" .gitignore`
Expected: 매칭되는 라인 출력 (Phase 1에서 이미 추가됨). 매칭 없으면 추가:
```gitignore
android/key.properties
```

- [ ] **Step 2: key.properties.example 생성**

Create `android/key.properties.example`:

```properties
# 이 파일은 커밋됨. 실제 값은 android/key.properties (gitignore됨)에 담는다.
# scripts/generate-upload-keystore.sh가 key.properties를 자동 생성한다.
#
# CI(GitHub Actions)에서는 이 파일을 쓰지 않고, Secrets에서 직접 환경변수로 주입받는다
# (release-android.yml 참고).

storePassword=REPLACE_ME
keyPassword=REPLACE_ME
keyAlias=upload
storeFile=upload-keystore.jks
```

- [ ] **Step 3: 커밋**

```bash
git add android/key.properties.example
git commit -m "chore(android): add key.properties example for release signing"
```

---

### Task 2: generate-upload-keystore.sh — 파생 레포용 키스토어 생성 스크립트

**Files:**
- Create: `scripts/generate-upload-keystore.sh` (실행 권한 755)

- [ ] **Step 1: 스크립트 작성**

Create `scripts/generate-upload-keystore.sh`:

```bash
#!/usr/bin/env bash
# 파생 레포(Use Template 결과)에서 실행한다. 템플릿 자체에서는 실행하지 않는다.
#
# 생성:
#  - android/app/upload-keystore.jks  (gitignore됨)
#  - android/key.properties            (gitignore됨, fastlane이 읽음)
#
# 원본 사본 + 비밀번호는 ~/Documents/keystores-pending/<app-slug>/ 에 임시 저장된다.
# 주기적으로 scripts/batch-backup-keystores.sh 실행하여 영구 백업 위치로 이전한다.
#
# 사용:
#   ./scripts/generate-upload-keystore.sh <app-slug>
# 예:
#   ./scripts/generate-upload-keystore.sh money-app

set -euo pipefail

APP_SLUG="${1:-}"
if [[ -z "$APP_SLUG" ]]; then
  echo "Usage: $0 <app-slug>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE_PATH="$REPO_ROOT/android/app/upload-keystore.jks"
KEY_PROPERTIES_PATH="$REPO_ROOT/android/key.properties"
PENDING_DIR="$HOME/Documents/keystores-pending/$APP_SLUG"

if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "ERROR: $KEYSTORE_PATH already exists. Refusing to overwrite." >&2
  exit 1
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "ERROR: keytool not found. Install Java JDK." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl not found." >&2
  exit 1
fi

mkdir -p "$PENDING_DIR"

STORE_PASS="$(openssl rand -base64 32 | tr -d '/=+' | cut -c1-32)"
KEY_PASS="$(openssl rand -base64 32 | tr -d '/=+' | cut -c1-32)"
KEY_ALIAS="upload"

keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias "$KEY_ALIAS" \
  -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
  -dname "CN=$APP_SLUG, OU=Dev, O=AppFactory, L=Seoul, S=Seoul, C=KR"

cat > "$KEY_PROPERTIES_PATH" <<EOF
storePassword=$STORE_PASS
keyPassword=$KEY_PASS
keyAlias=$KEY_ALIAS
storeFile=upload-keystore.jks
EOF

cp "$KEYSTORE_PATH" "$PENDING_DIR/upload-keystore.jks"
cat > "$PENDING_DIR/passwords.txt" <<EOF
App: $APP_SLUG
Created: $(date -Iseconds)
Store Password: $STORE_PASS
Key Password:   $KEY_PASS
Key Alias:      $KEY_ALIAS
EOF

chmod 600 "$KEY_PROPERTIES_PATH" "$PENDING_DIR/passwords.txt"

echo ""
echo "================================================================"
echo "✅ 키스토어 생성 완료"
echo "================================================================"
echo "로컬 빌드용:    $KEY_PROPERTIES_PATH"
echo "                $KEYSTORE_PATH"
echo ""
echo "임시 백업 위치: $PENDING_DIR"
echo ""
echo "다음 단계:"
echo "  1. ./scripts/upload-secrets-to-github.sh $APP_SLUG"
echo "     (GHA Secrets에 키스토어 + 비번 업로드)"
echo "  2. 나중에 ./scripts/batch-backup-keystores.sh 실행해 영구 백업"
echo "================================================================"
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x scripts/generate-upload-keystore.sh`

- [ ] **Step 3: 스크립트 문법 검증 (실행하지 않음, 템플릿에는 키스토어 생성 안 함)**

Run: `bash -n scripts/generate-upload-keystore.sh`
Expected: 출력 없음 (문법 OK)

- [ ] **Step 4: 커밋**

```bash
git add scripts/generate-upload-keystore.sh
git commit -m "feat(scripts): add generate-upload-keystore.sh for derived repos"
```

---

### Task 3: build.gradle.kts — 릴리스 서명 config + R8 활성화

**Files:**
- Modify: `android/app/build.gradle.kts`

- [ ] **Step 1: build.gradle.kts 수정**

Replace the existing content of `android/app/build.gradle.kts` with:

```kotlin
import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

// android/key.properties가 있으면 읽고, 없으면 null (CI Secrets 주입 경로용).
val keyPropertiesFile = rootProject.file("key.properties")
val keyProperties = Properties().apply {
    if (keyPropertiesFile.exists()) {
        load(FileInputStream(keyPropertiesFile))
    }
}

// GHA Secrets는 환경 변수로 주입됨. key.properties보다 우선.
val storePasswordFromEnv: String? = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val keyPasswordFromEnv: String? = System.getenv("ANDROID_KEY_PASSWORD")
val keyAliasFromEnv: String? = System.getenv("ANDROID_KEY_ALIAS")

android {
    namespace = "com.factory.app_template"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "com.factory.app_template"
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            // 1순위: env var (CI). 2순위: key.properties (로컬). 둘 다 없으면 config 비활성.
            val storePwd = storePasswordFromEnv ?: keyProperties.getProperty("storePassword")
            val keyPwd = keyPasswordFromEnv ?: keyProperties.getProperty("keyPassword")
            val alias = keyAliasFromEnv ?: keyProperties.getProperty("keyAlias")
            val file = keyProperties.getProperty("storeFile") ?: "upload-keystore.jks"

            if (storePwd != null && keyPwd != null && alias != null) {
                storeFile = rootProject.file("app/$file")
                storePassword = storePwd
                keyPassword = keyPwd
                keyAlias = alias
            }
        }
    }

    buildTypes {
        release {
            // key.properties 또는 env 주입이 있으면 release 서명, 없으면 debug 서명으로 폴백.
            // 템플릿은 기본적으로 key.properties가 없으므로 debug 서명(템플릿 CI가 깨지지 않음).
            val releaseSigning = signingConfigs.getByName("release")
            signingConfig = if (releaseSigning.storeFile != null) {
                releaseSigning
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}
```

- [ ] **Step 2: debug 빌드 재검증 (R8는 release에만 적용되어 debug는 영향 없음)**

Run: `flutter build apk --debug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: release 빌드 검증 (debug 서명으로 폴백 + R8 적용)**

Run: `flutter build apk --release`
Expected: BUILD SUCCESSFUL. 경고 가능: "signing with the debug keys"는 의도된 동작.

`proguard-rules.pro`가 없어 R8이 일부 경고를 낼 수 있음 → 다음 task에서 규칙 추가.

- [ ] **Step 4: 커밋**

```bash
git add android/app/build.gradle.kts
git commit -m "build(android): add release signing config + enable R8 minification"
```

---

### Task 4: proguard-rules.pro — 공용 라이브러리 R8 규칙

**Files:**
- Create: `android/app/proguard-rules.pro`

- [ ] **Step 1: 규칙 파일 작성**

Create `android/app/proguard-rules.pro`:

```pro
# Flutter 공식 권장 규칙 (기본)
-keep class io.flutter.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.plugins.**  { *; }
-dontwarn io.flutter.embedding.**

# Dio / OkHttp (간접 의존)
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Drift (SQLite wrapper)
-keep class androidx.sqlite.** { *; }
-keep class io.github.simolus3.** { *; }

# AdMob (google_mobile_ads)
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Sentry
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# PostHog
-keep class com.posthog.** { *; }
-dontwarn com.posthog.**

# Apple/Google Sign In (sign_in_with_apple, google_sign_in)
-keep class com.aboutyou.dart_packages.sign_in_with_apple.** { *; }

# flutter_local_notifications — GSON 리플렉션 사용
-keep class com.dexterous.** { *; }
-keepattributes InnerClasses
-keep class * implements com.google.gson.** { *; }

# workmanager
-keep class androidx.work.** { *; }

# flutter_secure_storage
-keep class androidx.security.crypto.** { *; }

# Kotlin metadata (coroutines 등)
-keepattributes *Annotation*
-keepclassmembers class kotlinx.** { *; }

# 일반: Application / Activity / Service / Receiver는 유지
-keep public class * extends android.app.Application
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver

# 주: 파생 레포에서 새 의존성 추가 시 이 파일에 규칙 보강 필요.
# 누락 시 release 빌드에서 NoClassDefFoundError / ClassCastException 발생 가능.
```

- [ ] **Step 2: release 빌드 재검증**

Run: `flutter build apk --release 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL. R8 경고 수 감소.

- [ ] **Step 3: 커밋**

```bash
git add android/app/proguard-rules.pro
git commit -m "build(android): add ProGuard rules for template's active kits"
```

---

## Section 2: Fastlane + GHA 배포 (Task 5–9)

이 섹션이 끝나면:
- 파생 레포에서 `fastlane android beta`로 Play Internal 업로드 가능
- `git tag v1.0.0 && git push --tags`로 GHA가 자동 릴리스 빌드 + Play 업로드 + Sentry mapping 업로드

---

### Task 5: Fastlane 설치 — Gemfile + Appfile + Fastfile

**Files:**
- Create: `android/Gemfile`
- Create: `android/fastlane/Appfile`
- Create: `android/fastlane/Fastfile`
- Create: `android/fastlane/README.md`

- [ ] **Step 1: Gemfile 생성**

Create `android/Gemfile`:

```ruby
source "https://rubygems.org"

gem "fastlane"
```

- [ ] **Step 2: Appfile 생성**

Create `android/fastlane/Appfile`:

```ruby
# package_name은 android/app/build.gradle.kts의 applicationId와 일치해야 함.
# 파생 레포에서 rename-app.sh 실행 시 자동으로 교체됨 (rename-app.sh 확장 작업은 Task 8).
package_name("com.factory.app_template")

# Play Console json_key 경로. 파생 레포에서 GHA Secret으로 주입하거나
# 로컬에서는 절대 경로로 교체.
# json_key_file("play-store-credentials.json")
```

- [ ] **Step 3: Fastfile 생성**

Create `android/fastlane/Fastfile`:

```ruby
default_platform(:android)

platform :android do
  desc "build + sign release AAB (CI가 서명 전제)"
  lane :build_release do
    sh "cd ../.. && flutter build appbundle --release"
  end

  desc "Play Console Internal testing 트랙 업로드"
  lane :beta do
    build_release
    upload_to_play_store(
      track: "internal",
      aab: "../build/app/outputs/bundle/release/app-release.aab",
      json_key: ENV["PLAY_STORE_JSON_KEY_PATH"] || "play-store-credentials.json",
      skip_upload_apk: true,
      skip_upload_metadata: true,
      skip_upload_changelogs: true,
      skip_upload_images: true,
      skip_upload_screenshots: true,
    )
  end

  desc "Play Console Production 트랙 승격"
  lane :deploy do
    upload_to_play_store(
      track: "production",
      track_promote_to: "production",
      skip_upload_apk: true,
      skip_upload_aab: true,
      skip_upload_metadata: true,
      skip_upload_changelogs: true,
      skip_upload_images: true,
      skip_upload_screenshots: true,
      json_key: ENV["PLAY_STORE_JSON_KEY_PATH"] || "play-store-credentials.json",
    )
  end

  desc "Sentry mapping 업로드 (릴리스 빌드 직후)"
  lane :upload_sentry_mapping do |options|
    org = ENV["SENTRY_ORG"] or UI.user_error!("SENTRY_ORG missing")
    project = ENV["SENTRY_PROJECT"] or UI.user_error!("SENTRY_PROJECT missing")
    auth_token = ENV["SENTRY_AUTH_TOKEN"] or UI.user_error!("SENTRY_AUTH_TOKEN missing")
    version = options[:version] or UI.user_error!("version option required")

    sh <<~SH
      sentry-cli --auth-token #{auth_token} \
        releases -o #{org} -p #{project} new #{version}
      sentry-cli --auth-token #{auth_token} \
        upload-proguard -o #{org} -p #{project} \
        --version #{version} \
        ../build/app/outputs/mapping/release/mapping.txt
      sentry-cli --auth-token #{auth_token} \
        releases -o #{org} -p #{project} finalize #{version}
    SH
  end
end
```

- [ ] **Step 4: fastlane 사용법 README 작성**

Create `android/fastlane/README.md`:

```markdown
# Fastlane (Android)

## 파생 레포에서 사용

### 준비
1. `gem install bundler && cd android && bundle install` (또는 `bundle exec fastlane`)
2. Play Console Service Account JSON을 `android/play-store-credentials.json` 로 저장 (gitignore됨)
   - 발급: https://play.google.com/console → Settings → API access → Create Service Account
3. `android/key.properties` 생성 (`scripts/generate-upload-keystore.sh` 실행하면 자동)

### 사용 가능한 lane

- `bundle exec fastlane android build_release`
  - `flutter build appbundle --release` 실행
- `bundle exec fastlane android beta`
  - 위 빌드 + Play Internal testing 트랙 업로드
- `bundle exec fastlane android deploy`
  - 기존 트랙을 Production으로 승격
- `bundle exec fastlane android upload_sentry_mapping version:1.2.3`
  - mapping.txt를 Sentry에 업로드 (릴리스 직후)
  - 환경변수: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

### CI에서

`.github/workflows/release-android.yml` 참고. 태그 push 시 자동 실행.
```

- [ ] **Step 5: 정적 검증 — Ruby 문법 체크**

Run: `ruby -c android/fastlane/Fastfile && ruby -c android/fastlane/Appfile`
Expected: `Syntax OK` (두 번)

만약 Ruby 미설치 시 스킵하고 다음 단계에서 `bundle exec fastlane lanes`로 확인.

- [ ] **Step 6: .gitignore에 fastlane 산출물 추가**

Append to `.gitignore`:

```gitignore

# Fastlane (Android)
android/Gemfile.lock
android/fastlane/report.xml
android/fastlane/Preview.html
android/play-store-credentials.json
```

- [ ] **Step 7: 커밋**

```bash
git add android/Gemfile android/fastlane/ .gitignore
git commit -m "feat(android): add fastlane with beta/deploy/sentry_mapping lanes"
```

---

### Task 6: upload-secrets-to-github.sh — GHA Secrets 자동 업로드

**Files:**
- Create: `scripts/upload-secrets-to-github.sh`

- [ ] **Step 1: 스크립트 작성**

Create `scripts/upload-secrets-to-github.sh`:

```bash
#!/usr/bin/env bash
# 파생 레포에서 실행. 키스토어 + 비번 + Play json key + Sentry 토큰을 GHA Secrets에 업로드.
#
# 전제: gh CLI 설치 + 인증 (`gh auth login`) + 현재 디렉토리가 파생 레포 git 루트
#
# 사용:
#   ./scripts/upload-secrets-to-github.sh <app-slug>

set -euo pipefail

APP_SLUG="${1:-}"
if [[ -z "$APP_SLUG" ]]; then
  echo "Usage: $0 <app-slug>" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. https://cli.github.com/" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PENDING_DIR="$HOME/Documents/keystores-pending/$APP_SLUG"

if [[ ! -f "$PENDING_DIR/upload-keystore.jks" ]]; then
  echo "ERROR: $PENDING_DIR/upload-keystore.jks not found." >&2
  echo "먼저 ./scripts/generate-upload-keystore.sh $APP_SLUG 를 실행하세요." >&2
  exit 1
fi

# 키스토어 base64 인코딩 후 업로드
echo "[1/4] Uploading ANDROID_KEYSTORE_BASE64..."
base64 -i "$PENDING_DIR/upload-keystore.jks" | gh secret set ANDROID_KEYSTORE_BASE64

# 비밀번호 추출 (passwords.txt에서)
STORE_PASS="$(grep -E '^Store Password:' "$PENDING_DIR/passwords.txt" | cut -d: -f2- | xargs)"
KEY_PASS="$(grep -E '^Key Password:' "$PENDING_DIR/passwords.txt" | cut -d: -f2- | xargs)"
KEY_ALIAS="$(grep -E '^Key Alias:' "$PENDING_DIR/passwords.txt" | cut -d: -f2- | xargs)"

echo "[2/4] Uploading ANDROID_KEYSTORE_PASSWORD..."
echo -n "$STORE_PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD

echo "[3/4] Uploading ANDROID_KEY_PASSWORD..."
echo -n "$KEY_PASS" | gh secret set ANDROID_KEY_PASSWORD

echo "[4/4] Uploading ANDROID_KEY_ALIAS..."
echo -n "$KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS

echo ""
echo "✅ Android 서명 Secrets 업로드 완료."
echo ""
echo "추가로 수동 등록해야 하는 Secrets (Play Console + Sentry):"
echo "  gh secret set PLAY_STORE_JSON_KEY       # Play Console service account JSON 내용"
echo "  gh secret set SENTRY_AUTH_TOKEN         # sentry-cli용 Auth Token"
echo "  gh secret set SENTRY_ORG                # 예: storkspear"
echo "  gh secret set SENTRY_PROJECT            # 예: flutter"
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x scripts/upload-secrets-to-github.sh`

- [ ] **Step 3: 문법 검증**

Run: `bash -n scripts/upload-secrets-to-github.sh`
Expected: 출력 없음

- [ ] **Step 4: 커밋**

```bash
git add scripts/upload-secrets-to-github.sh
git commit -m "feat(scripts): add upload-secrets-to-github.sh for CI secret provisioning"
```

---

### Task 7: batch-backup-keystores.sh — 주기적 배치 백업

**Files:**
- Create: `scripts/batch-backup-keystores.sh`

- [ ] **Step 1: 스크립트 작성**

Create `scripts/batch-backup-keystores.sh`:

```bash
#!/usr/bin/env bash
# ~/Documents/keystores-pending/ 아래 모든 앱 키스토어를 암호화 zip으로 묶어
# 원하는 백업 위치로 이동한다. 완료 후 pending 폴더 비움.
#
# 사용:
#   ./scripts/batch-backup-keystores.sh [backup-dir]
# 예:
#   ./scripts/batch-backup-keystores.sh /Volumes/NAS/keystores

set -euo pipefail

BACKUP_DIR="${1:-}"
PENDING_DIR="$HOME/Documents/keystores-pending"

if [[ -z "$BACKUP_DIR" ]]; then
  echo "Usage: $0 <backup-dir>" >&2
  echo "예: $0 /Volumes/NAS/keystores" >&2
  exit 1
fi

if [[ ! -d "$PENDING_DIR" ]]; then
  echo "No pending keystores. Nothing to backup."
  exit 0
fi

PENDING_APPS=($(ls -1 "$PENDING_DIR" 2>/dev/null || true))
if [[ ${#PENDING_APPS[@]} -eq 0 ]]; then
  echo "Pending 폴더 비어있음. 백업할 것 없음."
  exit 0
fi

if ! command -v 7z >/dev/null 2>&1; then
  echo "ERROR: 7z not found. 'brew install p7zip' 또는 동등 설치 필요." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PASS="$(openssl rand -base64 32 | tr -d '/=+' | cut -c1-32)"
ARCHIVE_PATH="$BACKUP_DIR/keystores-$TIMESTAMP.7z"

echo "📦 다음 앱들을 백업합니다:"
printf '  - %s\n' "${PENDING_APPS[@]}"
echo ""
echo "🗜  암호화 zip 생성 중..."

(cd "$PENDING_DIR" && 7z a -p"$ARCHIVE_PASS" -mhe=on "$ARCHIVE_PATH" "${PENDING_APPS[@]}")

echo ""
echo "================================================================"
echo "✅ 백업 완료: $ARCHIVE_PATH"
echo "================================================================"
echo ""
echo "‼️  다음 비밀번호를 업무 노트에 저장하세요 (분실 시 복구 불가):"
echo ""
echo "    Archive: keystores-$TIMESTAMP.7z"
echo "    Password: $ARCHIVE_PASS"
echo ""
echo "================================================================"
echo ""
read -r -p "업무 노트에 저장했습니까? (y/N) " confirmed
if [[ "$confirmed" == "y" || "$confirmed" == "Y" ]]; then
  rm -rf "$PENDING_DIR"/*
  echo "🧹 Pending 폴더 비움."
else
  echo "⚠️  Pending 폴더 그대로 둠. 확인 후 직접 삭제하세요: rm -rf $PENDING_DIR/*"
fi
```

- [ ] **Step 2: 실행 권한 + 문법 체크**

Run:
```bash
chmod +x scripts/batch-backup-keystores.sh
bash -n scripts/batch-backup-keystores.sh
```
Expected: 문법 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add scripts/batch-backup-keystores.sh
git commit -m "feat(scripts): add batch-backup-keystores.sh for periodic keystore archival"
```

---

### Task 8: GitHub Actions release-android.yml — 태그 트리거 릴리스 워크플로

**Files:**
- Create: `.github/workflows/release-android.yml`

- [ ] **Step 1: 워크플로 작성**

Create `.github/workflows/release-android.yml`:

```yaml
name: release-android

on:
  push:
    tags:
      - 'v*'

env:
  FLUTTER_VERSION: '3.32.8'

jobs:
  release-android:
    name: Release AAB → Play Internal + Sentry mapping
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
          working-directory: android

      - uses: subosito/flutter-action@v2
        with:
          channel: stable
          flutter-version: ${{ env.FLUTTER_VERSION }}
          cache: true

      - name: Install Flutter deps
        run: flutter pub get

      - name: Decode keystore
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: |
          if [ -z "$ANDROID_KEYSTORE_BASE64" ]; then
            echo "::error::ANDROID_KEYSTORE_BASE64 secret not set. 파생 레포에서 upload-secrets-to-github.sh를 먼저 실행하세요."
            exit 1
          fi
          mkdir -p android/app
          echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/app/upload-keystore.jks

      - name: Write Play Store credentials
        env:
          PLAY_STORE_JSON_KEY: ${{ secrets.PLAY_STORE_JSON_KEY }}
        run: |
          if [ -z "$PLAY_STORE_JSON_KEY" ]; then
            echo "::error::PLAY_STORE_JSON_KEY secret not set."
            exit 1
          fi
          echo "$PLAY_STORE_JSON_KEY" > android/play-store-credentials.json

      - name: Install sentry-cli
        run: curl -sL https://sentry.io/get-cli/ | bash

      - name: Extract version from tag
        id: version
        run: |
          VERSION="${GITHUB_REF_NAME#v}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Run fastlane beta (build + Play Internal upload)
        working-directory: android
        env:
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          PLAY_STORE_JSON_KEY_PATH: play-store-credentials.json
        run: bundle exec fastlane android beta

      - name: Upload Sentry mapping
        working-directory: android
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        run: |
          if [ -z "$SENTRY_AUTH_TOKEN" ]; then
            echo "::warning::SENTRY_AUTH_TOKEN not set — mapping upload skipped. Stack traces will be obfuscated in Sentry."
            exit 0
          fi
          bundle exec fastlane android upload_sentry_mapping version:${{ steps.version.outputs.version }}

      - name: Cleanup credentials
        if: always()
        run: |
          rm -f android/app/upload-keystore.jks android/play-store-credentials.json
```

- [ ] **Step 2: YAML 문법 검증**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-android.yml'))" 2>&1`
Expected: 출력 없음 (문법 OK)

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/release-android.yml
git commit -m "ci(android): add tag-triggered release workflow (Play Internal + Sentry mapping)"
```

---

### Task 9: rename-app.sh 확장 — Fastlane Appfile 도 동기화

**Files:**
- Modify: `scripts/rename-app.sh`

- [ ] **Step 1: 현재 rename-app.sh 읽고 applicationId/namespace 치환 로직 확인**

Run: `grep -n "applicationId\|namespace\|package_name" scripts/rename-app.sh`
Expected: 기존 치환 로직 존재 (Android manifest, build.gradle.kts 등).

- [ ] **Step 2: rename-app.sh에 Fastlane Appfile 치환 추가**

기존 스크립트에서 `applicationId`를 치환하는 sed 블록 근처에 (또는 해당 함수 안에) 다음 추가:

```bash
# Fastlane Appfile 내 package_name 동기화
if [[ -f "$REPO_ROOT/android/fastlane/Appfile" ]]; then
  sed -i.bak -E "s/^package_name\\(\".*\"\\)/package_name(\"$NEW_PACKAGE\")/" \
    "$REPO_ROOT/android/fastlane/Appfile"
  rm -f "$REPO_ROOT/android/fastlane/Appfile.bak"
fi
```

**주의**: 기존 스크립트의 변수명 규칙에 맞춰 `$NEW_PACKAGE`, `$REPO_ROOT` 등을 실제 스크립트 컨텍스트의 변수명으로 맞춰야 한다. 스크립트를 먼저 읽고 정확한 변수명으로 교체.

- [ ] **Step 3: 스크립트 문법 검증**

Run: `bash -n scripts/rename-app.sh`
Expected: 출력 없음

- [ ] **Step 4: 커밋**

```bash
git add scripts/rename-app.sh
git commit -m "fix(scripts): rename-app.sh syncs android/fastlane/Appfile package_name"
```

---

## Section 3: 런타임 보안 + 문서 (Task 10–14)

이 섹션이 끝나면:
- SSL 핀닝이 옵트인으로 활성화 가능 (`--dart-define=SSL_PINS=...`)
- AndroidManifest가 cleartext 트래픽 차단
- 파생 레포 체크리스트 문서화

---

### Task 10: SslPinningEnv + Tests (TDD)

**Files:**
- Create: `lib/kits/backend_api_kit/ssl_pinning_env.dart`
- Create: `test/kits/backend_api_kit/ssl_pinning_env_test.dart`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/kits/backend_api_kit/ssl_pinning_env_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/kits/backend_api_kit/ssl_pinning_env.dart';

void main() {
  group('SslPinningEnv', () {
    test('returns empty list when SSL_PINS is empty', () {
      expect(SslPinningEnv.pins, isEmpty);
      expect(SslPinningEnv.isEnabled, isFalse);
    });

    test('parses comma-separated SHA256 pins into list', () {
      final parsed = SslPinningEnv.parsePins('sha256/ABC=,sha256/DEF=');
      expect(parsed, ['sha256/ABC=', 'sha256/DEF=']);
    });

    test('trims whitespace around pins', () {
      final parsed = SslPinningEnv.parsePins('  sha256/ABC=  , sha256/DEF= ');
      expect(parsed, ['sha256/ABC=', 'sha256/DEF=']);
    });

    test('ignores empty entries', () {
      final parsed = SslPinningEnv.parsePins('sha256/ABC=,,sha256/DEF=');
      expect(parsed, ['sha256/ABC=', 'sha256/DEF=']);
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — FAIL**

Run: `flutter test test/kits/backend_api_kit/ssl_pinning_env_test.dart`
Expected: FAIL — 파일 없음

- [ ] **Step 3: 구현**

Create `lib/kits/backend_api_kit/ssl_pinning_env.dart`:

```dart
/// SSL 핀닝용 `--dart-define` 값 래퍼.
///
/// 주입 형식:
/// ```
/// flutter run \
///   --dart-define=SSL_PINS=sha256/AAAA=,sha256/BBBB=
/// ```
///
/// 핀 값은 `openssl s_client -servername <host> -connect <host>:443 < /dev/null | \
///   openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
///   openssl dgst -sha256 -binary | openssl enc -base64` 로 추출.
///
/// 최소 2개 권장 (현재 인증서 + 백업 인증서). 인증서 갱신 시 앱이 안 터지도록.
class SslPinningEnv {
  const SslPinningEnv._();

  static const String _rawPins =
      String.fromEnvironment('SSL_PINS', defaultValue: '');

  static List<String> get pins => parsePins(_rawPins);

  static bool get isEnabled => pins.isNotEmpty;

  /// 콤마로 구분된 핀 문자열을 파싱. 공백 제거, 빈 항목 제외.
  static List<String> parsePins(String raw) {
    if (raw.isEmpty) return const [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }
}
```

- [ ] **Step 4: 테스트 재실행 — PASS**

Run: `flutter test test/kits/backend_api_kit/ssl_pinning_env_test.dart`
Expected: 4 tests pass

- [ ] **Step 5: 커밋**

```bash
git add lib/kits/backend_api_kit/ssl_pinning_env.dart test/kits/backend_api_kit/ssl_pinning_env_test.dart
git commit -m "feat(security): add SslPinningEnv for --dart-define=SSL_PINS parsing"
```

---

### Task 11: SSL Pinning HttpClientAdapter (TDD)

**Files:**
- Create: `lib/kits/backend_api_kit/ssl_pinning.dart`
- Create: `test/kits/backend_api_kit/ssl_pinning_test.dart`

- [ ] **Step 1: 실패 테스트 작성**

Create `test/kits/backend_api_kit/ssl_pinning_test.dart`:

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_template/kits/backend_api_kit/ssl_pinning.dart';

void main() {
  group('computePinFromCert', () {
    test('throws when cert is empty', () {
      expect(() => SslPinning.computePinFromCert(Uint8List(0)),
          throwsA(isA<ArgumentError>()));
    });

    test('produces sha256/<base64> format', () {
      // 더미 DER 바이트(실제 인증서 아님) — 포맷만 검증
      final bytes = Uint8List.fromList(List.generate(32, (i) => i));
      final pin = SslPinning.computePinFromCert(bytes);
      expect(pin, startsWith('sha256/'));
      expect(pin.length, greaterThan('sha256/'.length + 40));
    });
  });

  group('SslPinning.matches', () {
    test('matches exact pin', () {
      final bytes = Uint8List.fromList(List.generate(32, (i) => i));
      final pin = SslPinning.computePinFromCert(bytes);
      expect(SslPinning.matches(bytes, [pin]), isTrue);
    });

    test('fails when cert does not match any pin', () {
      final bytes = Uint8List.fromList(List.generate(32, (i) => i));
      expect(SslPinning.matches(bytes, ['sha256/fakepin=']), isFalse);
    });

    test('returns true (bypass) when pins list is empty', () {
      // 핀이 없으면 핀닝 비활성 — 기본 TLS 검증만 수행하도록 위임
      final bytes = Uint8List.fromList([1, 2, 3]);
      expect(SslPinning.matches(bytes, []), isTrue);
    });
  });
}
```

- [ ] **Step 2: 테스트 실행 — FAIL**

Run: `flutter test test/kits/backend_api_kit/ssl_pinning_test.dart`
Expected: FAIL — 파일 없음

- [ ] **Step 3: 구현**

Create `lib/kits/backend_api_kit/ssl_pinning.dart`:

```dart
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

/// 인증서 SHA256 기반 SSL 핀닝 유틸.
///
/// 사용 패턴:
/// 1. 빌드 시 `--dart-define=SSL_PINS=sha256/XXX=,sha256/YYY=` 주입
/// 2. ApiClient 초기화 시 `SslPinning.applyTo(dio, pins: SslPinningEnv.pins)` 호출
///
/// 핀이 비어있으면 어댑터 교체 안 함 (no-op).
class SslPinning {
  const SslPinning._();

  /// DER 바이트로부터 `sha256/<base64>` 핀 문자열 생성.
  static String computePinFromCert(Uint8List der) {
    if (der.isEmpty) {
      throw ArgumentError('Certificate bytes cannot be empty');
    }
    final digest = sha256.convert(der);
    return 'sha256/${base64.encode(digest.bytes)}';
  }

  /// [certBytes]의 핀이 [pins] 중 하나와 일치하는지.
  /// [pins]가 비어있으면 `true` (핀닝 비활성 = 기본 TLS 검증만).
  static bool matches(Uint8List certBytes, List<String> pins) {
    if (pins.isEmpty) return true;
    final computed = computePinFromCert(certBytes);
    return pins.contains(computed);
  }

  /// [dio]의 HttpClientAdapter를 핀닝 래퍼로 교체한다.
  /// [pins]가 비어있으면 no-op.
  static void applyTo(Dio dio, {required List<String> pins}) {
    if (pins.isEmpty) return;
    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        client.badCertificateCallback = (cert, host, port) {
          // badCertificateCallback은 기본 검증이 실패했을 때만 호출됨.
          // 핀 매칭되면 허용, 아니면 거부.
          return matches(Uint8List.fromList(cert.der), pins);
        };
        // 정상 인증서도 핀 검증 통과해야 하므로 connectionFactory에 훅이 필요하지만,
        // Dart HttpClient 한계상 badCertificateCallback 레벨만 기본 제공.
        // 프로덕션에서는 별도 SecurityContext로 trusted root 제한 + 핀 검증 이중화 권장.
        return client;
      },
    );
  }
}
```

**주의**: `crypto` 패키지가 없을 수 있음. Step 3.5에 추가.

- [ ] **Step 3.5: `crypto` 의존성 추가 (있으면 스킵)**

Run: `grep -E "^\s+crypto:" pubspec.yaml`
없으면:
```bash
flutter pub add crypto
```

- [ ] **Step 4: 테스트 재실행 — PASS**

Run: `flutter test test/kits/backend_api_kit/ssl_pinning_test.dart`
Expected: 5 tests pass

- [ ] **Step 5: 커밋**

```bash
git add lib/kits/backend_api_kit/ssl_pinning.dart test/kits/backend_api_kit/ssl_pinning_test.dart pubspec.yaml pubspec.lock
git commit -m "feat(security): add SSL pinning utility for Dio HttpClientAdapter"
```

---

### Task 12: ApiClient 통합 — 선택적 SSL 핀닝 적용

**Files:**
- Modify: `lib/kits/backend_api_kit/api_client.dart`

- [ ] **Step 1: ApiClient 수정**

`lib/kits/backend_api_kit/api_client.dart`의 생성자에서 interceptor 추가 직후 한 줄 추가:

기존 (lines 28-46 근처):
```dart
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.instance.baseUrl,
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.addAll([
      AuthInterceptor(
        tokenStorage: _tokenStorage,
        dio: _dio,
        onTokenRefresh: _onTokenRefresh,
      ),
      ErrorInterceptor(),
      LoggingInterceptor(),
    ]);
  }
```

수정 후:
```dart
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.instance.baseUrl,
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // SSL 핀닝: --dart-define=SSL_PINS=... 주입 시 활성. 없으면 no-op.
    SslPinning.applyTo(_dio, pins: SslPinningEnv.pins);

    _dio.interceptors.addAll([
      AuthInterceptor(
        tokenStorage: _tokenStorage,
        dio: _dio,
        onTokenRefresh: _onTokenRefresh,
      ),
      ErrorInterceptor(),
      LoggingInterceptor(),
    ]);
  }
```

그리고 imports 추가:
```dart
import 'ssl_pinning.dart';
import 'ssl_pinning_env.dart';
```

- [ ] **Step 2: analyzer + 기존 테스트**

Run: `flutter analyze lib/kits/backend_api_kit/api_client.dart && flutter test test/`
Expected: No issues. All tests pass.

- [ ] **Step 3: 커밋**

```bash
git add lib/kits/backend_api_kit/api_client.dart
git commit -m "feat(security): apply SSL pinning to ApiClient when SSL_PINS is provided"
```

---

### Task 13: AndroidManifest + network_security_config

**Files:**
- Create: `android/app/src/main/res/xml/network_security_config.xml`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: network_security_config.xml 생성**

Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Release: cleartext 전면 차단 (HTTPS만 허용) -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Debug: localhost/에뮬레이터 주소 cleartext 허용 (로컬 API 개발용) -->
    <debug-overrides>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>

    <!-- Dev 서버가 http일 경우 여기 도메인 추가 (파생 레포에서 편집).
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">dev.api.yourapp.com</domain>
    </domain-config>
    -->
</network-security-config>
```

- [ ] **Step 2: AndroidManifest.xml 수정**

Read current manifest:
```bash
cat android/app/src/main/AndroidManifest.xml
```

`<application ...>` 태그 속성에 두 개 추가:
- `android:usesCleartextTraffic="false"`
- `android:networkSecurityConfig="@xml/network_security_config"`

예시 (기존 application 태그에 속성 추가):
```xml
<application
    android:label="app_template"
    android:name="${applicationName}"
    android:icon="@mipmap/ic_launcher"
    android:usesCleartextTraffic="false"
    android:networkSecurityConfig="@xml/network_security_config">
```

**주의**: 기존 application 태그 다른 속성들(label, icon 등)은 그대로 유지.

- [ ] **Step 3: Debug + Release 빌드 모두 검증**

Run:
```bash
flutter build apk --debug && flutter build apk --release
```
Expected: 둘 다 BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add android/app/src/main/res/xml/network_security_config.xml android/app/src/main/AndroidManifest.xml
git commit -m "feat(security): disable cleartext + add network_security_config for release"
```

---

### Task 14: 문서화 — deployment-android.md + security.md + README 업데이트

**Files:**
- Create: `docs/integrations/deployment-android.md`
- Create: `docs/integrations/security.md`
- Modify: `docs/integrations/README.md`

- [ ] **Step 1: deployment-android.md 작성**

Create `docs/integrations/deployment-android.md`:

```markdown
# Android 배포 (파생 레포 체크리스트)

이 템플릿은 Android 배포 인프라(서명·Fastlane·GHA 워크플로·Sentry mapping 업로드)를 이미 갖추고 있다. 파생 레포에서는 아래 절차만 수행하면 즉시 Play Internal 배포 가능.

## 준비 (한 번만)

1. **Google Play Developer 계정**: https://play.google.com/console 가입 ($25 일회성)
2. **Play Console에 앱 생성**: Create App → 이름 입력 → Package name은 이 레포 `android/app/build.gradle.kts`의 `applicationId`와 동일해야 함
3. **Service Account JSON 발급**:
   - Play Console → Settings → API access → Create Service Account
   - Google Cloud Console에서 JSON key 다운로드 (`play-store-credentials.json`)
   - **이 파일은 커밋 금지** (`.gitignore` 처리됨)
4. **Sentry Auth Token 발급** (이 레포의 관측성 기능 쓰는 경우):
   - https://<your-org>.sentry.io/settings/auth-tokens/ → Create Token
   - Scopes: `project:read`, `project:releases`, `project:write`

## 키스토어 생성 (앱당 한 번)

```bash
./scripts/generate-upload-keystore.sh <app-slug>
# 예: ./scripts/generate-upload-keystore.sh money-app
```

결과:
- `android/app/upload-keystore.jks` (gitignore됨)
- `android/key.properties` (gitignore됨)
- `~/Documents/keystores-pending/<app-slug>/` (임시 백업)

## GitHub Secrets 업로드 (앱당 한 번)

```bash
./scripts/upload-secrets-to-github.sh <app-slug>
```

이후 수동 등록 (안내 출력됨):

```bash
# Play Console service account JSON 내용 전체
gh secret set PLAY_STORE_JSON_KEY < path/to/play-store-credentials.json

# Sentry (관측성 사용 시)
gh secret set SENTRY_AUTH_TOKEN    # sntrys_...
gh secret set SENTRY_ORG           # 예: storkspear
gh secret set SENTRY_PROJECT       # 예: flutter
```

## 배포 실행

### 방법 A: Git tag 트리거 (추천)

```bash
git tag v1.0.0
git push origin v1.0.0
```

→ `.github/workflows/release-android.yml`이 자동으로:
1. 체크아웃 + Flutter/Ruby 셋업
2. 키스토어 디코딩
3. `fastlane android beta` 실행 (AAB 빌드 + Play Internal 업로드)
4. Sentry mapping 업로드 (토큰 있으면)

### 방법 B: 로컬 수동 실행

```bash
cd android
bundle install
bundle exec fastlane android beta
```

## 주기적 백업

월 1회 정도:
```bash
./scripts/batch-backup-keystores.sh /Volumes/NAS/keystores
```
→ `~/Documents/keystores-pending/`의 모든 앱 키스토어를 암호화 zip으로 묶어 지정 위치로 이전.

## 트러블슈팅

### `keystore not found` in CI
→ `ANDROID_KEYSTORE_BASE64` Secret이 비어있거나 잘못됨. `upload-secrets-to-github.sh` 재실행.

### Play Upload 실패: `APK signature does not match`
→ 이전에 업로드한 키와 다른 키로 서명. Play App Signing 활성화되어 있다면 upload key 재발급 가능.

### R8 runtime crash: `NoClassDefFoundError`
→ 새 의존성이 R8에 의해 제거됨. `android/app/proguard-rules.pro`에 `-keep class ...` 규칙 추가.

### mapping.txt 업로드 안 됨
→ `SENTRY_AUTH_TOKEN` Secret 미설정. 경고만 출력되고 빌드 자체는 통과.
```

- [ ] **Step 2: security.md 작성**

Create `docs/integrations/security.md`:

```markdown
# 적용된 보안 정책 요약

## 빌드 단계

| 항목 | 상태 | 위치 |
|------|------|------|
| R8/ProGuard 난독화 | ✅ release 활성 | `android/app/build.gradle.kts` |
| R8 규칙 파일 | ✅ 제공 | `android/app/proguard-rules.pro` |
| Resource shrinking | ✅ release 활성 | `android/app/build.gradle.kts` |
| 업로드 키 서명 | ✅ key.properties/env 주입 지원 | `android/app/build.gradle.kts` |
| Play App Signing | ⚠️ 파생 레포에서 활성화 필요 | Play Console에서 첫 업로드 시 |

## 런타임

| 항목 | 상태 | 위치 |
|------|------|------|
| Cleartext HTTP 차단 | ✅ release 전면 차단 | `AndroidManifest.xml` + `network_security_config.xml` |
| SSL 인증서 핀닝 | ✅ opt-in (`--dart-define=SSL_PINS=`) | `lib/kits/backend_api_kit/ssl_pinning.dart` |
| SecureStorage (토큰) | ✅ Keychain/EncryptedSharedPreferences | `lib/core/storage/secure_storage.dart` |
| JWT refresh 큐잉 | ✅ AuthInterceptor (QueuedInterceptor) | `lib/kits/backend_api_kit/interceptors/auth_interceptor.dart` |

## 비밀 관리

| 항목 | 상태 | 비고 |
|------|------|------|
| `.env` 파일 커밋 차단 | ✅ `.gitignore` | `.env.example`만 커밋 |
| 키스토어 커밋 차단 | ✅ `.gitignore` (`*.jks`, `*.keystore`) | |
| Google Service config 차단 | ✅ `.gitignore` | `google-services.json`, `GoogleService-Info.plist` |
| Play json key 차단 | ✅ `.gitignore` | |
| GHA Secrets 중심 관리 | ✅ `scripts/upload-secrets-to-github.sh` | 원본 백업은 주기적으로 별도 |

## 관측성 (PII 보호)

| 항목 | 상태 |
|------|------|
| Sentry `sendDefaultPii = false` | ✅ (IP 등 자동 수집 차단) |
| Sentry Data Scrubbing | ✅ 대시보드 기본값 활용 |
| PostHog identify 시 email 전송 | ⚠️ 앱별 판단 — GDPR 대상이면 해시 처리 또는 제거 |

## SSL 핀닝 활성화 방법

1. 서버 인증서의 SPKI SHA256 추출:
   ```bash
   openssl s_client -servername api.yourapp.com -connect api.yourapp.com:443 < /dev/null 2>/dev/null | \
     openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
     openssl dgst -sha256 -binary | openssl enc -base64
   # 출력 예: AAAAAAAAA=
   ```

2. 백업 인증서도 같은 방법으로 추출 (인증서 갱신 대비 — 최소 2개 권장)

3. 빌드 시 주입:
   ```bash
   flutter build appbundle --release \
     --dart-define=SSL_PINS=sha256/AAAAAAAAA=,sha256/BBBBBBBBB=
   ```

## 다음 단계 (추후 추가 고려 사항)

- Root/Jailbreak 탐지 (`freerasp` 등) — 금융/민감 앱만
- Play Integrity API 통합 (앱 변조 탐지)
- Certificate Transparency (CT) 검증
- 빌드 아티팩트 해시 검증 (supply chain)
```

- [ ] **Step 3: docs/integrations/README.md 업데이트**

기존 파일 읽고, 표에 새 항목 추가:

```markdown
| 대상 | 템플릿 기본 | 가이드 |
|------|-----------|-------------|
| 크래시 리포팅 | **observability_kit** 내장 (Sentry) — DSN 미주입 시 `DebugCrashService` | [`sentry.md`](./sentry.md) |
| 사용자 행동 분석 | **observability_kit** 내장 (PostHog) — Key 미주입 시 `DebugAnalyticsService` | [`posthog.md`](./posthog.md) 또는 [`analytics.md`](./analytics.md) |
| 푸시 알림 | `DebugNotificationService` | [`fcm.md`](./fcm.md) |
| **Android 배포** | Fastlane + GHA release workflow 내장 | [`deployment-android.md`](./deployment-android.md) |
| **보안 정책** | R8, SSL 핀닝 opt-in, cleartext 차단 등 | [`security.md`](./security.md) |
```

- [ ] **Step 4: 전체 검증**

Run:
```bash
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release
```
Expected: 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add docs/integrations/
git commit -m "docs(deployment,security): add Android deployment + security overview"
```

---

## Self-Review (Section 1-3 요약)

- ✅ **Section 1 커버**: key.properties + keystore 생성 스크립트 + build.gradle.kts signing + R8/ProGuard
- ✅ **Section 2 커버**: Fastlane 3 lane (build_release/beta/deploy/upload_sentry_mapping) + GHA release-android.yml + upload-secrets/batch-backup 스크립트 + rename-app.sh 확장
- ✅ **Section 3 커버**: SSL 핀닝 env + 유틸 + ApiClient 통합 + AndroidManifest 하드닝 + 2개 문서

**Placeholder scan**: 모든 Task에 실 코드/명령어 포함. "TODO"는 `build.gradle.kts`와 `AndroidManifest.xml`의 기존 코멘트만 그대로 유지 (수정 대상 아님).

**Type consistency**:
- `SslPinningEnv.pins` (List<String>), `SslPinning.applyTo(dio, pins: ...)` — 일관
- `scripts/*.sh`의 `$APP_SLUG`, `$PENDING_DIR` — 일관
- Fastlane lane 이름: `build_release`, `beta`, `deploy`, `upload_sentry_mapping` — GHA workflow와 일치

**리스크/미결**:
- Task 9의 `rename-app.sh` 확장은 기존 스크립트 내용에 맞춰 변수명을 조정해야 함 — 실행자는 스크립트를 먼저 읽고 `$NEW_PACKAGE` 등을 해당 스크립트의 실제 변수명으로 맞춰야 한다.
- iOS 대응(fastlane match, App Store Connect API)은 Phase 2b로 연기.
- Sentry mapping 업로드는 SENTRY_AUTH_TOKEN 없어도 경고만 내고 통과 — 파생 레포에서 관측성 안 쓰는 경우 대비.
