# ADR-021 · Multi-Recipe 구성 (local-only / local-notifier / backend-auth)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `recipes/` 폴더에 3개 YAML 파일 (`local-only-tracker.yaml` · `local-notifier-app.yaml` · `backend-auth-app.yaml`). 파생 레포가 복사 → `app_kits.yaml` 로 덮어쓰기.

## 결론부터

이 템플릿은 **하나의 Flutter 프로젝트로 세 가지 유형의 앱** 을 만들 수 있게 설계됐어요 — 완전 로컬 앱 · 로컬 알림 앱 · 백엔드 연동 앱. 각 유형은 **활성화하는 Kit 조합이 다름**. `recipes/*.yaml` 가 이 조합을 선언적으로 제공 → 파생 레포가 원하는 recipe 를 복사 → `app_kits.yaml` 로 사용. Kit 조합 외엔 모두 공통이라 templ 유지 비용이 단일.

## 왜 이런 고민이 시작됐나?

인디 앱 공장에서 만들 앱들은 **유형이 다양** 해요. 과거에 만든 (혹은 만들고 싶은) 앱 예시:

- **습관 트래커** — 완전 로컬. 서버 · 로그인 없음. 로컬 DB + 온보딩 + 차트
- **명상 타이머** — 로컬. 알림 · 백그라운드 · 광고 필요. 차트
- **가계부** — 백엔드 연동. 로그인 · 동기화 · 푸시 알림. 차트
- **SNS 초 마이크로** — 백엔드 + 인증. 실시간 기능 없음. 이미지 업로드
- **회의록 앱** — 로컬 DB + 백엔드 백업. 인증 옵션

"template 을 하나로 유지하면서 이 모든 유형을 포괄" 이 목표. 압력들이 부딪혀요.

**압력 A — 유형별 초기 조립의 반복성**  
로컬 앱 만들 때마다 "DB Kit 켜고 · 알림 Kit 끄고 · Auth Kit 끄고..." 같은 **반복 작업**. 신입이 30분씩 소모.

**압력 B — 유형 간 조합 실수**  
"로컬 앱인데 실수로 `AuthKit` 켠 상태" 같은 실수 → 로그인 화면 표시 + `/login` 경로 노출 → 이상한 UX.

**압력 C — template 단일성 유지**  
"local 용 template, backend 용 template" 을 **분리하면** 개선 전파 비용 2배. 하나의 template 으로 포괄해야 제약 2 (시간) 만족.

**압력 D — recipe 도 과투자 가능성**  
recipe 를 너무 세분화 (예: "local + 차트 없음" · "local + 차트 있음" · "local + DB 1개" · "local + DB 2개") 하면 **recipe 간 drift** 관리 부담.

이 결정이 답해야 했던 물음이에요.

> **template 하나로 다양한 앱 유형을 지원하되, 각 유형의 초기 셋업 비용을 0 에 가깝게 하는** 구조는?

## 고민했던 대안들

### Option 1 — 유형별 template 분리

`flutter-local-template` · `flutter-backend-template` · `flutter-notifier-template` 로 3개 repo.

- **장점**: 각 template 이 자기 유형에 최적. 불필요한 코드 없음.
- **단점 1**: **공통 코드 변경 시 3번 cherry-pick** — cherry-pick 전파 비용 3배.
- **단점 2**: template repo 3개 유지. 각각 CI · README · 버전 관리.
- **단점 3**: 4번째 유형 생기면 또 template 추가. 무한 확장.
- **탈락 이유**: 제약 2 · 압력 C 위반.

### Option 2 — 단일 template, 모든 Kit 항상 활성

Kit 조립 개념 포기. 모든 기능이 기본 포함. 안 쓰는 건 그냥 UI 에 노출 안 함.

