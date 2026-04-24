# Secrets Management

**비밀 값 관리의 3층 구조** — `.env` (로컬 개발) · GitHub Secrets (CI · 배포) · `--dart-define` (빌드 주입). 커밋 금지 목록 엄격.

---

## 3층 구조

```
┌─────────────────────────────────────────┐
│  로컬 개발                                │
│  .env (gitignore)                        │
│  flutter run --dart-define=KEY=$VALUE   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  CI · 배포                                │
│  GitHub Secrets                          │
│  .github/workflows/*.yml 에서 참조          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  런타임                                   │
│  String.fromEnvironment('KEY')           │
│  (빌드 시점 상수로 주입됨)                  │
└─────────────────────────────────────────┘
```

---

## 로컬 `.env` 파일

### 파일 위치

레포 루트의 `.env` (git 무시). `.env.example` 을 복사해서 시작:

```bash
cp .env.example .env
$EDITOR .env
```

### 내용

```bash
# .env (커밋 금지)
SENTRY_DSN=https://xxx@sentry.io/yyy
POSTHOG_KEY=phc_xxx
POSTHOG_HOST=https://app.posthog.com
GOOGLE_CLIENT_ID_ANDROID=...
GOOGLE_CLIENT_ID_IOS=...
SSL_PINS=sha256/AAA=,sha256/BBB=
```

### 실행 시 주입

```bash
flutter run \
  --dart-define=SENTRY_DSN=$(grep SENTRY_DSN .env | cut -d= -f2) \
  --dart-define=POSTHOG_KEY=$(grep POSTHOG_KEY .env | cut -d= -f2)
```

또는 스크립트로:

```bash
# scripts/run.sh
#!/bin/bash
set -a && source .env && set +a
flutter run \
  --dart-define=SENTRY_DSN=$SENTRY_DSN \
  --dart-define=POSTHOG_KEY=$POSTHOG_KEY
```

---

## GitHub Secrets

### 등록

Repository → Settings → Secrets and variables → Actions → New repository secret

또는 스크립트로 일괄 업로드:

```bash
./scripts/upload-secrets-to-github.sh
# → .env 읽어서 gh secret set 으로 일괄
```

### 워크플로우에서 참조

```yaml
- name: Build
  run: flutter build appbundle --dart-define=SENTRY_DSN=$SENTRY_DSN
  env:
    SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

### Environment secrets

staging · production 분리 필요 시 Environment 단위 secret:

```yaml
jobs:
  deploy-prod:
    environment: production  # ← 이 환경의 secret 사용
    steps:
      - run: ...
```

---

## `--dart-define` 주입

### 빌드 시점 상수

```bash
flutter build appbundle --dart-define=SENTRY_DSN=https://xxx
```

### 코드에서 접근

```dart
// lib/kits/observability_kit/observability_env.dart
class ObservabilityEnv {
  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');
  static bool get isSentryEnabled => sentryDsn.isNotEmpty;
}
```

### defaultValue 관용

```dart
static const value = String.fromEnvironment('KEY', defaultValue: '');
```

주입 안 됐을 때 null 대신 empty string → null 체크 대신 `isEmpty` 확인.

---

## 절대 커밋 금지 목록

### `.gitignore` 확인

```gitignore
# 환경 변수
.env
.env.local
.env.production

# 자격 증명 (iOS)
*.mobileprovision
*.p8
*.p12
ios/fastlane/app_store_connect_api_key.json

# 자격 증명 (Android)
*.jks
*.keystore
android/app/upload-keystore.jks
android/play-service-account.json
android/key.properties

# Firebase
google-services.json
GoogleService-Info.plist

# Flutter 빌드 결과물
build/
.dart_tool/
```

### 실수로 커밋한 경우

**즉시 키 재발급 + git 히스토리 제거**:

```bash
# BFG Repo-Cleaner 사용 권장
bfg --delete-files google-services.json
git push --force

# 또는 git filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch google-services.json' \
  --prune-empty --tag-name-filter cat -- --all
```

그리고 **해당 키 즉시 무효화 + 재발급**. Force push 만으론 캐시 · mirror 에 남을 수 있음.

---

## 환경별 분리

### 개발 / 스테이징 / 프로덕션

```bash
# .env.dev
SENTRY_DSN=https://dev-dsn@sentry.io/...
BASE_URL=http://localhost:8080

# .env.staging
SENTRY_DSN=https://staging-dsn@sentry.io/...
BASE_URL=https://staging-api.example.com

# .env.prod
SENTRY_DSN=https://prod-dsn@sentry.io/...
BASE_URL=https://api.example.com
```

### 빌드 타입별 주입

```bash
# 스테이징 빌드
flutter build appbundle \
  --dart-define-from-file=.env.staging

# 또는
flutter build appbundle \
  --dart-define=BASE_URL=$(grep BASE_URL .env.staging | cut -d= -f2)
```

---

## 키 갱신 주기 권장

| 키 | 갱신 |
|----|------|
| JWT_SECRET (백엔드) | 6개월 ~ 1년 |
| Sentry Auth Token | 1년 or 팀원 이탈 시 |
| Play Store JSON Key | 필요 시만 |
| App Store API Key | 1년 |
| Firebase Server Key | 거의 안 바꿈 |
| Keystore | **절대 바꾸지 마세요** — Play App Signing 으로 복구 불가 |

---

## 팀원 간 공유

### 안 되는 방법

- Slack · 이메일 · GitHub Issue 평문 — 금지
- 스크린샷 공유 — 금지

### 되는 방법

- **Bitwarden · 1Password** 공유 vault
- **Fastlane match** (인증서 암호화 git repo)
- GitHub 조직 Secrets (멤버 단위 권한)

---

## 파생 레포 체크리스트

- [ ] `.gitignore` 에 모든 비밀 파일 패턴 확인
- [ ] `.env.example` 에 필요 키 이름 · 설명 (값 없이)
- [ ] 팀 `.env` 공유 수단 (Bitwarden 등) 결정
- [ ] `scripts/upload-secrets-to-github.sh` 실행 → GHA Secrets 설정
- [ ] 주기적 키 갱신 일정 설정

---

## 관련 문서

- [`security.md`](./security.md) — 난독화 · 키 보관
- [`android-deployment.md`](./android-deployment.md) · [`ios-deployment.md`](./ios-deployment.md)
- [`ci-cd.md`](./ci-cd.md)
