# 통합 가이드 (Integrations)

외부 서비스 (Sentry · PostHog · FCM · AdMob · Play Store 등) 연동 가이드 모음이에요. 파생 레포 셋업 시 README 체크리스트 §5~§12 가 이 폴더 문서를 참조해요.

> **이 폴더의 책임**: "외부 서비스 콘솔에서 키 발급 → 앱에 주입 → 동작 확인" 까지의 운영 절차.
> Kit 자체 사용법은 `docs/features/{kit_name}.md` 또는 `lib/kits/{kit_name}/README.md` 참조.

---

## 가이드 목록

| 가이드 | 다루는 외부 서비스 | 관련 Kit |
|---|---|---|
| [`sentry.md`](./sentry.md) | Sentry — 크래시 / 에러 추적 | `observability_kit` |
| [`posthog.md`](./posthog.md) | PostHog — 사용자 행동 분석 | `observability_kit` |
| [`fcm.md`](./fcm.md) | Firebase Cloud Messaging — 푸시 알림 | `notifications_kit` + `backend_api_kit` |
| [`google-apple-auth.md`](./google-apple-auth.md) | Google Cloud + Apple Developer — 소셜 로그인 키 발급 | `auth_kit` |
| [`kakao-naver-auth.md`](./kakao-naver-auth.md) | Kakao + Naver Developers — 한국 시장 소셜 로그인 | `auth_kit` |
| [`analytics.md`](./analytics.md) | 분석 도구 선택 비교 | `observability_kit` |
| [`deployment-android.md`](./deployment-android.md) | Google Play Console + GHA 배포 파이프라인 | (인프라) |
| [`security.md`](./security.md) | R8 / SSL pinning / 토큰 관리 보안 정책 요약 | `backend_api_kit` |

---

## 인접 문서

- 빌드/CI 파이프라인 전체 — [`docs/infra/ci-cd.md`](../infra/ci-cd.md)
- Android 출시 상세 — [`docs/infra/android-deployment.md`](../infra/android-deployment.md)
- iOS 출시 상세 — [`docs/infra/ios-deployment.md`](../infra/ios-deployment.md)
- Secrets 관리 — [`docs/infra/secrets-management.md`](../infra/secrets-management.md)

`docs/integrations/` 는 외부 서비스 콘솔 화면부터 시작하는 가이드, `docs/infra/` 는 빌드/배포 파이프라인 자체의 문서예요. 겹치는 영역(예: GHA Secrets) 은 cross-link 로 처리.
