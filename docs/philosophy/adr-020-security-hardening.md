# ADR-020 · 이중 난독화 + SSL 핀닝 + Keychain 정책

**Status**: Accepted. 현재 유효. 2026-04-24 기준 Android R8 난독화 (`android/app/build.gradle.kts` · `proguard-rules.pro`) + Dart `--obfuscate --split-debug-info` + Sentry 심볼 업로드 + iOS Keychain `first_unlock_this_device` + SSL pinning opt-in (`lib/kits/backend_api_kit/ssl_pinning.dart`).

## 결론부터

**보안은 5중 방어선** — Android R8 난독화 · Dart 심볼 난독화 · Cleartext HTTP 차단 · SSL pinning (opt-in) · Keychain / EncryptedSharedPreferences. 각각 공격 유형이 달라서 한 층이 뚫려도 나머지가 막아요. 추가 비용은 CI 설정 약간 + Sentry 심볼 업로드 · 핀 관리. 인디 앱이 과도하게 엔터프라이즈 보안을 흉내 내는 건 피하되, **기본선은 지켜요**.

## 왜 이런 고민이 시작됐나?

모바일 앱은 서버 앱과 공격 표면이 달라요. **사용자 기기에 APK / IPA 가 직접 설치** 되므로 공격자가 바이너리를 자유롭게 분석 가능. 주요 공격 유형:

1. **바이너리 리버스 엔지니어링** — `jadx` · `IDA` 로 코드 추출 → API 구조 파악
2. **문자열 추출** — `strings` 명령으로 하드코딩 secret · API 엔드포인트 노출
3. **MITM 공격** — 공용 Wi-Fi 에서 HTTPS 트래픽 가로채기 (사용자 동의 하에 인증서 설치 시 가능)
4. **로컬 저장소 탈취** — 탈옥/루팅 기기에서 토큰 추출
5. **동적 분석** — Frida 등으로 런타임 메서드 후킹

압력들이 부딪혀요.

**압력 A — 엔터프라이즈 수준 보안 vs 인디 현실**  
금융 앱 수준 (RASP · 디버거 감지 · 화이트박스 암호화) 은 과투자. 하지만 **기본선 (난독화 · HTTPS · Keychain)** 은 지켜야.

**압력 B — 보안 도입 비용**  
난독화 설정 · 심볼 매핑 업로드 · SSL 핀 관리 등 설정 복잡도. 한번 설정하고 잊을 수 있어야.

**압력 C — 크래시 분석과의 트레이드오프**  
난독화하면 스택 트레이스가 `a.b.c()` 식으로 의미 불명. 심볼 매핑 업로드 안 하면 **자기 자신도 크래시 원인 못 찾음**.

**압력 D — 키 관리**  
SSL pinning 은 인증서 갱신 시 앱 업데이트 필요. 핀 1개만 쓰면 인증서 만료 = 앱 먹통.

이 결정이 답해야 했던 물음이에요.

> **인디 앱에 적절한 보안 수준 (엔터프라이즈 흉내 아니고, 무방비도 아닌) 의 경계는 어디인가?**

## 고민했던 대안들

### Option 1 — 보안 장치 없음 (plain 빌드)

난독화 · 핀닝 · 암호화 저장 전부 생략.

- **장점**: 설정 0. 크래시 스택 그대로.
- **단점 1**: API 구조 · 비즈니스 로직 공격자에게 open book.
- **단점 2**: 토큰 탈취 용이.
- **단점 3**: 스토어 리뷰에서 **"기본 보안 없음"** 으로 반려될 수 있음.
- **탈락 이유**: 압력 A 의 "기본선" 위반.

### Option 2 — 엔터프라이즈 수준

RASP (Runtime Application Self-Protection) · 디버거 감지 · root/jailbreak 감지 · 화이트박스 암호화 · certificate transparency 검증.

- **장점**: 금융 · 의료 급 보안.
- **단점 1**: 도입 · 유지 비용 **솔로 감당 불가** (ADR-019).
- **단점 2**: false positive 많음 — 루팅 탐지로 정상 사용자 차단.
- **단점 3**: 인디 앱에 과한 수준. 공격 동기 · 규모가 엔터프라이즈와 다름.
- **탈락 이유**: 과투자.

