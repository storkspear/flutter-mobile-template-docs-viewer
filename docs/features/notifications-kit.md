# notifications_kit

**로컬 예약 알림 (특정 시각 · 매일 반복) + 타임존 처리**. FCM 푸시도 `FcmNotificationService` 교체 가능.

---

## 개요

- **로컬 알림**: `flutter_local_notifications` 기반. 앱 내부에서 예약
- **타임존**: `timezone` 패키지로 DST · 지역 시간대 정확히 처리
- **FCM 통합 옵션**: `FcmNotificationService` 구현체 (백엔드 device 등록)
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
  NotificationsKit(),
  // (선택) PermissionsKit(),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `NotificationService` | 추상. `schedule` · `scheduleDaily` · `cancel` · `cancelAll` |
| `DebugNotificationService` | 기본 구현. 콘솔 출력만 |
| `LocalNotificationService` | `flutter_local_notifications` 기반 실제 구현 |
| `FcmNotificationService` | FCM 푸시 + 로컬 알림 통합 (선택) |
| `DeviceRegistration` | 백엔드에 FCM 토큰 등록 |
| `ScheduledAlertService` | 예약 알림 도메인 헬퍼 |

---

## 핵심 API

### 로컬 알림 예약

```dart
await ref.read(notificationServiceProvider).schedule(
  id: 100,
  title: '운동 시간이에요',
  body: '오늘의 목표를 완료하세요',
  scheduledAt: DateTime.now().add(Duration(hours: 1)),
);

// 매일 같은 시간
await ref.read(notificationServiceProvider).scheduleDaily(
  id: 200,
  title: '매일 아침 체크인',
  body: '오늘의 기분 기록',
  hour: 9,
  minute: 0,
);

// 취소
await ref.read(notificationServiceProvider).cancel(id: 100);
await ref.read(notificationServiceProvider).cancelAll();
```

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
- [ ] `FcmNotificationService` 를 `notification_service_provider` override

### 타임존

- [ ] `timezone` 패키지 초기화 (`tz.initializeTimeZones()` 는 자동)
- [ ] 사용자 지역 시간대 감지 · 저장 (`flutter_timezone` 패키지 권장)

---

## Code References

- [`lib/kits/notifications_kit/notification_service.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/notifications_kit/notification_service.dart) — 추상 + Debug
- [`lib/kits/notifications_kit/scheduled_alert_service.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/notifications_kit/scheduled_alert_service.dart)
- [`lib/kits/notifications_kit/device_registration.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/notifications_kit/device_registration.dart)

---

## 관련 문서

- [`permissions-kit.md`](./permissions-kit.md) — 알림 권한 요청
- [`background-kit.md`](./background-kit.md) — workmanager 와 함께 사용 시
- [`ADR-006 · Debug 폴백`](../philosophy/adr-006-debug-fallback.md)
