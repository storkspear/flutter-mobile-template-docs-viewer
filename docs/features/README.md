# FeatureKit 가이드

14 개의 **FeatureKit** 이 `lib/kits/` 에 있어요. 각 Kit 은 **독립 플러그인** 으로, `app_kits.yaml` + `lib/main.dart` 에서 활성화를 선택해요. 이 문서는 전체 목록 · 의존 관계 · 활성화 방법의 한눈 인덱스예요.

> **왜 선택 조립?** → [`ADR-003 · FeatureKit 동적 레지스트리`](../philosophy/adr-003-featurekit-registry.md)

---

## Kit 목록 (14개)

| Kit | 목적 | 의존 | 바이너리 크기 영향 |
|-----|------|------|----------------|
| [`backend_api_kit`](./backend-api-kit.md) | Dio HTTP 클라이언트 + 3 인터셉터 | 없음 | +1MB |
| [`auth_kit`](./auth-kit.md) | JWT + 소셜 로그인 (Google · Apple) | `backend_api_kit` | +3MB |
| [`payment_kit`](./payment-kit.md) | 결제 (Stripe 통합 골격, 의도적 SDK 미주입) | `backend_api_kit` | +0MB (template), derived 시 +SDK |
| [`observability_kit`](./observability-kit.md) | Sentry 크래시 + PostHog 분석 | 없음 | +4MB |
| [`notifications_kit`](./notifications-kit.md) | 로컬 알림 · 푸시 · 타임존 | 없음 | +2MB |
| [`local_db_kit`](./local-db-kit.md) | Drift (SQLite ORM) + 마이그레이션 | 없음 | +3MB |
| [`update_kit`](./update-kit.md) | 강제 업데이트 감지 · Dialog | 없음 | +0.5MB |
| [`onboarding_kit`](./onboarding-kit.md) | 다단계 위자드 + 완료 플래그 | 없음 | +0.2MB |
| [`nav_shell_kit`](./nav-shell-kit.md) | 하단 탭 셸 + 중앙 FAB | 없음 | +0.3MB |
| [`charts_kit`](./charts-kit.md) | fl_chart 래핑 (라인 · 도넛 · 파이) | 없음 | +1MB |
| [`ads_kit`](./ads-kit.md) | AdMob 배너 + UMP 동의 + ATT | 없음 | +5MB |
| [`background_kit`](./background-kit.md) | workmanager 주기 · 1회성 태스크 | 없음 | +1MB |
| [`permissions_kit`](./permissions-kit.md) | 런타임 권한 요청 + 설정 유도 | 없음 | +0.5MB |
| [`device_info_kit`](./device-info-kit.md) | 앱 버전 + 기기 정보 | 없음 | +0.3MB |

**크기 영향** 은 대략 추정. 실제는 플랫폼 · 빌드 설정에 따라 다름.

> ⚠️ **Tree-shaking 은 Dart 코드만 제거해요**. 미활성 Kit 의 Dart 코드는 빌드에서 빠지지만, **네이티브 플러그인(.aar / CocoaPods)은 `pubspec.yaml` 에 선언되어 있는 한 APK/IPA 에 항상 포함**돼요. 사이즈를 진짜 줄이려면 비활성 Kit 의 패키지를 `pubspec.yaml` 에서도 제거하세요. (예시: 31MB APK 측정 중 `sqlite3_flutter_libs`/`sentry-android-ndk` 등이 ABI 별로 ~5MB 차지)

---

## Core 모듈 목록 (10개)

`lib/core/` 의 항상 포함되는 기반 모듈이에요. Kit 활성화와 무관하게 모든 앱이 사용해요.

| 모듈 | 역할 | 주요 진입점 |
|------|------|------------|
| `analytics` | 크래시·이벤트 인터페이스 (Debug 폴백 포함) | `CrashService`, `AnalyticsService` |
| `cache` | 메모리 + SharedPrefs 2단 캐시 + stale-while-revalidate | `CachedRepository` |
| `config` | 앱 슬러그·baseUrl·환경 등 런타임 설정 | `AppConfig` |
| `i18n` | gen_l10n + ARB (ko / en) | `AppLocalizations` |
| `kits` | AppKit 계약 + 부트 단계 + 의존성 검증 | `AppKit`, `BootStep`, `AppKits` |
| `review` | In-app 리뷰 트리거 (signal 5회 + 60일 쿨다운 + 연 3회) | `ReviewTrigger` |
| `storage` | Secure / Prefs / Token 3종 저장소 | `TokenStorage`, `PrefsStorage` |
| `theme` | 디자인 토큰 (Palette·Typeface Registry) | `AppPalette`, `AppTypeface` |
| `utils` | 폼 검증·디바운스·날짜 유틸 | `FormValidators`, `Debouncer` |
| `widgets` | 공통 위젯 (버튼·시트·스켈레톤·약관 동의) | `TermsAgreementText` 등 |

---

## 의존 관계

