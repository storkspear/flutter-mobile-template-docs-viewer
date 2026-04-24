# Security

**5중 방어선** — Android R8 난독화 · Dart 심볼 난독화 · Cleartext 차단 · Keychain 정책 · SSL pinning (opt-in). 근거는 [`ADR-020`](../philosophy/adr-020-security-hardening.md).

---

## 방어선 요약

| 방어선 | 기본 활성 | 공격 유형 차단 |
|--------|----------|---------------|
| Android R8 난독화 | ✅ release | 리버스 엔지니어링 |
| Dart 심볼 난독화 + Sentry | ✅ release | 문자열 추출 |
| Cleartext HTTP 차단 | ✅ release | 평문 통신 실수 |
| Keychain / EncryptedSharedPreferences | ✅ | 탈옥/루팅 시 토큰 탈취 |
| SSL pinning | ⬜ opt-in | MITM |

---

## 1. Android R8 난독화

### 설정 (`android/app/build.gradle.kts`)

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

### `android/app/proguard-rules.pro`

플러그인별 `-keep` 규칙 유지. 주요 규칙:

```proguard
# Flutter 기본
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# JSON 직렬화 (Serializable 구현체)
-keep class * implements java.io.Serializable { *; }

# 플러그인별 keep (예: sqlite3_flutter_libs, sentry_flutter)
-keep class com.tekartik.sqflite.** { *; }
-keep class io.sentry.** { *; }
```

### 검증

Release APK 에서 클래스명이 난독화됐는지:

```bash
cd android
./gradlew :app:assembleRelease
unzip -p app/build/outputs/apk/release/app-release.apk classes.dex | dexdump - | head
```

`a.b.c` 같은 짧은 이름이 보이면 난독화 정상.

---

## 2. Dart 심볼 난독화 + 심볼 업로드

### 빌드 플래그

```bash
flutter build appbundle \
  --release \
  --obfuscate \
  --split-debug-info=build/app/symbols
```

`build/app/symbols/` 에 난독화 매핑 생성.

### Sentry 업로드 (필수)

```bash
npx @sentry/cli upload-dif \
  --org $SENTRY_ORG \
  --project $SENTRY_PROJECT \
  build/app/symbols
```

업로드 안 하면 Sentry 대시보드의 스택 트레이스가 `a.b.c` 상태 → 디버깅 불가.

---

## 3. Cleartext HTTP 차단

### Android

`android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

`android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="false">
</application>
```

### iOS

`ATS (App Transport Security)` 가 기본 HTTPS 강제. 별도 설정 불필요.

### 효과

Release 빌드에서 `http://api.example.com` 요청 시 즉시 실패. `https://` 만 허용.

---

## 4. Keychain / EncryptedSharedPreferences

### 설정 (`lib/core/storage/secure_storage.dart`)

```dart
static const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);
```

### `first_unlock_this_device` 이유

| 옵션 | 의미 |
|------|------|
| `first_unlock` | 첫 unlock 이후 백그라운드도 접근 가능 (FCM · workmanager 필요) |
| `this_device` | iCloud Keychain 백업 제외 (기기 복제 시 토큰 따라가지 않음) |

상세는 [`ADR-013`](../philosophy/adr-013-token-atomic-storage.md).

---

## 5. SSL Pinning (opt-in)

### 활성화

```bash
flutter build appbundle \
  --dart-define=SSL_PINS=sha256/AAA=,sha256/BBB=
```

### 핀 추출 (서버 인증서에서)

```bash
echo | openssl s_client -servername api.example.com -connect api.example.com:443 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform DER \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
```

출력: `sha256/BASE64_HASH=`

### 최소 2개 핀 유지

인증서 갱신 시 **앱 업데이트 전** 에 기존 앱이 먹통 되지 않도록 2개 이상:
- 현재 인증서 핀
- 백업 (다음 발급 예정 인증서 공개키 핀)

---

## 추가 보안 규칙

### PII 수집 최소화

```dart
// Sentry
options.sendDefaultPii = false;  // IP · 쿠키 자동 수집 차단

// PostHog
properties: {
  'query_length': input.length,  // 내용 말고 길이만
}
```

### Keystore · 인증서 관리

- **절대 커밋 금지**: `.gitignore` 에 `*.jks`, `*.p8`, `*.p12`, `*.mobileprovision`
- **GitHub Secrets** 만 사용
- **Bitwarden · 1Password** 같은 패스워드 매니저에 백업
- 팀원 합류 시 `fastlane match` 로 자동 동기화

### 앱 디버그 기능 Release 에 유출 방지

```dart
// 금지
bool showDebugPanel = true;  // 하드코딩

// 올바르게
bool showDebugPanel = kDebugMode;  // Release 에서 자동 false
// 또는 --dart-define 로 제어
```

---

## 파생 레포 체크리스트

- [ ] R8 · proguard-rules.pro 확인 (템플릿에 기본 세팅)
- [ ] 난독화 빌드 플래그 CI 에 포함
- [ ] Sentry 심볼 업로드 단계 CI 에 포함
- [ ] network_security_config.xml 확인
- [ ] (선택) SSL pinning 도입 시 핀 관리 프로세스 수립
- [ ] Keystore · 인증서 .gitignore 확인
- [ ] PII 수집 설정 검토

---

## 관련 문서

- [`ADR-013 · 토큰 원자 저장`](../philosophy/adr-013-token-atomic-storage.md)
- [`ADR-020 · 이중 난독화 + SSL 핀닝 + Keychain`](../philosophy/adr-020-security-hardening.md)
- [`secrets-management.md`](./secrets-management.md)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
