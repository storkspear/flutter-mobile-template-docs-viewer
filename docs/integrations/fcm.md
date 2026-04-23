# FCM 통합

`DebugNotificationService` → `FcmNotificationService` 교체 + 백엔드 디바이스 등록.

## 1) 의존성 추가

```yaml
dependencies:
  firebase_core: ^3.6.0
  firebase_messaging: ^15.1.3
  flutter_local_notifications: ^17.2.3
```

## 2) Firebase 프로젝트 설정

```bash
dart pub global activate flutterfire_cli
flutterfire configure --project=<firebase-project-id>
```

생성된 `lib/firebase_options.dart`는 **파생 레포에만 커밋**합니다 (템플릿에는 금지).

## 3) 구현체 작성

`lib/kits/notifications_kit/fcm_notification_service.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'notification_service.dart';

class FcmNotificationService implements NotificationService {
  final _fcm = FirebaseMessaging.instance;
  final _local = FlutterLocalNotificationsPlugin();

  void Function(NotificationPayload)? _foregroundHandler;
  void Function(NotificationPayload)? _tapHandler;

  @override
  Future<void> init() async {
    await _fcm.requestPermission(alert: true, badge: true, sound: true);

    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    FirebaseMessaging.onMessage.listen((msg) {
      _foregroundHandler?.call(_toPayload(msg));
    });
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _tapHandler?.call(_toPayload(msg));
    });
  }

  @override
  Future<String?> getToken() => _fcm.getToken();

  @override
  Stream<String> get onTokenRefresh => _fcm.onTokenRefresh;

  @override
  void onForegroundMessage(void Function(NotificationPayload) handler) {
    _foregroundHandler = handler;
  }

  @override
  void onNotificationTap(void Function(NotificationPayload) handler) {
    _tapHandler = handler;
  }

  @override
  Future<void> showLocal({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) {
    return _local.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails('default', 'Default'),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  NotificationPayload _toPayload(RemoteMessage msg) {
    return NotificationPayload(
      title: msg.notification?.title,
      body: msg.notification?.body,
      data: msg.data,
    );
  }
}
```

## 4) Provider 교체

```dart
final notificationServiceProvider = Provider<NotificationService>(
  (ref) => FcmNotificationService(),
);
```

## 5) 백엔드 등록 흐름 (핵심)

`DeviceRegistration`이 이미 구현되어 있습니다 (`lib/kits/notifications_kit/device_registration.dart`). 로그인 성공 후 다음을 호출합니다:

```dart
// 예: splash나 home 초기화에서
final notif = ref.read(notificationServiceProvider);
final device = ref.read(deviceRegistrationProvider);

await notif.init();
final token = await notif.getToken();
if (token != null) {
  await device.register(pushToken: token, deviceName: await _deviceName());
}

notif.onTokenRefresh.listen((newToken) {
  device.register(pushToken: newToken);
});
```

- 로그아웃 시: `device.unregister(deviceId)` 호출합니다.
- 백엔드는 `POST /api/apps/{appSlug}/devices`로 동일 platform이면 토큰 업데이트(upsert)합니다.

## 6) iOS APNs

- `ios/Runner/Info.plist`에 `UIBackgroundModes > remote-notification` 추가
- APNs 인증 키를 Firebase Console에 업로드
- Capabilities → Push Notifications 활성화

## 7) 검증

- 디버그 빌드에서 `getToken()` 값을 로그로 확인합니다
- Firebase Console에서 해당 토큰으로 테스트 메시지 전송 → 수신 확인
- 백엔드 `/devices` 조회 시 토큰이 저장되어 있는지 확인합니다
