# Sentry 통합

> **목표**: Sentry DSN 발급 → `--dart-define` 주입 → 운영 환경에서 크래시 1건 이상 수신 확인까지.

**관련 Kit**: [`observability_kit`](../features/observability-kit.md)
**관련 ADR**: 없음 (Phase 1 관측성 도입 — `docs/superpowers/plans/2026-04-19-observability-sentry-posthog.md`)

---

## 0. Sentry 가 하는 일

크래시 + 비동기 에러 + 사용자 zone error 까지 자동 캡처해서 Sentry 대시보드에 업로드해요. 우리 템플릿은:

- `main.dart` 의 `SentryFlutter.init` 으로 `runZonedGuarded` 래핑 — Future / Stream / 이벤트 루프 어디서 터져도 잡혀요
- DSN 미주입 시 `DebugCrashService` 로 폴백 — 콘솔 출력만, 외부 전송 없음 (로컬/CI 안전)
- `tracesSampleRate: 0.2` (트랜잭션 20%) — 무료 플랜 quota 절약

---

## 1. Sentry 콘솔에서 DSN 발급

1. https://sentry.io 가입 (무료 플랜 — 월 5,000 이벤트)
2. **New Project** → **Flutter** 선택 → 프로젝트 이름 입력 (앱 슬러그 권장)
3. 자동 생성된 DSN 복사 — 형태: `https://<key>@<org>.ingest.sentry.io/<project_id>`

> **보안 주의**: DSN 은 client-side 식별자이지만 공개 코드에는 절대 커밋하지 마세요. 누군가가 spam 으로 quota 를 소진시킬 수 있어요.

---

## 2. 로컬 개발에 주입

`.env` 또는 IDE run config 에서 dart-define 으로 전달.

### 옵션 A — `.env` + 셸 스크립트 (권장)

```bash
# .env (Git ignore 됨)
SENTRY_DSN=https://abcdef@o123456.ingest.sentry.io/789

# 실행
flutter run \
  --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2)
```

### 옵션 B — VS Code launch.json

```json
{
  "configurations": [
    {
      "name": "Flutter (with Sentry)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "toolArgs": [
        "--dart-define=SENTRY_DSN=https://...@....ingest.sentry.io/..."
      ]
    }
  ]
}
```

> launch.json 은 보통 git ignore 안 되므로 DSN 직접 박지 말고 환경변수에서 읽도록 wrapper 작성 권장.

---

## 3. CI / 운영에 주입 (GitHub Actions)

GHA Secrets 에 `SENTRY_DSN` 추가 후 release workflow 에서:

```yaml
# .github/workflows/release-android.yml (발췌)
- name: Build APK
  run: |
    flutter build apk --release \
      --dart-define=SENTRY_DSN=${{ secrets.SENTRY_DSN }}
```

Secrets 업로드 자동화는 [`scripts/upload-secrets-to-github.sh`](../../scripts/upload-secrets-to-github.sh) 참고.

---

## 4. 동작 확인

### 4-1. 의도적 크래시 발생

`lib/features/settings/settings_screen.dart` 같은 dev 전용 화면에 임시 버튼:

```dart
ElevatedButton(
  onPressed: () => throw StateError('Sentry test crash'),
  child: const Text('Force Crash'),
)
```

릴리스 빌드로 실행 후 버튼 누르고 → Sentry **Issues** 탭에서 1분 내 이벤트 확인.

### 4-2. Observability Kit 의 Dogfooding 패널 활용

`lib/kits/observability_kit/dogfooding_panel.dart` 가 dev 빌드에서만 노출되는 작은 패널을 제공해요. 거기서 "Send test event" 버튼을 누르면 Sentry 와 PostHog 둘 다 한 번에 검증 가능.

### 4-3. release 환경 분리

`SentryFlutter.init` 의 `options.environment` 가 자동으로 `AppConfig.instance.environment.name` 을 사용해요 — `dev` / `staging` / `prod` 로 Sentry 대시보드에서 필터링 가능.

---

## 5. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 크래시가 Sentry 에 안 옴 | DSN 미주입 (Debug 폴백) | 콘솔에서 `[DebugCrashService]` 로그 보이면 DSN 안 들어간 것. dart-define 확인 |
| 401 / "DSN was rejected" | DSN 오타 / quota 소진 | Sentry Settings → Client Keys 에서 DSN 재확인 |
| 너무 많은 이벤트로 quota 폭발 | tracesSampleRate 너무 높음 | `main.dart` 의 `tracesSampleRate: 0.2` (현재 기본) 유지 또는 더 낮춤 |
| iOS 만 안 옴 | Sentry iOS native init 누락 | `ios/Runner/AppDelegate.swift` 에서 SentryFlutter native 초기화 코드 확인 |

---

## 6. 파생 레포 체크리스트

- [ ] Sentry 프로젝트 생성 + DSN 발급
- [ ] `.env` 에 `SENTRY_DSN=` 라인 추가 (gitignore 확인)
- [ ] GHA Secrets 에 `SENTRY_DSN` 등록 (`scripts/upload-secrets-to-github.sh` 활용 가능)
- [ ] 릴리스 빌드 1회 실행 후 Issues 탭에 테스트 크래시 1건 도착 확인
- [ ] release 환경 (`AppConfig.instance.environment = Environment.prod`) 으로 빌드한 후 prod 환경 필터에서 보이는지 확인

---

## 7. Code References

- [`lib/kits/observability_kit/observability_env.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/observability_env.dart) — DSN env 로드
- [`lib/kits/observability_kit/sentry_crash_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/observability_kit/sentry_crash_service.dart) — Sentry 어댑터
- [`lib/main.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/main.dart) — `SentryFlutter.init` 래핑
- [`lib/kits/observability_kit/README.md`](../../lib/kits/observability_kit/README.md) — Kit 개요
