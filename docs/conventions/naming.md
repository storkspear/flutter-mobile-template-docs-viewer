# Naming Conventions

---

## 파일 네이밍

| 종류 | 규칙 | 예시 |
|------|------|------|
| Dart 파일 | `snake_case.dart` | `auth_service.dart`, `login_screen.dart` |
| 화면 | `{domain}_screen.dart` | `home_screen.dart`, `expense_list_screen.dart` |
| ViewModel | `{domain}_view_model.dart` | `login_view_model.dart` |
| 모델 | `{name}.dart` | `expense.dart`, `current_user.dart` |
| Provider 정의 | 모듈별 `providers.dart` 또는 공통 `common/providers.dart` | |
| 위젯 | `{역할}_view.dart` 또는 `app_{이름}.dart` | `loading_view.dart`, `app_dialog.dart` |
| 유틸 | `{기능}.dart` | `debouncer.dart`, `form_validators.dart` |
| ARB 파일 | `app_{locale}.arb` | `app_ko.arb`, `app_en.arb` |

---

## 클래스 네이밍

| 종류 | 규칙 | 예시 |
|------|------|------|
| 화면 (StatelessWidget/ConsumerWidget) | `{Domain}Screen` | `HomeScreen`, `LoginScreen` |
| ViewModel (StateNotifier) | `{Domain}ViewModel` | `LoginViewModel` |
| 상태 클래스 | `{Domain}State` | `LoginState`, `PaginationState` |
| 서비스 (비즈니스 로직) | `{Domain}Service` | `AuthService`, `NotificationService` |
| 인터페이스 | `{기능}Service` / `{기능}Store` | `AnalyticsService`, `CacheStore` |
| 구현체 | `{구현방식}{인터페이스}` | `DebugAnalyticsService`, `MemoryCacheStore` |
| 모델/DTO | `{Name}` (단순 이름) | `CurrentUser`, `DeviceInfo`, `Expense` |
| 예외 | `{Domain}Exception` | `ApiException` |
| 상수 모음 | `{Domain}` | `AppIcons`, `AppSpacing`, `ErrorCode` |

---

## 변수 네이밍

| 종류 | 규칙 | 예시 |
|------|------|------|
| Riverpod Provider | `{name}Provider` | `authServiceProvider`, `apiClientProvider` |
| StateNotifierProvider | `{name}ViewModelProvider` 또는 `{name}Provider` | `loginViewModelProvider` |
| private 필드 | `_camelCase` | `_apiClient`, `_tokenStorage` |
| 상수 | `camelCase` (Dart 컨벤션) | `buttonHeight`, `radiusMd` |
| i18n 접근 변수 | `s` | `final s = S.of(context);` |

---

## 디렉토리 구조

FeatureKit 아키텍처 이후 3층 구조:

```
lib/
├── core/             # 항상 사용하는 기반 (9개 모듈)
│   ├── {모듈명}/     # analytics, cache, config, i18n, kits, storage, theme, utils, widgets
│   └── kits/         # AppKit 계약, AppKits 컨테이너
│
├── kits/             # 선택형 FeatureKit (12개)
│   └── {kit_name}/   # 예: auth_kit, backend_api_kit, nav_shell_kit
│       ├── {kit_name}.dart   # AppKit 구현
│       └── kit_manifest.yaml # 의존성 선언
│
├── common/           # 점진 이관 중인 잔여 모듈
│   ├── providers.dart # 전역 DI 어댑터
│   ├── router/       # GoRouter + AppKits 합성
│   └── splash/       # SplashController + BootStep
│
├── features/         # 도메인 코드 (앱별)
│   └── {domain}/
│       ├── {domain}_screen.dart
│       ├── {domain}_view_model.dart
│       └── models/
│
├── app.dart          # MaterialApp 설정
└── main.dart         # 진입점 + AppKits.install
```

### 규칙

- **core는 kits/features를 모른다** (단방향)
- **kits는 features를 모른다** (단방향)
- **kits끼리는 `requires` 선언으로만 의존** (예: auth_kit → backend_api_kit)
- **features → core/kits** 자유롭게 import
- **features 간 직접 import 최소화** (라우터를 통한 느슨한 연결)
- **common은 리팩터 잔여물** — 점진적으로 core/kits로 이관 중. 현재 `common/router/app_router.dart`는 기본 features(home/settings) 참조를 허용(템플릿이 기본 제공하는 스텁이므로). 파생 레포 생성 후 해당 import를 대체/제거 가능.

---

## i18n 문자열 키 네이밍

| 종류 | 접두사 | 예시 |
|------|--------|------|
| 일반 UI 텍스트 | 없음 | `login`, `signUp`, `settings` |
| 검증 에러 | `validation` | `validationEmailRequired`, `validationPasswordTooShort` |
| 네트워크 에러 | `error` | `errorTimeout`, `errorUnknown` |
| 상대 시간 | `relativeTime` | `relativeTimeMinutes`, `relativeTimeDays` |
| 확인/취소 | 없음 | `confirm`, `cancel`, `retry` |

---

## JSON 필드명

백엔드와 동일하게 **camelCase**를 사용합니다.

```dart
factory Expense.fromJson(Map<String, dynamic> json) => Expense(
  id: json['id'],
  categoryId: json['categoryId'],     // camelCase
  expenseDate: json['expenseDate'],   // camelCase
);
```

날짜는 **ISO 8601 UTC** (`DateTime.parse()`)로 파싱합니다.
