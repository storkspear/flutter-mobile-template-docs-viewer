# onboarding_kit

**다단계 온보딩 위자드 + 완료 플래그 영속 + 라우팅 게이트**. 첫 실행 시 사용자 온보딩 화면. `redirectPriority: 50`.

---

## 개요

- **라우팅 게이트**: 온보딩 미완료면 `/onboarding` 강제 이동
- **완료 플래그**: `SharedPreferences` 에 저장 → 재시작 시에도 유지
- **다단계 위자드**: `OnboardingStep` 인터페이스로 페이지 추가 가능
- **Skip 버튼**: 선택 제공 (권장 기능 온보딩 시)

---

## 활성화

```yaml
# app_kits.yaml
kits:
  onboarding_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  OnboardingKit(steps: [
    WelcomeStep(),
    PermissionRequestStep(),
    NotificationSetupStep(),
  ]),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `OnboardingKit` | `AppKit` 구현. `redirectPriority: 50` |
| `OnboardingStep` | 추상. `Widget build(BuildContext)` · `Future<bool> onNext(BuildContext)` (true 반환 시 다음 스텝으로) |
| `OnboardingScaffold` | 공통 위자드 UI (페이지 전환 · 진행 바) |
| 완료 플래그 | `SharedPreferences` 에 영속, `isComplete` ValueNotifier 로 노출 |

---

## 파생 레포에서 OnboardingStep 구현

```dart
class WelcomeStep extends OnboardingStep {
  @override
  Widget build(BuildContext context) {
    return const Column(children: [
      Text('앱에 오신 걸 환영해요'),
      // ...
    ]);
  }

  // 선택: 사용자가 "다음" 누를 때 검증/저장 로직.
  // 기본 구현은 true (즉시 다음 스텝). false 반환 시 머무름.
  @override
  Future<bool> onNext(BuildContext context) async => true;
}
```

---

## 파생 레포 체크리스트

- [ ] `OnboardingStep` 구현체들 작성 (최소 3 ~ 5개)
- [ ] `main.dart` 의 `OnboardingKit(steps: [...])` 등록
- [ ] 완료 플래그 리셋 방법 고민 (예: 개발자 설정 메뉴)
- [ ] (선택) 다크모드 대응 · 애니메이션

---

## Code References

- [`lib/kits/onboarding_kit/onboarding_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/onboarding_kit/onboarding_kit.dart)
- [`lib/kits/onboarding_kit/onboarding_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/onboarding_kit/onboarding_step.dart)
- [`lib/kits/onboarding_kit/onboarding_scaffold.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/onboarding_kit/onboarding_scaffold.dart)

---

## 관련 문서

- [`ADR-018 · 라우팅 우선순위`](../philosophy/adr-018-redirect-priority.md) — `redirectPriority: 50`
