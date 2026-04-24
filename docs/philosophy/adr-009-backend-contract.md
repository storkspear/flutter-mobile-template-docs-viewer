# ADR-009 · 백엔드 응답 1:1 계약 (`{data, error}` + PageResponse)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/kits/backend_api_kit/api_response.dart` + `api_exception.dart` + `error_code.dart` 3개 파일로 구현. 짝이 되는 백엔드 [`spring-backend-template`](https://github.com/storkspear/spring-backend-template) 의 `common-web` 모듈과 스키마가 동일.

## 결론부터

이 프론트엔드 템플릿은 **짝이 되는 백엔드 템플릿과 응답 스키마를 글자 단위로 맞춰놓아요**. 백엔드가 내려주는 `{data, error}` 래퍼와 `PageResponse`, 그리고 `ErrorCode` enum 값이 **양쪽 레포에서 완전히 동일** 해요. 그래서 클라이언트가 직접 스키마를 설계하거나 mapper 를 쓸 필요가 없고, 서버 변경 시에는 두 레포의 동일 이름 파일만 동기화하면 끝나요.

> **한 사람이 프론트 + 백엔드를 둘 다 운영한다는 전제** 덕분에 가능한 설계예요. 팀이 나뉘어 있다면 이 수준의 결합은 위험했을 거예요. 프롤로그 참조.

## 왜 이런 고민이 시작됐나?

클라이언트가 서버 응답을 받을 때 일반적으로 세 층을 거쳐요.

```
서버 JSON  →  DTO 파싱  →  도메인 모델 변환  →  UI
            (네트워크층)   (mapper 층)      (state 층)
```

일반 엔터프라이즈에선 **mapper 층이 필수** 예요. 이유는 "서버 변경이 UI 까지 쭉 번지지 않도록" 경계를 두기 위함. 프론트 팀과 백엔드 팀이 다르면, 서버가 `snake_case` 로 주든 필드명을 바꾸든 클라이언트는 자기 관용으로 변환 계층을 끼워요.

하지만 이 프로젝트는 **같은 사람** 이 두 템플릿을 쌍으로 운영하는 구조예요 (프롤로그). 여기서 다음 힘들이 부딪혀요.

**힘 A — 변경 비용 최소화**  
서버 응답에 필드 하나 추가할 때마다 (1) 백엔드 DTO → (2) 클라이언트 DTO → (3) 도메인 모델 → (4) UI 를 전부 수정해야 해요. 4곳 동기화는 솔로한테 지옥. 제약 2 (시간) 직접 위반.

**힘 B — 타입 안전**  
그렇다고 서버 JSON 을 `Map<String, dynamic>` 으로 UI 까지 끌고 오면 각 화면이 `map['created_at'] as String?` 같은 추측 코드로 뒤덮여요. 컴파일러 도움 없음 + 런타임 오류 범람.

**힘 C — 에러 처리 표준화**  
서버가 내려주는 에러 코드가 `ErrorCode.INVALID_CREDENTIALS` 인지 `"invalid_credentials"` 인지 `"INVALID-CREDENTIALS"` 인지 같은 **표기 불일치** 가 생기면 클라이언트의 `switch` 문이 전부 깨져요. 반복되는 사고 유형.

이 결정이 답해야 했던 물음이에요.

> **서버와 클라이언트가 한 사람이 운영하는 템플릿 쌍** 이라는 전제를 어떻게 스키마 설계에 활용해서 변환 계층을 없앨 수 있는가?

## 고민했던 대안들

### Option 1 — OpenAPI + 코드 생성

백엔드가 OpenAPI 스펙을 내보내고, 클라이언트는 `openapi_generator` 로 Dart 코드 생성.

- **장점**: 타입 안전 완벽. 서버 스펙 변경이 자동으로 클라이언트 코드에 반영.
- **단점 1**: OpenAPI spec 자체가 YAML 수백 줄 관리 대상. 서버 컨트롤러 한 줄 수정 → spec 재생성 → 클라이언트 regenerate → 빌드 → diff 리뷰의 긴 cycle.
- **단점 2**: 생성된 코드가 `freezed` + `json_serializable` 스타일로 나와서 import 가 폭발. 생성 파일이 수백 개.
- **단점 3**: 커스텀 필드 (`@JsonKey`, union type 등) 변환 시 spec 수정 러닝 커브.
- **탈락 이유**: 한 사람이 두 템플릿을 운영하는 맥락에선 **코드 생성의 자동화 이득보다 유지 오버헤드가 더 큼**.

