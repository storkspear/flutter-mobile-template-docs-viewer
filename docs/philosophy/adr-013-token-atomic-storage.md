# ADR-013 · 토큰 저장 원자성 + SecureStorage vs SharedPreferences

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/core/storage/token_storage.dart` (73줄) 가 `saveTokens` 원자 저장 + `repairIfPartial` 복구 담당. iOS Keychain: `first_unlock_this_device`, Android: EncryptedSharedPreferences.

## 결론부터

토큰 (access + refresh) 은 **SecureStorage** (iOS Keychain, Android EncryptedSharedPreferences) 에, 일반 설정은 **SharedPreferences** 에 저장해요. 토큰 저장은 **두 개를 원자적으로** 처리 — 둘 다 성공하거나 둘 다 롤백. 반쪽 상태 (access 만 있고 refresh 없음) 는 signOut 루프의 주범이라, 부팅 시 `repairIfPartial()` 로 일관성 복구해요.

## 왜 이런 고민이 시작됐나?

JWT 기반 인증에선 access · refresh 두 토큰을 저장해야 해요. 그리고 저장 매체는 민감도 · 플랫폼 특성에 따라 달라야 해요.

네 가지 상황이 부딪혀요.

**상황 A — 민감 데이터의 암호화 저장**  
access · refresh token 은 **서버 인증 credential**. 이걸 평문으로 `SharedPreferences` 에 저장하면 탈옥 / 루팅된 기기에서 추출 가능. 플랫폼이 제공하는 **하드웨어 지원 암호화** (Keychain · EncryptedSharedPreferences) 가 필수.

**상황 B — 반쪽 저장 상태의 위험**  
`await write(accessToken)` 성공 후 `await write(refreshToken)` 실패 (저장 공간 부족 · OS 중단 등) → 다음 부팅 시 **access 는 있고 refresh 없는 상태**. 로그인됐다고 판단 → API 호출 → 401 → refresh 시도 → refresh token 없음 → **강제 로그아웃 루프**.

**상황 C — 백그라운드에서 접근 필요**  
FCM 푸시 수신 → 백엔드 device 등록 갱신 등 **앱이 포그라운드가 아닐 때** 도 토큰 필요. 이건 iOS Keychain 의 `first_unlock` accessibility 를 선택해야 가능.

**상황 D — iCloud 백업에서 제외**  
사용자가 기기 A → 기기 B 로 복원 시 iCloud 가 Keychain 을 복사. 이때 **토큰도 따라가면** 보안 이슈 · 서버 세션 혼란. iCloud 백업 제외 옵션 필요.

이 결정이 답해야 했던 물음이에요.

> **민감도가 다른 데이터를 적절한 매체에 저장하되, 원자성 · 플랫폼 보안 정책 · 반쪽 상태 복구를 모두 다루는** 구조는?

## 고민했던 대안들

### Option 1 — 모든 데이터를 SharedPreferences

토큰 · 설정 · 테마 선호 모두 `SharedPreferences`.

- **장점**: 단순. 단일 API.
- **단점 1**: **토큰 평문 저장**. 탈옥/루팅 기기 공격 시 노출.
- **단점 2**: iOS 에선 SharedPreferences = plist. **NSUserDefaults** 에 해당. 기기 연결 / backup 시 추출 쉬움.
- **탈락 이유**: 상황 A 정면 위반. 보안 표준 미달.

### Option 2 — 토큰을 서버 쿠키 + SameSite 전략

HTTP only cookie 로 서버가 토큰 관리. 클라 코드에서 접근 안 함.

- **장점**: 웹 환경에선 표준. 클라이언트 XSS 취약점 영향 최소.
- **단점 1**: **네이티브 앱 (Flutter)** 에선 쿠키 jar 관리 · SSO · 공유 브라우저 쿠키 등 웹 중심 가정이 안 맞음.
- **단점 2**: `dio` 등 HTTP 클라이언트의 cookie manager 설정 복잡 + iOS / Android 플랫폼별 동작 차이.
- **단점 3**: 백그라운드 작업 (FCM · workmanager) 에서 쿠키 jar 접근 경계 모호.
- **탈락 이유**: 모바일 네이티브 환경에 부적합.

### Option 3 — SecureStorage + SharedPreferences 이원화 + 원자 저장 ★ (채택)

**민감도별 매체 분리**:
- 토큰 → `SecureStorage` (flutter_secure_storage)
- 일반 설정 → `SharedPreferences` (shared_preferences)

**원자 저장 로직**:
- `TokenStorage.saveTokens(access, refresh)` — 둘 다 성공 or 둘 다 롤백
- `TokenStorage.repairIfPartial()` — 부팅 시 반쪽 상태 복구

- **상황 A 만족**: Keychain · EncryptedSharedPreferences 로 하드웨어 지원 암호화.
- **상황 B 만족**: `saveTokens` 가 실패 시 `clearTokens()` 로 둘 다 삭제. `repairIfPartial` 가 부팅 시 복구.
- **상황 C 만족**: iOS accessibility `first_unlock_this_device` → 첫 unlock 후 백그라운드 접근 가능.
- **상황 D 만족**: `this_device` suffix → iCloud 백업에서 제외.

## 결정

### SecureStorage 설정 (iOS / Android)

```dart
// lib/core/storage/secure_storage.dart 전체
class SecureStorage {
  /// iOS: KeychainAccessibility.first_unlock_this_device
  /// - `thisDevice` → iCloud Keychain 백업 대상에서 제외 (기기 복원 시 토큰 이전 방지)
  /// - `first_unlock` → 첫 unlock 후 접근 가능, 백그라운드 refresh 허용
  /// Android: EncryptedSharedPreferences.
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  Future<String?> read(String key) => _storage.read(key: key);
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  Future<void> delete(String key) => _storage.delete(key: key);
  Future<void> deleteAll() => _storage.deleteAll();
}
```

### TokenStorage 원자 저장

```dart
// lib/core/storage/token_storage.dart 전체
class TokenStorage {
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  final SecureStorage _storage;

