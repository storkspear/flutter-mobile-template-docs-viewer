# Module Dependencies

`lib/` 하위 모듈 간 **의존 방향 · 규칙 · 검증 메커니즘**. 근거는 [`ADR-002 · 3계층 모듈 구조`](../philosophy/adr-002-layered-modules.md) 참조.

---

## 의존 다이어그램

```
                          ┌────────┐
                          │ main.  │
                          │ dart   │
                          └───┬────┘
                              │
              ┌───────────────▼───────────────┐
              │          app.dart              │
              └───────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  ┌─────▼─────┐       ┌──────▼──────┐       ┌──────▼──────┐
  │ features/ │       │  common/    │       │  kits/      │
  │           │──────▶│             │──────▶│             │
  │ (도메인)   │       │ providers · │       │ (선택 기능)  │
  │           │       │ router ·    │       │             │
  │           │       │ splash      │       │             │
  └─────┬─────┘       └──────┬──────┘       └──────┬──────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                       ┌──────▼──────┐
                       │   core/     │
                       │             │
                       │ theme · DI  │
                       │ storage ·   │
                       │ widgets ·   │
                       │ i18n 등     │
                       └─────────────┘
```

**단방향**: `features → common → kits → core`

---

## 레이어별 역할

### `core/` — 모든 앱 필수 기반 (46 파일)

| 모듈 | 역할 |
|------|------|
| `analytics/` | AnalyticsService · CrashService 추상 + Debug ([`ADR-006`](../philosophy/adr-006-debug-fallback.md)) |
| `cache/` | CacheStore · CachedRepository ([`ADR-014`](../philosophy/adr-014-cached-repository.md)) |
| `config/` | AppConfig 싱글톤 |
| `i18n/` | gen_l10n 결과물 ([`ADR-016`](../philosophy/adr-016-i18n-from-start.md)) |
| `kits/` | AppKit 계약 · AppKits 레지스트리 ([`ADR-003`](../philosophy/adr-003-featurekit-registry.md)) |
| `review/` | 인앱 리뷰 트리거 |
| `storage/` | SecureStorage · PrefsStorage · TokenStorage ([`ADR-013`](../philosophy/adr-013-token-atomic-storage.md)) |
| `theme/` | AppPalette · 디자인 토큰 ([`ADR-015`](../philosophy/adr-015-palette-registry.md)) |
| `utils/` | FormValidators · Debouncer 등 순수 헬퍼 |
| `widgets/` | PrimaryButton · LoadingView · SkeletonLoading 등 12개 |

### `kits/` — 선택 14개 ([`Features 인덱스`](../features/README.md))

```
auth_kit, backend_api_kit, observability_kit, notifications_kit,
local_db_kit, update_kit, onboarding_kit, nav_shell_kit,
charts_kit, ads_kit, background_kit, permissions_kit, device_info_kit,
payment_kit
```

### `common/` — 여러 Kit 조립 지점

| 파일 | 역할 |
|------|------|
| `providers.dart` | 전역 DI — 여러 Kit 의 Provider 를 한 곳 ([`ADR-005`](../philosophy/adr-005-riverpod-mvvm.md), [`ADR-007`](../philosophy/adr-007-late-binding.md)) |
| `router/app_router.dart` | GoRouter 조립 + Kit redirect 합성 ([`ADR-018`](../philosophy/adr-018-redirect-priority.md)) |
| `splash/boot_step.dart` | BootStep 인터페이스 ([`ADR-008`](../philosophy/adr-008-boot-step.md)) |
| `splash/splash_controller.dart` | 부팅 단계 순차 실행 |

### `features/` — 파생 레포 도메인 영역

템플릿은 **스텁만** — `home/` + `settings/`. 파생 레포가 채움.

---

## 의존 규칙 (금지 · 허용)

### 금지

- ❌ `core/` → `kits/` 또는 `features/` import
- ❌ `kits/<A>` → `kits/<B>` 직접 import (Provider 경유만)
- ❌ `features/<A>` → `features/<B>` 직접 import (라우터 경유 권장)

### 허용

- ✅ `features/` → `common/` · `kits/` · `core/`
- ✅ `common/` → `kits/` · `core/`
- ✅ `kits/` → `core/`
- ✅ `kits/<A>` → `kits/<B>` 의 **Provider 참조** (ref.watch/read) — import 아님
- ✅ `kits/<A>` → `kits/<B>` 의 **`requires: [B]`** 선언 ([`ADR-003`](../philosophy/adr-003-featurekit-registry.md))

---

## 의존성 검증

### 런타임

`AppKits.install([...])` 시 `requires` 자동 검증. 누락 시 `StateError`:

```
✗ auth_kit requires backend_api_kit, which is not enabled
```

### CI

```bash
dart run tool/configure_app.dart --audit
```

불일치 시 exit 1 ([`ADR-004`](../philosophy/adr-004-manual-sync-ci-audit.md)).

### 정적 분석

`flutter analyze` 가 순환 import · unused import 감지. 현재는 **Kit 간 import 금지 linter 룰 없음** — 사람이 리뷰로 확인.

---

## tree-shaking

미활성 Kit 의 코드는 **최종 바이너리에서 제거**. 전제:

- `main.dart` 의 `AppKits.install([...])` 에 해당 Kit 인스턴스가 **없어야 함**
- `app_kits.yaml` 의 해당 항목이 **주석 처리** 돼야 함
- 다른 코드에서 해당 Kit 의 클래스 · Provider 를 **import 하지 말아야 함**

이 덕분에 로컬 전용 앱은 Sentry SDK · sign_in_with_apple 등 수 MB 제거.

---

## 관련 문서

- [`ADR-002 · 3계층 모듈 구조`](../philosophy/adr-002-layered-modules.md)
- [`ADR-003 · FeatureKit 동적 레지스트리`](../philosophy/adr-003-featurekit-registry.md)
- [`featurekit-contract.md`](./featurekit-contract.md) — AppKit 인터페이스 전체 명세
- [`boot-sequence.md`](./boot-sequence.md) — 앱 시작 시 순서도