### Option 2 — GraphQL / tRPC 같은 type-safe RPC

`graphql_codegen` 등으로 쿼리 단위에 정확히 맞는 타입 생성.

- **장점**: 타입 안전 + over-fetching 해결.
- **단점 1**: 백엔드에 GraphQL 서버 추가 필요 → Spring 템플릿에 GraphQL 스택 도입 비용. 제약 1 (운영 가능성) 위반.
- **단점 2**: 모바일 앱의 단순한 CRUD 에는 과한 도구. "해머로 압정 박기" 수준.
- **탈락 이유**: 앱 공장의 scope 를 벗어남.

### Option 3 — 클라이언트 자체 DTO + mapper 층

클라이언트가 서버 스키마와 독립된 자기 DTO 를 정의하고, `UserMapper.fromJson` 같은 변환기로 도메인 모델 생성.

- **장점**: 서버 변경이 UI 에 바로 번지지 않는 경계 보장.
- **단점 1**: 서버에 이미 DTO 가 있는데 클라이언트에서 또 DTO → mapper → 도메인 3중 구조. 한 사람이 관리 시 중복 극심.
- **단점 2**: spring-backend-template 의 ADR-016 (DTO Mapper 금지) 철학과 정면 충돌. 백엔드는 이미 mapper 를 없앤 상태인데 클라이언트만 도입하면 방향성 불일치.
- **탈락 이유**: 팀이 나뉘어 있을 때의 패턴을 솔로 환경에 끌어오는 셈.

### Option 4 — 백엔드 스키마 1:1 미러링 + `ApiResponse<T>` 제네릭 ★ (채택)

클라이언트가 백엔드 스키마를 **그대로 받아서 그대로 씀**. `ApiResponse<T>` · `PageResponse<T>` · `ErrorCode` 세 타입이 양쪽 레포에서 글자까지 동일.

- **힘 A 만족**: 서버 필드 추가 시 (1) 백엔드 DTO → (2) 클라이언트 DTO **두 곳만** 수정. 도메인 모델 변환 단계 없음.
- **힘 B 만족**: 제네릭으로 각 API 별 정확한 타입 (`ApiResponse<User>`, `PageResponse<Post>`) 추론.
- **힘 C 만족**: `ErrorCode` enum 문자열이 양쪽에서 동일 → `if (e.code == ErrorCode.invalidCredentials)` 가 서버 변경에도 자동 동기화.

## 결정

3개 파일 + 3가지 타입으로 계약을 고정해요.

### ApiResponse — 표준 응답 래퍼

```dart
// lib/kits/backend_api_kit/api_response.dart 발췌
class ApiResponse<T> {
  final T? data;
  final ApiError? error;

  const ApiResponse({this.data, this.error});

  bool get isSuccess => error == null;
  bool get isError => error != null;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromData,
  ) {
    return ApiResponse(
      data: json['data'] != null
          ? (fromData != null ? fromData(json['data']) : json['data'] as T?)
          : null,
      error: json['error'] != null ? ApiError.fromJson(json['error']) : null,
    );
  }
}

class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
  // ...
}
```

**서버 응답 예시**:

```json
// 성공
{ "data": { "id": 42, "name": "..." }, "error": null }

// 실패
{ "data": null, "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details": {...} } }
```

`data` 와 `error` 는 **항상 상호 배타적**. 이 불변량이 `isSuccess` / `isError` getter 의 근거예요.

### PageResponse — 페이지네이션 래퍼

