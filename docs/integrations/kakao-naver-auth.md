# Kakao / Naver 소셜 로그인 통합

> **목표**: 한국 시장 앱에 카카오/네이버 로그인 추가. 콘솔 키 발급 → 플랫폼 설정 → app_kits.yaml 활성화 → 검증까지.

**관련 Kit**: [`auth_kit`](../features/auth-kit.md)
**관련 패키지**: `kakao_flutter_sdk_user`, `flutter_naver_login` (pubspec.yaml 에 이미 선언됨)

---

## 0. 본 템플릿의 위치

기본적으로 이메일 + 4개 소셜 provider (총 5개) 지원: `email · google · apple · kakao · naver`. 한국 외 시장이면 카카오/네이버는 비활성 권장 (앱 사이즈 ~3MB 절약).

> 사이즈 영향: kakao_flutter_sdk + flutter_naver_login 의 native 라이브러리만 ~3MB. pubspec 에 선언만 해도 APK 에 포함되므로, **사용 안 하는 시장의 앱은 pubspec 에서도 제거 권장** ([features/README.md tree-shaking 주의](../features/README.md)).

---

## 1. Kakao Developers 콘솔 — 앱 등록

1. https://developers.kakao.com 가입 (한국 휴대폰 번호 인증 필요)
2. **내 애플리케이션 → 애플리케이션 추가하기**
   - 앱 아이콘 / 앱 이름 / 회사명 입력 (앱 슬러그 권장)
3. 발급된 **네이티브 앱 키** 복사 (예: `1234567890abcdefghij`)
4. **플랫폼 등록**:
   - **Android**: 패키지명 (`android/app/build.gradle.kts` 의 `applicationId`) + 키 해시
     ```bash
     # debug 키 해시
     keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64

     # release 키 해시
     keytool -exportcert -alias <YOUR_ALIAS> -keystore <YOUR_KEYSTORE>.jks -storepass <STORE_PASS> -keypass <KEY_PASS> | openssl sha1 -binary | openssl base64
     ```
   - **iOS**: Bundle ID (`ios/Runner.xcodeproj` 의 PRODUCT_BUNDLE_IDENTIFIER)
5. **카카오 로그인 활성화** (제품 설정 → 카카오 로그인):
   - 활성화 ON
   - **OpenID Connect 활성화 권장** (백엔드가 ID token 검증 시 사용)
   - **동의항목** 설정 — 이메일 (필수 여부 결정), 닉네임 등
6. **개인정보 동의 항목**: "이메일" 을 **필수 동의** 로 설정 권장 (백엔드가 email 없이는 처리 어려움)

---

## 2. Naver Developers 콘솔 — 앱 등록

1. https://developers.naver.com 가입
2. **Application → 애플리케이션 등록**
   - 애플리케이션 이름
   - **사용 API**: 네이버 로그인 선택
   - **로그인 오픈 API 서비스 환경**: Android, iOS
3. 발급된 **Client ID** + **Client Secret** 복사
4. **플랫폼 등록**:
   - **Android**: 패키지명 + 마켓 URL (Play Store 출시 후)
   - **iOS**: Bundle ID + URL Scheme (보통 Client ID 그대로)
5. **제공 정보 선택**: 이메일 (필수), 이름 등

---

## 3. Flutter 측 활성화

### 3-1. `app_kits.yaml`

```yaml
kits:
  auth_kit:
    providers:
      - email
      - google      # 한국 외 시장 대비
      - apple       # iOS 가이드라인 준수
      - kakao       # ← 추가
      - naver       # ← 추가
```

### 3-2. `lib/main.dart`

```dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(
    providers: const {
      AuthProvider.email,
      AuthProvider.google,
      AuthProvider.apple,
      AuthProvider.kakao,    // ← 추가
      AuthProvider.naver,    // ← 추가
    },
  ),
  // ...
]);
```

### 3-3. 검증

```bash
dart run tool/configure_app.dart
# Status: OK 확인
```

---

## 4. Native 셋업

### 4-1. Kakao SDK 초기화 (Flutter 측)

`lib/main.dart` 의 `_bootstrap()` 안 (AppKits.install 전):

```dart
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';

KakaoSdk.init(
  nativeAppKey: const String.fromEnvironment('KAKAO_NATIVE_KEY'),
);
```

### 4-2. Android — `AndroidManifest.xml`

`android/app/src/main/AndroidManifest.xml` 의 `<application>` 안에 카카오 redirect activity 등록:

```xml
<activity
    android:name="com.kakao.sdk.auth.AuthCodeHandlerActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <!-- 'kakao{NATIVE_APP_KEY}://oauth' -->
        <data android:scheme="kakao1234567890abcdef" android:host="oauth" />
    </intent-filter>
</activity>
```

> 보안: native key 는 base64 등으로 한 번 더 가리는 게 좋아요. 다만 Kakao SDK 가 native key 만으로는 임의 작업이 안 되도록 설계되어 있어서 노출돼도 치명적이진 않음.

### 4-3. iOS — `Info.plist`

`ios/Runner/Info.plist`:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>kakaokompassauth</string>
    <string>kakaolink</string>
    <string>naversearchapp</string>
    <string>naversearchthirdlogin</string>
</array>

<key>CFBundleURLTypes</key>
<array>
    <!-- 카카오 -->
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>kakao1234567890abcdef</string>
        </array>
    </dict>
    <!-- 네이버 -->
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>naverlogin1234567890</string>
        </array>
    </dict>