  TokenStorage({required SecureStorage storage}) : _storage = storage;

  Future<String?> getAccessToken() => _storage.read(_accessTokenKey);
  Future<String?> getRefreshToken() => _storage.read(_refreshTokenKey);

  /// 두 토큰을 **원자적**으로 저장. 중간 실패 시 둘 다 롤백.
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    try {
      await _storage.write(_accessTokenKey, accessToken);
      await _storage.write(_refreshTokenKey, refreshToken);
    } catch (_) {
      try {
        await clearTokens();  // ← 둘 다 정리
      } catch (cleanupError, cleanupStack) {
        developer.log(
          'clearTokens during saveTokens rollback failed',
          name: 'TokenStorage',
          error: cleanupError,
          stackTrace: cleanupStack,
        );
      }
      rethrow;  // ← 원 에러 전파
    }
  }

  /// 두 토큰 제거. 첫 delete 가 실패해도 두 번째 delete 는 반드시 시도.
  Future<void> clearTokens() async {
    try {
      await _storage.delete(_accessTokenKey);
    } finally {
      await _storage.delete(_refreshTokenKey);
    }
  }

  /// access + refresh **둘 다** 존재하면 true. 순수 조회.
  Future<bool> hasTokens() async {
    final access = await getAccessToken();
    final refresh = await getRefreshToken();
    return access != null && refresh != null;
  }

  /// 반쪽 상태이면 clearTokens. 부팅 시 한 번 호출해 일관성 복구.
  Future<void> repairIfPartial() async {
    final access = await getAccessToken();
    final refresh = await getRefreshToken();
    final partial = (access != null && refresh == null) ||
                    (access == null && refresh != null);
    if (partial) await clearTokens();
  }
}
```

### 부팅 시 복구 흐름

```dart
// lib/kits/auth_kit/auth_check_step.dart 맥락
class AuthCheckStep implements BootStep {
  @override
  Future<void> execute() async {
    // 1. 반쪽 상태 복구
    await _tokenStorage.repairIfPartial();

    // 2. 정상 토큰 있는지 확인
    if (!await _tokenStorage.hasTokens()) {
      _authState.emit(const AuthState.unauthenticated());
      return;
    }

    // 3. 서버에 유효성 확인 (/users/me 호출)
    try {
      final user = await _authService.fetchCurrentUser();
      _authState.emit(AuthState.authenticated(user));
    } catch (_) {
      _authState.emit(const AuthState.unauthenticated());
    }
  }
}
```

### PrefsStorage (일반 설정)

```dart
// lib/core/storage/prefs_storage.dart 개요
class PrefsStorage {
  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  String? getString(String key) => _prefs.getString(key);
  Future<void> setString(String key, String value) => _prefs.setString(key, value);
  // ... 기타 타입
}
```

**용도**: 테마 설정 · 언어 · 온보딩 완료 플래그 · 리뷰 트리거 카운터. **암호화 안 됨** — 민감 정보 저장 금지.

### 설계 선택 포인트

**포인트 1 — `first_unlock_this_device` accessibility 의 의미**  
- `first_unlock`: 기기가 **최초 unlock 된 이후** 토큰 접근 가능. 재부팅 직후엔 아직 unlock 안 돼서 접근 불가. 하지만 사용자가 unlock 한 뒤엔 백그라운드에서도 접근 OK. FCM · workmanager 용 필수.
- `this_device`: iCloud Keychain 백업 대상에서 **제외**. 기기 A 의 토큰이 기기 B 로 복제되지 않음.

두 속성 결합이 "운영 편의 + 보안" 의 균형점.

**포인트 2 — `clearTokens` 의 try/finally 패턴**  
access 삭제가 실패해도 refresh 삭제는 **반드시** 시도. 두 토큰 중 하나라도 남으면 반쪽 상태 → 추후 복구. `try/finally` 로 보장.

**포인트 3 — `saveTokens` 롤백 중 에러는 삼킴**  
`saveTokens` 가 실패해 `clearTokens()` 호출. clearTokens 자체가 또 실패하면? **원 에러** (saveTokens 실패) 가 호출자에게 중요, **정리 실패** 는 부차적. `developer.log` 로 기록만 하고 `rethrow` 로 원 에러 전파.

**포인트 4 — `repairIfPartial` 는 부팅 시만 호출**  
매 API 호출 전에 체크하면 성능 비용. 반쪽 상태는 **전 부팅 종료 시점의 중단** 에서만 생기므로, 부팅 시 한 번만 복구로 충분.

**포인트 5 — `hasTokens` 는 부작용 없음**  
순수 조회. 반쪽 상태여도 `false` 반환만 할 뿐 복구 안 함. 복구는 `repairIfPartial` 로 명시적 분리. **이벤트 (상태 변경) 와 쿼리 (조회) 를 섞지 않음**.

## 이 선택이 가져온 것

### 긍정적 결과

- **토큰 하드웨어 암호화**: Keychain / EncryptedSharedPreferences 로 탈옥/루팅 방어.
- **반쪽 상태 → signOut 루프 제거**: `repairIfPartial` 덕분에 "access 만 남아 401 → refresh 실패 → 또 401" 루프 없음.
- **iCloud 복제 방지**: 기기 이전 시 토큰 따라가지 않음. 새 기기 = 새 로그인.
- **백그라운드 작업 가능**: `first_unlock` 으로 FCM · workmanager 에서 토큰 접근 가능.
- **민감도별 매체 분리**: SharedPreferences 에 테마 설정 저장 · SecureStorage 에 토큰 저장 — 용도 명확.
- **테스트 용이**: SecureStorage 를 `overrideWithValue(FakeSecureStorage())` 로 mock 해서 TokenStorage 단위 테스트.

### 부정적 결과

- **두 매체 관리 복잡**: 어떤 데이터를 어디에 넣을지 선택 피로. "유저 설정 중 민감한 건 뭐?" 판단.
- **Android 호환성**: EncryptedSharedPreferences 는 Android 6.0 (API 23) 이상. 이보다 낮은 기기 미지원 (템플릿 minSdk 정책과 일치).
- **iOS Keychain 동기화 이슈**: 앱 삭제 후 재설치 시 Keychain 이 남아있는 경우 (OS 버전별 동작 차이). "첫 실행 체크" 로 clearAll 필요 시 있음.
- **원자성 구현이 완벽하지 않음**: 2개 쓰기 사이에 **OS 가 프로세스 kill** 하면 둘 다 쓰임 없이 멈춤. 그래도 반쪽은 안 됨. 극단적 시나리오 (첫 쓰기 성공 후 kill) 에선 반쪽 → 다음 부팅 `repairIfPartial` 로 복구.

## 교훈

### 교훈 1 — "원자성" 은 DB 의 ACID 뿐 아니라 Storage 에도

초기엔 `saveTokens` 에 두 줄 `await write(A); await write(B);` 만. 드물게 B 실패 → 반쪽. **signOut 루프 버그** 가 프로덕션에 나와서 원인 파악에 일주일. `try/catch/clearTokens/rethrow` 패턴 추가 후 해결.

**교훈**: 다중 쓰기는 **항상 원자성 전략** 을 생각. "둘 다 성공 or 둘 다 롤백" 을 코드로 명시. OS 가 우리를 중단할 가능성 + 쓰기 실패 가능성을 전제.

### 교훈 2 — `first_unlock_this_device` 가 정답

`whenUnlocked` (잠금 해제된 상태에서만 접근) 는 너무 엄격 — 백그라운드 FCM 수신 실패. `afterFirstUnlock` (재부팅 후 첫 unlock 이후 항상) 은 iCloud 백업 포함 → 기기 복제 위험. `first_unlock_this_device` 가 **"첫 unlock 이후 + 이 기기 전용"** 으로 두 마리 토끼.

**교훈**: iOS Keychain accessibility 는 세밀하게 구분됨. 기본값 선택 전에 **모든 옵션 비교표** 읽기.

### 교훈 3 — `repairIfPartial` 같은 "복구 함수" 는 부팅에 한 번만

초기엔 매 토큰 조회 전에 `repairIfPartial` 호출. 성능 영향 미미했지만 **로직 복잡도 증가** — "왜 매번 복구?" 를 매번 설명. 부팅 시 한 번으로 충분.

**교훈**: "일관성 복구" 는 **상태가 변할 수 있는 경계** (부팅 · 로그인 · 로그아웃) 에서만. 조회마다 하면 책임이 흐려져요.

## 관련 사례 (Prior Art)

- [flutter_secure_storage 공식 문서](https://pub.dev/packages/flutter_secure_storage) — 본 ADR 의 기반 라이브러리
- [Apple Keychain Services Guide](https://developer.apple.com/documentation/security/keychain_services) — accessibility 옵션 상세
- [Android EncryptedSharedPreferences](https://developer.android.com/reference/androidx/security/crypto/EncryptedSharedPreferences) — Android 6.0+ 하드웨어 지원 암호화
- [OWASP Mobile Top 10 — M5 Insufficient Cryptography](https://owasp.org/www-project-mobile-top-10/) — 토큰 저장 보안 지침
- [Database Transaction Patterns](https://en.wikipedia.org/wiki/Atomicity_(database_systems)) — 원자성 원리의 일반 개념

## Code References

**토큰 저장**
- [`lib/core/storage/secure_storage.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/storage/secure_storage.dart) — 24줄, iOS/Android 옵션 설정
- [`lib/core/storage/token_storage.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/storage/token_storage.dart) — 73줄, 원자 저장 + 복구

**일반 설정**
- [`lib/core/storage/prefs_storage.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/storage/prefs_storage.dart) — SharedPreferences 래퍼

**부팅 복구 호출**
- [`lib/kits/auth_kit/auth_check_step.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/auth_check_step.dart) — `repairIfPartial` → `hasTokens` → `fetchCurrentUser`

**테스트**
- [`test/core/storage/token_storage_test.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/test/core/storage/token_storage_test.dart) — 원자성 · 복구 시나리오

**관련 ADR**:
- [ADR-010 · QueuedInterceptor 로 401 자동 갱신](./adr-010-queued-interceptor.md) — refresh 성공 시 `saveTokens` 호출
- [ADR-012 · 앱별 독립 유저](./adr-012-per-app-user.md) — 앱별 Keychain 분리
- [ADR-020 · 이중 난독화 + 보안 정책](./adr-020-security-hardening.md) — 토큰 저장이 보안 방어선의 일부
- [ADR-008 · 부팅 단계 추상화](./adr-008-boot-step.md) — `AuthCheckStep` 에서 `repairIfPartial` 호출
