# User Profile

현재 로그인 유저의 **자신의 프로필** 조회/수정. 짝 백엔드의 `UserController` ([`/api/core/users/me`](https://github.com/storkspear/template-spring/blob/main/core/core-user-impl/src/main/java/com/factory/core/user/impl/controller/UserController.java)) 와 1:1 결합.

> **경로 주의 — 글로벌 endpoint** : `/api/apps/{slug}` prefix 가 **없어요**. user 프로필은 앱별이 아닌 글로벌 도메인이라 짝 백엔드에서 `/api/core/users/...` 경로로 노출돼요.
>
> Flutter `ApiClient.get/patch` 는 `/api/apps/{slug}` 자동 prefix 를 붙이므로 user 프로필 호출 시에는 **prefix 우회** 가 필요해요. 코드는 `lib/kits/backend_api_kit/api_endpoints.dart` 의 `userMe` 상수 (절대 경로) + `_apiClient.dio` 직접 호출 또는 `postRaw` 패턴을 써요.

---

## 엔드포인트

| Method | Path | 인증 | Response |
|---|---|---|---|
| GET | `/api/core/users/me` | 필수 | `ApiResponse<UserProfile>` |
| PATCH | `/api/core/users/me` | 필수 | `ApiResponse<UserProfile>` |

---

## 조회 (GET)

### Request

```
GET /api/core/users/me
Authorization: Bearer <access_token>
```

> URL 의 `appSlug` 가 없으므로 백엔드 `AppSlugVerificationFilter` 의 검증을 거치지 않아요. JWT 의 `sub` 만으로 본인 식별.

### Response

```json
{
  "data": {
    "id": 42,
    "email": "user@example.com",
    "displayName": "홍길동",
    "emailVerified": true,
    "role": "user",
    "createdAt": "2026-04-15T03:21:00Z"
  },
  "error": null
}
```

> 정확한 필드는 짝 백엔드의 `UserProfile` record 를 진실 출처로 봐요. 프론트가 임의로 필드 추가/삭제하지 않아요 (계약 변경은 백엔드 리드).

---

## 수정 (PATCH — partial update)

### Request

```
PATCH /api/core/users/me
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "displayName": "홍길동(수정)"
}
```

### PATCH 의미론

- **`null` 필드는 유지**: 본문에 포함되지 않은 필드는 변경 안 됨.
- **명시적 `null` 도 유지** (clear 의도가 아님): 짝 백엔드는 PATCH 의미를 "absent = no-op" 로 해석.
- 변경 불가 필드 (id, email, emailVerified, role, createdAt) 는 본문에 포함해도 무시.

### Response

수정 후 최신 `UserProfile` 반환 (GET 과 동일 shape).

```json
{
  "data": {
    "id": 42,
    "email": "user@example.com",
    "displayName": "홍길동(수정)",
    "emailVerified": true,
    "role": "user",
    "createdAt": "2026-04-15T03:21:00Z"
  },
  "error": null
}
```

---

## 클라이언트 호출 패턴

```dart
// 직접 ApiClient.dio 사용 (prefix 우회)
final response = await apiClient.dio.get(ApiEndpoints.userMe);
final profile = UserProfile.fromJson(
  (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
);
```

> 실 코드는 `lib/features/profile/` 같은 도메인 layer 에서 wrap 해요. 이 문서는 계약만 정리.

---

## 계약 변경 시

- 짝 백엔드의 `UserProfile.java` 와 Flutter 의 `UserProfile.fromJson` 동시 수정.
- 필드 **추가** 는 하위 호환 (Flutter 가 모르는 필드 무시). **삭제** / **이름 변경** 은 양쪽 동시 배포 + 마이그레이션 필요.

---

## 관련 문서

- [`response-schema.md`](./response-schema.md) — `ApiResponse<T>` 래퍼 구조
- [`auth-flow.md`](./auth-flow.md) — JWT 인증 흐름 (`sub` → userId)
- [`error-codes.md`](./error-codes.md) — `USR_*` 에러 코드
- [짝 백엔드 `UserController`](https://github.com/storkspear/template-spring/blob/main/core/core-user-impl/src/main/java/com/factory/core/user/impl/controller/UserController.java)
