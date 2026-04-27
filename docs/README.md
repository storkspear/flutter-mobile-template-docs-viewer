# template-flutter — Docs

이 폴더의 문서는 `template-flutter` 을 기반으로 **파생 레포를 만들고 운영하는 개발자** 를 위한 가이드예요. 폴더 구조는 독자의 여정에 맞게 정리되어 있고, 각 문서는 단일 목적에 집중합니다.

> **짝이 되는 백엔드 템플릿**: 이 프론트엔드 템플릿은 [`template-spring`](https://github.com/storkspear/template-spring) 과 쌍으로 작동해요. 백엔드 API 계약 · 에러 코드 · JWT 구조가 서로 1:1 대응되며, 같은 솔로 인디 개발자가 "앱 공장 전략" 으로 두 레포를 함께 운영하는 것을 전제로 합니다.

---

## 시작하기

처음 이 레포를 만났다면 **여정 문서부터** 읽어주세요. 어디서부터 시작할지, 다음은 뭘 읽을지가 단계별로 안내돼요.

- [`Developer Journey — 전체 읽기 순서`](./journey/README.md)

그다음부터는 필요한 영역만 골라서 들어가면 됩니다.

---

## 철학 & 설계 결정 (journey/philosophy/)

이 템플릿이 **왜 이런 구조가 되었는지** 를 담은 ADR (Architecture Decision Record) 카드 모음이에요. 추상적인 이론이 아니라, 솔로 인디 개발자가 여러 앱을 찍어낼 때 마주치는 구체적인 고통에 대한 답변으로 만들어졌어요.

- [`Philosophy — ADR 전체 인덱스`](./philosophy/README.md)
- 테마별 ADR 카드 (레포 구조 / 상태관리 / 네트워크 / 저장소 / UI·UX / 운영)

## 개발 여정 (journey/)

파생 레포 개발자가 시간 순서로 따라가는 문서들이에요.

- [`Architecture`](./journey/architecture.md) — 모듈 구조 한눈 요약
- [`Onboarding`](./journey/onboarding.md) — 파생 레포 최초 셋업
- [`Build First App`](./journey/build-first-app.md) — 첫 앱 완성 walkthrough
- [`Deployment`](./journey/deployment.md) — 파생 레포 첫 운영 배포
- [`Dogfood FAQ`](./journey/dogfood-faq.md) — 자주 묻는 질문
- [`Dogfood Pitfalls`](./journey/dogfood-pitfalls.md) — 자주 막히는 함정 모음

## 아키텍처 (architecture/) — 시스템 구조

구조 레퍼런스 문서예요. "어떻게 생겼는지" 빠르게 파악하고 싶을 때 참고합니다.

- [`Module Dependencies`](./architecture/module-dependencies.md) — core / kits / common / features 의존 방향
- [`FeatureKit Contract`](./architecture/featurekit-contract.md) — AppKit 인터페이스 전체 명세
- [`Boot Sequence`](./architecture/boot-sequence.md) — 앱 시작 시 순서도

## 컨벤션 (conventions/) — 코드 작성 규약

- [`Overview`](./conventions/README.md)
- [`Naming`](./conventions/naming.md) — 파일 · 클래스 · Provider 명명
- [`ViewModel + MVVM`](./conventions/viewmodel-mvvm.md) — StateNotifier · ConsumerWidget 패턴
- [`Error Handling`](./conventions/error-handling.md) — ApiException · safeErrorCode/Message · 인터셉터 순서
- [`Loading UX`](./conventions/loading-ux.md) — 4가지 로딩 패턴
- [`i18n`](./conventions/i18n.md) — ARB · gen_l10n 원칙
- [`Testing`](./testing/testing-strategy.md) — resetForTest · Provider override · 지문 테스트

## 기능 가이드 (features/) — 개별 Kit 상세

각 FeatureKit 의 계약 · 의존 · 사용법을 담아요. Kit 을 활성화하기 전에 해당 문서부터 읽어주세요.

- [`Kit 목록 + 의존 관계도`](./features/README.md)
- [`auth_kit`](./features/auth-kit.md) — JWT · 소셜 로그인
- [`backend_api_kit`](./features/backend-api-kit.md) — Dio · 3개 인터셉터
- [`observability_kit`](./features/observability-kit.md) — Sentry · PostHog 번들
- [`notifications_kit`](./features/notifications-kit.md) — 로컬 · 푸시
- [`local_db_kit`](./features/local-db-kit.md) — Drift · 마이그레이션
- [`update_kit`](./features/update-kit.md) — 강제 업데이트
- [`onboarding_kit`](./features/onboarding-kit.md) — 다단계 위자드
- [`nav_shell_kit`](./features/nav-shell-kit.md) — 하단 탭 셸
- [`charts_kit`](./features/charts-kit.md) — fl_chart 래핑
- [`ads_kit`](./features/ads-kit.md) — AdMob · UMP · ATT
- [`background_kit`](./features/background-kit.md) — workmanager
- [`permissions_kit`](./features/permissions-kit.md) — 런타임 권한
- [`device_info_kit`](./features/device-info-kit.md) — 기기 정보

## API 계약 (api-contract/) — template-spring 과의 쌍

백엔드 템플릿과 1:1 로 맞물리는 약속들입니다. 스키마가 어긋나면 양쪽이 동시에 안 돌아가요.

- [`Response Schema`](./api-contract/response-schema.md) — `{data, error}` 구조
- [`Search Request`](./api-contract/search-request.md) — SearchRequestBuilder 연산자
- [`Error Codes`](./api-contract/error-codes.md) — ErrorCode enum 동기화
- [`Auth Flow`](./api-contract/auth-flow.md) — JWT · appSlug 흐름

## 인프라 / 운영 (infra/)

- [`Android Deployment`](./infra/android-deployment.md) — Fastlane · GHA · Play Internal
- [`iOS Deployment`](./infra/ios-deployment.md) — Fastlane · App Store Connect
- [`Security`](./infra/security.md) — R8 난독화 · SSL 핀닝 · Keychain 정책
- [`CI/CD`](./infra/ci-cd.md) — GitHub Actions 워크플로우
- [`Secrets Management`](./infra/secrets-management.md) — .env · GHA Secrets 구분

## 테스팅 (testing/)

- [`Testing Strategy`](./testing/testing-strategy.md) — 계층별 테스트 전략
- [`Contract Testing`](./testing/contract-testing.md) — Kit 계약 테스트

## 참조 (reference/)

- [`Scripts`](./reference/scripts.md) — `scripts/*.sh` 사용법
- [`Recipes`](./reference/recipes.md) — 3가지 recipe (local-only / local-notifier / backend-auth)
- [`Glossary`](./reference/glossary.md) — 용어 사전 (파생 레포 · Kit · Recipe 등)
- [`Migration from Template`](./reference/migration-from-template.md) — cherry-pick 전파 규칙

---

## 문서 작성 규칙

이 레포의 `docs/` 는 [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) 의 컨벤션을 따라요. 새 문서를 추가하거나 기존 문서를 수정할 때는 해당 가이드를 먼저 확인해주세요.

특히 **ADR 카드** 는 8섹션 구조가 엄격하게 정해져 있고, 어느 문서든 해요체 일관성과 상대경로 링크 규칙이 적용돼요.

---

## 빠른 시작

```bash
# 1. Use this template → 새 레포 생성 후 클론
git clone git@github.com:<org>/<your-app>.git && cd <your-app>

# 2. 앱 이름 / 번들 ID 변경
./scripts/rename-app.sh <slug> com.<org>.<slug>

# 3. 의존성 설치 + 구성 검증
flutter pub get
dart run tool/configure_app.dart

# 4. 실행
flutter run
```

상세 단계는 [`Build First App`](./journey/build-first-app.md) 를 참고해주세요.
