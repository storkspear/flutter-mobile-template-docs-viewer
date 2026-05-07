# Naming Conventions

파일 · 클래스 · 변수 · Provider · i18n 키 · JSON 필드명 모두 **일관된 명명 규칙** 을 적용해요. IDE 자동완성이 잘 동작하고, `grep` · `git log` 추적이 쉬워지려면 이 관용이 절대적이에요.

---

## 파일 명명

모든 Dart 파일은 `snake_case.dart`.

| 종류 | 규칙 | 예시 |
|------|------|------|
| 화면 | `{domain}_screen.dart` | `home_screen.dart` · `login_screen.dart` |
| ViewModel | `{domain}_view_model.dart` | `login_view_model.dart` |
| 서비스 | `{domain}_service.dart` | `auth_service.dart` |
| 모델 · DTO | `{name}.dart` | `current_user.dart` · `expense.dart` |
| 인터페이스 | `{기능}_service.dart` 또는 `{기능}_store.dart` | `analytics_service.dart` · `cache_store.dart` |
| 구현체 | `{구현방식}_{인터페이스}.dart` | `debug_analytics_service.dart` · `memory_cache_store.dart` |
| Provider 모음 | `providers.dart` | `common/providers.dart` · `features/<domain>/providers.dart` |
| 공통 위젯 | `app_{이름}.dart` 또는 `{역할}_view.dart` | `app_dialog.dart` · `loading_view.dart` |
| 유틸 | `{기능}.dart` | `form_validators.dart` · `debouncer.dart` |
| ARB (i18n) | `app_{locale}.arb` | `app_ko.arb` · `app_en.arb` |
| Kit 진입점 | `{kit_name}.dart` | `auth_kit.dart` · `backend_api_kit.dart` |
| Kit 매니페스트 | `kit_manifest.yaml` | 모든 Kit 폴더 |

---

## 클래스 명명

PascalCase. 역할을 이름에서 바로 파악 가능하게.

| 종류 | 규칙 | 예시 |
|------|------|------|
| 화면 (ConsumerWidget / StatelessWidget) | `{Domain}Screen` | `HomeScreen` · `LoginScreen` |
| ViewModel (StateNotifier) | `{Domain}ViewModel` | `LoginViewModel` |
| 상태 클래스 | `{Domain}State` | `LoginState` · `AuthState` |
| 서비스 (비즈니스 로직) | `{Domain}Service` | `AuthService` · `NotificationService` |
| 추상 인터페이스 | `{기능}Service` · `{기능}Store` | `AnalyticsService` · `CacheStore` |
| Debug 폴백 구현체 | `Debug{인터페이스}` | `DebugAnalyticsService` · `DebugCrashService` |
| 실제 구현체 | `{구현방식}{인터페이스}` | `SentryCrashService` · `PostHogAnalyticsService` |
| 모델 · DTO | `{Name}` (단순) | `CurrentUser` · `DeviceInfo` · `Expense` |
| 예외 | `{Domain}Exception` | `ApiException` |
| 상수 모음 | `{Domain}` | `AppIcons` · `AppSpacing` · `ErrorCode` |
| Kit 구현 | `{KitName}Kit` | `AuthKit` · `BackendApiKit` · `ObservabilityKit` |
| BootStep 구현 | `{Domain}Step` (kit 외부 노출 시 public, kit 내부 전용은 `_{Domain}Step` private 허용) | `AuthCheckStep` · `_PostHogInitStep` · `_ForceUpdateStep` |

---

## 변수 · Provider 명명

Dart 관용은 `lowerCamelCase`. Provider 는 접미사로 종류 표시.

| 종류 | 규칙 | 예시 |
|------|------|------|
| Riverpod Provider | `{name}Provider` | `authServiceProvider` · `apiClientProvider` |
| StateNotifierProvider | `{name}ViewModelProvider` | `loginViewModelProvider` |
| StreamProvider · FutureProvider | `{name}StreamProvider` · `{name}FutureProvider` | `authStreamProvider` |
| private 필드 | `_camelCase` | `_apiClient` · `_tokenStorage` |
| 지역 상수 | `camelCase` | `buttonHeight` · `maxRetries` |
| 전역 상수 | `camelCase` (Dart 관용, `UPPER_SNAKE_CASE` 아님) | `AppSpacing.md` · `ErrorCode.tokenExpired` |
| i18n 접근 변수 (지역) | `s` | `final s = S.of(context);` |
| BuildContext 파라미터 | `context` | `(context, state) => ...` |
| WidgetRef 파라미터 | `ref` | `(context, ref) => ref.watch(...)` |

---

## 디렉토리 구조

3계층 + features ([`ADR-002`](../philosophy/adr-002-layered-modules.md) 참조):

