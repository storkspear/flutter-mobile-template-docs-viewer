# ADR-018 · Kit 별 라우팅 우선순위 (`redirectPriority`)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `lib/core/kits/app_kit.dart` 의 `redirectPriority` + `lib/core/kits/app_kits.dart` 의 안정 정렬 + `lib/common/router/app_router.dart` 의 합성 로직.

## 결론부터

여러 Kit 이 라우팅 게이트 (리다이렉트 규칙) 를 가질 때, **낮은 숫자일수록 먼저 실행** 하는 `redirectPriority` 정수로 순서 표현. 권장 기본값: `UpdateKit=1` · `AuthKit=10` · `OnboardingKit=50` · 기본 `100`. 동일 우선순위는 **install 순서로 안정 정렬**. 각 규칙은 `null` 반환 시 개입 안 함 — 첫 non-null 결과가 최종 리다이렉트.

## 왜 이런 고민이 시작됐나?

여러 Kit 이 각자 라우팅 개입을 원해요.

- **UpdateKit**: "필수 업데이트 버전 미만이면 스토어로 강제 이동"
- **AuthKit**: "미인증 상태면 `/login`, 인증됐는데 `/login` 접근 시 `/home`"
- **OnboardingKit**: "온보딩 미완료면 온보딩 플로우"

이게 **동시에 발동** 하면 혼란이에요.

- 미인증 + 업데이트 필요 → 로그인 먼저? 업데이트 먼저?
- 온보딩 미완료 + 미인증 → 온보딩 먼저 할지, 로그인 먼저 할지

압력들이 부딪혀요.

**압력 A — 순서의 명확성**  
"뭐가 먼저?" 를 **코드로 명시** 해야 해요. 암묵적 가정 (install 순서 = 실행 순서) 은 버그 유발.

**압력 B — Kit 독립성 (순환 참조 금지)**  
`AuthKit` 이 `UpdateKit` 의 존재를 알면 안 돼요 (`requires` 선언은 타입만, 동작 참조 금지). 각 Kit 이 **독립 선언** 만으로 올바른 순서 보장.

**압력 C — 확장 용이성**  
새 게이트 추가 (예: `FeatureFlagKit` 이 "beta 사용자만 접근" 게이트) 시 기존 Kit 수정 없이 추가.

**압력 D — 동일 우선순위의 결정성**  
두 Kit 이 `priority = 10` 이면? 순서가 **random** 이면 재현 불가능한 버그.

이 결정이 답해야 했던 물음이에요.

> **Kit 간 독립성을 유지하면서 라우팅 게이트 실행 순서를 명시적이고 결정적으로 제어** 하려면?

## 고민했던 대안들

### Option 1 — install 순서 = 실행 순서

`AppKits.install([UpdateKit(), AuthKit(), OnboardingKit()])` 순서대로 redirect 실행.

- **장점**: 단순. 순서 = 리스트 순서.
- **단점 1**: install 순서는 **의존성 (requires) 관점** 이라 의미 중첩. "auth 설치 먼저 (BackendApi 의존)" vs "auth 리다이렉트 먼저" 혼동.
- **단점 2**: 순서 변경하려면 install 리스트를 재정렬. 의존성 무너질 수 있음.
- **단점 3**: **명시적 순서 선언 없음** — 코드 읽는 사람이 "왜 auth 가 먼저?" 를 install 순서에서 유추.
- **탈락 이유**: 압력 A 위반.

### Option 2 — `dependsOn` 기반 위상 정렬

`AuthKit` 가 "UpdateKit 다음에 실행" 를 `runAfter: [UpdateKit]` 로 선언.

- **장점**: 명시적 의존 관계.
- **단점 1**: Kit 이 **다른 Kit 을 타입으로 참조** → 상호 결합. `OnboardingKit` 이 `runAfter: [UpdateKit, AuthKit]` 하면 AuthKit 을 import.
- **단점 2**: 위상 정렬 알고리즘 + 순환 감지 구현 필요. 복잡.
- **단점 3**: 새 Kit 추가 시 **기존 Kit 수정** 가능성 — "AuthKit 이 ForceUpdateKit 뒤에 실행" 을 어느 시점에 누가 업데이트?
- **탈락 이유**: 압력 B (독립성) 위반.