- **장점**: 결정 피로 0. 그냥 만들면 됨.
- **단점 1**: 로컬 전용 앱에 `AuthKit` 코드가 포함 → 바이너리 크기 증가 + SDK 불필요 포함 (Apple Sign In · Google Sign In 등).
- **단점 2**: 스토어 리뷰에서 "왜 로컬 앱인데 Apple Sign In 권한?" 같은 지적 가능.
- **단점 3**: `app_kits.yaml` 의 의도 (선택 조립) 가 무의미.
- **탈락 이유**: 압력 A 의 "반복 작업" 을 해결하지만 바이너리 · 권한 낭비.

### Option 3 — Single template + 3 recipes ★ (채택)

Template 하나. `recipes/` 에 **대표 유형별 `app_kits.yaml` 샘플**. 파생 레포가 recipe 하나 골라 복사 → 필요 시 커스터마이징.

- **압력 A 만족**: recipe 복사 한 줄로 초기 조립 끝. 세부 조정은 원하는 사람만.
- **압력 B 만족**: recipe 가 **검증된 조합** → 일반적 실수 차단.
- **압력 C 만족**: template 하나. 공통 코드 개선이 모든 유형에 반영.
- **압력 D 대응**: recipe 를 **3개 정도로 제한**. 세분화하지 않음. 세부 조정은 파생 레포 몫.

## 결정

### 3개 Recipe

#### 1. local-only-tracker (완전 로컬)

```yaml
# recipes/local-only-tracker.yaml 전체
# 완전 로컬 앱 — 인증·백엔드 없음, Drift + 온보딩 + 차트.
# update_kit 생략: 완전 로컬 앱 의도.
app:
  name: My Tracker
  slug: my_tracker
  environment: prod
  palette_class: DefaultPalette

kits:
  local_db_kit:
    database_class: AppDatabase
    database_file: lib/database/app_database.dart
  onboarding_kit: {}
  nav_shell_kit: {}
  charts_kit: {}
```

**대상**: 습관 · 운동 · 가계부 (로컬) · 학습 트래커 등  
**활성 Kit**: 4개 (DB · 온보딩 · 탭 셸 · 차트)  
**비활성**: 인증 · 네트워크 · 알림 · 광고 (아무것도 안 띄워도 됨)

#### 2. local-notifier-app (로컬 알림)

```yaml
# recipes/local-notifier-app.yaml 전체
# 로컬 알림 중심 앱 — 인증 없음, DB + 알림 + 백그라운드 + 차트 + 광고.
app:
  name: Notifier App
  slug: notifier_app
  environment: prod
  palette_class: DefaultPalette

kits:
  local_db_kit:
    database_class: AppDatabase
    database_file: lib/database/app_database.dart
  notifications_kit: {}
  background_kit: {}
  charts_kit: {}
  update_kit: {}
  ads_kit: {}
  permissions_kit: {}
  device_info_kit: {}
  nav_shell_kit: {}
```

**대상**: 알람 · 명상 타이머 · 타이머 기반 앱  
**활성 Kit**: 9개  
**특징**: AdMob · ATT · UMP 자동 처리 (ads_kit)

#### 3. backend-auth-app (백엔드 연동)

```yaml
# recipes/backend-auth-app.yaml 전체
# 백엔드 API + JWT 인증 앱.
app:
  name: Authed App
  slug: authed_app
  environment: prod
  palette_class: DefaultPalette

kits:
  backend_api_kit: {}
  auth_kit: {}
  notifications_kit: {}
  device_info_kit: {}
  update_kit: {}
```

**대상**: SNS · 협업 도구 · 대시보드 · 메신저 등  
**활성 Kit**: 5개  
**특징**: `spring-backend-template` 쌍 운영 전제

### 파생 레포의 사용

```bash
# 1. Use this template → 파생 레포 클론
git clone ...

# 2. 원하는 recipe 복사 (선택)
cp recipes/backend-auth-app.yaml app_kits.yaml

# 3. 편집 (선택적 Kit 추가/제거)
vi app_kits.yaml

# 4. main.dart 에 맞춰 AppKits.install 수정
vi lib/main.dart

# 5. 검증
dart run tool/configure_app.dart

# 6. 앱 정체성 설정
./scripts/rename-app.sh my_app com.my.app

# 7. 실행
flutter run
```

