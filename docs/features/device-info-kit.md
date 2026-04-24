# device_info_kit

**앱 버전 + 기기 정보 통합 조회**. `device_info_plus` + `package_info_plus` 래핑.

---

## 개요

- **앱 정보**: 버전 · 빌드 넘버 · 패키지 이름
- **기기 정보**: OS · 모델 · 디바이스 ID
- **Diagnostic 용도**: 크래시 리포트 첨부 · 푸시 토큰 등록 시

---

## 활성화

```yaml
# app_kits.yaml
kits:
  device_info_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  DeviceInfoKit(),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `DeviceInfoKit` | `AppKit` 구현 |
| `DeviceInfoService` | `getAppVersion` · `getDeviceInfo` |
| `DeviceInfo` (DTO) | 통합 기기 정보 |

---

## 사용 예

```dart
final info = await ref.read(deviceInfoServiceProvider).getDeviceInfo();
print('앱 버전: ${info.appVersion}');   // "1.2.3+45"
print('OS: ${info.os}');               // "iOS 17.1" / "Android 14"
print('모델: ${info.model}');           // "iPhone 15 Pro" / "Pixel 8"
print('디바이스 ID: ${info.deviceId}'); // 고유 식별자
```

### 크래시 리포트 첨부

```dart
final info = await ref.read(deviceInfoServiceProvider).getDeviceInfo();
await ref.read(crashServiceProvider).addBreadcrumb('Device info', data: info.toMap());
```

---

## 파생 레포 체크리스트

- [ ] iOS: `Info.plist` 의 `CFBundleShortVersionString` · `CFBundleVersion`
- [ ] Android: `android/app/build.gradle.kts` 의 `versionName` · `versionCode`
- [ ] 개인정보 정책 업데이트: 기기 ID 수집 명시

---

## Code References

- [`lib/kits/device_info_kit/device_info_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/device_info_kit/device_info_kit.dart)
- [`lib/kits/device_info_kit/device_info_service.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/device_info_kit/device_info_service.dart)