### Option 3 — 정수 `redirectPriority` + 안정 정렬 ★ (채택)

각 Kit 이 자기 `redirectPriority: int` 선언. 낮은 숫자 먼저. 동일 숫자는 install 순서로 안정 정렬.

- **압력 A 만족**: 각 Kit 의 header 에 우선순위가 숫자로 명시. 5초면 파악.
- **압력 B 만족**: Kit 간 직접 참조 없음. "내 우선순위는 10" 만 선언.
- **압력 C 만족**: 새 Kit 은 "내 우선순위" 만 정함. 기존 Kit 무관.
- **압력 D 만족**: 동일 우선순위는 install 순서로 tie-break. 결정적.

## 결정

### AppKit 계약의 redirectPriority

```dart
// lib/core/kits/app_kit.dart 발췌
abstract class AppKit {
  /// 리다이렉트 우선순위. 낮을수록 먼저 실행 (더 강한 차단력).
  /// 기본값 100. UpdateKit=1, AuthKit=10, OnboardingKit=50 권장.
  int get redirectPriority => 100;
  // ...
}
```

### AppKits 의 안정 정렬

```dart
// lib/core/kits/app_kits.dart 발췌
static List<RedirectRule> get redirectRules {
  final indexed = <({int priority, int order, RedirectRule rule})>[];
  for (var i = 0; i < _installed.length; i++) {
    final rule = _installed[i].buildRedirect();
    if (rule != null) {
      indexed.add((
        priority: _installed[i].redirectPriority,
        order: i,                                    // ← install 인덱스
        rule: rule,
      ));
    }
  }
  indexed.sort((a, b) {
    final byPriority = a.priority.compareTo(b.priority);
    return byPriority != 0 ? byPriority : a.order.compareTo(b.order);  // ← tie-break
  });
  return indexed.map((e) => e.rule).toList();
}
```

### AppRouter 의 합성

```dart
// lib/common/router/app_router.dart 발췌
String? _composedRedirect(BuildContext context, GoRouterState state) {
  for (final rule in AppKits.redirectRules) {     // ← 우선순위 정렬된 규칙들
    final result = rule(context, state);
    if (result != null) return result;            // ← 첫 non-null 이 최종 리다이렉트
  }
  if (state.matchedLocation == Routes.splash) {
    return Routes.home;                            // ← 기본 fallback
  }
  return null;
}
```

### Kit 별 우선순위 예

**UpdateKit (priority 1)** — 최우선:
```dart
@override
int get redirectPriority => 1;

@override
RedirectRule? buildRedirect() => (ctx, state) {
  if (_isUpdateRequired()) return '/force-update';
  return null;
};
```

**AuthKit (priority 10)** — 인증:
```dart
// lib/kits/auth_kit/auth_kit.dart 발췌
@override
int get redirectPriority => 10;

@override
RedirectRule? buildRedirect() => (ctx, state) {
  final status = container.read(authStateProvider).current.status;
  if (status == AuthStatus.unknown) return splashPath;
  if (!isAuthed && !isOnAuthFlow) return loginPath;
  if (isAuthed && isOnLogin) return homePath;
  return null;
};
```

**OnboardingKit (priority 50)** — 온보딩:
```dart
@override
int get redirectPriority => 50;

@override
RedirectRule? buildRedirect() => (ctx, state) {
  if (!_isOnboardingComplete && !state.matchedLocation.startsWith('/onboarding')) {
    return '/onboarding';
  }
  return null;
};
```

### 실행 흐름 예시

상황: 미인증 + 온보딩 미완료 + 업데이트 필요 상태에서 앱 진입.