```dart
// lib/kits/backend_api_kit/api_response.dart 발췌
class PageResponse<T> {
  final List<T> content;
  final int page;
  final int size;
  final int totalElements;
  final int totalPages;

  bool get isLastPage => page >= totalPages - 1;
  bool get hasNextPage => !isLastPage;

  factory PageResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    return PageResponse(
      content: (json['content'] as List).map((e) => fromItem(e as Map<String, dynamic>)).toList(),
      page: json['page'] as int,
      size: json['size'] as int,
      totalElements: json['totalElements'] as int,
      totalPages: json['totalPages'] as int,
    );
  }
}
```

**서버 응답 예시**:

```json
{
  "data": {
    "content": [ {...}, {...}, {...} ],
    "page": 0,
    "size": 20,
    "totalElements": 153,
    "totalPages": 8
  },
  "error": null
}
```

Spring Boot 의 `Page<T>` 가 직렬화될 때의 포맷을 그대로 따라요.

### ErrorCode — enum 1:1 매핑

```dart
// lib/kits/backend_api_kit/error_code.dart 전체
class ErrorCode {
  static const validationError = 'VALIDATION_ERROR';
  static const notFound = 'NOT_FOUND';
  static const conflict = 'CONFLICT';
  static const internalError = 'INTERNAL_ERROR';

  static const unauthorized = 'UNAUTHORIZED';
  static const forbidden = 'FORBIDDEN';
  static const tokenExpired = 'TOKEN_EXPIRED';
  static const invalidToken = 'INVALID_TOKEN';
  static const invalidCredentials = 'INVALID_CREDENTIALS';
  static const emailNotVerified = 'EMAIL_NOT_VERIFIED';
  static const emailAlreadyExists = 'EMAIL_ALREADY_EXISTS';

  static const emailDeliveryFailed = 'EMAIL_DELIVERY_FAILED';
  static const pushDeliveryFailed = 'PUSH_DELIVERY_FAILED';
  static const socialAuthFailed = 'SOCIAL_AUTH_FAILED';
}
```

이 값들은 **spring-backend-template 의 `ErrorCode` enum 과 문자열이 동일** 해요. 서버에 새 에러가 추가되면 양쪽 레포에 같은 이름으로 넣어야 해요.

### ApiException + safeErrorCode / safeErrorMessage

ViewModel 은 서버 에러를 `ApiException` 으로 받아서 처리해요.

```dart
// lib/kits/backend_api_kit/api_exception.dart 발췌
class ApiException implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? details;

  factory ApiException.fromApiError(ApiError error, {int? statusCode}) => ...;
  factory ApiException.network([String? message]) => ...;
  factory ApiException.timeout() => ...;
  factory ApiException.unknown([String? message]) => ...;

  bool get isTokenExpired => code == 'TOKEN_EXPIRED';
  bool get isUnauthorized => code == 'UNAUTHORIZED' || statusCode == 401;
}

/// UI 에 안전한 에러 코드. ApiException 이면 서버 code, 아니면 fallback.
String safeErrorCode(Object e, {String fallbackCode = 'UNKNOWN_ERROR'}) {
  if (e is ApiException) return e.code;
  return fallbackCode;
}
```

`safeErrorCode` / `safeErrorMessage` 의 역할은 **raw exception 의 stack 이나 내부 경로가 UI 로 유출되는 걸 차단** 하는 거예요. ViewModel 은 항상 이 두 함수로 감싸서 state 에 저장해요 (ADR-005).

### 설계 선택 포인트

**포인트 1 — `ApiResponse` 는 data/error 를 **객체가 아닌 단순 nullable** 로 표현**  
`sealed class` + `Success(data)` · `Failure(error)` 같은 ADT 를 쓸까 고민했지만, Spring 이 JSON 직렬화할 때 `null` 필드를 그대로 내려주는 포맷과 맞아야 해서 nullable 로 갔어요. 대신 `isSuccess` / `isError` getter 로 분기 의도를 명확히.

**포인트 2 — `fromData` 콜백으로 제네릭 파싱**  
Dart 에는 JSON 라이브러리 수준의 런타임 타입 정보가 없어서, `ApiResponse<User>.fromJson(json, User.fromJson)` 처럼 **생성자 참조를 명시적으로 넘김**. 이 관용은 매 DTO 에 반복되지만, `freezed` + `json_serializable` 체인을 피해 얻는 대가로 받아들였어요.

