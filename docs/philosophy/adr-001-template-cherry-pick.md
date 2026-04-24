# ADR-001 · GitHub Template Repository 패턴 + cherry-pick 전파

**Status**: Accepted. 현재 유효. 2026-04-24 기준 레포가 GitHub Template Repository 로 표시됨. 파생 레포와의 공통 코드 동기화는 수동 cherry-pick.

## 결론부터

이 레포는 **fork 가 아닌 GitHub "Use this template" 버튼** 으로 복제돼요. 파생 레포는 부모 레포와 git 히스토리가 끊어진 **독립 레포** 가 되고, 이후 템플릿에 추가되는 공통 코드는 **자동 전파가 아니라 수동 cherry-pick** 으로 가져와요. 자동 동기화가 아닌 이유는 **"파생 레포마다 도메인 코드가 이미 크게 달라져 있어서 merge 가 오히려 위험"** 이기 때문이에요.

## 왜 이런 고민이 시작됐나?

솔로 개발자가 여러 Flutter 앱을 빠른 주기로 출시하려면 **공통 코드 (테마 · 인증 · 네트워크 · 관측성)** 는 반드시 한 번만 잘 만들고 재사용해야 해요 (프롤로그 제약 2). 이때 "공통 코드 저장소" 와 "앱별 개별 레포" 의 관계를 어떻게 맺을지가 첫 질문이에요.

두 방향의 힘이 부딪혀요.

**힘 A — 공통 코드 진화**  
템플릿에 "더 나은 `ApiClient` 인터셉터" 가 추가되면 이미 만든 앱 A · B · C 에도 그 개선을 가져오고 싶어요. 안 그러면 옛 버전이 박제돼요.

**힘 B — 파생 레포의 고유성 보존**  
앱 A 는 이미 도메인 코드 (화면 · ViewModel · 모델) 가 수천 줄 쌓여 있어요. 템플릿 변경을 자동 merge 하면 도메인 코드의 구조나 테스트를 망가뜨릴 수 있어요. 예: 템플릿이 `LoginViewModel` 의 `state` 필드 이름을 바꾸는데 파생 레포에서 이미 그 필드를 직접 수정해서 쓰는 경우.

두 힘 모두 진심이지만, 동시에 만족하긴 어려워요. 완전 자동 merge 는 B 를 깨고, 완전 독립은 A 를 포기해요. 이 결정이 답해야 했던 물음이에요.

> **공통 코드는 진화시키되, 파생 레포의 도메인 코드는 해치지 않는 전파 방식** 은 무엇인가?

## 고민했던 대안들

### Option 1 — Monorepo (공통 + 앱들이 한 레포)

`apps/app-a/`, `apps/app-b/`, `packages/common/` 같은 monorepo 구조.

- **장점**: 공통 코드 변경이 모든 앱에 즉시 반영. atomic commit 으로 API 변경 + 호출부 수정이 한 번에.
- **단점 1**: 앱 하나 출시할 때마다 전체 레포 CI 가 돌아감 → 빌드 시간 누적.
- **단점 2**: 앱 저장소가 거대해지면 `git clone` 이 느려짐. 신규 기기 셋업 비용.
- **단점 3**: "한 앱만 파괴적으로 실험" 이 어려워짐 — 전체 빌드가 깨지니까.
- **탈락 이유**: 솔로 운영에서 앱이 N 개 늘어날 때 repo 규모가 지수적으로 증가. 제약 1 위반.

### Option 2 — Git fork + upstream pull

템플릿을 한 번 fork → 앱 레포. 이후 `git remote add upstream ...` + `git pull upstream main` 으로 공통 변경 흡수.

- **장점**: git 표준 워크플로우. GitHub 가 "N commits behind upstream" 표시로 상태 시각화.
- **단점 1**: **fork 는 부모 네트워크 레포** 로 관리됨. 검색 · starring · 브랜드 식별에서 "storkspear/flutter-mobile-template 의 포크" 로 계속 보여요. 독립 브랜드가 아님.
- **단점 2**: `pull` 이 **full merge** 를 의도 — 파생 레포의 도메인 코드와 충돌이 나면 conflict 해결 비용. 앱이 오래 될수록 conflict 가 커져요.
- **단점 3**: fork 는 **공개 템플릿 레포에서만 가능** — 조직 내 사설 템플릿에는 쓰기 복잡.
- **탈락 이유**: 힘 B (고유성 보존) 가 깨져요. 자동화가 오히려 위험해요.

