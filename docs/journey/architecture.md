# Architecture — 한눈 요약

파생 레포 개발자가 **10분 안에 전체 구조** 를 파악할 수 있게 쓴 개요. 깊이 들어가려면 [Architecture](../architecture/) · [ADR](../philosophy/README.md) 참조.

---

## 큰 그림

이 템플릿은 **FeatureKit 아키텍처** 기반이에요. 앱의 기능들이 독립 Kit 으로 쪼개져 있고, 앱 유형에 맞는 Kit 만 조립해서 쓰는 구조.

```
┌─────────────────────────────────────────────────────┐
│  main.dart + app.dart                                │
│  (엔트리포인트 · MaterialApp)                          │
└─────────────────────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────▼────┐         ┌────▼────┐         ┌────▼────┐
│features/│         │ common/ │         │  kits/  │
│         │────────▶│         │────────▶│         │
│ 도메인    │         │ DI · 라우터 │      │ 13개 기능 │
│ (파생)    │         │ · 스플래시 │       │ (선택 조립)│
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     └───────────────────┼───────────────────┘
                         │
                   ┌─────▼─────┐
                   │   core/   │
                   │           │
                   │ theme · DI │
                   │ · 저장소 ·  │
                   │ 위젯 · i18n │
                   └───────────┘
```

**단방향 의존**: `features → common → kits → core`. 역방향 금지.

---

## 4 계층 역할

### `core/` (항상 사용)

모든 앱이 **무조건** 쓰는 기반. 44개 파일, 10개 모듈.

| 모듈 | 핵심 자산 |
|------|----------|
| `theme/` | AppPalette · 디자인 토큰 |
| `storage/` | SecureStorage · SharedPreferences · TokenStorage |
| `cache/` | CacheStore · CachedRepository (5 정책) |
| `widgets/` | PrimaryButton · AppTextField · LoadingView 등 13개 |
| `i18n/` | gen_l10n 결과 (S 클래스) |
| `analytics/` | AnalyticsService · CrashService 추상 + Debug |
| `config/` | AppConfig 싱글톤 |
| `kits/` | AppKit 계약 + AppKits 레지스트리 |
| `utils/` | FormValidators · Debouncer |
| `review/` | 인앱 리뷰 트리거 |

### `kits/` (선택 13개)

앱마다 켜고 끄는 기능 단위. [Features 인덱스](../features/README.md) 상세.

- **인프라**: `backend_api_kit`, `observability_kit`, `local_db_kit`, `notifications_kit`, `background_kit`, `update_kit`, `permissions_kit`, `device_info_kit`
- **UI · UX**: `nav_shell_kit`, `onboarding_kit`, `charts_kit`, `ads_kit`
- **도메인**: `auth_kit` (JWT · 소셜 로그인)

### `common/` (조립 지점)

| 파일 | 역할 |
|------|------|
| `providers.dart` | 전역 Riverpod Provider 정의 (Kit 들 연결) |
| `router/app_router.dart` | GoRouter + Kit redirect 합성 |
| `splash/splash_controller.dart` | BootStep 순차 실행 |
| `splash/boot_step.dart` | 부팅 단계 인터페이스 |

### `features/` (파생 레포 영역)

```
lib/features/
├── home/             # 템플릿은 스텁 (홈 화면 뼈대)
└── settings/         # 템플릿은 스텁 (프로필 · 로그아웃 샘플)
```

파생 레포가 여기에 **자기 도메인** 화면 추가:
```
lib/features/
├── home/
├── settings/
├── expense/          # ← 예: 가계부 앱
│   ├── list/
│   ├── detail/
│   └── models/
└── category/
```

---

## 상태 관리 흐름

**Riverpod + MVVM** — Screen 은 UI, ViewModel 은 로직.

```
사용자 클릭
  ↓
Screen.onPressed
  ↓
ref.read(viewModelProvider.notifier).someAction()
  ↓
ViewModel (StateNotifier) 가 Service 호출
  ↓
ref.read(serviceProvider).call()
  ↓
Service 가 Repository · ApiClient 사용
  ↓
응답 / 에러
  ↓
ViewModel: state = state.copyWith(...)
  ↓
Screen: ref.watch 가 state 변화 감지 → 리빌드
```