### Option 3 — 5중 방어선 (기본선 + opt-in) ★ (채택)

기본 방어선 4개 + SSL pinning 은 opt-in:

1. Android R8 난독화 (기본 활성)
2. Dart 심볼 난독화 + Sentry 업로드 (기본 활성)
3. Cleartext HTTP 차단 (release 기본 활성)
4. Keychain / EncryptedSharedPreferences (ADR-013, 기본 활성)
5. SSL pinning (opt-in, `--dart-define=SSL_PINS=...`)

- **압력 A 만족**: 기본선 충족, 엔터프라이즈 과투자 회피.
- **압력 B 만족**: 1회 설정 후 자동.
- **압력 C 만족**: Sentry 심볼 업로드로 난독화된 스택 복원.
- **압력 D 만족**: SSL pinning 은 인증서 관리 가능한 팀만 활성화.

## 결정

### 방어선 1 — Android R8 난독화

```kotlin
// android/app/build.gradle.kts 발췌
buildTypes {
  release {
    isMinifyEnabled = true
    isShrinkResources = true
    proguardFiles(
      getDefaultProguardFile("proguard-android-optimize.txt"),
      "proguard-rules.pro"
    )
    signingConfig = signingConfigs.getByName("release")
  }
}
```

```proguard
# android/app/proguard-rules.pro 발췌
# Flutter · Dart 내부 클래스 보존
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# Dart 생성 클래스 (JSON · code generation)
-keep class * implements java.io.Serializable { *; }
-keepclassmembers enum * { *; }

# 플러그인별 keep 규칙 (flutter_secure_storage · dio 등)
# ...
```

효과: Java/Kotlin 클래스명 · 메서드명을 `a.b.c()` 로 난독화. 리버스 엔지니어링 비용 대폭 증가.

### 방어선 2 — Dart 심볼 난독화 + Sentry 업로드

```yaml
# .github/workflows/release-android.yml 발췌
- name: Build AAB with obfuscation
  run: |
    flutter build appbundle \
      --release \
      --obfuscate \
      --split-debug-info=build/app/symbols \
      --dart-define=SENTRY_DSN=${{ secrets.SENTRY_DSN }} \
      --dart-define=POSTHOG_KEY=${{ secrets.POSTHOG_KEY }}

- name: Upload debug symbols to Sentry
  run: |
    npx @sentry/cli upload-dif \
      --org ${{ secrets.SENTRY_ORG }} \
      --project ${{ secrets.SENTRY_PROJECT }} \
      build/app/symbols
```

효과:
- Dart 클래스 / 메서드 이름이 **최종 바이너리에서 제거**. `strings app.so | grep` 으로 API 엔드포인트 · 비밀 추출 어려움.
- Sentry 에 **debug symbols** 업로드 → 크래시 발생 시 Sentry 가 원본 심볼로 스택 복원. 개발자는 평소처럼 읽을 수 있는 stack trace 확인.

### 방어선 3 — Cleartext HTTP 차단

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
  android:networkSecurityConfig="@xml/network_security_config"
  android:usesCleartextTraffic="false">
</application>
```

효과: Release 빌드에서 **HTTP (암호화 없음) 요청 전면 차단**. 실수로 `http://api.example.com` 쓰면 컴파일은 되지만 런타임 즉시 실패.

iOS 는 ATS (App Transport Security) 가 기본 HTTPS 강제.

### 방어선 4 — Keychain / EncryptedSharedPreferences (ADR-013 상세)

```dart
// lib/core/storage/secure_storage.dart 발췌
static const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);
```

효과:
- iOS: Keychain 의 AES-256 암호화. `first_unlock` 으로 백그라운드 접근 가능, `this_device` 로 iCloud 백업 제외.
- Android 6.0+: EncryptedSharedPreferences (AES-256). Root 권한 없이는 추출 불가.

상세는 [ADR-013](./adr-013-token-atomic-storage.md) 참조.

### 방어선 5 — SSL Pinning (opt-in)

```dart
// lib/kits/backend_api_kit/ssl_pinning_env.dart 발췌
class SslPinningEnv {
  static const String _pins = String.fromEnvironment('SSL_PINS', defaultValue: '');
  static List<String> get sha256Pins => _pins.isEmpty ? [] : _pins.split(',');
  static bool get isEnabled => sha256Pins.isNotEmpty;
}
```

