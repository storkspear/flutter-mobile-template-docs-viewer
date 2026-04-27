# Repository Philosophy — 책 안내

이 문서는 `template-flutter` 이 **왜 현재의 구조를 가지게 되었는지** 설명하는 **ADR (Architecture Decision Record) 카드** 모음이에요.

각 결정은 추상적인 이론이 아니라 **솔로 인디 개발자가 여러 앱을 빠른 주기로 출시할 때 마주치는 구체적인 고통** 에 대한 답변으로 만들어졌어요. 이 문서를 읽고 나면 "왜 굳이 이렇게 복잡하게 만들었지?" 하는 의문이 풀리기를 바랍니다.

---

## 프롤로그 — 배경 및 철학

### 맥락: 앱 공장 전략

이 레포지토리는 **"한 사람이 여러 앱을 고 cadence 로 찍어내는"** 작업 방식을 전제로 해요. 짝이 되는 [`template-spring`](https://github.com/storkspear/template-spring) 과 함께 쓰이며, 같은 개발자가 프론트와 백엔드를 동시에 운영하는 구조예요.

이 한 문장이 단순해 보이지만, 실제로 펼쳐 보면 다음 세 가지 제약이 자동으로 따라붙어요.

#### 제약 1 — 운영 가능성이 최우선

한 사람이 10개 앱을 동시에 운영한다고 상상해봅시다. 앱 1개당 **운영 부담이 조금만 커져도** 전체가 무너져요. 예를 들어 앱마다:

- 독립된 Firebase 프로젝트 = 10개 콘솔 관리
- 독립된 Sentry 프로젝트 = 10개 대시보드
- 독립된 AdMob 계정 = 10개 지불 정산
- 독립된 Play Store / App Store Connect = 20개 스토어 리스팅

여기에 각 앱의 **크래시 대응 · 리뷰 대응 · 업데이트 주기** 까지 더하면 솔로로는 감당 불가능한 수준이 돼요. 그래서 이 프로젝트는 "기술적으로 멋있는가" 보다 **"솔로가 감당 가능한가"** 가 설계 기준이에요. 멋있지만 복잡한 구조는 기각, 단순하지만 안정적인 구조는 채택.

#### 제약 2 — 시간이 가장 희소한 자원

돈은 **0에 가깝게 만들 수 있어요** — Firebase Free tier, Sentry 개발자 플랜, PostHog 무료, GitHub Actions 무료 분 조합이면 월 고정 비용이 한 자릿수 달러. 하지만 개발자 1명의 시간은 **복제 불가능한 자원** 이에요.

이 비대칭성이 설계에 직접 반영돼요.

- 매번 재구현되는 공통 작업 (인증, 테마, 네트워크, 캐시, i18n, 관측성) 은 **반드시 한 번만 잘 만들고 재사용**
- 새 앱 생성은 **스크립트 한 줄** (`./scripts/rename-app.sh <slug> com.<org>.<slug>`) — 수동 셋업 금지
- 문서 작성에 들어가는 시간도 비용이므로, 코드 자체가 읽기 쉽게 (**"코드가 문서"** 원칙)

시간을 아끼는 모든 설계 결정이 여기서 출발해요.

#### 제약 3 — 복권 사기 모델

인디 앱 하나가 **성공할 확률은 낮아요**. 경험적으로 80%는 시장 반응이 없고, 15%는 그럭저럭 굴러가며, 5%만 의미 있는 트래픽을 얻어요. 하지만 **새 앱 출시 비용이 0에 가까우면** 많이 시도할 수 있어요.

복권 사기로 비유하면: 당첨 확률은 낮아도 **한 장의 가격이 100원** 이면 1만 장을 살 수 있어요. 반대로 한 장이 10만원이면 3장도 못 사요. 이 프로젝트의 존재 이유는 **새 앱 출시 비용을 극단적으로 낮추는 것** — 앱 하나 만드는 데 며칠이 아니라 몇 시간 수준으로 압축하는 게 목표예요.

### 이 세 제약이 모든 ADR 의 공통 전제

이 세 제약을 내재화하고 나면, 뒤따르는 ADR 들의 **"왜 이 선택이 되었는가"** 가 자연스럽게 이해돼요. 거꾸로 이 제약을 모른 채 ADR 만 읽으면 "왜 굳이 이렇게 복잡하게?" 하는 의문이 끝없이 생겨요.

예를 들어:

- ADR-001 이 "Use this template + cherry-pick" 을 선택한 이유는 제약 2 (공통 코드 재사용) 때문
- ADR-003 이 "FeatureKit 동적 레지스트리" 를 선택한 이유는 제약 3 (앱마다 필요 기능이 다름 → 선택 조립)
- ADR-019 가 "관리형 서비스 선호" 를 선택한 이유는 제약 1 + 제약 2 의 결합

**모든 결정이 이 세 제약의 세 가지 조합에서 나와요.** 프롤로그를 먼저 읽어두면 이후 ADR 독해 속도가 2배 빨라질 거예요.

---

## 이 문서의 사용법

이 문서는 **ADR 카드** 로 구성되어 있으며, 각 카드는 하나의 설계 결정을 다뤄요. 전체를 순서대로 읽는 것이 가장 좋지만, 독자의 상황과 목적에 따라 진입점이 달라질 수 있어요.

### 독자별 추천 경로

**처음 이 레포를 만난 분**  
위 프롤로그 → 테마 1 의 ADR 부터 순서대로 읽기. 테마 1 만 읽어도 "이 레포가 어떻게 생긴 건지" 대부분 이해돼요.

**Flutter 경력이 있고 설계 결정만 빠르게 훑고 싶은 분**  
각 ADR 의 **Status + 결론부터 + 이 선택이 가져온 것** 섹션만 읽으세요. 세 섹션을 합치면 "뭐를 결정했고, 그 결과가 어떤가" 가 5분에 파악돼요.

**"왜 이렇게 만들었는지" 가 궁금한 분**  
각 ADR 의 **왜 이런 고민이 시작됐나? + 고민했던 대안들 + 교훈** 을 읽으세요. 결정의 **배경과 시행착오** 가 담겨 있어요.

**특정 문제에 부딪혀서 해결책 찾는 분**  
아래 "어떤 질문에 어떤 ADR?" 매핑 표로 바로 점프하세요.

### 어떤 질문에 어떤 ADR?

| 이 질문이 궁금하다면 | 이 ADR 을 읽으세요 |
|---|---|
| "파생 레포끼리 공통 코드를 어떻게 동기화하지?" | [`ADR-001: GitHub Template + cherry-pick`](./adr-001-template-cherry-pick.md) |
| "`core/`, `kits/`, `common/`, `features/` 는 어떻게 다른가?" | [`ADR-002: 3계층 모듈 구조`](./adr-002-layered-modules.md) |
| "Kit 은 왜 런타임에 조립되는가?" | [`ADR-003: FeatureKit 동적 레지스트리`](./adr-003-featurekit-registry.md) |
| "왜 `app_kits.yaml` 과 `main.dart` 두 곳에 kit 선언?" | [`ADR-004: 수동 동기화 + CI 검증`](./adr-004-manual-sync-ci-audit.md) |
| "상태 관리는 왜 Riverpod + MVVM?" | [`ADR-005: Riverpod + StateNotifier`](./adr-005-riverpod-mvvm.md) |
| "왜 서비스는 인터페이스 + Debug 구현체 패턴?" | [`ADR-006: 인터페이스 기반 서비스 교체`](./adr-006-debug-fallback.md) |
| "ApiClient ↔ AuthService 순환 의존을 어떻게?" | [`ADR-007: Late Binding`](./adr-007-late-binding.md) |
| "스플래시 중 뭘 하는가?" | [`ADR-008: 부팅 단계 추상화`](./adr-008-boot-step.md) |
| "백엔드 응답 스키마가 왜 이렇게?" | [`ADR-009: 1:1 계약 (template-spring 과)`](./adr-009-backend-contract.md) |
| "401 받으면 자동으로 refresh 되는 원리는?" | [`ADR-010: QueuedInterceptor`](./adr-010-queued-interceptor.md) |
| "인터셉터가 3개인 이유는?" | [`ADR-011: 인터셉터 체인 (Auth / Error / Logging)`](./adr-011-interceptor-chain.md) |
| "앱마다 유저 테이블이 따로인가?" | [`ADR-012: 앱별 독립 유저 + JWT appSlug`](./adr-012-per-app-user.md) |
| "토큰은 어디에 저장?" | [`ADR-013: SecureStorage + 원자적 저장`](./adr-013-token-atomic-storage.md) |
| "캐시 정책은 어떻게 선택?" | [`ADR-014: 정책 기반 캐싱`](./adr-014-cached-repository.md) |
| "테마 색상을 런타임에 바꿀 수 있나?" | [`ADR-015: Palette 레지스트리`](./adr-015-palette-registry.md) |
| "i18n 은 언제부터 해야 하나?" | [`ADR-016: 처음부터 (ARB + gen_l10n)`](./adr-016-i18n-from-start.md) |
| "로딩 UI 는 어떻게 통일하나?" | [`ADR-017: 4가지 로딩 UX 패턴`](./adr-017-loading-ux.md) |
| "라우팅 게이트 우선순위는?" | [`ADR-018: Kit 별 redirectPriority`](./adr-018-redirect-priority.md) |
| "결정 내릴 때 어떤 기준으로 판단?" | [`ADR-019: 솔로 친화적 운영`](./adr-019-solo-friendly.md) |
| "보안은 뭐부터 지켜야 하나?" | [`ADR-020: 이중 난독화 + SSL 핀닝 + Keychain`](./adr-020-security-hardening.md) |
| "같은 템플릿으로 여러 유형의 앱을 만들 수 있나?" | [`ADR-021: Multi-Recipe 구성`](./adr-021-multi-recipe.md) |
| "정적 분석 룰셋은 어디까지 엄격하게?" | [`ADR-022: very_good_analysis + 큐레이션`](./adr-022-very-good-analysis.md) |

### ADR 카드의 읽는 법

각 카드는 다음 섹션으로 구성돼 있어요.

- **Status** — 현재 유효한지, 언제 정해졌는지
- **결론부터** — 30초 안에 핵심 잡기
- **왜 이런 고민이 시작됐나?** — 이 결정이 답해야 했던 물음
- **고민했던 대안들** — 검토된 대안과 탈락 이유
- **결정** — 실제 채택된 안과 구현
- **이 선택이 가져온 것** — 긍정 / 부정 결과 모두 정직하게
- **교훈** — 사후에 드러난 교훈 (있을 때만)
- **관련 사례 (Prior Art)** — 업계의 유사 접근
- **Code References** — 실제 구현 파일 링크

각 섹션은 독립적으로 읽을 수 있도록 쓰여 있어요.

---

## 전체 ADR 목록 (테마별)

### 테마 1 — 레포지토리 구조의 기반

**이 테마가 답하는 물음**: "솔로 개발자가 여러 Flutter 앱을 감당 가능한 레포지토리 구조는 어떤 모양인가?"

```
ADR-001 (GitHub Template + cherry-pick)
  "파생 레포는 본인 도메인, 공통은 템플릿 원본. 수동 전파가 오히려 안전"
   │
   │ 레포 안 구조는?
   ▼
ADR-002 (3계층 모듈 구조)
  "core / kits / common / features — 책임별 분리"
   │
   │ 선택적 기능은 어떻게 조립?
   ▼
ADR-003 (FeatureKit 동적 레지스트리)
  "AppKit 계약 + app_kits.yaml 로 런타임 조립"
   │
   │ 위 3가지를 실제로 지키려면?
   ▼
ADR-004 (YAML ↔ Dart 수동 동기화 + CI 검증)
  "configure_app.dart --audit 로 CI 에서 실수 차단"
```

- [`ADR-001 · GitHub Template Repository 패턴 + cherry-pick 전파`](./adr-001-template-cherry-pick.md)
- [`ADR-002 · 3계층 모듈 구조 (core / kits / common / features)`](./adr-002-layered-modules.md)
- [`ADR-003 · FeatureKit 동적 레지스트리 (AppKit 계약)`](./adr-003-featurekit-registry.md)
- [`ADR-004 · app_kits.yaml ↔ main.dart 수동 동기화 + CI 검증`](./adr-004-manual-sync-ci-audit.md)

### 테마 2 — 상태 관리 & 아키텍처

**이 테마가 답하는 물음**: "솔로 개발자가 감당 가능한 상태 관리와 DI 구조는 무엇인가?"

- [`ADR-005 · Riverpod + MVVM (StateNotifier + ConsumerWidget)`](./adr-005-riverpod-mvvm.md)
- [`ADR-006 · 인터페이스 기반 서비스 교체 + Debug 폴백`](./adr-006-debug-fallback.md)
- [`ADR-007 · Late Binding 으로 순환 의존 해결`](./adr-007-late-binding.md)
- [`ADR-008 · 부팅 단계 추상화 (BootStep + SplashController)`](./adr-008-boot-step.md)

### 테마 3 — 네트워크 & 백엔드 계약

**이 테마가 답하는 물음**: "template-spring 과 어떻게 쌍을 이루며, HTTP 계층은 어떻게 추상화하는가?"

- [`ADR-009 · 백엔드 응답 1:1 계약 ({data, error} + PageResponse)`](./adr-009-backend-contract.md)
- [`ADR-010 · QueuedInterceptor 로 401 자동 갱신`](./adr-010-queued-interceptor.md)
- [`ADR-011 · 3층 인터셉터 체인 (Auth / Error / Logging)`](./adr-011-interceptor-chain.md)
- [`ADR-012 · 앱별 독립 유저 + JWT appSlug 클레임`](./adr-012-per-app-user.md)

### 테마 4 — 데이터 & 저장소

**이 테마가 답하는 물음**: "민감도가 다른 데이터를 어디에 어떻게 저장하는가?"

- [`ADR-013 · 토큰 저장 원자성 + SecureStorage vs SharedPreferences`](./adr-013-token-atomic-storage.md)
- [`ADR-014 · 정책 기반 캐싱 (CachedRepository)`](./adr-014-cached-repository.md)

### 테마 5 — UI & UX

**이 테마가 답하는 물음**: "앱마다 다른 브랜딩과 UX 를 어떻게 변주 가능하게 만드는가?"

- [`ADR-015 · 팔레트 런타임 교체 (AppPalette + Registry)`](./adr-015-palette-registry.md)
- [`ADR-016 · i18n 처음부터 (ARB + gen_l10n)`](./adr-016-i18n-from-start.md)
- [`ADR-017 · 4가지 로딩 UX 패턴`](./adr-017-loading-ux.md)
- [`ADR-018 · Kit 별 라우팅 우선순위 (redirectPriority)`](./adr-018-redirect-priority.md)

### 테마 6 — 운영 & 배포

**이 테마가 답하는 물음**: "개발 · 배포 · 보안을 솔로 한 사람이 굴리는 원칙은?"

- [`ADR-019 · 솔로 친화적 운영 (Debug 폴백 · 관리형 서비스 선호)`](./adr-019-solo-friendly.md)
- [`ADR-020 · 이중 난독화 + SSL 핀닝 + Keychain 정책`](./adr-020-security-hardening.md)
- [`ADR-021 · Multi-Recipe 구성 (local-only / local-notifier / backend-auth)`](./adr-021-multi-recipe.md)
- [`ADR-022 · very_good_analysis 도입 + 컨텍스트 기반 큐레이션`](./adr-022-very-good-analysis.md)

---

## 템플릿 유지 규칙 (절대 금지)

이 템플릿 레포에 커밋할 때 **반드시** 지켜요. 파생 레포에는 적용되지 않아요 — 거기에선 오히려 도메인 로직을 적극적으로 씁니다.

- **특정 앱 / 도메인 / 팀 / 회사 이름** 을 코드나 문서에 박지 않아요. 템플릿이 중립적이어야 어느 도메인으로든 가지를 뻗을 수 있어요.
- **특정 인프라 자격증명, Bundle ID, 프로젝트 ID** 를 커밋하지 않아요. Firebase project-ref, Google Client ID, Sentry DSN 등은 파생 레포의 `.env` 에서만 존재해야 해요.
- **실제 비즈니스 로직** 을 이 레포에 쓰지 않아요 — 그건 파생 레포의 역할이에요. 여기에는 뼈대, Kit 계약, 공통 인프라만 둬요.
- **구체적인 스펙 문서** (특정 앱이 언급되는 요구사항 / API 문서 등) 를 여기 두지 않아요.
- **운영 환경 변수 파일** (`.env`, `.env.prod`) 을 커밋하지 않아요. 운영용 값은 GHA Repository Secrets 만 사용해요.

이유의 배경은 ADR-001 참조.

---

## 관련 문서

- [`Architecture 한눈 요약`](../journey/architecture.md) — 실제 구조의 상세 레퍼런스
- [`FeatureKit Contract`](../architecture/featurekit-contract.md) — AppKit 인터페이스 전체 명세
- [Conventions](../conventions/) — 코딩 규약
- [`STYLE_GUIDE`](../STYLE_GUIDE.md) — 문서 작성 스타일 가이드

---

## 📖 책 목차 — Journey 1단계

[`Developer Journey`](../journey/README.md) 의 **1단계 — 이 레포가 뭐야?** 입니다.

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | (없음, 첫 단계) | 레포 루트 `README.md` 의 빠른 시작이 선행 |
| → 다음 | [`Architecture 한눈 요약`](../journey/architecture.md) | 같은 1단계, 모듈 구조 한눈 요약 |

**막혔을 때**: [`도그푸딩 함정`](../journey/dogfood-pitfalls.md) / [`FAQ`](../journey/dogfood-faq.md)  
**왜 이렇게?**: 이 문서가 "왜" 의 본진이에요. 더 깊은 인프라 결정은 [Infra](../infra/) 에 있어요.
