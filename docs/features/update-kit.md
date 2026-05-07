# update_kit

**강제 업데이트 감지 + ForceUpdateDialog**. Firebase Remote Config · 자체 API 와 연계 가능. `redirectPriority: 1` (최우선).

---

## 개요

- **라우팅 게이트**: 업데이트 필요 시 `/force-update` 강제 이동
- **서비스 교체 가능**: 기본 `NoUpdateAppUpdateService` (항상 false). 실제 로직은 파생 레포에서
- **Dialog**: 사용자에게 "스토어로 이동" 버튼 제공
- **`url_launcher`**: 스토어 URL 오픈

---

## 활성화

```yaml
# app_kits.yaml
kits:
  update_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  UpdateKit(service: NoUpdateAppUpdateService()),  // ← 기본
  // 또는: UpdateKit(service: RemoteConfigUpdateService()),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `UpdateKit` | `AppKit` 구현. `redirectPriority: 1` |
| `AppUpdateService` | 추상. `init()` · `check()` → `UpdateInfo?` (null 이면 업데이트 불필요) |
| `UpdateInfo` | `isForce` · `minVersion` · `latestVersion` · `message?` · `iosStoreUrl?` · `androidStoreUrl?` |
| `NoUpdateAppUpdateService` | 기본 구현. `check()` 가 항상 null (업데이트 없음) |
| `ForceUpdateDialog` | `/force-update` 화면 UI |

---

## 파생 레포에서 실제 구현

### Firebase Remote Config 연계 예

```dart
class RemoteConfigUpdateService implements AppUpdateService {
  @override
  Future<void> init() async {
    await FirebaseRemoteConfig.instance.fetchAndActivate();
  }

  @override
  Future<UpdateInfo?> check() async {
    final remoteConfig = FirebaseRemoteConfig.instance;
    final minVersion = remoteConfig.getString('min_app_version');
    final latestVersion = remoteConfig.getString('latest_app_version');
    final currentVersion = AppConfig.instance.appVersion;
    if (!_isOlderThan(currentVersion, minVersion)) return null;
    return UpdateInfo(
      isForce: true,
      minVersion: minVersion,
      latestVersion: latestVersion,
      iosStoreUrl: 'https://apps.apple.com/app/id1234567890',
      androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    );
  }
}
```

### 자체 API 기반

```dart
class BackendUpdateService implements AppUpdateService {
  final ApiClient _api;
  BackendUpdateService(this._api);

  @override
  Future<void> init() async {}

  @override
  Future<UpdateInfo?> check() async {
    final res = await _api.get<MinVersion>('/config/min-version', fromData: MinVersion.fromJson);
    final info = res.data!;
    if (!_isOlderThan(AppConfig.instance.appVersion, info.minVersion)) return null;
    return UpdateInfo(
      isForce: info.isForce,
      minVersion: info.minVersion,
      latestVersion: info.latestVersion,
      message: info.message,
      iosStoreUrl: info.iosStoreUrl,
      androidStoreUrl: info.androidStoreUrl,
    );
  }
}
```

---

## 파생 레포 체크리스트

- [ ] 스토어 URL 확인 (App Store · Play Store 각각)
- [ ] 버전 비교 로직 구현 (semver 비교)
- [ ] (선택) Firebase Remote Config 설정 or 자체 API 엔드포인트
- [ ] `main.dart` 의 `UpdateKit(service: ...)` 를 실제 구현체로 교체
- [ ] 테스트: `check()` 가 `UpdateInfo(isForce: true, ...)` 반환 시 `/force-update` 리다이렉트 확인

---

## Code References

- [`lib/kits/update_kit/update_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/update_kit/update_kit.dart)
- [`lib/kits/update_kit/app_update_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/update_kit/app_update_service.dart)
- [`lib/kits/update_kit/force_update_dialog.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/update_kit/force_update_dialog.dart)

---

## 관련 문서

- [`ADR-018 · 라우팅 우선순위`](../philosophy/adr-018-redirect-priority.md)
- [`ADR-006 · Debug 폴백`](../philosophy/adr-006-debug-fallback.md)