```
lib/
├── core/             # 모든 앱 필수 기반 (46 파일)
│   ├── analytics/    # AnalyticsService · CrashService 추상 + Debug
│   ├── cache/        # CacheStore · CachedRepository
│   ├── config/       # AppConfig
│   ├── i18n/         # ARB + gen_l10n 결과물
│   ├── kits/         # AppKit 계약 + AppKits 레지스트리
│   ├── review/       # 인앱 리뷰 트리거
│   ├── storage/      # SecureStorage · PrefsStorage · TokenStorage
│   ├── theme/        # AppPalette · 디자인 토큰
│   ├── utils/        # 순수 헬퍼
│   └── widgets/      # PrimaryButton · AppTextField 등 12개
│
├── kits/             # 선택 Kit 14개
│   └── {kit_name}/
│       ├── {kit_name}.dart       # AppKit 구현 + export
│       ├── kit_manifest.yaml     # 의존성 선언
│       ├── README.md             # Kit 자체 문서
│       └── ui/                   # (UI 있는 Kit)
│
├── common/           # 점진 이관 잔여
│   ├── providers.dart        # 전역 DI
│   ├── router/               # GoRouter + Kit redirect 합성
│   └── splash/               # BootStep 인터페이스 · SplashController
│
├── features/         # 파생 레포 도메인 영역 (템플릿은 스텁만)
│   ├── home/
│   └── settings/
│
├── app.dart          # MaterialApp 설정
└── main.dart         # 진입점 + AppKits.install
```

**의존 방향** (ADR-002):
- `features → common → kits → core`
- `core/` 는 Flutter SDK + 외부 패키지만 import
- `kits/` 간 의존: **type import** 는 `kit_manifest.requires` 선언 시 허용 (`ApiException` 같은 타입은 provider 접근 불가), **인스턴스 접근** 은 provider 경유. 미선언 cross-import 절대 금지. 상세 룰: [`conventions/kits.md` §3](./kits.md), [`ADR-003`](../philosophy/adr-003-featurekit-registry.md)
- `features/` 간 직접 import **최소화** — 라우터로 느슨한 연결

---

## i18n 키 명명

접두사로 용도 구분. 자세한 건 [`i18n.md`](./i18n.md).

| 종류 | 접두사 | 예시 |
|------|--------|------|
| 일반 UI 텍스트 | 없음 | `login` · `signUp` · `settings` |
| 검증 에러 | `validation` | `validationEmailRequired` · `validationPasswordTooShort` |
| 네트워크 · 앱 에러 | `error` | `errorTimeout` · `errorUnknown` · `errorTokenExpired` |
| 상대 시간 | `relativeTime` | `relativeTimeMinutes` · `relativeTimeDays` |
| 확인 · 취소 류 | 없음 | `confirm` · `cancel` · `retry` |
| 스낵바 · 토스트 | `toast` | `toastCopied` · `toastSaved` |

---

## JSON 필드명

백엔드 응답과 **완전 동일** 하게 camelCase 사용. 자세한 건 [`ADR-009 · 백엔드 계약`](../philosophy/adr-009-backend-contract.md).

```dart
factory Expense.fromJson(Map<String, dynamic> json) => Expense(
  id: json['id'] as int,
  categoryId: json['categoryId'] as int,         // camelCase
  expenseDate: DateTime.parse(json['expenseDate']),  // ISO 8601 UTC
  createdAt: DateTime.parse(json['createdAt']),
);
```

- **snake_case 금지** — 백엔드가 `expense_date` 로 주지 않음
- **날짜는 ISO 8601 UTC** — `DateTime.parse()` 로 파싱. 로컬 시간대 변환은 UI 에서.

---

## 파일 · 클래스 명명의 관용 예시

✅ **좋은 예**:
```
login_screen.dart       → class LoginScreen
login_view_model.dart   → class LoginViewModel + class LoginState
auth_service.dart       → class AuthService
api_client.dart         → class ApiClient
debug_crash_service.dart → class DebugCrashService implements CrashService
```

❌ **피할 예**:
```
LoginScreen.dart         → 파일명이 PascalCase (관용 위반)
login_vm.dart            → 축약 ViewModel → ViewModel 로 풀어쓰기
auth.dart                → 뭐에 대한 파일인지 불명확
AuthenticationService.dart → 클래스는 OK 지만 파일은 auth_service.dart
MyAuthService.dart       → 접두사 My 불필요
```

---

## 관련 문서

- [`viewmodel-mvvm.md`](./viewmodel-mvvm.md) — ViewModel 구조 상세
- [`i18n.md`](./i18n.md) — i18n 키 정의 워크플로우
- [`ADR-002`](../philosophy/adr-002-layered-modules.md) — 의존 방향 근거
