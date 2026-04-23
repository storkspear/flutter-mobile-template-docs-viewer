# 도그푸딩 노트 — "짐로그" 앱 (2026-04-19)

> README 12단계 + recipe(local-only-tracker)를 따라 짐로그 앱을 실제로 만들면서 발견한 것들입니다.

## 짐로그 기획
- 컨셉: 솔로 운동인 — 매일 운동 세트(중량/횟수) 기록 + 주/월 볼륨 트렌드 차트
- 데이터: 로컬 전용 (백엔드 X)
- recipe: `local-only-tracker`
- 색상: seed `0xFFFF6B35` (오렌지)
- 활성 kit: local_db_kit, nav_shell_kit, charts_kit, observability_kit (4개)

## 단계별 결과

| 단계 | 결과 | 시간 | 주요 발견 |
|------|------|------|-----------|
| 1. rename-app.sh | ✅ 작동, 그러나 import 경로 미갱신 | 0.4s | **🚨 P0**: `package:app_template/` → `package:gymlog/` 일괄 치환 필요. 1115 errors → 0 |
| 2. AppPaletteRegistry 커스텀 | ✅ seed 1줄로 끝. 매우 간단 | 2분 | 좋음 |
| 3. AppConfig.init | ✅ termsUrl까지 주입 | 1분 | privacyUrl/termsUrl 호스팅 결정은 도메인 |
| 4. recipe 복사 + main.dart 동기화 + configure_app.dart | ⚠️ 부분 성공 | 5분 | **함정 2**: recipe가 app.name/slug 덮어씀 → 짐로그로 다시 수정 |
| 5. observability DSN | 스킵 (도그푸딩) | 0s | DSN 없으면 Debug 폴백 — 정상 작동 |
| 6~7. 키스토어/Play Console | dry-read만 | — | deployment-android.md 가이드 충실 |
| 8. FCM | 스킵 (짐로그 알림 미사용) | 0s | — |
| 9. 아이콘/스플래시 | 그대로 (placeholder) | 0s | — |
| 10. 권한 매트릭스 | 짐로그 활성 4개 모두 권한 X | 1분 | 매트릭스 정확 |
| 11. 도메인 코드 (Drift + 3화면) | ✅ 완성, 함정 다수 | 40분 | 함정 3~9 (NavTab.builder, Drift Set 충돌 등) |
| 12. 배포 | 시뮬레이션만 | — | release-android.yml 흐름 명확 |

---

## 🚨 발견된 함정 TOP 9 (가장 영향 큰 순)

### 1. rename-app.sh가 import 경로 안 바꿈 (P0)
- 증상: `flutter analyze` → 1115 errors (전부 `package:app_template/...` 미존재)
- 해결: `find lib test -name "*.dart" -exec sed -i '' "s|package:app_template/|package:gymlog/|g" {} +`
- **개선 후보**: rename-app.sh 자체에 통합

### 2. recipe 복사 시 app.name/slug 덮어씀
- 증상: `cp recipes/local-only-tracker.yaml app_kits.yaml` → app.name이 "My Tracker"로 변경됩니다
- 해결: 복사 후 짐로그로 다시 수정합니다
- **개선 후보**: rename-app.sh를 recipe 적용 후에 실행하도록 README 순서 변경, 또는 recipe에 placeholder 마커 (`{{APP_NAME}}`)

### 3. NavTab은 `screen`이 아니라 `builder`
- 증상: 컴파일 에러 "named parameter 'screen' isn't defined"
- 해결: `NavTab(builder: (_, __) => const TodayScreen(), ...)`
- **개선 후보**: NavTab에 short alias `screen` 추가 또는 가이드 명시

### 4. OnboardingKit()은 `prefs/steps` 필수
- 증상: 컴파일 에러 "missing required argument: 'prefs', 'steps'"
- 해결: 짐로그처럼 사용하지 않을 거면 install에서 제거합니다
- 별도 가이드가 충분히 있습니다 (`onboarding_kit/README.md`)

### 5. EmptyView 본문 파라미터는 `message`가 아니라 `subtitle`
- 증상: 컴파일 에러 "named parameter 'message' isn't defined"
- 해결: `EmptyView(title:, subtitle:, icon: ...)` 시그니처 확인 (icon은 기본값 `AppIcons.folder` 있음)
- 정정: 처음 노트에 "icon X"라고 잘못 적혔습니다 — 실제로는 icon 파라미터가 존재합니다

