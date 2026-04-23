# 적용된 보안 정책 요약

## 지원 플랫폼 최소 버전

| 플랫폼 | 최소 지원 | 이유 | 위치 |
|--------|---------|------|------|
| Android | API 23 (Marshmallow, 6.0+) | posthog_flutter → posthog-android 3.41+ 요구 | `android/app/build.gradle.kts` |
| iOS | 14.0 | workmanager_apple (background_kit) 요구 | `ios/Podfile`, `ios/Runner.xcodeproj` |

**파생 레포에서 활성 kit 변경 시 최소 버전도 재평가합니다.** 새 kit이 더 높은 버전을 요구하면 bump가 필요합니다 (예: 이전에 Android minSdk 21→23 bump, iOS 12→14 bump).

## 빌드 단계

| 항목 | 상태 | 위치 |
|------|------|------|
| R8/ProGuard 난독화 (Kotlin/Java) | ✅ release 활성 | `android/app/build.gradle.kts` |
| R8 규칙 파일 | ✅ 제공 | `android/app/proguard-rules.pro` |
| Resource shrinking | ✅ release 활성 | `android/app/build.gradle.kts` |
| **Dart 심볼 난독화** | ✅ `--obfuscate --split-debug-info=build/symbols` | `android/fastlane/Fastfile` (`build_release` lane) |
| **Dart/ProGuard 심볼 Sentry 업로드** | ✅ 자동 (릴리스 시) | `android/fastlane/Fastfile` (`upload_sentry_mapping` lane) |
| 업로드 키 서명 | ✅ key.properties/env 주입 지원 | `android/app/build.gradle.kts` |
| Play App Signing | ⚠️ 파생 레포에서 활성화 필요 | Play Console에서 첫 업로드 시 |

### Dart 심볼 난독화 상세

Flutter의 Dart 코드는 AOT 컴파일되어 ARM 네이티브 바이너리가 되지만, **기본 빌드는 클래스/함수 이름이 심볼 테이블에 그대로 남습니다**. `strings app.so`로 비즈니스 로직 추정이 가능합니다.

`--obfuscate`는 이 심볼을 축약된 식별자(`aA`, `bC` 등)로 치환하고, 원본 매핑을 `--split-debug-info=<dir>`에 저장합니다. 이 매핑을 Sentry에 업로드하면:
- 프로덕션 크래시는 난독화된 상태로 수집됩니다
- Sentry가 서버에 저장된 매핑으로 **원본 심볼로 복원해서** 대시보드에 표시합니다

즉 보안 (엔드유저는 원본 못 봄) + 가독성 (개발자는 Sentry에서 원본으로 봄) 둘 다 확보됩니다.

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

## SSL 핀닝 동작 원리

`lib/kits/backend_api_kit/ssl_pinning.dart`

`SslPinning` 클래스는 Dio의 `HttpClientAdapter`를 교체해 TLS 핸드셰이크 시점에 인증서를 검증합니다. 핀이 비어있으면 어댑터를 바꾸지 않아 기본 TLS 동작 그대로입니다.

```
--dart-define=SSL_PINS=sha256/AAA=,sha256/BBB=
          ↓
SslPinningEnv.pins  →  ["sha256/AAA=", "sha256/BBB="]
          ↓
SslPinning.applyTo(dio, pins: ...)
          ↓
IOHttpClientAdapter (badCertificateCallback 등록)
          ↓
서버 인증서 DER → SHA256 → base64 → "sha256/..."
          ↓
pins 목록에 포함됐으면 연결 허용, 아니면 차단
```

**핵심 메서드:**

| 메서드 | 역할 |
|--------|------|
| `computePinFromCert(der)` | DER 바이트 → `sha256/<base64>` 핀 문자열 생성 |
| `matches(certBytes, pins)` | 서버 인증서 핀이 허용 목록에 포함되는지 확인. pins가 비어있으면 항상 `true` |
| `applyTo(dio, {pins})` | Dio 어댑터 교체. pins가 비어있으면 no-op |

`badCertificateCallback`은 기본 TLS 검증이 실패했을 때만 호출됩니다. 핀 매칭이 성공하면 연결을 허용하고, 실패하면 차단합니다.

> **인증서 갱신 시 주의**: 현재 인증서 핀 + 다음 인증서 핀을 동시에 등록해두어야 갱신 기간 중 서비스가 끊기지 않습니다. 최소 2개의 핀을 항상 유지하세요.

## SSL 핀닝 활성화 방법

1. 서버 인증서의 SPKI SHA256 추출 (HOST를 실제 도메인으로 교체):
   ```bash
   openssl s_client -servername HOST -connect HOST:443 < /dev/null 2>/dev/null | \
     openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
     openssl dgst -sha256 -binary | openssl enc -base64
   # 출력 예: AAAAAAAAA=
   ```

2. 백업 인증서도 같은 방법으로 추출합니다 (인증서 갱신 대비 — 최소 2개 권장)

3. 빌드 시 주입:
   ```bash
   flutter build appbundle --release \
     --dart-define=SSL_PINS=sha256/AAAAAAAAA=,sha256/BBBBBBBBB=
   ```

## SecureStorage / TokenStorage 동작 원리

### SecureStorage (`lib/core/storage/secure_storage.dart`)

플랫폼별 보안 저장소를 추상화한 클래스입니다. 내부적으로 `flutter_secure_storage`를 사용합니다.

| 플랫폼 | 저장 방식 | 설정 이유 |
|--------|-----------|-----------|
| iOS | Keychain (`first_unlock_this_device`) | `thisDevice` → iCloud Keychain 백업에서 제외 (기기 복원 시 토큰 이전 방지). `first_unlock` → 첫 unlock 후 백그라운드에서도 접근 가능 (자동 토큰 갱신 허용) |
| Android | `EncryptedSharedPreferences` | Android Keystore 기반 AES 암호화. Android 6+ (API 23)에서만 지원 |

```dart
// iOS 키체인 설정
IOSOptions(
  accessibility: KeychainAccessibility.first_unlock_this_device,
)
// → iCloud 백업 X, 잠금 해제 후 백그라운드 접근 O
```

### TokenStorage (`lib/core/storage/token_storage.dart`)

`SecureStorage` 위에서 access token / refresh token 쌍을 관리합니다.

**핵심 설계 포인트:**

- **`saveTokens()` 원자적 저장**: access + refresh 저장 중 하나라도 실패하면 둘 다 `clearTokens()`로 롤백합니다. 반쪽 저장 상태로 인한 로그인 루프를 방지합니다.
- **`clearTokens()` 양쪽 보장**: 첫 번째 delete가 실패해도 두 번째 delete는 반드시 실행합니다 (`finally` 블록). 반쪽 잔여 최소화가 목적입니다.
- **`repairIfPartial()` 부팅 복구**: 앱 시작 시 access만 있거나 refresh만 있는 불일치 상태를 감지해 `clearTokens()`로 정리합니다. `hasTokens()`는 부작용 없는 순수 조회입니다.

```
앱 시작
  ↓
TokenStorage.repairIfPartial()   ← 반쪽 상태 복구
  ↓
hasTokens() → true → checkAuthStatus()
hasTokens() → false → 로그인 화면
```

## 다음 단계 (추후 추가 고려 사항)

- Root/Jailbreak 탐지 (`freerasp` 등) — 금융/민감 앱만
- Play Integrity API 통합 (앱 변조 탐지)
- Certificate Transparency (CT) 검증
- 빌드 아티팩트 해시 검증 (supply chain)
