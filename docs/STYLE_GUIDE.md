# Documentation Style Guide

이 문서는 **flutter-mobile-template `docs/` 를 어떻게 쓸 것인가** 의 규칙을 모아요. 추상 원칙이 아니라 **`journey/philosophy/` 의 파일럿 ADR (003 · 005 · 009) 에서 귀납적으로 추출된 규칙** 이에요. 각 규칙마다 구체 샘플 링크가 있어야 하며, 샘플 없는 규칙은 근거가 약해요.

> **이 문서의 위상**: `docs/` 안의 모든 문서가 참조하는 메타 문서. 새 문서 쓸 때 이 가이드를 따르고, 예외가 필요하면 "왜 이 경우에 예외인가" 를 본 문서에 추가.

> **spring-backend-template 과의 관계**: 짝이 되는 백엔드 템플릿의 [`STYLE_GUIDE`](https://github.com/storkspear/spring-backend-template/blob/main/docs/STYLE_GUIDE.md) 와 정합성을 유지해요. 독자 레벨 분류 (Level 0~3), ADR 8섹션, 해요체, 상대경로 링크 규칙이 공통. Flutter 고유 사항 (Dart 코드 블록, AppKit 용어) 만 차이.

---

## 1. 독자 페르소나 — Level 0~3

모든 문서는 **어느 레벨의 독자를 대상으로 쓰는지** 를 명시적으로 결정해야 해요.

| Level | 누구 | 배경 지식 | 예시 문서 타겟 |
|---|---|---|---|
| **Level 0** | 처음 모바일 앱을 만드는 사람 | Dart 입문, Flutter 미경험 | "프로젝트 소개", "첫 앱 실행" (아직 미작성) |
| **Level 1** | 주니어 Flutter 개발자 | Widget · setState 튜토리얼 수준 | `journey/onboarding.md`, `journey/build-first-app.md` |
| **Level 2** | Flutter 실무 중급 | 2+년 현업, 앱 출시 경험 | `journey/architecture.md`, 대부분의 `conventions/*.md` |
| **Level 3** | 시스템 설계 관심자 | 여러 플랫폼/스택 경험, 트레이드오프 사고 | `journey/philosophy/*.md` 전체 (ADR) |

### 레벨별 톤 규칙

**Level 0~1** — 비유 · 예시 · 단계별 안내 위주:
- 긴 개념 설명 전에 "이게 뭐에 쓰이는가" 먼저
- 코드 스니펫은 **전체 맥락** 을 담아서 (import 포함)
- 실행 명령은 그대로 복붙 가능한 형태

**Level 2** — 의사결정 맥락 + 구체 구현:
- "왜" 와 "어떻게" 를 같이 다룸
- 코드 스니펫은 **핵심만 발췌** 가능 (import 생략 허용)
- 업계 표준 (Android Jetpack, iOS Swift 등) 과의 비교 자연스럽게

**Level 3** — 트레이드오프 · 대안 검토 · 장기 결과:
- "왜" 중심, "어떻게" 는 Code References 링크로 위임
- 여러 대안을 병렬 비교 (Option 1/2/3 구조)
- 미래 부작용 · 이행 경로까지 기록

### 샘플

- Level 3 예시: [`adr-003-featurekit-registry`](./philosophy/adr-003-featurekit-registry.md) — Option 1/2/3 + 롤백 설계 + 미래 마이그레이션 경로
- Level 3 예시 (결합도 트레이드오프): [`adr-009-backend-contract`](./philosophy/adr-009-backend-contract.md) — "팀 분리 시 재고 필요" 명시

---

## 2. ADR 카드 표준 구조

`journey/philosophy/` 의 ADR 은 아래 **8개 필수 섹션** + 선택 섹션으로 구성. 새 설계 결정을 ADR 로 기록할 때 그대로 따름.

### 필수 섹션 순서 (h2)

1. **결론부터** — 30초 안에 핵심 잡기. 4~7줄.
2. **왜 이런 고민이 시작됐나?** — 문제 맥락. 마지막에 `> 이 결정이 답해야 했던 물음은 이거예요` 블록으로 물음 명확화.
3. **고민했던 대안들** — 최소 2~3개. 각 대안은 `### Option N — 제목` 서브섹션. 채택안은 `★ (채택)` 표시.
4. **결정** — 실제 채택된 구현. 구조도 / 코드 스니펫 / 하위 결정 포함.
5. **이 선택이 가져온 것** — `### 긍정적 결과`, `### 부정적 결과` 서브섹션 필수. 정직하게.
6. **교훈** — 2~3개 정도. 각 교훈은 `### 교훈 N — 제목` 서브섹션 + 구체 일화 + `**교훈**:` 한 줄 요약.
7. **관련 사례 (Prior Art)** — 업계 레퍼런스 4~5개 외부 링크.
8. **Code References** — 실제 파일 · 라인 링크. GitHub URL 사용. 마지막에 `**관련 ADR**:` 블록.

### 파일 헤더 (h1 + Status 줄)

```markdown
# ADR-NNN · 제목 한 줄

**Status**: Accepted/Deprecated/Superseded. 현재 유효. YYYY-MM-DD 기준 현황 한 줄.
```

- h1 제목 포맷: `ADR-NNN · 제목` (중점 ` · ` 구분자)
- Status 줄은 **파일 상단 고정**. 날짜 · 현재 유효성 · 주요 구현 위치 한 줄 언급.

### 선택 섹션

- `### 설계 선택 포인트` — 결정 안에 하위 결정이 여러 개일 때 (`결정` 섹션 내부 서브섹션)
- `## 비목표` — 명시적 거절이 중요할 때 (spring-backend-template 의 adr-007 스타일)

### 샘플

- 8섹션 구조 모범: [`adr-003-featurekit-registry.md`](./philosophy/adr-003-featurekit-registry.md) — 8섹션 + 설계 포인트 4개
- Option 병렬 비교 모범: [`adr-009-backend-contract.md`](./philosophy/adr-009-backend-contract.md) — Option 1 OpenAPI / Option 2 GraphQL / Option 3 자체 DTO / Option 4 ★

---

## 3. 톤 · 문체 · 말투

### 기본 말투: 해요체

- `~예요`, `~이에요`, `~해요` 기본.
- 명령조 (`~하라`) 금지. 규칙을 서술할 때도 `~해요`, `~따라요`.
- 학술 톤 (`~하여야 한다`, `~이며`) 회피.

> ⚠️ **CLAUDE.md 와의 차이**: 레포 루트의 `CLAUDE.md` 는 합쇼체 (`~합니다`) 를 지시하지만, `docs/` 하위는 **해요체가 우선** 이에요. `CLAUDE.md` 는 AI 에이전트용 운영 지침이고, `docs/` 는 파생 레포 독자용 설명서라서 톤이 달라요. 불가피하게 자연스럽지 않을 때만 `~합니다` 혼용 허용.

### 섹션명 자연 한국어

학술적 섹션명 대신 물음 · 감탄 형태 허용:

| ❌ 학술체 | ✅ 자연체 |
|---|---|
| Summary | 결론부터 |
| Context | 왜 이런 고민이 시작됐나? |
| Options Considered | 고민했던 대안들 |
| Consequences | 이 선택이 가져온 것 |
| Lessons Learned | 교훈 |

**예외**: 고유명사는 영문 유지 — `Status`, `Prior Art`, `Code References`, `AppKit`, `ADR`, `Riverpod`, `Provider`.

### 독자에게 직접 말 걸기 허용

- "~해요" 보다 직접적인 톤 OK: "처음 보면 낯설어요", "3줄이면 완성이에요"
- 감탄사 절제 — `ㅋㅋ`, 이모지 금지 (사용자 요청 시만 예외. 최상위 `README.md` 의 📚 정도만 관용).

### 표현 강도

- 단정적 표현 허용: "**절대** 금지", "**반드시** 따릅니다"
- 단 근거가 없으면 쓰지 말 것. 모든 단정은 뒤에 "왜" 를 수반해야 함.
- 완곡 표현 (`~인 것 같습니다`, `~할 수도 있습니다`) 은 정말 불확실할 때만.

### 샘플

- 해요체 일관: [`adr-005-riverpod-mvvm.md`](./philosophy/adr-005-riverpod-mvvm.md) 전체
- 단정적 근거 있는 표현: [`adr-009-backend-contract.md`](./philosophy/adr-009-backend-contract.md) 의 "**두 곳만** 수정" · "**반드시** `safeErrorCode` 를 거친다"

---

## 4. 용어집 (Glossary)

프로젝트 특유 용어는 **표기를 고정**. 흔들리면 검색 · 치환이 안 됨.

| 용어 | 표기 | 설명 |
|---|---|---|
| 템플릿 레포 | `flutter-mobile-template` | 본 레포 (GitHub Template Repository) |
| 파생 레포 | (앱 slug 이름) | 템플릿에서 "Use this template" 으로 분기된 레포 |
| 짝 백엔드 템플릿 | `spring-backend-template` | 함께 쓰이는 백엔드 레포 |
| Kit / AppKit | `AppKit`, `auth_kit`, `backend_api_kit` 등 | 기능 단위 플러그인. `AppKit` 추상 클래스 계약 |
| Kit 조립 | — | `app_kits.yaml` + `lib/main.dart` 에 Kit 선언해서 활성화 |
| Recipe | `recipes/*.yaml` | 3가지 샘플 앱 유형 (local-only / local-notifier / backend-auth) |
| BootStep | `BootStep` | 스플래시 중 실행되는 단계 (AuthCheckStep 등) |
| ViewModel | `*ViewModel` | `StateNotifier<*State>` 를 상속한 로직 객체 |
| Provider | `Provider`, `provider` | Riverpod 의 DI 노드. 본 프로젝트는 영문 `Provider` 유지 |
| providers.dart | `lib/common/providers.dart` | 전역 DI 정의 중앙 파일 |
| safeErrorCode / safeErrorMessage | — | UI 안전 에러 추출 함수 (ADR-009) |
| 솔로 | 한 명의 개발자 | "솔로 감당 가능" 등 |
| 도그푸딩 | `tools/dogfooding/` 유사 개념 (아직 없음) | 자체 템플릿을 자기 프로젝트에 적용하는 검증 |
| cherry-pick 전파 | — | 템플릿 레포 개선 → 파생 레포로 전파 |
| `appSlug` | 단일 문자열 claim | JWT 의 앱 식별자 (ADR-012) |

### 용어 사용 규칙

- 한 번 정의하면 본문에서 계속 같은 표기 유지
- 약어는 **첫 등장 시 풀어쓰기** + 괄호로 약어: `ADR (Architecture Decision Record)`, `MVVM (Model-View-ViewModel)`
- 같은 개념을 한국어 / 영어 혼용 지양 — "Kit" vs "키트" 중 하나로 고정 (본 프로젝트는 **Kit** 영문 유지)
- 파일 · 클래스명은 백틱: `AppKits.install([...])`, `auth_kit/auth_service.dart`

---

## 5. 코드 블록 규칙

### 언어 태깅 필수

    ```dart     ← ✅
    ```         ← ❌ (언어 미지정)

모든 코드 블록에 언어 태그 (`dart`, `bash`, `yaml`, `json`, `groovy`, `kotlin`, `markdown` 등).

### 경로 주석

긴 코드 스니펫에는 **파일 경로 주석** 을 첫 줄에 달아요. Truncation 여부도 명시.

```dart
// lib/core/kits/app_kit.dart 발췌
abstract class AppKit {
  String get name;
  // ...
}
```

`발췌` 표기로 "전체가 아님" 을 명확히. 전체 인용이면 `전체`.

### 공백 · 들여쓰기

- 2 스페이스 (Dart / YAML / JSON 기본)
- 4 스페이스 (shell 의 중첩 경우 정도)
- 탭 금지

### 주석 최소

- 코드 스니펫 안의 주석은 **문서 맥락을 위한 것만**. 실제 코드의 주석이 아닌 것은 `// ← 이 부분이 핵심` 같은 지시 주석 허용.
- 단 이런 지시 주석은 스니펫 1~2개 이하로만. 많으면 본문에서 설명.

### 샘플

- 경로 주석 + 발췌 표기: [`adr-003`](./philosophy/adr-003-featurekit-registry.md) 의 `AppKit` / `AppKits` 스니펫
- 지시 주석 활용: [`adr-005`](./philosophy/adr-005-riverpod-mvvm.md) 의 "← 사용자 메시지는 ErrorInterceptor 가 i18n 변환"
- JSON 스키마 블록: [`adr-009`](./philosophy/adr-009-backend-contract.md) 의 `{data, error}` 응답 예시

---

## 6. 링크 / Cross-reference 규칙

### 내부 링크는 **상대 경로**

- 같은 디렉토리: `[`ADR-005`](./adr-005-riverpod-mvvm.md)` ← ADR 파일에서 다른 ADR 참조
- 상위 경로: `[`testing`](../../testing/testing-strategy.md)` ← `journey/philosophy/` 에서 `docs/testing/` 참조
- 절대 경로 · 전체 docs-viewer URL 금지 (레포 이름 바뀌면 깨짐)

### Code References 섹션의 외부 링크

Code References 는 파일 위치를 **GitHub 절대 URL** 로 적어요 (뷰어에서 소스를 바로 열 수 있도록).

```markdown
- [`lib/core/kits/app_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kit.dart)
```

내부 문서 참조에는 상대경로 유지. Code References 만 절대 URL 예외.

### 앵커 링크

```markdown
[제약 2](./philosophy/README.md#제약-2--시간이-가장-희소한-자원)
```

- 한글 제목의 앵커는 **한글 그대로** + 특수문자는 `-` 로 치환 + 공백도 `-`
- 확인 방법: 실제로 클릭해서 점프 검증

### ADR 간 참조 포맷

**첫 언급 시** — 번호 + 제목 + 링크:
```markdown
[ADR-005 · Riverpod + MVVM](./adr-005-riverpod-mvvm.md)
```

**재언급 시** — 번호만 + 링크:
```markdown
[ADR-005](./adr-005-riverpod-mvvm.md)
```

### "관련 ADR" 섹션 위치

Code References 마지막에 `**관련 ADR**:` 블록으로 수렴:

```markdown
**관련 ADR**:
- [ADR-003 · FeatureKit 동적 레지스트리](./adr-003-featurekit-registry.md) — Kit 의 providerOverrides 가 맞물림
- [ADR-007 · Late Binding](./adr-007-late-binding.md) — 순환 의존 해결
```

각 링크 뒤에 `—` + 한 줄 설명 필수.

### 외부 링크 (Prior Art)

- `[이름](URL)` 기본 형태
- 도메인 권위 (공식 문서 > 블로그 > 포럼) 우선
- URL 이 장기 안정인지 확인 (Medium 개인 블로그 등 링크 rot 위험 높은 것 회피)

### 샘플

- ADR 간 재참조: [`adr-005`](./philosophy/adr-005-riverpod-mvvm.md) 의 "관련 ADR" 블록
- Code References 포맷: [`adr-003`](./philosophy/adr-003-featurekit-registry.md) / [`adr-009`](./philosophy/adr-009-backend-contract.md) 의 GitHub URL 형태

---

## 7. 문서 규모별 1 세션 작업량

경험 기반 기준. 무리하면 밀도가 떨어짐.

| 규모 | 예시 | 1 세션 분량 |
|---|---|---|
| **대형 플래그십** | `journey/philosophy/README.md`, `journey/architecture.md`, `architecture/featurekit-contract.md` | **1 문서 엄격** |
| **중형 여정** | `onboarding.md`, `build-first-app.md`, `deployment.md`, `infra/android-deployment.md` | 1 문서 기본 |
| **소형 컨벤션** | `naming.md`, `i18n.md` 등 (100~300줄) | 관련 주제 **2개 쌍** |
| **ADR 카드 1 개** | philosophy 테마별 쪼갠 단위 | 3~4 개까지 몰아 가능 (테마 단위) |

### 1 세션 기준의 근거

- 대형: 코드 감사 10~20 파일 + 독자 시뮬레이션 반복. 분산하면 맥락 유지 비용이 큼.
- 중형: 코드 감사 5~10 파일. 한 흐름을 끝까지.
- 소형 쌍: 짝을 지으면 오히려 일관성 강화 효과.

### 세션 밀도 유지 원칙

- 1 세션 내 **감사 → 작성 → 검증 → 커밋** 한 사이클로 완결
- 컨텍스트 소모가 심하면 중단하고 다음 세션으로
- 4~5 시간 초과 시 밀도 하락 — 강제 종료 권장

---

## 8. 검증 체크리스트 (문서 완료 전)

새 문서 / ADR 작성 후 커밋 전:

- [ ] 섹션 헤더가 STYLE_GUIDE 기준을 따르는가
- [ ] 해요체 일관 유지 (학술체 · 명령조 혼입 없음)
- [ ] 옛 섹션명 본문 참조 없음 (`grep -E 'Context|Consequences|Lessons Learned' docs/`)
- [ ] 링크가 실제 파일에 도달 (내부 · 외부 모두)
- [ ] Code References 의 파일 경로가 실존 (`ls` 확인)
- [ ] 두 레포 (template + docs-viwer) 동기화 (`rsync`)
- [ ] `docs-viwer/docs/manifest.json` 의 사이드바 엔트리 추가 (새 문서인 경우)
- [ ] 특정 앱 / 회사 / Bundle ID 노출 없음 (`grep -r 'gymlog\|sumtally\|com\.twosun' docs/`)
- [ ] 커밋 메시지 Conventional Commits 포맷 + subject 72자 이하

---

## 9. 이 가이드의 진화 원칙

### 귀납이 우선, 연역은 금지

이 가이드의 모든 규칙은 **구체 샘플에서 추출**. 추상 원칙을 먼저 쓰고 "이렇게 쓰자" 선언하지 않음.

- 새 규칙 추가 시 `journey/philosophy/*.md` 또는 다른 완성 문서에서 근거 샘플 제시 필수
- 샘플 없는 규칙은 "아이디어" 로만 보존 — 실제 문서 작성 시 검증되면 본문 이동

### 예외 발생 시 기록 → 패턴 식별 → 규칙 업데이트

한 문서에서 이 가이드를 따르기 어려운 상황 발생 시:

1. **예외를 일단 적용** + 해당 문서 상단에 "본 문서는 STYLE_GUIDE §N 예외" 주석
2. 같은 예외가 3개 이상 문서에서 발생하면 **패턴 인식**
3. 본 가이드에 예외 조항 추가 또는 기존 규칙 수정

### 로드맵에서 이 가이드의 활용

- **Phase 3 이후 ADR 작성** 시 이 가이드가 주 레퍼런스
- **conventions / features / infra** 작성 시 가이드 위반 발견되면 즉시 업데이트
- **Level 0 신규 문서** 작성 시 Level 0 톤 규칙 확장 필요 — 작성 결과에서 추출 → 본 가이드 §1 업데이트

---

## 10. 변경 이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-24 | 초기 작성 | `journey/philosophy/` 파일럿 3개 ADR (003 · 005 · 009) 에서 귀납 추출 |

이후 업데이트 시 상기 표에 추가.
