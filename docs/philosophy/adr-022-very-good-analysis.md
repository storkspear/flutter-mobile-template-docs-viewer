# Very_Good_Analysis

**Status**: Accepted. 2026-04-25 기준 유효.

## 결론부터

기본 `flutter_lints` (9 룰) → `very_good_analysis` (100+ 룰) 로 정적 분석 룰셋을 강화하고, 솔로 앱 컨텍스트에 과한 20개 룰은 의식적으로 disable 했어요. 도입 직후 1,367개 위반이 떴고 그중 633개는 `dart fix --apply` 로 자동 수정. 정리 과정에서 **진짜 버그 1건** (`AppKits.install` 의 `_rollback` await 누락) 발견. 최종 0 이슈로 마무리.

## 왜 이런 고민이 시작됐나?

기본 `flutter_lints` 는 핵심 안전 룰 9개만 활성화돼 있어요. 이걸로는:

- 회피 가능한 잠재 버그 (제네릭 추론 실패, unawaited Future, 광범위 catch) 가 통과
- 파생 레포마다 다른 코딩 스타일 누적 위험
- "이 정도로 충분한가?" 의문이 매번 코드 리뷰에서 반복

압력들이 부딪혔어요.

**압력 A — 솔로의 의지력 한계**  
"룰을 머리로 알고 있어도 매번 지키기 어려움." 자동 강제가 필요.

**압력 B — 룰셋이 너무 빡빡할 때의 부작용**  
매 PR 마다 스타일 룰 위반이 뜨면 짜증 → 결국 자동 disable 또는 무시. 신호가 묻힘.

**압력 C — 파생 레포 N개에 전파**  
한 곳에서 결정한 룰이 모든 앱에 영향. 신중해야 함.

**압력 D — 라이브러리용 룰 vs 앱용 룰 혼재**  
`public_member_api_docs` 같은 룰은 패키지 개발자 대상. 앱 코드에는 노이즈.

이 결정이 답해야 했던 물음이에요.

> **솔로 인디 앱에 적합한 정적 분석 엄격도는 어디까지이며, 어떤 룰이 신호이고 어떤 룰이 노이즈인가?**

## 고민했던 대안들

### Option 1 — flutter_lints 유지 (기본 9 룰 + 커스텀 9 룰)

- **장점**: 변경 0. 기존 코드 무수정. 룰 위반 거의 없음.
- **단점**: 잠재 버그 통과. 룰 추가 시 매번 의식적 결정 필요 — 결국 누락.
- **탈락 이유**: "충분한가?" 의문이 해소 안 됨. 솔로 개발자가 "필요한 룰" 을 직접 큐레이션할 시간 없음.

### Option 2 — very_good_analysis 전부 활성

100+ 룰 모두 적용 후 1,367개 위반 모두 수정.

- **장점**: 라이브러리 수준 엄격함. 파생 레포가 자동으로 모범 코드.
- **단점 1**: 1,367 위반 중 620개 (45%) 가 `public_member_api_docs` — 앱 코드에 dartdoc 강제는 라이브러리 컨텍스트.
- **단점 2**: 80자 줄 제한 (`lines_longer_than_80_chars`) 은 Flutter Material API에 비현실적.
- **단점 3**: 매 PR 마다 스타일 룰 위반 가능성 → 솔로에게 짜증, 결국 무시 흐름.
- **탈락 이유**: 노이즈 비율이 너무 높음. 진짜 가치 룰이 가려짐.

### Option 3 — 다른 큐레이션 룰셋 (Google `lints`, `pedantic` 등)

- **장점**: 다른 옵션 존재.
- **단점**: 유지보수 책임이 본인. 매년 새 룰 등장 추적 필요.
- **탈락 이유**: VGV 가 Flutter 커뮤니티에서 사실상 표준 (Bloc 공식 템플릿 채택). 본인이 큐레이션할 ROI 없음.

### Option 4 (채택) — very_good_analysis + 컨텍스트 기반 disable

100+ 룰 베이스라인 + 솔로 앱에 과한 20개 룰 의식적 disable + 사유 yaml 주석에 명시.