### Recipe 의 결정 가이드

| 조건 | recipe |
|------|--------|
| 서버 없이 돌아갈 수 있음 | `local-only-tracker` |
| 서버 없고 알림 / 타이머 중심 | `local-notifier-app` |
| 서버 있고 로그인 필요 | `backend-auth-app` |
| 위 어느 것도 아님 | 3개 중 가까운 것 복사 후 커스터마이징 |

### Recipe 조합이 아닌 경우

**유형 간 혼합** (예: "로컬 + 서버 백업 옵션" 앱) 은 3개 recipe 어느 것과도 정확히 안 맞음. 이때:

1. **가장 가까운 recipe 복사**
2. **Kit 개별 추가** (예: `local-only-tracker.yaml` 복사 후 `backend_api_kit` 추가)
3. `configure_app.dart` 로 정합성 검증

Recipe 는 **"시작점"** 일 뿐. 파생 레포가 자유롭게 조정.

### 설계 선택 포인트

**포인트 1 — recipe 를 3개로 제한**  
가능한 조합은 수백 가지. 하지만 **대표 3개** 로만 제공. 세분화하면 recipe 간 drift 관리 부담 (ADR-004 참조). 3개가 "대부분 유형 커버 + 관리 가능" 의 균형.

**포인트 2 — recipe 주석으로 의도 · 특이사항**  
YAML 파일 상단에 "이건 로컬 전용" · "ads_kit 활성 시 ATT 자동 노출" 같은 주석. 복사한 사람이 "왜 이 Kit 이 켜져?" 바로 이해.

**포인트 3 — `app.slug` · `app.name` 은 placeholder**  
recipe 의 `slug: my_tracker` 는 그대로 쓰지 말고 파생 레포의 본인 slug 로 교체. `rename-app.sh` 가 자동 변환.

**포인트 4 — recipe 와 `app_kits.yaml` 의 포맷 동일**  
recipe 는 단지 **샘플 `app_kits.yaml`**. 별도 포맷 아님. 복사 = 그대로 쓰기.

**포인트 5 — Kit 파라미터 (local_db_kit 의 database_class 등)**  
YAML 의 Kit 선언에 파라미터 넣을 수 있음 (`local_db_kit: { database_class: AppDatabase }`). 하지만 **실제 실행은 `main.dart` 의 생성자** 라 YAML 파라미터는 문서화 수준. ADR-004 참조.

**포인트 6 — 파생 레포마다 `recipes/` 폴더 유지 여부 선택**  
복사 후 `recipes/` 삭제 가능 (필요 없음). 또는 유지하고 "다른 recipe 로 실험용" 으로 보관.

## 이 선택이 가져온 것

### 긍정적 결과

- **신규 앱 시작 1분**: recipe 복사 + rename-app.sh + `flutter run`. 이전엔 30분.
- **template 단일성**: 공통 코드 개선이 모든 recipe 에 자동 반영.
- **유형별 최적화**: 로컬 앱은 Apple Sign In SDK 포함 안 함 (tree-shaking). 바이너리 경량.
- **실수 방지**: recipe 가 검증된 조합이라 "auth 켜고 backend 끔" 같은 모순 실수 줄어듦.
- **확장 자유**: recipe 기반으로 시작 + 필요한 Kit 추가. 제한 없음.
- **주석으로 의도 전달**: 파일 상단 주석이 복사 후에도 남아있어 유지보수 쉬움.

### 부정적 결과

- **정확히 맞는 recipe 없는 경우**: "로컬 + 서버 옵션" 같은 혼합은 3개 중 정확한 선택 안 됨. 커스터마이징 필요.
- **recipe 유지 부담**: 새 Kit 추가 시 3개 recipe 중 관련된 것에 반영 필요. 예: `feature_flag_kit` 추가 시 backend-auth-app 에 포함?
- **YAML 파라미터의 제한**: YAML 엔 `database_class: AppDatabase` 같은 단순 값만. Dart 객체 (e.g., `update_kit` 의 `service: NoUpdateAppUpdateService()`) 는 `main.dart` 에서만. 두 곳 수동 동기화 피로 (ADR-004).
- **신규 유형 발견 시 recipe 추가?**: 4번째 유형 필요하면 recipe 추가 고민. 현재 3개로 제한이지만 성장 시 조정.