**포인트 3 — `PageResponse` 는 백엔드 Spring `Page<T>` 를 그대로**  
클라이언트 취향에 맞춰 `meta` 필드로 래핑할까 했지만, Spring 의 기본 포맷과 어긋나면 백엔드가 직접 커스텀 직렬화기를 만들어야 해요. 서버에 쓸데없는 코드를 늘리지 않기 위해 Spring 표준을 그대로 따랐어요.

**포인트 4 — `ErrorCode` 는 enum 이 아니라 static const String**  
Dart enum 을 쓰면 `ErrorCode.invalidCredentials.name` 같은 방식이 가능하지만, 서버 문자열이 `SCREAMING_SNAKE_CASE` 라 `name` 과 불일치해요. 그래서 `static const invalidCredentials = 'INVALID_CREDENTIALS'` 로 평범한 문자열 상수를 택했어요. switch 대신 `if (e.code == ErrorCode.invalidCredentials)` 패턴.

## 이 선택이 가져온 것

### 긍정적 결과

- **Mapper 층 전무**: 서버 DTO 가 클라이언트 DTO 에 그대로 도달. 파일 수가 대략 절반 수준.
- **서버-클라이언트 동시 추적**: 에러 코드를 추가할 때 두 레포의 `ErrorCode.java` · `error_code.dart` 를 동시에 수정하는 관행이 자연스럽게 형성됨. PR 리뷰에서 한쪽만 수정됐으면 바로 눈에 띔.
- **IDE 타입 추론 완벽**: `final user = response.data!; // User` 처럼 제네릭이 제대로 흐름. `as User` 캐스트 거의 필요 없음.
- **테스트 시 JSON 고정 가능**: 서버 쪽의 실제 응답 JSON 을 그대로 복사해서 `ApiResponse.fromJson(sample)` 로 테스트 픽스처 제작. 스키마 표류가 즉시 발견.
- **페이지네이션 관용**: `PageResponse<T>.hasNextPage` / `isLastPage` 로 무한 스크롤 로직이 짧아져요.

### 부정적 결과

- **두 레포 수동 동기화**: 에러 코드 추가 · 스키마 변경 시 양쪽 파일을 사람이 맞춰야 해요. 자동화 없음. 단기 실수 위험.
- **`ApiResponse` 의 nullable 혼란**: `data` 는 nullable, `error` 도 nullable 이라 **논리적으로 4가지 조합** (둘 다 있음 / 둘 다 없음 등) 이 컴파일러 입장에선 가능해 보여요. 불변량은 설계 문서에만 명시됨. 방어적 체크가 관용적으로 들어가요.
- **generic parsing 의 cold start 감각**: 매 DTO 에 `fromJson` · `fromItem` 콜백 넘기는 관용이 처음엔 번잡하게 느껴져요. `freezed` 에 익숙한 개발자가 특히 그래요.
- **팀이 커지면 재고 필요**: 백엔드팀이 분리되는 순간 이 수준의 결합은 깨져요. 그때는 ADR-003 (mapper 층 도입) 으로 돌아가야 해요.

## 교훈

### 교훈 1 — "스키마 결합 = 나쁨" 은 팀 시나리오 한정

업계 통념상 "클라이언트가 서버 스키마에 결합되는 건 나쁘다" 고 해요. 이건 **팀이 나뉘어 있고 변경 속도가 비대칭일 때** 맞는 말이에요. 한 사람이 양쪽을 운영하면 결합이 **오히려 비용 절감** 이에요. 통념을 상황에 맞춰 역으로 뒤집은 결정이에요.

**교훈**: 아키텍처 통념은 "누가 얼마나 큰 조직에서 쓰는가?" 맥락을 내포해요. 솔로 인디 환경에선 같은 결정이 완전히 다른 의미가 돼요.

### 교훈 2 — 생성 코드 (codegen) 는 조직 규모와 비례 비용

OpenAPI / freezed / json_serializable 같은 코드 생성 도구는 **수십 명이 동일 DTO 를 만지는 환경** 에서 빛나요. 솔로가 쓰면 "어 내가 DTO 한 줄 수정하려는데 3초 기다려야 하네" 가 매일 반복. 코드 생성의 가치는 변화의 빈도 × 참여 인원에 비례해요.

