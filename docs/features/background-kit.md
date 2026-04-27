# background_kit

**`workmanager` 기반 주기 · 1회성 백그라운드 태스크**. 앱 종료 후에도 실행 가능.

---

## 개요

- **주기 태스크**: 15분 간격 (iOS 최소) · Android 제한 없음
- **1회성 태스크**: 지연 실행 (예: 10분 후)
- **제약 조건**: 네트워크 연결 · 충전 중 · Wi-Fi 만 등
- **플랫폼 차이**: iOS 는 background fetch API, Android 는 WorkManager

---

## 활성화

```yaml
# app_kits.yaml
kits:
  background_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  BackgroundKit(),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `BackgroundKit` | `AppKit` 구현. workmanager 초기화 BootStep |
| `BackgroundTaskScheduler` | 태스크 등록 · 취소 API |
| `WorkmanagerTaskScheduler` | 실제 구현체 |

---

## 사용 예

```dart
// 매일 오전 9시 동기화
await ref.read(backgroundTaskSchedulerProvider).schedulePeriodic(
  taskName: 'daily_sync',
  frequency: Duration(days: 1),
  initialDelay: _untilNext9am(),
  callback: _syncCallback,
  constraints: BackgroundConstraints(requiresWifi: true),
);

// 취소
await ref.read(backgroundTaskSchedulerProvider).cancel('daily_sync');
```

### 콜백 (top-level 함수 필수)

```dart
// lib/background_tasks.dart (top-level)
@pragma('vm:entry-point')
void _syncCallback() {
  Workmanager().executeTask((task, inputData) async {
    // 작업 수행
    return Future.value(true);
  });
}
```

---

## 파생 레포 체크리스트

- [ ] iOS: `ios/Runner/Info.plist` 의 `UIBackgroundModes` 에 `fetch` · `processing` 추가
- [ ] iOS: `UIBackgroundTaskIdentifier` 등록 (Info.plist · AppDelegate)
- [ ] Android: `AndroidManifest.xml` 의 permission 확인 (대부분 workmanager 자동)
- [ ] `@pragma('vm:entry-point')` 어노테이션 (Dart AOT 최적화 방지)

---

## Code References

- [`lib/kits/background_kit/background_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/background_kit/background_kit.dart)
- [`lib/kits/background_kit/background_task_scheduler.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/background_kit/background_task_scheduler.dart)
