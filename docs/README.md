# flutter-mobile-template 문서

이 문서들은 `flutter-mobile-template`을 기반으로 파생 레포를 만들고 운영하는 개발자를 위한 가이드입니다.

---

## 이 템플릿이 하는 일

솔로 인디 개발자가 여러 앱을 빠른 주기로 출시할 때, 매번 반복되는 인프라 코드(네트워크, 인증, 테마, 캐시, 관측성, 배포 파이프라인)를 미리 만들어 둔 뼈대입니다.

새 앱 아이디어가 생기면 이 레포를 **Use this template**으로 복사한 파생 레포에서 도메인 코드만 추가하면 됩니다. 포크(fork)가 아니라 히스토리를 분리한 별도 레포가 생성됩니다.

---

## 문서 읽는 순서

처음 이 템플릿을 받았다면 아래 순서를 권장합니다.

1. **Philosophy** (`integrations/philosophy.md`) — 왜 이런 구조인지 설계 배경을 이해합니다
2. **Architecture** (`conventions/architecture.md`) — 레이어 구조(core/kits/features)와 MVVM 패턴을 파악합니다
3. **Kits** (`conventions/kits.md`) — FeatureKit 조립 방법과 AppKit 계약을 확인합니다
4. **짐로그 튜토리얼** (`tutorials/build-gymlog.md`) — 실제 앱 생성 과정을 전체 흐름으로 따라갑니다

그 다음에는 필요한 영역만 골라서 읽으면 됩니다.

---

## 문서 구성

### 통합 가이드

파생 레포에서 실제 서비스를 연결할 때 참고합니다.

| 문서 | 내용 |
|------|------|
| `integrations/philosophy.md` | 설계 철학 — 앱 공장 전략, 각 결정의 이유 |
| `integrations/update-kit.md` | 강제 업데이트 감지 · ForceUpdateDialog · AppUpdateService |
| `integrations/sentry.md` | 크래시 리포팅 설정 (DSN 주입, Spike Protection, 심볼 업로드) |
| `integrations/posthog.md` | 사용자 행동 분석 (API Key 주입, 자동 화면 추적) |
| `integrations/analytics.md` | AnalyticsService 커스텀 구현 가이드 |
| `integrations/fcm.md` | 푸시 알림 설정 (FCM, 디바이스 등록) |
| `integrations/deployment-android.md` | Fastlane + GitHub Actions Android 배포 |
| `integrations/security.md` | 보안 정책 요약 (난독화, SSL 핀닝, SecureStorage) |

### 컨벤션

코드를 작성할 때 지켜야 할 규약입니다.

| 문서 | 내용 |
|------|------|
| `conventions/architecture.md` | MVVM 패턴, 모듈 의존 방향, 인증/캐시/에러 전략 |
| `conventions/kits.md` | Kit 작성법, AppKit 계약, app_kits.yaml 동기화 |
| `conventions/api-contract.md` | API 응답 규격, ApiException, SearchRequestBuilder |
| `conventions/error-handling.md` | 인터셉터 흐름, 401 자동 갱신, ViewModel 에러 처리 |
| `conventions/loading.md` | 로딩 UX 패턴 (skeleton, pull-to-refresh, 버튼 스피너) |
| `conventions/naming.md` | 파일/클래스/변수/Provider 네이밍 규칙 |
| `conventions/testing.md` | 테스트 전략, AppKits.resetForTest, Provider override, 헬퍼 |

### 튜토리얼

| 문서 | 내용 |
|------|------|
| `tutorials/build-gymlog.md` | 처음부터 앱 완성까지 12단계 walkthrough |
| `tutorials/dogfood-2026-04-19-gymlog.md` | 짐로그 도그푸딩 실전 기록 — 발견된 함정과 개선 사항 |

---

## 빠른 시작

```bash
# 1. Use this template → 새 레포 생성 후 클론
git clone git@github.com:<org>/<your-app>.git && cd <your-app>

# 2. 앱 이름/번들 ID 변경
./scripts/rename-app.sh <slug> com.<org>.<slug>

# 3. 의존성 설치 + 구성 검증
flutter pub get
dart run tool/configure_app.dart

# 4. 실행
flutter run
```

상세 절차는 `tutorials/build-gymlog.md`를 참고하세요.