**교훈**: 도구 도입 결정 시 **코드 생성이 주는 이득 / 생성 파이프라인의 유지비** 비율을 계산하세요. 솔로 환경에선 이 비율이 놀랄 만큼 자주 마이너스예요.

### 교훈 3 — `safeErrorCode` 는 보안 경계

초기엔 ViewModel 에서 `state.errorMessage = e.toString()` 을 썼어요. 그러면 `ApiException($code): $message` 이나 `DioException: connection timeout at https://internal-api.../users/...` 같은 스택 정보가 UI 에 노출됐어요. `safeErrorCode` / `safeErrorMessage` 를 도입하면서 **"ViewModel 은 반드시 이 두 함수를 거친다"** 는 관용이 생겼어요.

**교훈**: 에러 포매팅은 로깅 (개발자용) 과 UI (사용자용) 을 다른 함수로 분리. 섞이면 사고.

## 관련 사례 (Prior Art)

- [spring-backend-template · api-response.md](https://github.com/storkspear/spring-backend-template/blob/main/docs/api-contract/api-response.md) — 짝이 되는 백엔드 스키마 원본
- [Spring Boot `Page<T>` 직렬화](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html#core.web) — `PageResponse` 포맷의 출처
- [RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807) — 에러 응답 표준화 관련 표준. 본 ADR 은 이보다 단순한 `{code, message}` 택함
- [JSON:API spec](https://jsonapi.org/) — `{data, errors}` 포맷의 대중화. 본 ADR 은 singular `error` 를 택했는데 백엔드 Spring 관용과 맞춤
- [GraphQL vs REST 비교 (Apollo)](https://www.apollographql.com/blog/graphql-vs-rest) — 대안 Option 2 의 근거

## Code References

**계약 구현** (클라이언트)
- [`lib/kits/backend_api_kit/api_response.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/api_response.dart) — `ApiResponse<T>` · `ApiError` · `PageResponse<T>` (77줄)
- [`lib/kits/backend_api_kit/error_code.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/error_code.dart) — 에러 코드 상수 (24줄)
- [`lib/kits/backend_api_kit/api_exception.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/api_exception.dart) — `ApiException` + `safeErrorCode` / `safeErrorMessage` (67줄)
- [`lib/kits/backend_api_kit/api_client.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/backend_api_kit/api_client.dart) — `ApiClient.get/post<T>` 에서 `fromData` 콜백 받아 파싱

**ViewModel 에서 사용**
- [`lib/kits/auth_kit/ui/login/login_view_model.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/ui/login/login_view_model.dart) — `safeErrorCode` / `safeErrorMessage` 사용 예

**짝이 되는 백엔드 정의** (spring-backend-template)
- [`common-web/src/main/java/com/factory/common/web/response/ApiResponse.java`](https://github.com/storkspear/spring-backend-template/blob/main/common/common-web/src/main/java/com/factory/common/web/response/ApiResponse.java) — 동일 스키마 서버 측
- [`common-web/src/main/java/com/factory/common/web/error/ErrorCode.java`](https://github.com/storkspear/spring-backend-template/blob/main/common/common-web/src/main/java/com/factory/common/web/error/ErrorCode.java) — 같은 enum 문자열

**관련 ADR**:
- [ADR-010 · QueuedInterceptor 로 401 자동 갱신](./adr-010-queued-interceptor.md) — `TOKEN_EXPIRED` 에러 코드가 여기서 트리거
- [ADR-011 · 3층 인터셉터 체인](./adr-011-interceptor-chain.md) — `DioException → ApiException` 변환 책임이 `ErrorInterceptor` 에 있음
- [ADR-012 · 앱별 독립 유저 + JWT appSlug](./adr-012-per-app-user.md) — 본 ADR 의 JWT · 인증 헤더 계약과 이어짐
- [ADR-005 · Riverpod + MVVM](./adr-005-riverpod-mvvm.md) — ViewModel 이 `safeErrorCode` 로 state 를 채우는 이유
