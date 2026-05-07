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
import 'package:workmanager/workmanager.dart';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    // task별 분기 처리
    return Future.value(true);
  });
}

await AppKits.install([
  BackgroundKit(
    scheduler: WorkmanagerTaskScheduler(),
    callbackDispatcher: callbackDispatcher,
  ),
]);
```

> `callbackDispatcher` 는 **top-level 함수** + `@pragma('vm:entry-point')` 필수 (Dart AOT 가 트리쉐이킹하지 않도록).

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
// 주기 태스크 등록 (15분 이상)
await ref.read(backgroundTaskSchedulerProvider).registerPeriodic(
  uniqueName: 'daily_sync',
  taskName: 'sync',          // callbackDispatcher 내부에서 분기 키
  frequency: const Duration(days: 1),
  payload: {'type': 'full'}, // 선택: 콜백에 inputData 로 전달
);

// 1회성 태스크 등록 (지연 가능)
await ref.read(backgroundTaskSchedulerProvider).registerOneOff(
  uniqueName: 'send_log',
  taskName: 'log_upload',
  initialDelay: const Duration(minutes: 5),
);

// 특정 태스크 취소
await ref.read(backgroundTaskSchedulerProvider).cancel('daily_sync');

// 모두 취소
await ref.read(backgroundTaskSchedulerProvider).cancelAll();
```

> 추가 제약 (네트워크 / 충전 / Wi-Fi 등) 은 `WorkmanagerTaskScheduler` 가 workmanager 의 옵션을 직접 노출하지 않아요. 필요 시 파생 레포에서 `Scheduler` 인터페이스 자체 구현체로 확장.

---

## 파생 레포 체크리스트

- [ ] iOS: `ios/Runner/Info.plist` 의 `UIBackgroundModes` 에 `fetch` · `processing` 추가
- [ ] iOS: `UIBackgroundTaskIdentifier` 등록 (Info.plist · AppDelegate)
- [ ] Android: `AndroidManifest.xml` 의 permission 확인 (대부분 workmanager 자동)
- [ ] `@pragma('vm:entry-point')` 어노테이션 (Dart AOT 최적화 방지)

---

## Code References

- [`lib/kits/background_kit/background_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/background_kit/background_kit.dart) — AppKit 구현
- [`lib/kits/background_kit/background_task_scheduler.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/background_kit/background_task_scheduler.dart) — 인터페이스 + `InMemoryBackgroundTaskScheduler` (테스트)
- [`lib/kits/background_kit/workmanager_task_scheduler.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/background_kit/workmanager_task_scheduler.dart) — 실제 workmanager 구현