```dart
// lib/kits/backend_api_kit/ssl_pinning.dart 발췌
// HttpClient 의 badCertificateCallback 을 활용해 SHA-256 공개키 핀 검증
class SslPinning {
  static HttpClientAdapter createAdapter(List<String> pins) {
    // dio 의 HttpClientAdapter 를 override 하여
    // 서버 인증서의 SHA-256 해시가 핀 리스트에 있는지 확인
    // 불일치 시 요청 실패
  }
}
```

사용 방식:

```bash
# 빌드 시 주입
flutter build appbundle \
  --obfuscate --split-debug-info=build/app/symbols \
  --dart-define=SSL_PINS=sha256/AAA=,sha256/BBB=
```

pinning 은 **opt-in**. 기본은 플랫폼 TLS 검증만. 이유: 핀 관리 부담 (인증서 갱신 시 핀도 갱신).

### 심볼 업로드 · 난독화된 스택 복원

Sentry 에 symbols 업로드 없이 난독화만 하면:

```
// Sentry 대시보드
StackOverflowError at a.b.c (a.dart:1)
at d.e.f (b.dart:42)
```

전혀 디버깅 불가. 업로드 후:

```
StackOverflowError at UserViewModel.loadProfile (user_view_model.dart:52)
at AuthService.refreshToken (auth_service.dart:120)
```

읽을 수 있음.

### 설계 선택 포인트

**포인트 1 — 난독화는 방어벽이 아닌 "시간 지연"**  
난독화는 공격자를 **완전히 막지 않음**. 시간을 벌 뿐. 하지만 대부분의 공격자는 **낮은 비용 대상** 을 찾아 움직이니, 난독화만으로도 "이 앱은 나중에 다시" 로 보낼 수 있음.

**포인트 2 — SSL pinning 은 신중히**  
핀 1개만 쓰면 **인증서 만료 = 앱 먹통**. 최소 2개 (현재 + 백업) 유지. 본 템플릿은 **opt-in 으로 보수적** — 핀 관리 인프라 없는 팀은 안 쓰는 게 나음.

**포인트 3 — Cleartext 차단은 실수 방지**  
"잠깐 로컬 테스트" 로 `http://` 썼다가 배포 시 그대로 가는 실수 방지. Release 빌드 자체를 HTTPS 강제.

**포인트 4 — 난독화 + 심볼 업로드는 세트**  
심볼 업로드 없이 난독화만 하면 크래시 디버깅 불가. 반드시 **CI 에 심볼 업로드 단계 포함**.

**포인트 5 — `sendDefaultPii = false` (Sentry)**  
Sentry 기본값 이 IP 자동 수집. GDPR · 개인정보 보호법 관점에서 불필요. 명시적 false.

**포인트 6 — keystore 절대 커밋 금지**  
Android keystore · Play store JSON key · Apple p12 등은 `.gitignore` + GitHub Secrets 만. 실수로 커밋 시 전체 키 재발급.

## 이 선택이 가져온 것

### 긍정적 결과

- **기본 공격 차단**: `strings app.so` 로 API 엔드포인트 · 비밀 추출 어려움.
- **MITM 방어 (opt-in)**: SSL pinning 활성화 시 공용 Wi-Fi 에서도 안전.
- **토큰 하드웨어 보호**: Keychain · EncryptedSharedPreferences 로 탈옥/루팅 방어.
- **크래시 여전히 디버깅 가능**: Sentry 심볼 업로드 덕분에 난독화해도 원본 스택 확인.
- **release 실수 방지**: Cleartext 차단이 `http://` 실수 배포 원천 차단.

### 부정적 결과

- **빌드 시간 증가**: R8 + `--obfuscate` 로 빌드 시간 ~50% 증가. CI 캐싱으로 완화.
- **심볼 업로드 인프라 필요**: Sentry 프로젝트 + auth token 설정. 처음 1회 셋업.
- **SSL 핀 관리 피로**: pinning 쓸 경우 인증서 갱신 시 앱 업데이트 + 핀 동기화.
- **proguard-rules 의 keep 실수**: 플러그인마다 필요한 keep 규칙 놓치면 런타임 NullPointer. 테스트 필수.
- **보안 Null 인 기분**: "이거로 충분?" 의 의심. 완벽한 보안은 불가능이니 "상식적 수준" 이 목표라고 받아들여야.