### 6. configure_app.dart는 main.dart 동기화 검증 X
- 증상: yaml에 observability_kit이 빠져있어도 main.dart에서 install되어 있으면 Status: OK
- 해결: 사람이 마지막에 yaml ↔ main.dart 비교합니다
- **이미 알려진 한계** — kits.md에 명시됩니다

### 7. Drift `Set` 테이블이 dart:core `Set<T>`와 충돌
- 증상: `Xcode build` 에러 "Expected 0 type arguments" (`Set` 클래스 충돌)
- 해결: `@DataClassName('WorkoutSet')` 어노테이션
- **개선 후보**: local_db_kit/README.md에 일반 충돌 케이스 (Set, List, Map) 미리 안내

### 8. features/home, features/settings 기존 스텁이 인증 흐름용
- 짐로그 같은 로컬 앱은 자체 SettingsScreen을 작성해야 합니다 (기존 settings_screen은 로그아웃/탈퇴 등 인증 메뉴 위주)
- features/home은 NavShellKit을 사용하면 자동 우회되어 OK입니다

### 9. .g.dart 빌드 산출물
- `lib/database/app_database.g.dart`는 codegen 결과입니다
- `.gitignore`에 `*.g.dart` 등록을 권장합니다 (현재 템플릿은 그렇게 되어 있는지 확인 필요)

---

## 시간 분석

| 작업 | 실제 시간 |
|------|-----------|
| 1~5단계 (초기 설정) | ~10분 |
| 11단계 도메인 코드 (스키마 + 3화면) | ~40분 |
| 함정 디버깅 (1, 2, 3, 5, 7) | ~20분 |
| analyze/test/codegen 반복 | ~10분 |
| **총** | **~80분** |

함정 5개를 만나면서 약 20분이 추가로 소요됩니다. 가이드에 미리 명시되어 있다면 절약 가능합니다.

---

## 강점

✅ recipe 복사 → 빠른 시작 (정확히 의도한 kit set)
✅ AppPalette 1줄로 전체 테마 변경 (Material 3 magic)
✅ Drift + StreamBuilder 조합 — 자동 리빌드, ViewModel 없이도 깔끔합니다
✅ AppDialog/EmptyView/PrimaryButton 등 공통 위젯 — 디자인 일관성 자동
✅ ReviewTrigger.signal('event') 한 줄로 정책 적용
✅ 397/397 tests 그대로 통과 (template kit 테스트가 짐로그에서도 회귀 가드 역할)
✅ 다크모드 자동 (별도 작업 0)

## 약점

❌ rename → recipe → import 일괄 치환 흐름이 README에 미명시 (가장 큰 시간 손실)
❌ Drift 테이블 명명 충돌 가이드 부재 (이번이 첫 발견)
❌ 빌드 산출물 .gitignore 정책 명시 미확인
⚠️ NavTab/OnboardingKit/EmptyView 시그니처 헷갈림 (각 README를 보면 OK, 하지만 자주 보게 됩니다)

---

## 추가 보강 후보 (템플릿)

1. **rename-app.sh에 import 일괄 치환 추가** (P0) — 5줄 추가로 큰 효과
2. **recipe placeholder 마커** — `app.name: {{APP_NAME}}`로 변경 후 rename-app.sh가 치환
3. **local_db_kit/README에 명명 충돌 섹션** — Set/List/Map 등
4. **튜토리얼 (이 가이드)** — 본 저장소에 `docs/tutorials/build-gymlog.md`로 보존

---

## 최종 평가

- **기능 완성도**: 9.5/10 (recipe + Kit + 공통 위젯이 정확히 의도대로 작동합니다)
- **첫 사용 친화도**: 7.5/10 (함정 9개 — 가이드만 보강하면 9.0 가능합니다)
- **출시까지 시간**: 짐로그 같은 단순 앱 = **2시간 코드 + 1~2일 외부 의존 작업** (호스팅/스토어 등록)
- **재사용성**: 매우 높습니다 — 다음 앱은 본 가이드를 따라가면 함정을 회피하며 1시간 내 시작 가능합니다

총평: **템플릿 자체는 매우 견고합니다**. 가이드 보강 (P0 1건 + 튜토리얼 추가)이 가장 큰 ROI입니다.
