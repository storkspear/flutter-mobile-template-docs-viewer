# UpdateKit

강제 업데이트 감지 및 차단 화면을 제공하는 Kit입니다. 스플래시에서 업데이트 여부를 확인하고, 강제 업데이트가 필요하면 앱 전체를 `ForceUpdateDialog`로 덮어씌웁니다.

`redirectPriority: 1` — 모든 Kit 중 가장 먼저 실행됩니다. 강제 업데이트 상태에서는 인증/온보딩 흐름 진입 전에 차단됩니다.

---

## 동작 흐름

```
앱 시작 → 스플래시 → ForceUpdateStep.execute()
    ↓
AppUpdateService.check()
    ├── null 반환        → 업데이트 불필요, 정상 진행
    ├── isForce: false   → 선택적 업데이트 (현재 무시, 향후 배너 등 활용 가능)
    └── isForce: true    → forceUpdateInfoNotifier 방출
                              ↓
                          MaterialApp.builder 감지
                              ↓
                          ForceUpdateDialog (닫기 불가)
                          → 스토어 이동 버튼만 노출
```

업데이트 확인 자체가 실패(네트워크 오류, Remote Config 미응답 등)하면 **에러를 삼키고 정상 진행**합니다. 실패는 non-fatal로 Sentry에 리포트됩니다. 확인 실패가 앱 실행을 막지 않도록 설계되어 있습니다.

---

## 기본값 (템플릿)

`NoUpdateAppUpdateService` — 항상 `null`을 반환합니다. 업데이트 체크 없이 앱이 정상 실행됩니다.

```dart
await AppKits.install([
  UpdateKit(service: NoUpdateAppUpdateService()),  // 기본값, 체크 없음
]);
```

---

## 파생 레포에서 활성화

### 1. `AppUpdateService` 구현

Firebase Remote Config, 자체 API 등 어떤 방식으로도 구현할 수 있습니다.

**Firebase Remote Config 예시:**

```dart
class RemoteConfigUpdateService implements AppUpdateService {
  final FirebaseRemoteConfig _remoteConfig;

  RemoteConfigUpdateService(this._remoteConfig);

  @override
  Future<void> init() async {
    await _remoteConfig.setConfigSettings(RemoteConfigSettings(
      fetchTimeout: const Duration(seconds: 10),
      minimumFetchInterval: const Duration(hours: 1),
    ));
    await _remoteConfig.fetchAndActivate();
  }

  @override
  Future<UpdateInfo?> check() async {
    final minVersion = _remoteConfig.getString('min_version');
    final latestVersion = _remoteConfig.getString('latest_version');
    if (minVersion.isEmpty) return null;

    final currentVersion = (await PackageInfo.fromPlatform()).version;
    final isForce = _isOlderThan(currentVersion, minVersion);

    if (!isForce) return null;

    return UpdateInfo(
      isForce: true,
      minVersion: minVersion,
      latestVersion: latestVersion,
      message: _remoteConfig.getString('force_update_message'),
      iosStoreUrl: _remoteConfig.getString('ios_store_url'),
      androidStoreUrl: _remoteConfig.getString('android_store_url'),
    );
  }
}
```

**자체 API 예시:**

```dart
class ApiUpdateService implements AppUpdateService {
  final ApiClient _apiClient;

  @override
  Future<void> init() async {}

  @override
  Future<UpdateInfo?> check() async {
    final response = await _apiClient.get(
      '/version/check',
      fromData: UpdateInfo.fromJson,
    );
    return response.data;
  }
}
```

### 2. UpdateKit 설치

```dart
await AppKits.install([
  UpdateKit(service: RemoteConfigUpdateService(FirebaseRemoteConfig.instance)),
  // 또는
  UpdateKit(service: ApiUpdateService(apiClient)),
]);
```

---

## UpdateInfo 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `isForce` | `bool` | `true`이면 앱 사용 차단 |
| `minVersion` | `String` | 허용되는 최소 버전 (예: `"1.2.0"`) |
| `latestVersion` | `String` | 권장 최신 버전 |
| `message` | `String?` | 다이얼로그에 표시할 메시지 (없으면 기본 문구) |
| `iosStoreUrl` | `String?` | App Store 링크 |
| `androidStoreUrl` | `String?` | Play Store 링크 |

---

## ForceUpdateDialog

- `PopScope(canPop: false)` — 뒤로가기/제스처로 닫기 불가
- 플랫폼에 따라 `iosStoreUrl` 또는 `androidStoreUrl`로 이동합니다
- 스토어 URL이 null이면 버튼이 아무 동작도 하지 않습니다 → 반드시 URL 세팅이 필요합니다

---

## 제거

UpdateKit을 쓰지 않는 앱:

1. `app_kits.yaml`에서 `update_kit:` 주석 처리
2. `main.dart`의 `AppKits.install([...])`에서 `UpdateKit(...)` 제거
3. `flutter analyze` + `flutter test` 확인
