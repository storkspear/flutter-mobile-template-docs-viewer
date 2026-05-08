# Devices

푸시 알림 발송 대상 기기 등록/해제. 짝 백엔드의 [`DeviceController`](https://github.com/storkspear/template-spring/blob/main/core/core-device-impl/src/main/java/com/factory/core/device/impl/controller/DeviceController.java) 와 1:1 결합.

Flutter 측 호출은 [`lib/kits/backend_api_kit/device_registration.dart`](../../lib/kits/backend_api_kit/device_registration.dart) 의 `DeviceRegistration` 클래스가 담당.

---

## 엔드포인트

| Method | Path | 인증 | Response |
|---|---|---|---|
| POST | `/api/apps/{appSlug}/devices` | 필수 | `ApiResponse<DeviceDto>` |
| DELETE | `/api/apps/{appSlug}/devices/{id}` | 필수 | `204 No Content` |

> `/api/apps/{appSlug}` prefix 가 붙어요 — `ApiClient.post` / `ApiClient.delete` 의 자동 prefix 적용 대상.

---

## 등록 (POST)

### Request

```
POST /api/apps/{appSlug}/devices
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "platform": "ios",
  "pushToken": "fcm-or-apns-token-string",
  "deviceName": "iPhone 15"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `platform` | string | ✅ | `"ios"` 또는 `"android"` |
| `pushToken` | string | ✅ | FCM 토큰 (iOS 도 FCM 사용 권장) 또는 APNs 토큰 |
| `deviceName` | string | ⬜ | 사용자 표시용 (예: "홍길동의 아이폰") |

### Upsert 의미론

**같은 user + 같은 platform** 으로 다시 호출하면 백엔드가 **기존 레코드 update** (새 token 으로 교체). 즉, FCM 토큰 갱신 시 별도 DELETE 없이 POST 만으로 갱신 가능. 이 동작은 짝 백엔드 `DeviceController.register` 의 docstring 에 명시돼요.

### Response

```json
{
  "data": {
    "id": 101,
    "platform": "ios",
    "pushToken": "fcm-or-apns-token-string",
    "deviceName": "iPhone 15"
  },
  "error": null
}
```

응답의 `id` 를 클라가 보관해두면 향후 DELETE 시 그대로 사용 가능 (보통 로그아웃 직전 unregister 호출).

---

## 해제 (DELETE)

### Request

```
DELETE /api/apps/{appSlug}/devices/{id}
Authorization: Bearer <access_token>
```

`{id}` 는 등록 시 받은 device id.

### Response

```
204 No Content
```

본문 없음. 본인 소유 디바이스가 아니면 `403 Forbidden` (또는 `404 Not Found` — 백엔드 정책에 따름).

---

## 클라이언트 호출 패턴

```dart
// 등록 (FCM 토큰 갱신 콜백에서 자동 호출)
final info = await deviceRegistration.register(
  pushToken: fcmToken,
  deviceName: deviceName,
);
// info!.id 를 prefs 에 저장해 두면 unregister 시 사용

// 해제 (로그아웃 직전)
await deviceRegistration.unregister(savedDeviceId);
```

---

## 알림 흐름 결합

디바이스가 등록돼야 백엔드가 푸시를 보낼 대상을 결정해요. 알림 채널 (push/email) 별 toggle 은 [`notification-preferences.md`](./notification-preferences.md) 참조.

```
NotificationsKit.init()
  → FCM 토큰 획득
    → DeviceRegistration.register(pushToken)        ← 본 문서
      → 알림 발송 시 백엔드가 device.pushToken 로 발송
        → kind 별 NotificationPreferences 가 ON 일 때만 발송
```

---

## 계약 변경 시

- 새 `platform` 값 (예: `"web"`) 추가는 양쪽 동시 배포 필요. 짝 백엔드의 `Device.platform` 검증 로직 + Flutter 의 `Platform.isIOS / isAndroid` 분기 둘 다 갱신.

---

## 관련 문서

- [`notification-preferences.md`](./notification-preferences.md) — kind 별 push/email toggle
- [`response-schema.md`](./response-schema.md) — `ApiResponse<T>` 래퍼
- [짝 백엔드 `DeviceController`](https://github.com/storkspear/template-spring/blob/main/core/core-device-impl/src/main/java/com/factory/core/device/impl/controller/DeviceController.java)
