# API Contract

이 문서는 `spring-backend-template`과의 API 계약을 정의합니다. Flutter 네트워크 레이어가 이 규격을 1:1로 미러링합니다.

---

## 응답 래퍼

모든 응답은 `{data, error}` 구조입니다. 둘은 **상호 배타적**.

### 성공

```json
{
  "data": { "id": 123, "email": "user@example.com" },
  "error": null
}
```

### 실패

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이메일 형식이 올바르지 않습니다",
    "details": { "field": "email" }
  }
}
```

### Flutter 매핑

```dart
final response = await apiClient.get('/users/me',
  fromData: (data) => UserProfile.fromJson(data),
);
if (response.isSuccess) {
  final user = response.data!;
} else {
  final errorCode = response.error!.code;
}
```

---

## 페이지네이션

### 응답

```json
{
  "data": {
    "content": [{ "id": 1 }, { "id": 2 }],
    "page": 0,
    "size": 20,
    "totalElements": 42,
    "totalPages": 3
  }
}
```

### Flutter 매핑: `PageResponse<T>`

```dart
final response = await apiClient.search('/expenses',
  request: searchRequest,
  fromItem: Expense.fromJson,
);
final page = response.data!;
page.content;       // List<Expense>
page.hasNextPage;   // bool
page.totalElements; // int
```

---

## 검색 요청 (POST /search)

### 요청 포맷

```json
{
  "conditions": {
    "categoryId_eq": 5,
    "amount_gte": 10000,
    "title_like": "커피"
  },
  "page": { "page": 0, "size": 20 },
  "sort": [
    { "field": "createdAt", "direction": "DESC" }
  ]
}
```

### Flutter: `SearchRequestBuilder`

```dart
final request = SearchRequestBuilder()
    .eq('categoryId', selectedCategory)
    .gte('amount', minAmount)
    .like('title', keyword)
    .page(0, 20)
    .sortBy('createdAt', SortDirection.desc)
    .build();
```

- null 값은 **자동 무시** (조건에 추가되지 않음)
- 빈 문자열/빈 리스트도 자동 무시

### 조건 연산자

| 연산자 | Flutter 메서드 | 의미 |
|--------|---------------|------|
| `field_eq` | `.eq()` | 일치 |
| `field_not` | `.notEq()` | 불일치 |
| `field_gte` | `.gte()` | 이상 |
| `field_lte` | `.lte()` | 이하 |
| `field_gt` | `.gt()` | 초과 |
| `field_lt` | `.lt()` | 미만 |
| `field_like` | `.like()` | 부분 매칭 (대소문자 무시) |
| `field_in` | `.isIn()` | 목록 포함 |
| `field_notIn` | `.notIn()` | 목록 미포함 |
| `field_isNull` | `.isNull()` | null 여부 |
| `field_isNotNull` | `.isNotNull()` | not null 여부 |

---

## 에러 코드

백엔드 `ErrorCode` enum과 1:1 매핑. `error_code.dart`에 정의.

| 코드 | HTTP | 의미 |
|------|------|------|
| `VALIDATION_ERROR` | 422 | 입력 검증 실패 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 중복 (이미 존재) |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `TOKEN_EXPIRED` | 401 | JWT 만료 |
| `INVALID_TOKEN` | 401 | JWT 유효하지 않음 |
| `INVALID_CREDENTIALS` | 401 | 이메일/비밀번호 불일치 |
| `EMAIL_NOT_VERIFIED` | 401 | 이메일 미인증 |
| `EMAIL_ALREADY_EXISTS` | 409 | 이메일 중복 가입 |
| `EMAIL_DELIVERY_FAILED` | 502 | 이메일 발송 실패 (외부 서비스) |
| `PUSH_DELIVERY_FAILED` | 502 | 푸시 발송 실패 (외부 서비스) |
| `SOCIAL_AUTH_FAILED` | 401 | 소셜 로그인 실패 (Apple/Google 토큰 검증) |

> `AuthInterceptor`는 응답 코드와 무관하게 **HTTP 401 전체**에 대해 1회 `/auth/refresh`를 시도한다. 성공하면 원 요청 재실행, 실패하면 원래의 401을 그대로 전파해 호출자가 `signOut()` 여부를 결정한다.

---

## 인증 엔드포인트

경로: `/api/apps/{appSlug}/auth/*`

| 엔드포인트 | 메서드 | Flutter 호출 |
|------------|--------|-------------|
| `/email/signup` | POST | `authService.signUpWithEmail(...)` |
| `/email/signin` | POST | `authService.signInWithEmail(...)` |
| `/verify-email` | POST | `ApiEndpoints.verifyEmail` (파생 레포 생성 후 구현) |
| `/resend-verification` | POST | `ApiEndpoints.resendVerification` (파생 레포 생성 후 구현) |
| `/password-reset/request` | POST | `ApiEndpoints.passwordResetRequest` (파생 레포 생성 후 구현) |
| `/password-reset/confirm` | POST | `ApiEndpoints.passwordResetConfirm` (파생 레포 생성 후 구현) |
| `/password/change` | POST | `ApiEndpoints.passwordChange` (파생 레포 생성 후 구현) |
| `/apple` | POST | `authService.signInWithApple(...)` |
| `/google` | POST | `authService.signInWithGoogle(...)` |
| `/refresh` | POST | `authService.refreshToken()` (자동) |
| `/withdraw` | POST | `authService.withdraw()` |

> 이메일 인증 / 비밀번호 리셋 / 비밀번호 변경 엔드포인트는 상수만 선언되어 있고 `AuthService` 메서드는 미구현. 파생 레포에서 필요 시 추가한다.

### 인증 응답

```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "abc123..."
  }
}
```

Flutter에서 자동 처리:
1. `TokenStorage`에 저장
2. JWT payload 파싱 → `CurrentUser`
3. `AuthState.authenticated` 방출 → GoRouter 리다이렉트

---

## 디바이스 엔드포인트

경로: `/api/apps/{appSlug}/devices`

| 엔드포인트 | 메서드 | Flutter 호출 |
|------------|--------|-------------|
| `/devices` | POST | `deviceRegistration.register(pushToken: token)` |
| `/devices/{id}` | DELETE | `deviceRegistration.unregister(deviceId)` |

---

## JSON 규칙

- 필드명: **camelCase**
- 날짜: **ISO 8601 UTC** (`"2026-04-14T10:30:00Z"`)
- null 필드: **응답에 포함하지 않음** (Jackson `non_null` 설정)
- 빈 배열: **빈 배열 `[]`로 반환** (null 아님)
