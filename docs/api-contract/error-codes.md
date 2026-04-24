# Error Codes

서버 · 클라이언트 간 **ErrorCode enum 1:1 매핑**. 문자열 값이 양쪽에서 완전 동일.

---

## 전체 코드

### 일반

| Code | HTTP | 설명 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 요청 검증 실패. `details.fields` 참조 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 상태 충돌 (예: 중복 등록) |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

### 인증 · 인가

| Code | HTTP | 설명 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 · 유효하지 않은 토큰 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `TOKEN_EXPIRED` | 401 | Access token 만료 → refresh 필요 |
| `INVALID_TOKEN` | 401 | 토큰 변조 · 서명 불일치 |
| `INVALID_CREDENTIALS` | 401 | 로그인 실패 (이메일/비번 오류) |
| `EMAIL_NOT_VERIFIED` | 403 | 이메일 인증 미완료 |
| `EMAIL_ALREADY_EXISTS` | 409 | 가입 시 이메일 중복 |

### 외부 서비스

| Code | HTTP | 설명 |
|------|------|------|
| `EMAIL_DELIVERY_FAILED` | 503 | 이메일 발송 실패 (SES · Resend 등) |
| `PUSH_DELIVERY_FAILED` | 503 | 푸시 발송 실패 (FCM · APNs) |
| `SOCIAL_AUTH_FAILED` | 401 | 소셜 로그인 실패 (Google · Apple) |

### 클라이언트 로컬

백엔드가 내려준 코드가 아닌, 클라이언트 자체 생성 코드.

| Code | 설명 |
|------|------|
| `NETWORK_ERROR` | 네트워크 연결 실패 |
| `TIMEOUT` | 요청 · 응답 타임아웃 |
| `UNKNOWN_ERROR` | 알 수 없는 에러 (fallback) |

그리고 각 ViewModel 별 `fallbackCode`:
- `LOGIN_FAILED`, `SIGNUP_FAILED`, `FETCH_FAILED`, `SAVE_FAILED`, `DELETE_FAILED` 등

---

## Dart 상수

```dart
// lib/kits/backend_api_kit/error_code.dart
class ErrorCode {
  static const validationError = 'VALIDATION_ERROR';
  static const notFound = 'NOT_FOUND';
  // ...
}
```

### 사용

```dart
if (state.errorCode == ErrorCode.invalidCredentials) {
  // 로그인 실패 UI
}

// 또는 ApiException getter
if (e is ApiException && e.isTokenExpired) {
  // refresh 로직
}
```

---

## i18n 매핑

각 code 를 Screen 에서 번역:

```dart
// lib/core/i18n/app_ko.arb
{
  "errorInvalidCredentials": "이메일 또는 비밀번호가 올바르지 않습니다",
  "errorTokenExpired": "세션이 만료되었어요. 다시 로그인해주세요",
  "errorEmailAlreadyExists": "이미 사용 중인 이메일이에요",
  "errorNetwork": "네트워크 연결을 확인해주세요",
  "errorTimeout": "응답이 너무 느려요. 잠시 후 다시 시도해주세요",
  "errorUnknown": "알 수 없는 오류가 발생했어요"
}
```

Screen:
```dart
String _localizedError(BuildContext context, String code) {
  final s = S.of(context);
  switch (code) {
    case ErrorCode.invalidCredentials: return s.errorInvalidCredentials;
    case ErrorCode.tokenExpired: return s.errorTokenExpired;
    case ErrorCode.emailAlreadyExists: return s.errorEmailAlreadyExists;
    case 'NETWORK_ERROR': return s.errorNetwork;
    case 'TIMEOUT': return s.errorTimeout;
    default: return s.errorUnknown;
  }
}
```

---

## 새 ErrorCode 추가 워크플로우

1. **백엔드**: `common-web/.../ErrorCode.java` 에 enum 추가
2. **프론트**: `lib/kits/backend_api_kit/error_code.dart` 에 상수 추가
3. **i18n**: `app_ko.arb` · `app_en.arb` 에 번역 추가 → `flutter gen-l10n`
4. **Screen**: `_localizedError` switch 에 case 추가
5. **테스트**: 해당 상황 시나리오 테스트 추가

---

## 주의사항

- **문자열 오타 주의**: Dart · Java 둘 다 `UPPER_SNAKE_CASE` 정확히 일치해야.
- **HTTP 상태 코드와 무관할 수 있음**: 예를 들어 `TOKEN_EXPIRED` 는 401 로 주지만, 비즈니스 로직에선 code 로만 분기.
- **details 활용**: validation 에러는 `details.fields: {email: "이메일 형식 오류"}` 같이 필드별 메시지 제공.

---

## 관련 문서

- [ADR-009 · 백엔드 계약](../philosophy/adr-009-backend-contract.md)
- [Error Handling](../conventions/error-handling.md)
- [`response-schema.md`](./response-schema.md)
