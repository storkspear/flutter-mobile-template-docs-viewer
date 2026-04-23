# Coding Conventions

이 디렉토리는 `flutter-mobile-template` 및 이를 기반으로 생성된 모든 파생 레포의 **코딩 규약**을 담습니다.

규약은 취향이 아니라 **일관성을 위한 계약**입니다. 혼자 작업하더라도, 6개월 뒤의 나 자신이 과거 코드를 이해할 수 있어야 합니다. 파생 레포가 여러 개 생겼을 때 코드 스타일이 비슷해야 cherry-pick backport가 매끄럽습니다.

---

## 문서 구성

- [`architecture.md`](./architecture.md) — MVVM 패턴, 모듈 구조(`core/`+`kits/`+`features/`), 의존 방향, 에러 처리
- [`kits.md`](./kits.md) — FeatureKit 작성법, `AppKit` 계약, `kit_manifest.yaml` 스펙, README 표준
- [`loading.md`](./loading.md) — 로딩 UX 규약 (skeleton, progress, splash)
- [`naming.md`](./naming.md) — 파일/클래스/변수/위젯 네이밍 규칙
- [`api-contract.md`](./api-contract.md) — 백엔드 API 계약, 응답 파싱, 에러 처리

---

## 규약의 우선순위

1. **동작하는 코드**가 이상적인 규약보다 우선입니다
2. **이 문서에 명시된 규약**이 개인 취향보다 우선입니다
3. **프로젝트 내 기존 패턴**이 새 패턴보다 우선입니다
4. **SOLID/DRY/YAGNI** 같은 원칙은 참조점이지 절대 기준이 아닙니다

---

## 규약을 지키는 방법

**자동화가 1순위입니다.**

- **`flutter analyze`** — 정적 분석 (analysis_options.yaml)
- **`flutter test`** — 테스트 실행
- **`flutter gen-l10n`** — i18n 자동 생성
- **Riverpod lint** — Provider 사용 패턴 검증

---

## 모듈 README 유지 규칙

각 모듈 디렉토리(`lib/core/*`, `lib/kits/*`, 잔여 `lib/common/*`)에는 `README.md`가 있습니다. 코드를 변경할 때 다음 중 하나라도 해당되면 **같은 커밋에서** 해당 모듈의 `README.md`를 함께 업데이트합니다.

1. **새 파일을 추가**했을 때 → "제공 파일" 섹션에 추가
2. **기존 파일을 삭제/이름 변경**했을 때 → README에서 제거/수정
3. **Provider가 추가/변경**됐을 때 → 해당 섹션 업데이트
4. **주요 설계 결정이 바뀌었을 때** → README 업데이트

코드 변경과 같은 커밋에 포함합니다. 별도 "docs 업데이트" 커밋으로 분리하지 않습니다.