1. `AppKits.redirectRules` = `[UpdateKit rule, AuthKit rule, OnboardingKit rule]` (priority 정렬)
2. UpdateKit rule 실행 → `'/force-update'` 반환
3. 첫 non-null 이므로 AuthKit · OnboardingKit 은 실행 안 됨
4. `/force-update` 로 이동

업데이트 설치 후 재진입:

1. UpdateKit rule → null (업데이트 완료)
2. AuthKit rule → `'/login'` (미인증)
3. `/login` 으로 이동

로그인 후:

1. UpdateKit → null
2. AuthKit → null (인증됐고 홈 접근)
3. OnboardingKit rule → `'/onboarding'` (온보딩 미완료)
4. `/onboarding` 로 이동

온보딩 완료 후: 모든 rule null → 홈 유지.

### 권장 우선순위 범위

| 카테고리 | 범위 | 예 |
|---------|------|---|
| **최우선 게이트** (앱 사용 금지) | 1~9 | UpdateKit, MaintenanceKit |
| **인증 게이트** | 10~19 | AuthKit |
| **온보딩 · 동의** | 50~59 | OnboardingKit, TosConsentKit |
| **기능 게이트** | 60~99 | FeatureFlagKit, ABTestKit |
| **기본** | 100 | 대부분 |

**숫자 사이를 띄워둬요** — `1, 2, 3` 이 아닌 `1, 10, 50` 로 하면 나중에 "UpdateKit 과 AuthKit 사이" 에 새 게이트 (priority 5) 삽입 가능.

### 설계 선택 포인트

**포인트 1 — 정수 타입 (enum 이 아님)**  
Enum 으로 `Priority.highest / high / medium / low` 도 고려. 하지만 **사용자 정의 우선순위** 를 허용해야 하므로 정수가 맞음. 파생 레포가 `priority = 15` 같은 세밀한 값 쓸 수 있음.

**포인트 2 — 낮은 숫자 = 먼저 실행**  
"높은 숫자 = 높은 우선순위" 는 직관적이지만, 리스트 인덱스 (0부터 시작) 와 맞는 건 "낮은 숫자 = 먼저". 둘 다 관용적인데 본 템플릿은 **"낮을수록 강한 차단"** 철학으로 낮은 숫자 택함.

**포인트 3 — 동일 우선순위는 install 순서**  
tie-break 규칙이 "install 순" 이라 예측 가능. 같은 priority 쓰는 경우는 드물지만 (AuthKit = 10, BetaAccessKit = 10) tie-break 이 있으면 안심.

**포인트 4 — 첫 non-null 이 최종**  
모든 rule 을 순회하며 **중첩 리다이렉트** 하지 않음. 첫 non-null 에서 중단. 이유: 체인 리다이렉트는 무한 루프 위험.

**포인트 5 — `buildRedirect()` 가 nullable**  
Kit 이 라우팅 개입 안 해도 됨. `BackendApiKit` · `ObservabilityKit` 은 리다이렉트 없음 → `buildRedirect()` 반환 null → `redirectRules` 에서 빠짐.

## 이 선택이 가져온 것

### 긍정적 결과

- **순서 명시성**: Kit 파일 열면 `redirectPriority: 10` 한 줄로 파악.
- **Kit 독립**: Kit 간 참조 없음. 각자 선언.
- **확장 용이**: 새 Kit 추가 시 "내 우선순위는?" 결정만.
- **결정론적**: 동일 환경에서 동일 순서. 재현 가능한 동작.
- **`null` 폴스루**: 개입 안 할 땐 null → 자연스러운 옵트아웃.

### 부정적 결과

- **숫자 선택 피로**: "이 게이트 priority 30? 40?" 결정. 권장 범위 표가 있지만 여전히 판단.
- **충돌 디버깅**: "AuthKit 의 `/login` 리다이렉트가 왜 발동 안 하지?" 를 찾으려면 UpdateKit 이 null 아닌 값을 먼저 반환했는지 확인. flow 추적 비용.
- **Kit 파생 관리**: 파생 레포에서 새 Kit 추가 시 "이 게이트 우선순위 얼마?" 를 템플릿 값과 조율 필요.
- **숫자 낭비**: 1~100 범위에 현재 3~4개만 쓰고 나머지 비어있음. 의도된 여유 공간이지만 "이 숫자가 맞나?" 혼란 가능.

