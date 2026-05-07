# permissions_kit

**런타임 권한 요청 + 거부 시 설정 유도 다이얼로그**. 카메라 · 위치 · 알림 등.

---

## 개요

- **`permission_handler` 기반**: 표준 Flutter 권한 라이브러리
- **자동 다이얼로그**: "영구 거부" 상태면 "설정으로 이동" 버튼
- **플랫폼별 처리**: iOS · Android 권한 이름 자동 매핑
- **순차 요청**: 여러 권한 순서대로

---

## 활성화

```yaml
# app_kits.yaml
kits:
  permissions_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  PermissionsKit(),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `PermissionsKit` | `AppKit` 구현 (Provider 노출 없음) |
| `PermissionHelper` | **static** `ensure(BuildContext, Permission, {showOpenSettingsPrompt, openSettingsTitle, openSettingsMessage}) → Future<bool>` — 권한 요청 + 영구 거부 시 설정 앱 유도 다이얼로그 (`AppDialog.confirm` + `openAppSettings`) |

---

## 사용 예

```dart
// 카메라 권한 요청 (한 줄로 거부·영구거부·설정유도까지 처리)
final granted = await PermissionHelper.ensure(context, Permission.camera);
if (granted) {
  // 카메라 기능 진행
}

// 여러 권한은 순차 호출
final cam = await PermissionHelper.ensure(context, Permission.camera);
if (!cam) return;
final mic = await PermissionHelper.ensure(context, Permission.microphone);
if (!mic) return;
final loc = await PermissionHelper.ensure(context, Permission.location);
```

> static 메서드라 Provider 통한 주입 불필요. 영구 거부 다이얼로그를 끄고 싶으면 `showOpenSettingsPrompt: false`.

---

## 파생 레포 체크리스트

- [ ] iOS: `Info.plist` 에 `NSCameraUsageDescription` · `NSLocationWhenInUseUsageDescription` 등 필요 문구 추가
- [ ] Android: `AndroidManifest.xml` 에 `<uses-permission>` 선언
- [ ] 앱 정책: 왜 이 권한이 필요한지 사용자에게 먼저 설명 (pre-prompt 화면)
- [ ] 거부 시 UX 고려 — "나중에" 선택지 제공

---

## Code References

- [`lib/kits/permissions_kit/permissions_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/permissions_kit/permissions_kit.dart)
- [`lib/kits/permissions_kit/permission_helper.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/permissions_kit/permission_helper.dart)
