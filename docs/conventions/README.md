# Coding Conventions

이 디렉토리는 `flutter-mobile-template` 과 이를 기반으로 생성된 모든 파생 레포의 **코딩 규약** 을 담아요. 규약은 취향이 아니라 **일관성을 위한 계약** 이에요. 혼자 작업해도 6개월 뒤의 나 자신이 과거 코드를 이해해야 하고, 파생 레포가 여러 개 생겼을 때 코드 스타일이 비슷해야 cherry-pick 전파가 매끄럽게 돼요.

> **ADR 과의 관계**: 컨벤션 문서는 **실행 규칙** (어떻게 쓸 것인가), ADR 은 **설계 결정의 근거** (왜 이렇게?). 각 컨벤션의 "왜?" 는 해당 ADR 에 링크되어 있어요.

---

## 문서 구성

| 파일 | 내용 | 관련 ADR |
|------|------|----------|
| [`naming.md`](./naming.md) | 파일 · 클래스 · 변수 · Provider 네이밍 | - |
| [`viewmodel-mvvm.md`](./viewmodel-mvvm.md) | `StateNotifier + ConsumerWidget` 패턴 | [ADR-005](../philosophy/adr-005-riverpod-mvvm.md) |
| [`error-handling.md`](./error-handling.md) | `ApiException` · `safeErrorCode` · 인터셉터 흐름 | [ADR-009](../philosophy/adr-009-backend-contract.md) · [ADR-010](../philosophy/adr-010-queued-interceptor.md) · [ADR-011](../philosophy/adr-011-interceptor-chain.md) |
| [`loading-ux.md`](./loading-ux.md) | 4가지 로딩 패턴 적용 | [ADR-017](../philosophy/adr-017-loading-ux.md) |
| [`i18n.md`](./i18n.md) | ARB + gen_l10n 워크플로우 | [ADR-016](../philosophy/adr-016-i18n-from-start.md) |

> **테스트 규약**은 별도 섹션. [Testing Strategy](../testing/testing-strategy.md) · [Contract Testing](../testing/contract-testing.md) 참조.

---

## 규약의 우선순위

1. **동작하는 코드** 가 이상적인 규약보다 우선
2. **이 문서에 명시된 규약** 이 개인 취향보다 우선
3. **프로젝트 내 기존 패턴** 이 새 패턴보다 우선
4. **SOLID / DRY / YAGNI** 같은 원칙은 참조점이지 절대 기준이 아님

---

## 규약을 지키는 방법

**자동화가 1순위** 예요.

| 검증 수단 | 역할 |
|---------|------|
| `flutter analyze` | 정적 분석 (`analysis_options.yaml`) |
| `flutter test` | 단위 · 위젯 · 통합 테스트 |
| `flutter gen-l10n` | i18n 코드 생성 ([ADR-016](../philosophy/adr-016-i18n-from-start.md)) |
| `dart run tool/configure_app.dart --audit` | Kit 조합 정합성 ([ADR-004](../philosophy/adr-004-manual-sync-ci-audit.md)) |
| `dart format --set-exit-if-changed .` | 포매팅 일관성 |

커밋 전 위 명령이 모두 통과해야 해요. CI 에서 한 번 더 검증돼요.

---

## 모듈 README 유지 규칙

각 모듈 디렉토리 (`lib/core/*`, `lib/kits/*`, `lib/common/*`) 에는 `README.md` 가 있어요. 코드 변경 시 다음 중 하나라도 해당되면 **같은 커밋** 에서 해당 모듈의 `README.md` 도 업데이트해요.

1. **새 파일 추가** → "제공 파일" 섹션 추가
2. **기존 파일 삭제 / 이름 변경** → README 에서 제거 · 수정
3. **Provider 추가 · 변경** → 해당 섹션 업데이트
4. **주요 설계 결정 변경** → README 업데이트

**별도 "docs 업데이트" 커밋으로 분리하지 않아요**. 코드 변경과 한 커밋.

---

## 문서 작성 스타일 (docs/ 하위 모든 마크다운)

자세한 건 [STYLE_GUIDE](../STYLE_GUIDE.md) 참조. 핵심만.

- **해요체** (`~예요`, `~해요`) 기본. 명령조 · 학술체 회피
- **상대 경로 링크** — 내부 참조는 상대 경로, 소스 파일만 GitHub URL
- **코드 블록 언어 태그 필수** (`dart`, `bash`, `yaml`, `json`)
- **ADR 첫 언급** — `[ADR-005 · Riverpod + MVVM](../philosophy/adr-005-riverpod-mvvm.md)` 포맷
- **독자 레벨 Level 2** (실무 중급 Flutter 개발자) 를 기본으로 씀

---

## 파생 레포가 이 규약을 확장할 때

파생 레포는 **템플릿 원본 규약을 그대로 유지** 하는 게 기본. 도메인별 추가 규칙이 필요하면 파생 레포의 `docs/conventions/` 에 **새 파일** 로 추가하고, 템플릿 원본 파일은 건드리지 않아요. 이래야 cherry-pick 전파 시 충돌 최소.
