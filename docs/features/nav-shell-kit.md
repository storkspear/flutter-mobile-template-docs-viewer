# nav_shell_kit

**하단 네비게이션 셸 (`BottomNavigationBar`) + 선택적 중앙 FAB**. 2 ~ 5 개 메인 탭 구조 앱에 적합.

---

## 개요

- **go_router ShellRoute** 사용 — 탭 전환 시 각 탭의 네비게이션 스택 유지
- **중앙 FAB** 옵션 — 주요 액션 (추가 · 녹음 등)
- **아이콘 · 라벨** 커스터마이징
- **탭 전환 애니메이션** — Material · Cupertino 자동 감지

---

## 활성화

```yaml
# app_kits.yaml
kits:
  nav_shell_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  NavShellKit(tabs: [
    NavTab(path: '/home', icon: Icons.home, label: 'Home'),
    NavTab(path: '/stats', icon: Icons.bar_chart, label: 'Stats'),
    NavTab(path: '/settings', icon: Icons.settings, label: 'Settings'),
  ]),
]);
```

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `NavShellKit` | `AppKit` 구현. ShellRoute 기여 |
| `NavTab` | 탭 정의 (path · icon · label) |
| `BottomNavShell` | 실제 셸 위젯 |
| (선택) `CentralFab` | 중앙 FAB 위젯 |

---

## 파생 레포에서 탭 · FAB 추가

```dart
NavShellKit(
  tabs: [
    NavTab(path: '/home', icon: Icons.home, label: s.home),
    NavTab(path: '/stats', icon: Icons.bar_chart, label: s.stats),
    NavTab(path: '/settings', icon: Icons.settings, label: s.settings),
  ],
  fab: CentralFab(
    icon: Icons.add,
    onPressed: (context) => context.push('/expense/new'),
  ),
)
```

---

## 파생 레포 체크리스트

- [ ] 앱 탭 구조 결정 (2 ~ 5개)
- [ ] 각 탭의 라우트 정의
- [ ] (선택) FAB 위치 · 동작 설계
- [ ] 다크모드 · 텍스트 스케일 대응 확인

---

## Code References

- [`lib/kits/nav_shell_kit/nav_shell_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/nav_shell_kit/nav_shell_kit.dart)
- [`lib/kits/nav_shell_kit/bottom_nav_shell.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/nav_shell_kit/bottom_nav_shell.dart)
- [`lib/kits/nav_shell_kit/nav_tab.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/nav_shell_kit/nav_tab.dart)

---

## 관련 문서

- [go_router ShellRoute](https://pub.dev/documentation/go_router/latest/topics/Shell%20routes-topic.html)