</array>
```

---

## 5. 키 주입

`.env`:

```
KAKAO_NATIVE_KEY=1234567890abcdefghij
NAVER_CLIENT_ID=ABCDEFGHIJKLMNOP
NAVER_CLIENT_SECRET=abcdefghij
```

빌드:

```bash
flutter run \
  --dart-define=KAKAO_NATIVE_KEY=$(grep KAKAO_NATIVE_KEY .env | cut -d= -f2) \
  --dart-define=NAVER_CLIENT_ID=$(grep NAVER_CLIENT_ID .env | cut -d= -f2)
```

GHA Secrets:

```bash
gh secret set KAKAO_NATIVE_KEY
gh secret set NAVER_CLIENT_ID
gh secret set NAVER_CLIENT_SECRET   # 백엔드 측에서 사용
```

---

## 6. 검증

### 6-1. Kakao 로그인 시퀀스

```
앱 실행 → /login 화면 → "카카오로 로그인" 버튼
  ↓
SocialLoginBar → KakaoLoginGate.signInAndGetAccessToken()
  ↓
Kakao SDK: 카카오톡 앱 또는 웹뷰 OAuth → access token 획득
  ↓
authService.signInWithKakao(accessToken: '...')
  ↓
백엔드: POST /api/apps/{slug}/auth/kakao { accessToken, appSlug }
  ↓
백엔드: kapi.kakao.com/v2/user/me 로 token 재검증 + email 추출
  ↓
백엔드: 우리 JWT 발급 (AuthResponse — user + tokens nested)
  ↓
AuthService._handleAuthResponse → 토큰 저장 + authenticated 상태
```

### 6-2. 흔한 트러블

| 증상 | 원인 | 해결 |
|---|---|---|
| Android: "카카오 SDK가 초기화되지 않았습니다" | `KakaoSdk.init` 호출 누락 또는 native key 미주입 | main.dart 에서 `KakaoSdk.init` 호출 + dart-define 확인 |
| Android: "key hash mismatch" | 콘솔에 등록한 키 해시와 빌드 keystore 해시 불일치 | release/debug 각각 해시 추출 → 콘솔에 추가 |
| iOS: 카카오톡 앱으로 redirect 안 됨 | `LSApplicationQueriesSchemes` 누락 | Info.plist 에 `kakaokompassauth` 추가 |
| Naver: 이메일 없음 → `socialAuthFailed (ATH_004)` (`details.reason = "email_required"`) | 사용자가 이메일 동의 거부 | 콘솔에서 이메일을 **필수** 동의로 설정 + 화면에 안내 메시지 |
| Apple "Hide My Email" 처리됨 → 카카오/네이버에서도 비슷한 정책? | 카카오/네이버는 hide email 정책 없음 — 동의 거부만 가능 | 콘솔에서 필수 설정 + 사용자 안내 |

---

## 7. 파생 레포 체크리스트

### Kakao
- [ ] Kakao Developers 콘솔에서 앱 등록 + 네이티브 앱 키 발급
- [ ] Android keystore 해시를 release/debug 모두 콘솔에 등록
- [ ] iOS Bundle ID 콘솔에 등록
- [ ] 카카오 로그인 활성화 + OpenID Connect 활성화
- [ ] 이메일을 **필수 동의** 항목으로 설정
- [ ] `AndroidManifest.xml` 에 redirect activity + `kakao{KEY}://oauth` scheme 등록
- [ ] `Info.plist` 에 `LSApplicationQueriesSchemes` + `CFBundleURLTypes` (카카오 scheme)
- [ ] `.env` 와 GHA Secrets 에 `KAKAO_NATIVE_KEY` 추가
- [ ] `app_kits.yaml` + `main.dart` 에 `kakao` provider 활성화

### Naver
- [ ] Naver Developers 콘솔에서 앱 등록 + Client ID/Secret 발급
- [ ] 사용 API "네이버 로그인" 선택
- [ ] Android 패키지명 + iOS Bundle ID 등록
- [ ] 이메일 제공 정보 필수 설정
- [ ] `Info.plist` 에 `LSApplicationQueriesSchemes` + URL Scheme 등록
- [ ] `.env` + GHA Secrets 에 `NAVER_CLIENT_ID` (백엔드는 추가로 `NAVER_CLIENT_SECRET`)
- [ ] `app_kits.yaml` + `main.dart` 에 `naver` provider 활성화

### 백엔드 (template-spring)
- [ ] `KakaoOidcVerifier` / `NaverProfileFetcher` 환경변수 주입 (Kakao app_id, Naver client_id+secret)
- [ ] `/api/apps/{slug}/auth/kakao` 와 `/auth/naver` endpoint 가 응답 정상

---

## 8. 개인정보 / 동의 정책

- **수집 항목 명시**: 개인정보처리방침에 "카카오 (이메일, 닉네임, 프로필 이미지)" / "네이버 (이메일, 이름)" 명시
- **위탁사**: Kakao Corp., NAVER Corp. (한국)
- **보관 기간**: 회원 탈퇴 시 즉시 삭제 또는 법적 보관 기간 (예: 5년)
- 이메일 미동의 시 안내 메시지: "이메일은 계정 식별에 필수입니다. 동의 후 다시 시도해주세요"

---

## 9. Code References

- [`lib/kits/auth_kit/auth_provider.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_provider.dart) — AuthProvider enum
- [`lib/kits/auth_kit/social/social_auth_gates.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/social/social_auth_gates.dart) — Kakao/Naver Gate 인터페이스
- [`lib/kits/auth_kit/auth_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/auth_kit/auth_service.dart) — `signInWithKakao`, `signInWithNaver`
- [`api-contract/auth-flow.md`](../api-contract/auth-flow.md) — OAuth 2.0 흐름 시퀀스
- [`integrations/google-apple-auth.md`](./google-apple-auth.md) — Google/Apple 짝 가이드
