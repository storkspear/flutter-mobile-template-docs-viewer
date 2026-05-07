# 📚 template-flutter — 책 목차 (Developer Journey)

이 문서는 `docs/` 안의 모든 문서를 **읽는 순서** 로 안내해요.

레포 루트의 `README.md` 빠른 시작만으로도 첫 앱은 실행돼요. 이 책은 그 이후, 레포의 정체와 사용 흐름을 차근차근 이해하고 싶을 때 읽는 안내서예요.

각 단계 끝에는 다음 단계로 넘어가는 링크가 있어요. 책처럼 위에서 아래로 한 번 흐르듯 읽으면 자연스럽게 전체 그림이 잡혀요.

> 💡 막히면: [`도그푸딩 함정 모음`](./dogfood-pitfalls.md) / [`도그푸딩 FAQ`](./dogfood-faq.md) 부터 검색해보세요.

---

## 0. 시작 전 — README 의 빠른 시작 (10분)

이미 마치셨다면 1단계로 넘어가세요. 안 하셨다면 레포 루트의 `README.md` 빠른 시작부터 따라가주세요.

빠른 시작에서 하는 일:

- `Use this template` 으로 파생 레포 생성 및 클론
- `scripts/rename-app.sh` 로 앱 이름 · 번들 ID 일괄 치환
- `flutter pub get` + `dart run tool/configure_app.dart` 로 의존성 · 구성 검증
- `flutter run` 으로 첫 실행 확인

이 책은 빠른 시작이 끝났다는 가정에서 시작해요.

---

## 1. 이 레포가 뭐야? (15분)

이 레포의 **정체** 를 이해해요. 어떤 종류의 템플릿인지, 왜 이렇게 설계되었는지 큰 그림을 잡습니다.

읽을 문서:

1. [`Philosophy 인덱스`](../philosophy/README.md) 의 **프롤로그 + 테마 1 의 ADR 두 개** 만 먼저 읽어주세요.
   - 프롤로그 — "앱 공장 전략" 과 세 가지 제약 (운영 가능성 · 시간 희소성 · 복권 사기 모델)
   - ADR-001 · GitHub Template Repository 패턴 (왜 fork 가 아닌 template 인가)
   - ADR-002 · 3계층 모듈 구조 (core / kits / common / features)

2. [`architecture.md`](./architecture.md) 의 **§ 모듈 구조 한눈 요약** 한 섹션만 읽어주세요. FeatureKit 아키텍처의 큰 그림이 있어요.

여기까지 읽으면 "이 템플릿이 뭘 하려는 도구인지" 감이 잡혀요. 더 깊은 ADR 카드들은 나중에 필요할 때 돌아오세요.

---

## 2. 어떻게 써? — 로컬 개발 환경 (1시간)

본인 머신에서 파생 레포를 띄우고 Flutter 앱을 직접 돌려봐요.

읽을 문서:

- [`onboarding.md`](./onboarding.md) — 전체 한 번 정독

핵심 흐름은 다음과 같아요.

1. `§1 사전 설치 체크리스트` — Flutter SDK (3.41.8+) · FVM · Xcode · Android Studio 확인
2. `§2 파생 레포 생성` — `Use this template` 으로 본인 레포 만들기
3. `§3 앱 정체성 설정` — `rename-app.sh` 로 슬러그 · 번들 ID · 패키지명 일괄 치환
4. `§4 첫 기동` — `flutter pub get` → `dart run tool/configure_app.dart` → `flutter run`

여기까지 마치면 시뮬레이터에 본인 앱 이름으로 첫 화면이 떠요.

---

## 3. Kit 조립은 어떻게? — 앱 유형 결정 (30분)

이 템플릿은 **14개의 FeatureKit** 을 선택적으로 조립하는 구조예요. 본인 앱이 어떤 유형인지에 따라 활성화하는 Kit 조합이 달라져요.

읽을 문서:

