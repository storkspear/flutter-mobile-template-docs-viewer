# Error Codes

서버(template-spring) ↔ 클라이언트(template-flutter) 간 **ErrorCode 1:1 매핑**. 양쪽이 동일한 prefix 형식(`CMN_*`, `ATH_*`)을 공유해요.

> **Source of Truth**: Spring 측이 선언하고 Flutter 가 매핑. 변경 시 양쪽 동시 갱신 필수 — `lib/kits/backend_api_kit/error_code.dart` docstring 의 동기화 의무 참조.
>
> Spring 정의 위치:
> - `template-spring/common/common-web/.../exception/CommonError.java` (CMN_*)
> - `template-spring/core/core-auth-api/.../exception/AuthError.java` (ATH_*)

---

## 전체 코드

### 공통 — `CMN_*` (CommonError)

도메인에 속하지 않는 범용 에러. JWT access token 관련도 여기에 포함 (common-security 가 core-auth-api 에 의존할 수 없는 모듈 구조 때문).

| Code | HTTP | Dart 상수 | 설명 |
|------|------|---------|------|
| `CMN_001` | 422 | `ErrorCode.validationError` | 입력값 검증 실패 (Bean Validation 외 비즈니스 검증) |
| `CMN_002` | 404 | `ErrorCode.notFound` | 리소스 없음. `details.resource`/`details.id` 권장 |
| `CMN_003` | 409 | `ErrorCode.conflict` | 리소스 충돌 (중복 등록 등) |
| `CMN_004` | 401 | `ErrorCode.unauthorized` | 인증 정보 없음 |
| `CMN_005` | 403 | `ErrorCode.forbidden` | 권한 없음 |
| `CMN_006` | 500 | `ErrorCode.internalError` | 서버 내부 오류. 상세는 서버 로그에만 |
| `CMN_007` | 401 | `ErrorCode.accessTokenExpired` | **JWT access token 만료** → refresh 시도 트리거 |
| `CMN_008` | 401 | `ErrorCode.accessTokenInvalid` | JWT access token 무효 (서명 불일치/형식 오류) |
| `CMN_429` | 429 | `ErrorCode.rateLimitExceeded` | Rate limit 초과. `Retry-After` 헤더 + `details.limit/window` |

### 인증 도메인 — `ATH_*` (AuthError)

이메일/소셜 로그인, refresh/reset/verification 토큰 관련.

| Code | HTTP | Dart 상수 | 설명 |
|------|------|---------|------|
| `ATH_001` | 401 | `ErrorCode.invalidCredentials` | 이메일/비밀번호 불일치 (열거 방지 — 어느 쪽 틀렸는지 구분 X) |
| `ATH_002` | 401 | `ErrorCode.refreshTokenExpired` | **refresh / reset / verification 토큰 만료** → signOut + 재로그인 |
| `ATH_003` | 401 | `ErrorCode.refreshTokenInvalid` | refresh / reset / verification 토큰 무효 (revoked, replay 감지 등) |
| `ATH_004` | 401 | `ErrorCode.socialAuthFailed` | Apple/Google/Kakao/Naver 소셜 검증 실패. `details.provider` 권장 |
| `ATH_005` | 401 | `ErrorCode.emailNotVerified` | 이메일 인증 미완료 유저 |
| `ATH_006` | 503 | `ErrorCode.emailDeliveryFailed` | 이메일 발송 실패 (Resend API 장애 등) |

> **CMN_007 vs ATH_002 의 차이가 핵심**:
> - `CMN_007` = access token 만료 → 자동 refresh 시도 후 성공 가능
> - `ATH_002` = refresh token 만료 → 더 이상 갱신 불가, signOut 필요
> Flutter 측 `ApiException.isAccessTokenExpired` 와 `isRefreshTokenExpired` getter 가 분리된 이유예요.

### 유저 도메인 — `USR_*` (UserError)

유저 엔티티 조회·등록 관련.

| Code | HTTP | Dart 상수 | 설명 |
|------|------|---------|------|
| `USR_001` | 404 | `ErrorCode.userNotFound` | 유저 미존재. `details.id` 권장 |
| `USR_002` | 409 | `ErrorCode.emailAlreadyExists` | 이미 사용 중인 이메일로 가입 시도 — signup 화면 분기에 사용 |