- **장점 1**: VGV 큐레이션을 베이스로 활용 (커뮤니티 표준).
- **장점 2**: disable 결정 + 사유를 `analysis_options.yaml` 에 박아둠 → 미래의 본인이 "왜 이 룰 꺼져있지?" 답을 찾을 수 있음.
- **장점 3**: 자동 수정 가능한 위반 (633개) 은 `dart fix --apply` 로 일괄 처리.
- **단점**: 큐레이션 결정에 1회 시간 투입 (~2시간).

## 결정

### 채택된 룰셋 구조

```yaml
# analysis_options.yaml
include: package:very_good_analysis/analysis_options.yaml

linter:
  rules:
    # 기존 flutter_lints 명시 룰 유지 (very_good_analysis에 포함되지만 표현 명시)
    avoid_print: true
    prefer_single_quotes: true
    # ... (총 9개)

    # 솔로 앱 컨텍스트에 과한 룰 disable (사유는 yaml 주석)
    public_member_api_docs: false   # 라이브러리용 — 앱 코드 dartdoc 강제 불필요
    cascade_invocations: false      # `.foo().bar()` vs `..foo()..bar()` 취향
    avoid_returning_this: false     # fluent builder 비추 (취향)
    # ... (총 19개)
    lines_longer_than_80_chars: false  # Flutter Material API에 비현실적

analyzer:
  errors:
    # very_good_analysis가 warning으로 승격한 inference 경고 — solo ROI 낮음
    inference_failure_on_function_invocation: ignore
    inference_failure_on_instance_creation: ignore
```

### Disable 분류

| 분류 | 룰 예시 | 사유 |
|------|--------|------|
| 라이브러리 전용 | `public_member_api_docs` | 앱 코드는 dartdoc 강제 불필요 |
| 의도된 패턴 | `avoid_catches_without_on_clauses` | splash/storage 의 광범위 catch 는 의도적 |
| 거짓 양성 | `only_throw_errors` | `ApiException implements Exception` 인데 ternary 추론 한계로 fire |
| 비현실적 | `lines_longer_than_80_chars` | Material API 호출에 80자 제한 어려움 |
| 취향 | `cascade_invocations`, `avoid_returning_this` | 스타일 강제, ROI 낮음 |

### 도입 절차 (재현 가능)

1. `flutter pub add --dev very_good_analysis` (자동으로 호환 버전 해결)
2. `analysis_options.yaml` 의 `include:` 교체
3. `flutter analyze` 로 baseline 측정 (1,367 위반 확인)
4. `dart fix --apply` 로 자동 수정 (633 fix in 139 files)
5. 잔여 위반 카테고리별 분류 → disable 결정 (사유 yaml 주석)
6. 진짜 버그 (`argument_type_not_assignable` 9, `unawaited_futures` 4) 수동 수정
7. 검증: `flutter analyze` 0 이슈 + `flutter test` 397 통과

## 이 선택이 가져온 것

### 긍정

- **잠재 버그 1건 발견** — `AppKits.install` 의 `_rollback` await 누락 (line 53, 65). cleanup 비동기 작업이 throw 전 미완료될 수 있는 문제. 같은 함수 line 75 에는 이미 `await _rollback` 이 있어 일관성 회복.
- **타입 안전 강화** — Dio `response.data` 캐스트 9곳에 `as Map<String, dynamic>` 명시. 런타임 동작은 동일하지만 의도가 코드에 표현됨.
- **자동 강제** — pre-push hook + CI 모두 강한 룰셋 통과 필요. 의지력 의존 제거.
- **파생 레포 상속** — 모든 파생 레포가 동일 엄격도 자동 적용. 신규 앱이 자동으로 "큐레이션된 룰셋" 위에서 시작.

### 부정

- **diff 폭발 1회** — 142 파일 변경 (대부분 `dart fix --apply` 자동, import 정렬/생성자 위치 등). 머지 부담은 1회성.
- **disable 결정의 주관성** — 20개 룰 disable 사유가 본인 판단. 미래에 "다시 켜볼까?" 재검토 여지 있음 (예: 팀 합류 시 `public_member_api_docs` 재고).
- **신규 파생 레포 학습 곡선 ↑ 약간** — 100+ 룰 위반 시 메시지 해석 필요. 다만 큐레이션 덕분에 진짜 가치 룰만 fire.