```
backend_api_kit (독립)
  ↑   ↑
auth_kit  payment_kit

observability_kit (독립)
notifications_kit (독립)
local_db_kit (독립)
update_kit (독립)
onboarding_kit (독립)
nav_shell_kit (독립)
charts_kit (독립)
ads_kit (독립)
background_kit (독립)
permissions_kit (독립)
device_info_kit (독립)
```

**규칙**:
- `auth_kit` 와 `payment_kit` 가 `backend_api_kit` 에 의존 (`requires: [BackendApiKit]`)
- 나머지 12개는 독립 — 자유롭게 on/off
- Kit 간 직접 import 금지 ([`ADR-002`](../philosophy/adr-002-layered-modules.md)) — Provider 경유만

의존성 위반 시 `configure_app.dart --audit` 가 CI 에서 차단:
```
✗ auth_kit requires backend_api_kit, which is not enabled
```

---

## 활성화 방법

### 1. `app_kits.yaml` 에 선언

```yaml
# app_kits.yaml
kits:
  backend_api_kit: {}
  auth_kit: {}
  observability_kit: {}
```

### 2. `lib/main.dart` 의 install 리스트 동기화

```dart
// lib/main.dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  ObservabilityKit(),
]);
```

### 3. 검증

```bash
dart run tool/configure_app.dart
```

자세한 건 [`ADR-004 · YAML ↔ Dart 수동 동기화`](../philosophy/adr-004-manual-sync-ci-audit.md) 참조.

---

## 앱 유형별 권장 조합

[`ADR-021 · Multi-Recipe 구성`](../philosophy/adr-021-multi-recipe.md) 의 4개 샘플:

### Local-only Tracker (`recipes/local-only-tracker.yaml`)

완전 로컬 · 서버 · 로그인 없음.

```yaml
kits:
  local_db_kit: {...}
  onboarding_kit: {}
  nav_shell_kit: {}
  charts_kit: {}
```

**적합**: 습관 트래커 · 가계부 (로컬) · 학습 기록

### Local Notifier (`recipes/local-notifier-app.yaml`)

로컬 알림 중심. 광고 포함.

```yaml
kits:
  local_db_kit: {...}
  notifications_kit: {}
  background_kit: {}
  charts_kit: {}
  update_kit: {}
  ads_kit: {}
  permissions_kit: {}
  device_info_kit: {}
  nav_shell_kit: {}
```

**적합**: 알람 · 명상 타이머 · 습관 알림

### Backend Auth (`recipes/backend-auth-app.yaml`)

백엔드 연동 + JWT 인증.

```yaml
kits:
  backend_api_kit: {}
  auth_kit: {}
  notifications_kit: {}
  device_info_kit: {}
  update_kit: {}
```

**적합**: SNS · 협업 도구 · 대시보드

### Social Auth (`recipes/social-auth-app.yaml`)

백엔드 연동 + 소셜 로그인 (Google · Apple · Kakao · Naver) 풀세트.

```yaml
kits:
  backend_api_kit: {}
  auth_kit:
    providers: [email, google, apple, kakao, naver]
  observability_kit: {}
  notifications_kit: {}
  update_kit: {}
  device_info_kit: {}
```

**적합**: 한국 시장 SNS · 커뮤니티 · 콘텐츠 앱

---

## Kit 문서 구조 (공통 템플릿)

각 Kit 문서는 다음 섹션을 담아요.

1. **개요** — Kit 이 하는 일 한 문단
2. **활성화** — `app_kits.yaml` + `main.dart` 설정
3. **제공 기능** — Service · Provider · 화면 · BootStep
4. **핵심 API** — 자주 쓰는 메서드 · 시그니처
5. **일반 사용 예** — ViewModel / Screen 에서 호출
6. **파생 레포 체크리스트** — 활성화 시 필요한 외부 설정 (DSN · 키 등)
7. **Code References** — 실제 소스 링크

---

## 새 Kit 추가 (파생 레포에서)

파생 레포에서 도메인 특화 Kit 추가 시:

1. `lib/kits/<kit_name>/` 폴더 생성
2. `kit_manifest.yaml` — `requires` · `dependencies` 선언
3. `<kit_name>.dart` — `AppKit` 구현
4. `README.md` — 표준 양식 (이 문서 §Kit 문서 구조 참고)
5. `app_kits.yaml` · `lib/main.dart` 활성화
6. 테스트 추가 (`test/kits/<kit_name>/`)

표준 템플릿은 기존 Kit 하나 (예: `update_kit`) 복사 추천.

---

## 관련 문서

- [`ADR-003 · FeatureKit 동적 레지스트리`](../philosophy/adr-003-featurekit-registry.md) — AppKit 계약
- [`ADR-004 · YAML ↔ Dart 동기화`](../philosophy/adr-004-manual-sync-ci-audit.md) — `configure_app.dart`
- [`ADR-021 · Multi-Recipe`](../philosophy/adr-021-multi-recipe.md) — 4개 샘플 조합
- [`FeatureKit Contract`](../architecture/featurekit-contract.md) — AppKit 인터페이스 전체 명세