### 스토리지 도메인 — `STG_*` (StorageError)

S3/Cloud Storage 어댑터 호출 관련. 파생 레포가 첨부파일/이미지 업로드를 다룰 때 분기.

| Code | HTTP | Dart 상수 | 설명 |
|------|------|---------|------|
| `STG_001` | 404 | `ErrorCode.bucketNotFound` | 버킷 미존재 |
| `STG_002` | 404 | `ErrorCode.objectNotFound` | 객체 미존재 |
| `STG_003` | 500 | `ErrorCode.uploadFailed` | 업로드 실패 |
| `STG_004` | 500 | `ErrorCode.downloadFailed` | 다운로드 실패 |
| `STG_005` | 413 | `ErrorCode.quotaExceeded` | 용량 쿼터 초과 |
| `STG_006` | 413 | `ErrorCode.sizeLimitExceeded` | 단일 파일 크기 초과 |
| `STG_007` | 400 | `ErrorCode.invalidObjectKey` | 잘못된 키 (경로/문자) |
| `STG_008` | 500 | `ErrorCode.signedUrlGenerationFailed` | presigned URL 생성 실패 |
| `STG_009` | 503 | `ErrorCode.adapterUnavailable` | 어댑터 일시 장애 |
| `STG_010` | 500 | `ErrorCode.deleteFailed` | 삭제 실패 |

### 결제 도메인 — `BIL_*` (BillingError)

> Phase 1 에서 Spring 측 `BillingError` 추가 시 동기화. 현재 Flutter `error_code.dart` 에 정의 비어 있음.

### 클라이언트 로컬

백엔드가 내려준 코드가 아닌, Flutter 측이 자체 생성하는 코드. `ApiException` factory 가 발행해요.

| Code | 발생 | 설명 |
|------|------|------|
| `NETWORK_ERROR` | `ApiException.network()` | 네트워크 연결 실패 (`SocketException`, `connectionError`) |
| `TIMEOUT` | `ApiException.timeout()` | 요청/응답 타임아웃 |
| `UNKNOWN_ERROR` | `ApiException.unknown()` | 알 수 없는 에러 (fallback) |

### ViewModel fallback codes

ViewModel 의 `safeErrorCode(e, fallbackCode: '...')` 호출 시 사용하는 도메인-친화 코드. 백엔드 응답이 아닌 UI 단의 그룹핑.

- `LOGIN_FAILED` (login_view_model.dart)
- `SIGNUP_FAILED`
- `PASSWORD_RESET_FAILED` (password_reset_view_model.dart)
- 도메인별 fallback 은 파생 레포에서 추가 (예: `EXPENSE_SAVE_FAILED`)

---

## Dart 매핑 (실제 코드)

```dart
// lib/kits/backend_api_kit/error_code.dart
class ErrorCode {
  // 공통 (CMN_*)
  static const validationError = 'CMN_001';
  static const notFound = 'CMN_002';
  static const conflict = 'CMN_003';
  static const unauthorized = 'CMN_004';
  static const forbidden = 'CMN_005';
  static const internalError = 'CMN_006';
  static const accessTokenExpired = 'CMN_007';
  static const accessTokenInvalid = 'CMN_008';
  static const rateLimitExceeded = 'CMN_429';

  // 인증 (ATH_*)
  static const invalidCredentials = 'ATH_001';
  static const refreshTokenExpired = 'ATH_002';
  static const refreshTokenInvalid = 'ATH_003';
  static const socialAuthFailed = 'ATH_004';
  static const emailNotVerified = 'ATH_005';
  static const emailDeliveryFailed = 'ATH_006';

  // 유저 (USR_*)
  static const userNotFound = 'USR_001';
  static const emailAlreadyExists = 'USR_002';

  // 스토리지 (STG_*) — 10개
  static const bucketNotFound = 'STG_001';
  static const objectNotFound = 'STG_002';
  static const uploadFailed = 'STG_003';
  static const downloadFailed = 'STG_004';
  static const quotaExceeded = 'STG_005';
  static const sizeLimitExceeded = 'STG_006';
  static const invalidObjectKey = 'STG_007';
  static const signedUrlGenerationFailed = 'STG_008';
  static const adapterUnavailable = 'STG_009';
  static const deleteFailed = 'STG_010';
}
```

