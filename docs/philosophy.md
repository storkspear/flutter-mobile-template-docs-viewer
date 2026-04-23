# Repository Philosophy

이 문서는 `flutter-mobile-template`이 왜 현재의 구조를 가지게 되었는지 설명합니다.

각 결정은 추상적인 이론이 아니라 **솔로 인디 개발자가 여러 앱을 빠른 주기로 출시할 때 마주치는 구체적인 고통**에 대한 답변으로 만들어졌습니다.

---

## 맥락: 앱 공장 전략

이 레포지토리는 **`spring-backend-template`의 프론트엔드 짝**입니다. 백엔드가 모든 앱의 공통 인프라(인증, 유저, 푸시, 결제)를 담당하고, 이 Flutter 템플릿은 모든 앱의 공통 모바일 코드(네트워크, 인증 UI, 테마, 캐시)를 담당합니다.

**목표**: 새 앱 아이디어가 떠오르면 10분 안에 scaffold → 도메인 코드만 작성 → 출시.

---

## 결정 1. GitHub Template Repository 패턴

### 결정

이 레포는 **직접 개발되지 않는 공통 뼈대 템플릿**입니다. 실제 앱 개발은 `Use this template`으로 만든 파생 레포에서 진행합니다.

### 이유

**각 앱의 도메인/디자인은 고유합니다.** 가계부 앱의 화면을 포트폴리오 앱에 재사용할 수 없습니다. 한 레포에 여러 앱을 섞으면 배포 충돌이 생기고, 스토어 계정/심사 일정도 앱마다 다릅니다.

**템플릿이 순수해야** 어느 도메인으로든 시작할 수 있습니다. 특정 앱 이름, Firebase 프로젝트 ID, API URL 등이 템플릿에 박히면 파생 레포 생성 시 삭제 작업이 필요해지고, 삭제를 잊으면 사고가 됩니다.

### 공통 코드 전파

템플릿 개선 → 기존 파생 레포 전파는 **수동 cherry-pick**입니다. 자동 전파 없음. 각 앱이 자기 속도로 이행합니다.

```bash
git remote add template https://github.com/storkspear/flutter-mobile-template.git
git fetch template
git cherry-pick <commit-hash>
```

---

## 결정 2. Riverpod + MVVM

### 결정

상태관리는 **Riverpod**, 아키텍처 패턴은 **MVVM (StateNotifier + ConsumerWidget)**을 사용합니다.

### 이유

**이유 A. Provider 패턴과 DI가 하나로 해결됩니다.** Riverpod의 `Provider`가 서비스 로케이터 역할을 겸합니다. 별도 DI 프레임워크(GetIt 등)가 필요 없습니다.

**이유 B. `ref.watch`로 상태 변경 → UI 자동 반영.** 수동 `setState`, `notifyListeners` 호출 없이 반응형 UI가 만들어집니다. dispose 관리도 Riverpod이 자동 처리합니다.

**이유 C. 테스트에서 의존성 오버라이드가 간단합니다.** `ProviderScope(overrides: [...])`로 mock 주입이 한 줄입니다.

**이유 D. 솔로 개발자에게 보일러플레이트가 가장 적습니다.** BLoC은 Event/State 분리가 강력하지만 파일 수가 3배입니다. 인디 앱 규모에서는 과도합니다.

### 대안 검토

| 패턴 | 장점 | 탈락 이유 |
|------|------|-----------|
| BLoC | 이벤트/상태 명확, 대규모 강함 | 파일 3배, 솔로에겐 과도한 보일러플레이트 |
| Provider + ChangeNotifier | 단순, 학습 쉬움 | 대규모 앱에서 `notifyListeners` 남발 → 성능 |
| GetX | 매우 간결 | 테스트 어려움, 글로벌 상태 오염, 커뮤니티 우려 |

### MVVM 적용 규칙

```
features/{domain}/
├── {domain}_screen.dart       # ConsumerWidget — UI만 담당
├── {domain}_view_model.dart   # StateNotifier — 로직만 담당
└── models/                    # 도메인 모델 (fromJson/toJson)
```

- Screen에 비즈니스 로직을 직접 작성하지 않는다
- ViewModel에 UI 코드(BuildContext, Widget)를 넣지 않는다
- ViewModel은 `autoDispose`로 화면 이탈 시 자동 정리

---

## 결정 3. 인터페이스 기반 공통 모듈

### 결정

analytics, crash, notifications, cache 모듈은 **추상 인터페이스 + Debug 기본 구현**으로 제공합니다. 파생 레포 생성 후 실제 서비스(Sentry, PostHog, FCM 등)로 `Provider.overrideWithValue`합니다.

### 이유

**앱마다 선택하는 서비스가 다를 수 있습니다.** 한 앱은 Sentry, 다른 앱은 Firebase Crashlytics를 쓸 수 있습니다. 템플릿이 특정 서비스에 하드 의존하면 파생 레포 생성 시 교체 비용이 큽니다.

**Debug 구현이 있으므로 개발 초기부터 코드가 동작합니다.** 실제 서비스 연동은 배포 전에 하면 됩니다. 인터페이스 타입이 잡혀있으니 연동 시 시그니처 변경 없이 구현체만 교체합니다.

### 적용 대상

| 모듈 | 인터페이스 | Debug 구현 | 파생 레포 생성 후 교체 예시 |
|------|-----------|------------|------------------|
| analytics | `AnalyticsService` | `DebugAnalyticsService` | PostHog, Amplitude |
| crash | `CrashService` | `DebugCrashService` | Sentry, Crashlytics |
| notifications | `NotificationService` | `DebugNotificationService` | FCM |
| cache | `CacheStore` | `MemoryCacheStore` | Drift, sqflite |