1. [`Philosophy 인덱스`](../philosophy/README.md) 의 **ADR-003 · FeatureKit 동적 레지스트리** + **ADR-021 · Multi-Recipe 구성** 을 읽어주세요.
2. [`Features 인덱스`](../features/README.md) 의 **§ Kit 의존 관계도** 로 의존성 체인 파악
3. [`Recipes`](../reference/recipes.md) 에서 본인 앱에 맞는 **recipe** 고르기
   - `local-only-tracker` — 완전 로컬 앱 (서버 없음)
   - `local-notifier-app` — 로컬 알림 중심 앱
   - `backend-auth-app` — 백엔드 연동 + 로그인 필요 앱

수행하는 일:

```bash
cp recipes/<your-recipe>.yaml app_kits.yaml
# lib/main.dart 의 AppKits.install([...]) 를 recipe 에 맞춰 수정
dart run tool/configure_app.dart   # 정합성 검증
```

여기까지 끝나면 본인 앱 유형에 맞는 Kit 조합이 활성화된 상태가 돼요.

---

## 4. 발급은 어디서? — 외부 서비스 자격 증명 (1 ~ 2시간)

운영 배포로 넘어가려면 외부 서비스의 API 키 · DSN 을 발급받아야 해요. 어디서 어떻게 받는지가 막히는 지점이라, 영역별로 문서가 나뉘어 있어요.

### 4.1 소셜 로그인 (auth_kit 쓸 때)

- **Google Sign In**: Google Cloud Console 에서 Client ID 발급
- **Apple Sign In**: Apple Developer 에서 Bundle ID + Service ID 설정
- 상세 절차는 [`auth_kit`](../features/auth-kit.md) 참고

### 4.2 관측성 (observability_kit 쓸 때)

- **Sentry DSN**: [`observability_kit`](../features/observability-kit.md) → Sentry 프로젝트 생성 · DSN 복사 · 심볼 업로드 토큰 발급
- **PostHog API Key**: 같은 문서의 PostHog 섹션

### 4.3 푸시 알림 (notifications_kit 쓸 때)

- **Firebase 프로젝트**: [`notifications_kit`](../features/notifications-kit.md) → `google-services.json` 다운로드 · `GoogleService-Info.plist` 다운로드

각 발급 후 파생 레포의 `.env` 에 채워 넣거나, CI 배포 시엔 GitHub Actions Secrets 에 등록해요. 자세한 비밀 관리 규칙은 [`Secrets Management`](../infra/secrets-management.md) 를 참고해주세요.

---

## 5. 기능 조립은 어떻게? — 첫 화면 & 첫 기능 (1 ~ 2시간)

발급 받은 값으로 실제 Kit 들을 활성화하고, 본인 도메인의 첫 화면을 추가해봐요.

읽을 문서:

- [`build-first-app.md`](./build-first-app.md) — 완성까지 가는 12단계 walkthrough
- [`ViewModel + MVVM`](../conventions/viewmodel-mvvm.md) — `StateNotifier + ConsumerWidget` 패턴
- [`Error Handling`](../conventions/error-handling.md) — ApiException 처리
- [`Loading UX`](../conventions/loading-ux.md) — 로딩 UX 4가지 패턴

구성 흐름:

1. `lib/features/<your-domain>/` 디렉토리 생성
2. `<feature>_screen.dart` + `<feature>_view_model.dart` 작성
3. ViewModel 에서 `ApiClient` · Repository 호출
4. Screen 에서 `ref.watch()` 로 상태 구독
5. 라우팅 추가 (`lib/common/router/app_router.dart`)

여기까지 끝나면 본인 도메인의 첫 화면이 동작해요.

---

## 6. 배포 준비 — Android · iOS 자격 증명 (2시간)

로컬에서 잘 돌아가면, 운영 스토어에 올릴 준비를 해요.

읽을 문서:

- [`Android Deployment`](../infra/android-deployment.md) — Android 키스토어 생성 · GHA Secrets 등록 · Fastlane
- [`iOS Deployment`](../infra/ios-deployment.md) — iOS 인증서 · 프로비저닝 프로파일 · App Store Connect
- [`Security`](../infra/security.md) — 난독화 · SSL 핀닝 · Keychain 정책

수행하는 일 (Android 기준):

```bash
./scripts/generate-upload-keystore.sh    # 업로드 키스토어 생성
./scripts/upload-secrets-to-github.sh    # keystore + Play JSON key → GitHub Secrets
```

여기까지 마치면 `git tag v1.0.0 && git push --tags` 만으로 Play Internal 배포가 돌아가요.

---

## 7. 첫 운영 배포 (30분)

모든 자격 증명이 준비됐으니, 이제 실제로 스토어에 올려요.

읽을 문서:

1. [`deployment.md`](./deployment.md) — 첫 Play Internal + TestFlight 배포 walkthrough
2. [`CI / CD`](../infra/ci-cd.md) — GHA 워크플로우 동작 원리

핵심 흐름:

```bash
git tag v1.0.0
git push --tags
# GHA 가 자동으로 AAB 빌드 → Play Internal 업로드 → Sentry 심볼 업로드
```

여기까지 끝나면 본인 앱이 내부 테스터에게 배포된 상태가 됩니다.

---

## 깊이 있는 참조 (필요할 때 돌아오는 곳)

위 책 본문에서는 "왜?" 를 자세히 다루지 않아요. 본문이 가볍게 흘러가게 하기 위함이에요. 깊이 들어가고 싶을 때 아래 문서들을 참고해주세요.

| 궁금한 것 | 문서 | 한 줄 설명 |
|---|---|---|
| 왜 이렇게 설계? | [`Philosophy 인덱스`](../philosophy/README.md) | ADR 카드 전체 인덱스 |
| 모듈 구조 상세 | [`architecture.md`](./architecture.md) | core / kits / common / features 의존 그래프 |
| AppKit 계약 전체 | [`FeatureKit Contract`](../architecture/featurekit-contract.md) | `AppKit` 인터페이스 명세 |
| 부팅 시퀀스 | [`Boot Sequence`](../architecture/boot-sequence.md) | Sentry → AppConfig → Kits → Splash |
| 코딩 규약 | [`Conventions`](../conventions/README.md) | 네이밍 · MVVM · 에러 · 로딩 · 테스트 |
| Kit 개별 사용법 | [`Features`](../features/README.md) | 14개 Kit 별 상세 문서 |
| API 계약 (백엔드 쌍) | [`API Contract`](../api-contract/README.md) | 응답 스키마 · 에러 코드 · JWT |
| 배포 / CI/CD / 보안 | [`Android Deployment`](../infra/android-deployment.md) | Fastlane · GHA · 난독화 (Infra 폴더 진입점) |
| 테스트 전략 | [`Testing Strategy`](../testing/testing-strategy.md) | resetForTest · Provider override |
| 스크립트 사용법 | [`Scripts`](../reference/scripts.md) | `scripts/*.sh` 전체 |
| Recipe 선택 기준 | [`Recipes`](../reference/recipes.md) | local-only / notifier / backend-auth |
| 용어 사전 | [`Glossary`](../reference/glossary.md) | 파생 레포 · Kit · BootStep 등 |
| 템플릿 → 파생 동기화 | [`Migration from Template`](../reference/migration-from-template.md) | cherry-pick 전파 |

---

## 이 책 다음에는?

7단계까지 한 번 흐르고 나면 템플릿의 전체 사용 흐름이 머릿속에 잡혀요. 그다음은 **본인 앱의 도메인 로직을 만들어가는 것** 이 자연스러운 다음 단계예요.

진행하면서 막히는 부분이 있으면 위 "깊이 있는 참조" 의 해당 문서를 펼쳐보세요. 모든 문서는 서로 연결돼 있고, 어디로 가야 할지 막힌다면 이 책 목차로 다시 돌아오면 돼요.

행운을 빕니다.