## 교훈

### 교훈 1 — "대표 3개" 가 관리의 한계점

recipe 를 2개로 줄이면 유형 커버 부족. 5개로 늘리면 drift 관리 부담. **3개** 가 경험상 sweet spot.

**교훈**: 샘플 제공은 **3개 정도가 관리 가능 상한**. 세분화 욕구가 생기면 "파생 레포 커스터마이징" 으로 해결.

### 교훈 2 — recipe 는 "시작점" 이지 "완제품" 아님

초기엔 recipe 를 "이거 쓰면 끝" 으로 생각. 실제론 파생 레포마다 조금씩 커스터마이징 필요. recipe 의 가치는 **"첫 30분 절약"** 이지 "완벽 일치" 가 아님.

**교훈**: 샘플 · recipe 는 **90% 커버** 를 목표. 10% 커스터마이징은 파생 레포 몫. 100% 추구는 recipe 수 폭발.

### 교훈 3 — Recipe 주석의 가치

`# ads_kit 활성 시 ATT 자동 노출됨` 같은 주석 한 줄이 신규 개발자의 혼란 방지. YAML 은 간결하지만 **숨은 의도** 가 많아서 주석이 코드보다 가치 클 때 있음.

**교훈**: YAML · JSON 같은 선언적 파일엔 **주석으로 맥락** 을 담으세요. 코드 가독성과 다른 관점의 문서화.

## 관련 사례 (Prior Art)

- [Next.js `create-next-app` templates](https://nextjs.org/docs/app/api-reference/cli/create-next-app) — 초기 시작 유형 여러 개 제공
- [Vite templates](https://vite.dev/guide/#scaffolding-your-first-vite-project) — `vue / react / svelte / vanilla` 조합
- [Ruby on Rails `-T -d postgresql` 옵션](https://guides.rubyonrails.org/command_line.html#rails-new) — 프로젝트 생성 시 옵션
- [cookiecutter recipes](https://github.com/cookiecutter/cookiecutter) — 파이썬 프로젝트 템플릿
- [Spring Initializr](https://start.spring.io/) — Spring 프로젝트 시작점 생성기

## Code References

**Recipe 파일**
- [`recipes/local-only-tracker.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/local-only-tracker.yaml) — 완전 로컬
- [`recipes/local-notifier-app.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/local-notifier-app.yaml) — 로컬 알림
- [`recipes/backend-auth-app.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/recipes/backend-auth-app.yaml) — 백엔드 연동

**파생 레포 대상 파일**
- [`app_kits.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/app_kits.yaml) — 파생 레포가 recipe 복사해 덮어쓰기
- [`lib/main.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/main.dart) — YAML 과 동기화해야 할 실제 코드

**검증 · 도구**
- [`tool/configure_app.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/tool/configure_app.dart) — YAML ↔ Dart 정합성
- [`scripts/rename-app.sh`](https://github.com/storkspear/flutter-mobile-template/blob/main/scripts/rename-app.sh) — recipe 의 placeholder slug 교체

**관련 ADR**:
- [`ADR-003 · FeatureKit 동적 레지스트리`](./adr-003-featurekit-registry.md) — Recipe 가 동작하는 기반
- [`ADR-004 · YAML ↔ Dart 수동 동기화`](./adr-004-manual-sync-ci-audit.md) — Recipe 적용 후 main.dart 조정 필요
- [`ADR-001 · GitHub Template + cherry-pick`](./adr-001-template-cherry-pick.md) — 파생 레포 생성 맥락
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — "3개 recipe 로 제한" 의 근거