자세한 건 [ViewModel + MVVM](../conventions/viewmodel-mvvm.md).

---

## 네트워크 흐름 (backend_api_kit 활성 시)

```
ViewModel 이 ApiClient.get('/users/me') 호출
  ↓
AuthInterceptor: Authorization 헤더 자동 첨부
  ↓
실제 HTTP 요청
  ↓
응답 수신
  ↓
ErrorInterceptor: DioException → ApiException 변환
  ↓
AuthInterceptor: 401 이면 refresh 시도 + 재시도
  ↓
LoggingInterceptor: debug 빌드에 콘솔 출력
  ↓
ViewModel: try/catch 로 수신
```

근거:
- [ADR-009 · 백엔드 계약](../philosophy/adr-009-backend-contract.md)
- [ADR-010 · 401 refresh](../philosophy/adr-010-queued-interceptor.md)
- [ADR-011 · 인터셉터 체인](../philosophy/adr-011-interceptor-chain.md)

---

## 부팅 시퀀스

```
main()
  ├─ Sentry 래핑 (DSN 주입 시)
  ├─ Flutter 바인딩 초기화
  ├─ AppPaletteRegistry 설치
  ├─ AppConfig 초기화
  ├─ PrefsStorage 초기화
  ├─ AppKits.install([...])  ← Kit 등록 + onInit
  ├─ ProviderContainer 생성
  ├─ AppKits.attachContainer(container)
  ├─ SplashController.run()  ← 모든 Kit 의 BootStep 순차 실행
  └─ runApp(UncontrolledProviderScope)
```

자세한 건 [Boot Sequence](../architecture/boot-sequence.md).

---

## 조립 규약

### `app_kits.yaml`

```yaml
kits:
  backend_api_kit: {}
  auth_kit: {}
  observability_kit: {}
```

### `lib/main.dart`

```dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  ObservabilityKit(),
]);
```

### 검증

```bash
dart run tool/configure_app.dart
```

이 3단계 동기화가 전체 템플릿의 핵심 관용이에요. 근거: [ADR-003](../philosophy/adr-003-featurekit-registry.md) · [ADR-004](../philosophy/adr-004-manual-sync-ci-audit.md).

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Flutter 3.32.8+ · Dart 3.8.1+ |
| 상태관리 | flutter_riverpod 2.6+ (StateNotifier) |
| 라우팅 | go_router 14.8+ |
| HTTP | dio 5.7+ |
| 로컬 DB | drift 2.23+ (SQLite) |
| 로컬 저장 | shared_preferences · flutter_secure_storage |
| 알림 | flutter_local_notifications · (선택) firebase_messaging |
| 관측성 | sentry_flutter · posthog_flutter |
| i18n | flutter_localizations · intl (gen_l10n) |
| 차트 | fl_chart |
| 광고 | google_mobile_ads (선택) |
| 백엔드 연동 | [`spring-backend-template`](https://github.com/storkspear/spring-backend-template) 짝 |

최소 지원:
- **Android**: API 23 (6.0) +
- **iOS**: 14.0 +

---

## 다음으로 읽을 것

- 더 깊은 모듈 구조: [Module Dependencies](../architecture/module-dependencies.md)
- AppKit 계약 상세: [FeatureKit Contract](../architecture/featurekit-contract.md)
- Kit 개별 문서: [Features 인덱스](../features/README.md)
- 설계 결정 배경: [Philosophy 인덱스](../philosophy/README.md)
- 코딩 규약: [Conventions Overview](../conventions/README.md)

---

## 📖 책 목차 — Journey 1단계

[Overview](./README.md) 의 **1단계** 후반부.

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | [Philosophy 인덱스](../philosophy/README.md) | 철학 · 설계 결정 배경 |
| → 다음 | [Onboarding](./onboarding.md) | 파생 레포 최초 셋업 (2단계) |