### 사용 패턴

**1) ViewModel 에서 분기 처리**

```dart
try {
  await authService.signInWithEmail(...);
} on ApiException catch (e) {
  if (e.isInvalidCredentials) {
    // 이메일/비밀번호 오류 — 사용자 안내
  } else if (e.isAccessTokenExpired) {
    // 자동 refresh 트리거 (보통 인터셉터에서 처리)
  } else if (e.isRefreshTokenExpired || e.isRefreshTokenInvalid) {
    // signOut + 재로그인 화면 이동
  }
}
```

**2) 화면에서 i18n 메시지 매핑**

`lib/kits/backend_api_kit/api_exception.dart` 의 `safeErrorCode(e)` 로 안전하게 코드 추출 후 ARB 키와 매핑.

```dart
String _localizedError(BuildContext context, String code) {
  final s = S.of(context);
  switch (code) {
    case ErrorCode.invalidCredentials:
      return s.errorInvalidCredentials;
    case ErrorCode.accessTokenExpired:
    case ErrorCode.refreshTokenExpired:
      return s.errorSessionExpired;
    case 'NETWORK_ERROR':
      return s.errorNetworkUnavailable;
    case 'TIMEOUT':
      return s.errorTimeout;
    default:
      return s.errorUnknown;
  }
}
```

> 위 ARB 키들은 예시예요. 실제 `lib/core/i18n/app_ko.arb` / `app_en.arb` 에 정의된 키와 일치시키세요. 새 키 추가 시 `flutter gen-l10n` 실행 필수.

---

## 새 ErrorCode 추가 워크플로우

1. **Spring**: 도메인에 따라 `CommonError.java` (범용) 또는 `XxxError.java` (도메인별 — auth/user/device 등) 에 enum 추가. code 형식 `<3자약어>_<번호>` (예: `EXP_001` for expense 도메인).
2. **Flutter**: `lib/kits/backend_api_kit/error_code.dart` 에 상수 추가. **이 파일 docstring 에 명시된 동기화 의무 준수**.
3. **i18n**: `lib/core/i18n/app_ko.arb` + `app_en.arb` 양쪽에 새 키 추가 → `flutter gen-l10n`.
4. **Screen**: `_localizedError` (또는 동등 함수) switch 에 case 추가.
5. **테스트**: `test/kits/backend_api_kit/api_exception_test.dart` 에 새 코드 boolean helper 추가하면 그 테스트도 갱신.
6. **양쪽 동시 PR**: Spring 과 Flutter 의 변경은 같은 sprint 안에 배포 — 한쪽만 먼저 나가면 분기 처리 fail.

---

## 주의사항

- **prefix 일관성**: code 는 항상 `<도메인약어>_<번호>` 형식. 예외 없음.
- **HTTP 상태 코드와 별개**: 같은 401 안에서도 `CMN_004` vs `CMN_007` vs `ATH_002` 가 의미가 달라요. 분기는 code 로만.
- **details 활용**: validation 에러는 `details.field` (단일) 또는 `details.fields` (다중) 로 필드명 전달. Spring `GlobalExceptionHandler` 가 자동 첨부.
- **열거 공격 방지**: `ATH_001` 은 의도적으로 "이메일/비밀번호" 둘 중 무엇이 틀렸는지 구분하지 않아요.
- **소셜 로그인 details**: `ATH_004` 는 `details.provider: "kakao"` 처럼 provider 정보 포함 권장.

---

## 관련 문서

- [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md) — `{data, error}` 설계 의사결정
- [`Error Handling`](../conventions/error-handling.md) — Flutter 측 ApiException 처리 패턴
- [`response-schema.md`](./response-schema.md) — `{data, error}` 응답 envelope
- [`auth-flow.md`](./auth-flow.md) — 인증 흐름에서 에러 코드 사용
- [`integrations/sentry.md`](../integrations/sentry.md) — 에러 → Sentry 연동
