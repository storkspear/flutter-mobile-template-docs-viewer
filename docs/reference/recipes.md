# Recipes

`recipes/` 에 제공되는 **3개 샘플 앱 구성**. 파생 레포가 복사 → `app_kits.yaml` 로 덮어쓰기. 상세 근거는 [ADR-021 · Multi-Recipe](../philosophy/adr-021-multi-recipe.md).

---

## 선택 가이드

| 조건 | Recipe |
|------|--------|
| 서버 없이 완전 로컬 | `local-only-tracker` |
| 서버 없고 알림 · 타이머 중심 | `local-notifier-app` |
| 서버 있고 로그인 필요 | `backend-auth-app` |
| 위 어느 것도 아님 | 가까운 것 복사 + 커스터마이징 |

---

## 1. local-only-tracker

완전 로컬 앱 (습관 · 가계부 · 학습 기록 등).

```yaml
# recipes/local-only-tracker.yaml
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

### 활성 Kit (4개)

- `local_db_kit` — Drift SQLite
- `onboarding_kit` — 첫 실행 시 위자드
- `nav_shell_kit` — 하단 탭
- `charts_kit` — 통계 시각화

### 비활성 (의도적)

- `backend_api_kit` · `auth_kit` — 서버 없음
- `notifications_kit` · `permissions_kit` — 알림 없음
- `update_kit` — 로컬 전용. 강제 업데이트 체인 불필요
- `ads_kit` — 광고 없는 앱 기본

### 대표 사례

- 습관 트래커 · 독서 기록 · 가계부 (로컬)

---

## 2. local-notifier-app

로컬 알림 · 타이머 중심 앱. 광고 포함.

```yaml
# recipes/local-notifier-app.yaml
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

### 활성 Kit (9개)

- `local_db_kit` · `notifications_kit` · `background_kit` · `charts_kit`
- `update_kit` · `ads_kit` · `permissions_kit` · `device_info_kit` · `nav_shell_kit`

### 특이 사항

- **ads_kit 활성**: 첫 실행 시 ATT (iOS) · UMP (GDPR) 다이얼로그 자동 노출
- **출시 전**: `Info.plist` 의 `NSUserTrackingUsageDescription` 다듬기 + AdMob 실제 ID 입력

### 대표 사례

- 알람 · 명상 타이머 · 운동 알림 · 리마인더 앱

---

## 3. backend-auth-app

백엔드 연동 + JWT 인증 앱.

```yaml
# recipes/backend-auth-app.yaml
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

### 활성 Kit (5개)

- `backend_api_kit` · `auth_kit` (짝) — 서버 연동 · JWT
- `notifications_kit` · `device_info_kit` — FCM 푸시 + device 등록
- `update_kit` — 강제 업데이트

### 전제

- [`spring-backend-template`](https://github.com/storkspear/spring-backend-template) 쌍 운영
- 백엔드에 해당 앱 slug 등록 + 스키마 생성

### 대표 사례

- SNS 마이크로 · 협업 도구 · 대시보드 · 메신저

---

## Recipe 사용 워크플로우

### 1. Recipe 복사

```bash
cp recipes/backend-auth-app.yaml app_kits.yaml
```

### 2. 편집 (선택)

```yaml
# app_kits.yaml
app:
  name: My Cool App          # ← 변경
  slug: my_cool_app
  # ...

kits:
  backend_api_kit: {}
  auth_kit: {}
  notifications_kit: {}
  device_info_kit: {}
  update_kit: {}
  observability_kit: {}      # ← 추가
```

### 3. main.dart 동기화

```dart
await AppKits.install([
  BackendApiKit(),
  AuthKit(),
  NotificationsKit(),
  DeviceInfoKit(),
  UpdateKit(service: NoUpdateAppUpdateService()),
  ObservabilityKit(),        // ← 추가
]);
```

### 4. 검증

```bash
dart run tool/configure_app.dart
```

Status: OK 확인.

### 5. 앱 정체성 변경

```bash
./scripts/rename-app.sh my_cool_app com.example.mycoolapp
```

### 6. 실행

```bash
flutter pub get
flutter run
```

---

## 혼합 유형 처리

### "로컬 + 서버 백업 옵션" 같은 혼합

3개 Recipe 중 어느 것과도 정확히 안 맞음. 전략:

1. **가장 가까운 것 선택** — 예: `local-only-tracker`
2. **Kit 추가** — `backend_api_kit` · `auth_kit` (옵션 기능)
3. **기능 플래그로 on/off** — ViewModel 에서 "서버 연동 활성 여부" 플래그

### 새 Recipe 추가?

3개로 제한 권장 (drift 관리 부담). 필요 시 **파생 레포 에서만** 유지 — 템플릿에 반영하지 않음.

---

## 관련 문서

- [ADR-021 · Multi-Recipe](../philosophy/adr-021-multi-recipe.md)
- [ADR-003 · FeatureKit](../philosophy/adr-003-featurekit-registry.md)
- [ADR-004 · YAML ↔ Dart 동기화](../philosophy/adr-004-manual-sync-ci-audit.md)
- [Features 인덱스](../features/README.md) — Kit 13개 상세
- [`scripts.md`](./scripts.md) — `rename-app.sh`