## 교훈

### 교훈 1 — 순서가 의미인 집합은 **정수 우선순위** 가 효율적

처음엔 위상 정렬 (`runAfter: [...]`) 을 시도했어요. 하지만 의존 관계를 선언하는 비용이 크고, **순환 감지** 코드까지 필요. 정수 priority 하나로 모든 케이스 커버 + 단순.

**교훈**: 단순한 순서는 **단순한 표현** 으로. 위상 정렬은 진짜 그래프 구조일 때만.

### 교훈 2 — 숫자 사이를 비워둬야 확장 가능

초기엔 `1, 2, 3, 4` 순차 할당. 나중에 "Update 와 Auth 사이" 에 Maintenance 게이트 추가 필요 → **전체 재할당**. `1, 10, 50, 100` 처럼 띄워두면 `5` 삽입 쉬움.

**교훈**: 우선순위 숫자는 **미래 삽입 공간** 을 남김. 배수 단위로 띄우기.

### 교훈 3 — "개입 안 함 = null" 관용이 깔끔

초기엔 `buildRedirect()` 가 필수 + 내부 분기로 "개입 여부". 그러면 모든 Kit 이 `buildRedirect` 를 구현해야 해서 보일러플레이트. **nullable 반환 + null = 옵트아웃** 으로 네트워크 Kit · 관측성 Kit 같이 라우팅과 무관한 Kit 은 아예 구현 안 함.

**교훈**: 선택적 hook 은 nullable 반환으로 "참여 여부" 표현. 필수 메서드로 만들면 빈 구현이 쌓여요.

## 관련 사례 (Prior Art)

- [Android OkHttp Interceptor `Priority`](https://square.github.io/okhttp/interceptors/) — 인터셉터 순서 개념
- [Express middleware 순서](https://expressjs.com/en/guide/using-middleware.html) — 등록 순서 = 실행 순서
- [React Router `guards`](https://reactrouter.com/start/framework/route-module#route-guards) — 라우팅 가드 체인
- [Vue Router `beforeEach` 체인](https://router.vuejs.org/guide/advanced/navigation-guards.html) — 우선순위 없이 순서대로
- [Servlet Filter `@Priority`](https://jakarta.ee/specifications/platform/10/apidocs/jakarta/annotation/priority) — JVM 진영의 정수 우선순위

## Code References

**계약 + 합성**
- [`lib/core/kits/app_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kit.dart) — `redirectPriority` getter
- [`lib/core/kits/app_kits.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/kits/app_kits.dart) — `redirectRules` 안정 정렬
- [`lib/common/router/app_router.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/router/app_router.dart) — `_composedRedirect` 첫 non-null

**Kit 별 설정 예**
- [`lib/kits/auth_kit/auth_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/auth_kit.dart) — `redirectPriority: 10` + `buildRedirect`
- [`lib/kits/update_kit/update_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/update_kit/update_kit.dart) — `redirectPriority: 1`

**테스트**
- [`test/common/router/auth_guard_test.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/test/common/router/auth_guard_test.dart) — `computeAuthRedirect` 순수 함수 테스트

**관련 ADR**:
- [ADR-003 · FeatureKit 동적 레지스트리](./adr-003-featurekit-registry.md) — Kit 이 `buildRedirect` · `redirectPriority` 기여
- [ADR-005 · Riverpod + MVVM](./adr-005-riverpod-mvvm.md) — 리다이렉트 내부에서 `container.read` 로 상태 접근
- [ADR-008 · 부팅 단계 추상화](./adr-008-boot-step.md) — `refreshListenable` 이 리다이렉트 재평가 트리거