## 교훈

### 교훈 1 — 노이즈 비율이 높아도 도입 ROI 있음

1,367 위반 중 진짜 가치 있는 케이스는 13개 (1%). 나머지 99% 는 자동 수정 가능한 스타일 또는 의도된 패턴. 처음엔 "노이즈에 묻혀 의미 없음" 으로 보였지만, 그 1% 가 **AppKits.install 의 cleanup 누락 같은 잠재 운영 사고** 를 잡아냄. 한 번 운영 사고 막은 가치가 도입 비용 (~2시간) 을 훨씬 상회.

**교훈**: 정적 분석 강화는 **신호 비율** 이 아닌 **신호의 절대량** 으로 판단해야 해요. 1% 라도 진짜 버그 13건이면 도입 가치 충분.

### 교훈 2 — 무조건 활성보다 의식적 큐레이션

처음엔 "100+ 룰 다 켜자, 엄격할수록 좋다" 로 시작. 실제 돌려보니 `public_member_api_docs` 하나가 620개 위반 — 라이브러리 컨텍스트 전용. 모두 켜면 진짜 신호가 노이즈에 묻혔음.

**교훈**: 베이스라인 큐레이션을 신뢰하되, **컨텍스트에 맞는 disable 결정** 이 신뢰 가능한 시스템을 만들어요. "엄격 = 좋음" 의 단순 매핑은 위험.

### 교훈 3 — 사유는 yaml 주석에 박아두기

`public_member_api_docs: false` 만 적으면 6개월 후 "왜 끈 거지?" 의문. yaml 주석에 한 줄 사유 (`# 라이브러리용 — 앱 코드 dartdoc 강제 불필요`) 박아두니 미래의 본인이 즉시 이해.

**교훈**: 설정 파일의 결정은 **그 자리에 사유** 를 적어두는 게 별도 doc 보다 효과적. doc 는 사람이 찾아가야 하지만, 주석은 그 결정 옆에서 자동으로 보임.

## 관련 사례 (Prior Art)

- **Very Good Ventures** — `very_good_analysis` 패키지 (Flutter 커뮤니티 사실상 표준급 강한 룰셋)
- **Bloc 공식 템플릿** — VGV 룰셋 채택
- **Google `lints` 패키지** — Dart 팀 공식이지만 더 가벼움 (이 ADR과 다른 선택지)
- **Airbnb JavaScript Style Guide** — "강한 룰 + 사유 주석" 패턴의 원형 (다른 생태계지만 사상 유사)

## Code References

- [`analysis_options.yaml`](https://github.com/storkspear/template-flutter/blob/main/analysis_options.yaml) — 룰셋 include + disable 사유 (yaml 주석)
- [`pubspec.yaml`](https://github.com/storkspear/template-flutter/blob/main/pubspec.yaml) — `very_good_analysis` dev_dependency
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/core/kits/app_kits.dart) — 발견된 버그 수정 (line 53, 65 `await _rollback`)
- [`lib/kits/backend_api_kit/api_client.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/backend_api_kit/api_client.dart) — 타입 캐스트 명시 (`as Map<String, dynamic>`)

**관련 ADR**:
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — "솔로 감당 가능" 기준의 상위 ADR. 이 ADR은 그 구체 사례.
- [`ADR-004 · YAML ↔ Dart 수동 동기화 + CI 검증`](./adr-004-manual-sync-ci-audit.md) — `configure_app.dart --audit` 와 함께 자동 강제의 두 축.

---

## 📖 책 목차 — Journey 6단계 (운영 & 배포)

[`Developer Journey`](../journey/README.md) 의 **6단계 — 운영** 보강. [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) 의 구체 사례 — "솔로가 감당 가능한 코드 품질 자동 강제는 어디까지?" 의 답.

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | [`ADR-021 · Multi-Recipe`](./adr-021-multi-recipe.md) | 동일 테마 (운영 & 배포) |
| → 다음 | (없음, 최신 ADR) | |