### Option 3 — GitHub Template Repository + cherry-pick ★ (채택)

템플릿 레포를 GitHub Template 으로 표시 → "Use this template" 버튼으로 **히스토리가 끊긴 독립 레포** 생성. 이후 공통 변경은 **수동 cherry-pick** 으로 필요한 것만 가져옴.

- **힘 A 만족**: 템플릿이 진화하면 각 파생 레포가 필요한 변경만 선별해서 가져옴. 최근 개선 확인 가능 (` git log <template-remote>/main`).
- **힘 B 만족**: 자동 merge 가 없으니 도메인 코드와의 충돌이 원천 차단. cherry-pick 시 **명시적으로** 도입 여부 결정.
- **추가 이점**: 파생 레포가 **완전 독립 브랜드** 로 보임. GitHub 검색 · README 에서 "xxx 의 포크" 로 표시되지 않음.

## 결정

### 1. 레포 수준

- `flutter-mobile-template` 은 **GitHub Template Repository 로 표시**. Settings → General → "Template repository" 체크.
- "Use this template → Create a new repository" 로 파생 레포 생성. 자동으로 히스토리 없는 single commit 으로 시작.

### 2. 초기 커스터마이징

파생 레포 클론 직후 아래 스크립트로 앱 정체성을 일괄 변경.

```bash
./scripts/rename-app.sh <slug> com.<org>.<slug>
```

이 스크립트가 바꾸는 곳:
- `pubspec.yaml` 의 `name:`
- `android/app/build.gradle.kts` 의 `applicationId`
- `ios/Runner/Info.plist` 의 `CFBundleIdentifier`
- Kotlin · Swift 파일의 패키지 선언

### 3. 템플릿 → 파생 전파 (cherry-pick)

파생 레포에서 템플릿 원본을 remote 로 등록하고 필요한 커밋만 집어 옴.

```bash
# 최초 1회
git remote add template https://github.com/storkspear/flutter-mobile-template.git
git fetch template

# 템플릿에서 뭐가 바뀌었는지 확인
git log template/main --oneline --not main

# 특정 커밋만 가져오기
git cherry-pick <SHA>

# 범위로 가져오기 (충돌 시 수동 해결)
git cherry-pick A..B
```

Conflict 가 나면 도메인 코드 보존이 우선. 이미 파생 레포가 해당 파일을 크게 수정했다면 cherry-pick 을 **포기** 하는 것도 정당한 선택이에요.

### 4. 템플릿 레포에 커밋할 때 지켜야 할 절대 금지

- 특정 앱 · 도메인 · 회사 이름을 코드 · 문서에 박지 않음 (`gymlog`, `sumtally`, `com.twosun` 같은 실명)
- 실제 Bundle ID · Firebase project ID · Sentry DSN 을 커밋하지 않음
- 비즈니스 로직은 `lib/features/` 에 스텁만 — 실제 도메인은 파생 레포 몫
- 운영 환경 파일 (`.env`, `.env.prod`) 커밋 금지 — 운영 값은 파생 레포의 GitHub Secrets 만

## 이 선택이 가져온 것

### 긍정적 결과

- **파생 레포 독립성 완벽**: GitHub 에서 보면 그냥 독립 레포. `xxx of storkspear/flutter-mobile-template` 표시 없음.
- **도메인 코드 안전**: 템플릿 변경이 의도치 않게 파생 레포를 깨뜨릴 일 없음. cherry-pick 을 거부할 권한이 개발자에게 있음.
- **선택 전파**: "이 인터셉터 개선만 필요하고, 저 라우팅 리팩터는 안 함" 같은 세밀한 제어 가능.
- **템플릿 자체의 실험 자유도**: 템플릿에서 파괴적 변경 (예: AppKit 인터페이스 개편) 을 해도 파생 레포가 자동 영향받지 않음.

### 부정적 결과

- **수동 전파 피로**: 여러 앱을 운영할수록 "이 커밋 가져왔나?" 추적 부담 누적. ADR-019 (솔로 친화적 운영) 와 긴장 관계.
- **cherry-pick 충돌 해결 스킬 필요**: `git rerere` 활용 · 3-way merge 이해 등 어느 정도 git 숙련도 요구.
- **"오래된 파생 레포" 문제**: 1년 방치한 앱이 갑자기 업데이트 필요할 때 템플릿과 gap 이 너무 커서 cherry-pick 이 현실적이지 않을 수 있음. 이땐 수동 리팩터가 답.
- **자동화된 "sync PR" 도구 없음**: Dependabot 같이 자동 PR 만드는 봇이 cherry-pick 을 위해 쓰이진 않음. 개발자가 주기적으로 수동 확인.

