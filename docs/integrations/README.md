# 통합 가이드

파생 레포에서 프로덕션 서비스로 스텁을 교체하거나, 템플릿 기본 내장 kit을 활성화할 때 참고하십시오.

| 대상 | 템플릿 기본 | 가이드 |
|------|-----------|-------------|
| 크래시 리포팅 | **observability_kit** 내장 (Sentry) — DSN 미주입 시 `DebugCrashService` | [`sentry.md`](./sentry.md) |
| 사용자 행동 분석 | **observability_kit** 내장 (PostHog) — Key 미주입 시 `DebugAnalyticsService` | [`posthog.md`](./posthog.md) 또는 [`analytics.md`](./analytics.md) |
| 푸시 알림 | `DebugNotificationService` | [`fcm.md`](./fcm.md) |
| **Android 배포** | Fastlane + GHA release workflow 내장 | [`deployment-android.md`](./deployment-android.md) |
| **보안 정책** | R8, SSL 핀닝 opt-in, cleartext 차단 등 | [`security.md`](./security.md) |

## 공통 원칙

- **observability_kit처럼 내장된 kit**은 파생 레포에서 DSN/Key만 `--dart-define`으로 주입하면 자동으로 동작합니다. 구현체를 직접 작성할 필요가 없습니다.
- **kit 미내장 영역**(FCM 등)은 파생 레포에서 인터페이스 구현체를 만들고 Provider를 교체합니다:
  - `lib/common/providers.dart`의 Provider 값을 교체
  - 인터페이스 시그니처는 변경 금지 (다른 앱과 호환 유지)
- **비밀키/DSN은 이 템플릿 레포에 커밋 금지.** 파생 레포의 `.env` (gitignore됨) 또는 CI Secrets로 주입합니다.
- 신규 의존성은 신중히 — pubspec.yaml은 모든 파생 레포에 영향을 줍니다. **가능하면 kit으로 격리합니다.**

## 옵트아웃

내장 kit 중 불필요한 것은 제거할 수 있습니다:
1. `app_kits.yaml`에서 해당 kit 줄 제거
2. `lib/main.dart`의 `AppKits.install([...])`에서 해당 Kit 인스턴스 제거
3. (선택) `pubspec.yaml`에서 관련 dep 제거 — 바이너리 사이즈 감소
