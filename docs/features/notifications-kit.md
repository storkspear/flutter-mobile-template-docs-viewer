# notifications_kit

**로컬 예약 알림 (특정 시각 · 매일 반복) + 타임존 처리**. FCM 푸시는 `NotificationService` 인터페이스를 파생 레포에서 구현해 통합.

---

## 개요

- **로컬 알림**: `flutter_local_notifications` 기반. 앱 내부에서 예약
- **타임존**: `timezone` 패키지로 DST · 지역 시간대 정확히 처리
- **FCM 통합 옵션**: `NotificationService` 인터페이스를 파생 레포에서 구현 (백엔드 device 등록은 `backend_api_kit` 의 `DeviceRegistration` 사용)
- **Debug 폴백**: 알림 권한 없거나 설정 전엔 콘솔 로그만
- **권한**: `permissions_kit` 함께 쓰면 요청 UI 자동

---

## 활성화

```yaml
# app_kits.yaml
kits:
  notifications_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  NotificationsKit(service: LocalScheduledAlertService()),
  // (선택) PermissionsKit(),
]);
```

> `service` 인자는 필수예요. 로컬 전용은 `LocalScheduledAlertService`, FCM 통합은 파생 레포에서 `NotificationService` 인터페이스를 구현한 클래스를 전달.

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `ScheduledAlertService` | **로컬 예약 알림 인터페이스** — `init` · `schedule` · `cancel` |
| `LocalScheduledAlertService` | `flutter_local_notifications` 기반 기본 구현 (NotificationsKit 의 default) |
| `NotificationService` | **FCM 푸시 인터페이스** — `init` · `getToken` · `onTokenRefresh` · `onForegroundMessage` · `onNotificationTap` (구현은 파생 레포에서) |
| `NotificationPermission` | 알림 권한 상태 enum + 헬퍼 |

> 백엔드에 FCM 토큰 등록하는 `DeviceRegistration` 클래스는 [`backend_api_kit`](./backend-api-kit.md) 으로 이동했어요. 로컬 전용 알림 앱이 BackendApiKit 없이 NotificationsKit 만 쓸 수 있도록 도메인 분리.

---

## 핵심 API

### 로컬 알림 예약

```dart
// 1회성 예약
await ref.read(scheduledAlertServiceProvider).scheduleAt(
  id: 100,
  title: '운동 시간이에요',
  body: '오늘의 목표를 완료하세요',
  when: DateTime.now().add(const Duration(hours: 1)),
);

// 매일 같은 시간
await ref.read(scheduledAlertServiceProvider).scheduleDaily(
  id: 200,
  title: '매일 아침 체크인',
  body: '오늘의 기분 기록',
  hour: 9,
  minute: 0,
);

// 취소 (positional 인자)
await ref.read(scheduledAlertServiceProvider).cancel(100);
await ref.read(scheduledAlertServiceProvider).cancelAll();
```

> Android 12+ 에서 정시 알람 (`exactTiming: true`) 을 쓰려면 `SCHEDULE_EXACT_ALARM` 권한이 필요해요. 자세한 옵션은 `ScheduledAlertService` 인터페이스 dartdoc 참조.

### FCM 푸시 (선택)

```dart
// 토큰 등록 (로그인 시)
final token = await FirebaseMessaging.instance.getToken();
await ref.read(deviceRegistrationProvider).register(token!);

// 포그라운드 메시지 수신
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // notification_service 가 로컬 알림으로 재전시
});
```

---

## 파생 레포 체크리스트

### 로컬 알림만

- [ ] `ios/Runner/Info.plist` 의 `UIBackgroundModes` 에 `fetch` · `remote-notification` 추가
- [ ] Android: `AndroidManifest.xml` 에 `POST_NOTIFICATIONS` 권한 (API 33+)
- [ ] `permissions_kit` 으로 권한 요청 UI

### FCM 푸시

- [ ] [Firebase Console](https://console.firebase.google.com) 프로젝트 생성
- [ ] Android: `google-services.json` → `android/app/`
- [ ] iOS: `GoogleService-Info.plist` → `ios/Runner/`, APNs key 업로드
- [ ] 백엔드 `core-device-impl` 에 FCM 서버 키 설정
- [ ] `NotificationService` 구현체 (FirebaseMessaging 기반) 작성 후 `notificationServiceProvider` override

### 타임존

- [ ] `timezone` 패키지 초기화 (`tz.initializeTimeZones()` 는 자동)
- [ ] 사용자 지역 시간대 감지 · 저장 (`flutter_timezone` 패키지 권장)

---

## Code References

- [`lib/kits/notifications_kit/notifications_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/notifications_kit.dart) — `AppKit` 구현
- [`lib/kits/notifications_kit/scheduled_alert_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/scheduled_alert_service.dart) — 인터페이스
- [`lib/kits/notifications_kit/local_scheduled_alert_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/local_scheduled_alert_service.dart) — 기본 구현
- [`lib/kits/notifications_kit/notification_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/notification_service.dart) — FCM 인터페이스
- [`lib/kits/notifications_kit/notification_permission.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/notifications_kit/notification_permission.dart) — 권한 헬퍼
- [`lib/kits/backend_api_kit/device_registration.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/device_registration.dart) — push token 백엔드 등록 (이 kit 에서 backend_api_kit 으로 이동)

---

## 관련 문서

- [`permissions-kit.md`](./permissions-kit.md) — 알림 권한 요청
- [`background-kit.md`](./background-kit.md) — workmanager 와 함께 사용 시
- [`ADR-006 · Debug 폴백`](../philosophy/adr-006-debug-fallback.md)