---

## 결정 4. 팔레트 추상화

### 결정

색상 체계는 `AppPalette` 추상 클래스로 정의합니다. 파생 레포 생성 후 `seed` 색상만 오버라이드하면 앱 전체 색감이 바뀝니다.

### 이유

**디자인 시스템이 아니라 코드 인프라를 공통화합니다.** 각 앱의 시각적 정체성(컬러, 타이포)은 달라야 하지만, 컬러를 관리하는 구조(시맨틱 토큰 → ColorScheme → ThemeData)는 동일합니다.

Material 3의 `ColorScheme.fromSeed()`가 하나의 시드 색상으로 전체 팔레트를 생성해주므로, 파생 레포 생성 후 바꿀 값은 딱 1개입니다.

---

## 결정 5. 백엔드 API 계약 1:1 대응

### 결정

Flutter의 네트워크 레이어는 백엔드의 응답 규격(`{data, error}`, `PageResponse`, `SearchRequest`, `ErrorCode`)을 1:1로 미러링합니다.

### 이유

**프론트와 백엔드가 같은 사람이 만듭니다.** 두 템플릿 사이의 계약이 일치하면 연동 시 "이 필드 이름이 뭐였지?" 같은 삽질이 없습니다.

- `ApiResponse<T>` ↔ 백엔드 `ApiResponse<T>`
- `PageResponse<T>` ↔ 백엔드 `PageListResponse<T>`
- `SearchRequestBuilder` ↔ 백엔드 `QueryDslPredicateBuilder`
- `ErrorCode` ↔ 백엔드 `ErrorCode` enum

### 검색 API 조건 연산자

백엔드와 동일한 `field_operator` 규칙을 사용합니다:

| 연산자 | 의미 | 예시 |
|--------|------|------|
| `field_eq` | 일치 | `categoryId_eq: 5` |
| `field_gte` / `field_lte` | 이상/이하 | `amount_gte: 10000` |
| `field_like` | 부분 매칭 | `title_like: '커피'` |
| `field_in` | 목록 포함 | `status_in: ['active', 'pending']` |

---

## 결정 6. i18n은 처음부터

### 결정

한국어 단독 앱이라도 문자열을 코드에서 분리합니다. Flutter의 `gen_l10n` + ARB 파일을 사용합니다.

### 이유

**나중에 하면 비용이 10배입니다.** 50개 화면에 흩어진 한국어 리터럴을 ARB로 옮기는 작업은 고통입니다. 처음부터 `S.of(context).xxx`로 작성하면 추가 비용이 0입니다.

**영어 시장을 열 수 있습니다.** 한국어 앱이 잘 되면 영어 버전을 내고 싶어집니다. i18n이 이미 잡혀있으면 `app_en.arb` 번역만 하면 됩니다.

### 비-위젯 코드에서의 i18n

ViewModel, Service 같은 context 없는 코드에서는 **에러 코드를 반환**하고, 화면에서 `S.of(context)`로 번역합니다. 이렇게 하면 비즈니스 로직이 UI 프레임워크에 의존하지 않습니다.

---

## 결정 7. 앱별 독립 유저 (Per-App Independent Users)

### 결정

각 앱은 독립된 유저 체계를 가집니다. JWT의 `appSlug` 클레임(단일 문자열)이 URL의 `{appSlug}`와 일치해야 API 접근이 가능합니다.

### 이유

**실제 유저 관점에서 별개의 서비스입니다.** sumtally 유저가 richandyoung에 같은 이메일로 가입하면, 그건 "같은 계정으로 로그인"이 아니라 "다른 앱에 새로 가입"입니다. 통합 계정은 유저에게 혼란을 주고, 앱 간 데이터 격리를 어렵게 만듭니다.

Flutter 측에서는 `AppConfig.appSlug`가 모든 API 호출에 자동으로 포함됩니다. 앱 하나가 다른 앱의 데이터에 접근할 수 없습니다.

---

## 결정 8. 차트는 선택 가능한 Kit

### 결정

차트는 `charts_kit`으로 **선택형 FeatureKit**에 포함합니다. `app_kits.yaml`에서 활성화/비활성화할 수 있습니다.

### 이유

**모든 앱이 차트를 쓰지 않습니다.** 가계부 앱은 차트가 핵심이지만, 포트폴리오 앱에는 불필요합니다. 그래서 **기본 포함이 아니라 선택형**입니다.

`charts_kit`는 `fl_chart` 기반 공통 차트 위젯(`AppLineChart`, `AppPieChart`, `DonutGauge`)을 제공합니다. 필요 없는 앱은 `app_kits.yaml`에서 주석 처리하고 `main.dart`의 `AppKits.install`에서도 제거하면 됩니다.

특수한 차트 요구가 있다면 kit 내부 위젯을 참고하거나 `fl_chart`를 직접 사용할 수 있습니다.

---

## 요약: 설계 기준

| 기준 | 설명 |
|------|------|
| **운영 가능성** | 솔로가 감당 가능한가? |
| **시작 비용** | 새 앱을 10분 안에 scaffold 할 수 있는가? |
| **확장 포인트** | 파생 레포 생성 후 도메인 코드만 추가하면 되는가? |
| **계약 일치** | 백엔드 템플릿과 1:1 대응하는가? |
| **자동화** | 사람이 기억해야 하는 규약은 기계로 강제하는가? |