## 교훈

### 교훈 1 — "자동화된 synchronization" 이 항상 이득은 아니다

처음엔 `git subtree` 나 `git submodule` 같은 도구로 템플릿을 파생 레포에 "묶어두는" 방식도 검토했어요. 하지만 두 구조 모두 **템플릿 변경이 자동으로 파생 레포에 개입** 하는 성격이라, 도메인 코드와 충돌 시 대응이 복잡해졌어요.

**교훈**: 자동화는 편리하지만 **자율성을 줄여요**. 독립 레포 + 수동 cherry-pick 의 "개입 비용 낮지만 자율성 높은" 구조가 솔로 운영에 더 적합해요.

### 교훈 2 — "공통 코드 vs 도메인 코드" 경계는 시간과 함께 옮겨간다

초기엔 `ApiClient` 가 100% 공통 코드였는데, 앱 A 가 특수한 retry 로직을 추가하면서 "공통이면서도 앱별 패치가 있는" 상태가 돼요. 이런 케이스는 cherry-pick 으로도 처리 어려움 — 차라리 템플릿에 확장 포인트를 추가하는 식으로 풀어야 해요.

**교훈**: cherry-pick 이 지속 가능하려면 **공통 코드의 인터페이스가 확장 가능** 해야 해요. 변경 가능한 ViewModel 이 아니라 **설정 가능한 Service** 를 만드는 게 핵심.

### 교훈 3 — 템플릿 순수성 규칙은 자동 검증으로

"gymlog · sumtally · com.twosun 같은 실명을 템플릿에 커밋 금지" 는 사람 기억에만 의존하면 깨져요. pre-commit hook 이나 CI 에서 **이름 블랙리스트 grep** 을 자동으로 돌려야 일관성 유지 가능.

**교훈**: 규칙은 사람 의지로 유지되지 않아요. 기계가 강제해야 해요.

## 관련 사례 (Prior Art)

- [GitHub Template Repositories 공식 문서](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository) — 본 ADR 의 기반 기능
- [`spring-backend-template 의 ADR-002`](https://github.com/storkspear/spring-backend-template/blob/main/docs/journey/philosophy/adr-002-use-this-template.md) — 짝이 되는 백엔드 템플릿의 같은 결정. 프롤로그 제약 공유
- [Create React App · Next.js 의 `create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) — 템플릿 복제 + 초기 이름 설정 패턴
- [cookiecutter (Python)](https://cookiecutter.readthedocs.io/) — 템플릿 변수 치환 기반 프로젝트 생성기
- [Git rerere](https://git-scm.com/book/en/v2/Git-Tools-Rerere) — 반복되는 cherry-pick conflict 자동 해결

## Code References

**템플릿 유지 규칙**
- [`README.md`](https://github.com/storkspear/flutter-mobile-template/blob/main/README.md) — "Use this template" 안내 + 빠른 시작 12단계
- [`CLAUDE.md`](https://github.com/storkspear/flutter-mobile-template/blob/main/CLAUDE.md) — 절대 룰: 직접 개발 금지 · "파생 레포" 용어 · 순수성 규칙
- [`scripts/rename-app.sh`](https://github.com/storkspear/flutter-mobile-template/blob/main/scripts/rename-app.sh) — 앱 정체성 일괄 치환
- [`scripts/setup.sh`](https://github.com/storkspear/flutter-mobile-template/blob/main/scripts/setup.sh) — git hooks 활성화

**짝이 되는 백엔드 템플릿**
- [`Spring Backend — Cross-repo Cherry-pick`](https://github.com/storkspear/spring-backend-template/blob/main/docs/journey/cross-repo-cherry-pick.md) — 같은 전파 원칙 상세. 이 ADR 의 실전 가이드로 재사용 가능

**관련 ADR**:
- [`ADR-002 · 3계층 모듈 구조`](./adr-002-layered-modules.md) — 템플릿에 뭐를 둘지 / 파생 레포에 뭐를 둘지 경계
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — 수동 cherry-pick 의 "솔로 감당 가능" 판정
- [`ADR-021 · Multi-Recipe 구성`](./adr-021-multi-recipe.md) — 파생 레포가 어떤 Kit 조합으로 시작할지 선택