## 교훈

### 교훈 1 — 난독화는 **심볼 업로드 없이** 는 시간 낭비

초기엔 `--obfuscate` 만 하고 symbols 업로드를 안 했어요. 프로덕션 크래시 보니 **`a.b.c at x.dart:1`** — 전혀 디버깅 불가. 심볼 업로드 추가 후 정상화.

**교훈**: 난독화와 **심볼 관리는 동등한 중요도**. 난독화만 하고 심볼 놓치면 디버깅 포기. 반드시 **CI 파이프라인에 함께**.

### 교훈 2 — SSL pinning 은 "무조건 좋음" 이 아님

처음엔 "보안 강화" 라며 모든 프로덕션 빌드에 pinning 켰어요. Let's Encrypt 인증서 만료 · 자동 갱신 시점에 **핀 불일치로 앱 전체 먹통**. 핀 관리 프로세스 없이 도입하면 자기 사이트 위조 공격을 하게 됨.

**교훈**: pinning 은 **인증서 관리 인프라가 있을 때만**. 백업 핀 · 갱신 프로세스 준비 없으면 안 쓰는 게 안전.

### 교훈 3 — 보안은 "정도" 의 결정

"해커 수준 방어 가능?" 같은 절대 기준보단 **"일반 공격 도구 (jadx · Frida 기본값) 로 5분 안에 안 뚫림?"** 이 현실적. 인디 앱에 대한 공격 비용이 높아지면 공격자는 다른 타깃.

**교훈**: 보안은 **"비용 대비 가치"** 의 선. 인디 앱 타깃의 공격 비용 · 동기를 감안한 수준이 답. 과도하면 자기 비용 > 보호 가치.

## 관련 사례 (Prior Art)

- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/) — 모바일 보안 기준
- [Android Developers — Security guidelines](https://developer.android.com/topic/security/best-practices) — 공식 권장
- [Apple Security Features](https://support.apple.com/guide/security/welcome/web) — iOS 보안 문서
- [Sentry 난독화 매핑 업로드](https://docs.sentry.io/platforms/flutter/configuration/options/#debug-information-files) — 본 ADR 의 핵심 도구
- [OWASP Pinning Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Pinning_Cheat_Sheet.html) — SSL pinning 원리

## Code References

**Android 난독화**
- [`android/app/build.gradle.kts`](https://github.com/storkspear/flutter-mobile-template/blob/main/android/app/build.gradle.kts) — R8 활성화
- [`android/app/proguard-rules.pro`](https://github.com/storkspear/flutter-mobile-template/blob/main/android/app/proguard-rules.pro) — keep 규칙
- [`android/app/src/main/res/xml/network_security_config.xml`](https://github.com/storkspear/flutter-mobile-template/blob/main/android/app/src/main/res/xml/network_security_config.xml) — Cleartext 차단

**SSL Pinning**
- [`lib/kits/backend_api_kit/ssl_pinning.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/ssl_pinning.dart)
- [`lib/kits/backend_api_kit/ssl_pinning_env.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/ssl_pinning_env.dart)

**토큰 저장 (ADR-013 상세)**
- [`lib/core/storage/secure_storage.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/storage/secure_storage.dart)

**CI · 배포**
- [`.github/workflows/release-android.yml`](https://github.com/storkspear/flutter-mobile-template/blob/main/.github/workflows/release-android.yml) — 난독화 + 심볼 업로드
- [`scripts/upload-secrets-to-github.sh`](https://github.com/storkspear/flutter-mobile-template/blob/main/scripts/upload-secrets-to-github.sh) — Secrets 관리

**관련 ADR**:
- [ADR-013 · 토큰 저장 원자성](./adr-013-token-atomic-storage.md) — 방어선 4 의 상세
- [ADR-019 · 솔로 친화적 운영](./adr-019-solo-friendly.md) — 엔터프라이즈 수준 거부의 근거
- [ADR-010 · QueuedInterceptor](./adr-010-queued-interceptor.md) — JWT · 인증 토큰 흐름
