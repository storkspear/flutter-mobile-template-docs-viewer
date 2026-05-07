# Deployment — 첫 운영 배포

앱이 로컬에서 잘 돌아가면 스토어에 올릴 차례. Android **Play Internal** (GHA 자동 — `release-android.yml`) + iOS **TestFlight** (현재는 fastlane 수동 또는 Xcode Archive — iOS GHA 워크플로우는 미구현). 약 2~3시간 (최초 1회 · 이후엔 Android 만 태그 push 만).

---

## 개요

```
로컬 개발 완료
  ↓
외부 서비스 자격증명 발급 (Sentry · PostHog · Firebase · 소셜 · 스토어)
  ↓
Android keystore · iOS 인증서 생성
  ↓
GitHub Secrets 등록
  ↓
스토어 앱 등록 + 최초 수동 업로드
  ↓
git tag v1.0.0 && git push --tags
  ↓
GHA 자동 배포 → Play Internal      (release-android.yml)
  ↓
iOS TestFlight 수동 배포            (fastlane beta 또는 Xcode Archive)
```

---

## §1 외부 서비스 자격증명 (1시간)

자세한 건 [`Journey §4`](./README.md#4-발급은-어디서--외부-서비스-자격-증명-1--2시간). 체크만:

### Sentry (observability_kit)

- [ ] [Sentry](https://sentry.io) Flutter 프로젝트 생성
- [ ] DSN · Auth Token · Org · Project slug 확보

### PostHog (observability_kit)

- [ ] [PostHog](https://posthog.com) 프로젝트 생성
- [ ] Project API Key · Host 확보

### Firebase (notifications_kit 쓰면)

- [ ] [Firebase Console](https://console.firebase.google.com) 프로젝트 생성
- [ ] Android: `google-services.json` → `android/app/`
- [ ] iOS: `GoogleService-Info.plist` → `ios/Runner/`, APNs key 업로드

### Google Sign In / Apple Sign In (auth_kit 쓰면)

- [ ] OAuth 2.0 Client ID · Bundle ID 설정 ([`auth_kit`](../features/auth-kit.md))

---

## §2 Android 배포 준비 (30분)

### 1. 업로드 keystore 생성

```bash
./scripts/generate-upload-keystore.sh
```

생성: `android/app/upload-keystore.jks`

**중요**: `.gitignore` 확인. 절대 커밋 금지. [Bitwarden](https://bitwarden.com/) 같은 매니저에 백업.

### 2. Play Console 앱 등록

- [Play Console](https://play.google.com/console) → 앱 만들기
- 앱 이름 · 기본 언어 · 앱/게임 구분 · 무료/유료
- **Play App Signing 활성화** (필수)
- 내부 테스트 track 활성화

### 3. 서비스 계정 + JSON 키

- Play Console → Setup → API Access → Link Google Cloud Project
- 새 서비스 계정 생성 → **Android Publisher** 권한
- JSON 키 다운로드 → 안전하게 보관

### 4. 최초 AAB 수동 업로드

Play Console 의 API 업로드는 **해당 앱이 이미 존재** 해야 가능. 최초 1회는 수동:

```bash
flutter build appbundle --release --dart-define=SENTRY_DSN=... --dart-define=POSTHOG_KEY=...
# → build/app/outputs/bundle/release/app-release.aab
```

Play Console 에서 이 AAB 수동 업로드 → 내부 테스트 track 릴리스.

### 5. 내부 테스터 등록

Play Console → 내부 테스트 → 테스터 → 이메일 추가 (본인 포함)

---

## §3 iOS 배포 준비 (40분)

### 1. Apple Developer 계정 · Bundle ID

- [Apple Developer](https://developer.apple.com) 유료 계정 ($99/년)
- Identifiers → `+` → App IDs → Bundle ID 등록
- Capabilities: Sign in with Apple · Push Notifications 등 필요 항목

### 2. Fastlane match 설정 (권장)

> ⚠️ 템플릿은 iOS fastlane 을 사전 셋업하지 않아요. `ios/fastlane/`, `ios/Gemfile` 모두 미존재. 아래는 첫 셋업 절차예요.

```bash
cd ios
bundle init
# Gemfile 에: gem 'fastlane'
bundle install
bundle exec fastlane match init
# git repo URL 입력 (인증서 암호화 저장소)

bundle exec fastlane match appstore --readonly=false
```

### 3. App Store Connect 앱 등록

- [App Store Connect](https://appstoreconnect.apple.com) → My Apps → `+`
- Bundle ID 선택 · SKU · 앱 이름

### 4. API Key

App Store Connect → Users and Access → Keys → `+`
- 권한: Developer
- `.p8` 파일 다운로드 · Key ID · Issuer ID 기록

### 5. 최초 TestFlight 업로드

§3.2 의 Fastlane 셋업을 마쳤다면:

```bash
cd ios
bundle exec fastlane beta
```

또는 Xcode 에서 Product → Archive → Distribute.

### 6. TestFlight 내부 테스터 등록

App Store Connect → TestFlight → Internal Testing → 본인 Apple ID 추가.

---

## §4 GitHub Secrets 등록 (20분)

`.env` 로컬 파일에 먼저 모으고:

```bash
# .env (커밋 금지)
SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=my-org
SENTRY_PROJECT=my-app

POSTHOG_KEY=phc_xxx
POSTHOG_HOST=https://app.posthog.com

ANDROID_KEYSTORE_PASSWORD=...
ANDROID_KEY_ALIAS=upload
ANDROID_KEY_PASSWORD=...

PLAY_STORE_JSON_KEY='{"type":"service_account", ...}'

APP_STORE_KEY_ID=...
APP_STORE_ISSUER_ID=...
APP_STORE_KEY_CONTENT='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
```

일괄 업로드:

```bash
./scripts/upload-secrets-to-github.sh
```

또는 수동:

```bash
gh secret set SENTRY_DSN --body "$SENTRY_DSN"
# ...
```

keystore base64:

```bash
base64 -i android/app/upload-keystore.jks | gh secret set ANDROID_KEYSTORE_BASE64
```

---

## §5 첫 자동 배포 (10분)

### 버전 설정

```yaml
# pubspec.yaml
version: 1.0.0+1
#        |     |
#        |     +- build number
#        +- semver
```

### 태그 push

```bash
git commit -am "chore: prepare v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### GHA 확인

- Repository → Actions
- `release-android.yml` 워크플로우 실행 확인
- 10~15분 후 완료
- Play Console → 내부 테스트 → 새 버전 업로드 확인

### 내부 테스터에게 링크 공유

Play Console 에서 "사전 가입 URL" 복사 → 이메일 등록된 테스터에게 전달.

---

## §6 배포 주기

### 메이저

- 월 1회 내외
- `v1.0.0 → v2.0.0` — 파괴적 변경 · 큰 기능 추가

### 마이너 · 패치

- 필요 시
- `v1.1.0` · `v1.0.1`

### 핫픽스

- 긴급 버그 → hotfix 브랜치 → 태그 → 24시간 내 배포

---

## §7 Internal → Production 승격

GHA 는 **Internal 에만** 자동 배포. 이후 단계:

### 테스트 통과 후

1. Play Console → Internal → "Release to closed testing" (선택)
2. Closed → Open → **Production** 승격
3. 최종 Production 은 Play Console 수동 (리뷰 1~7일)

### 전략

- 내부 테스터에게 며칠 사용 → 피드백 수집
- 크래시 · 로그 확인 (Sentry)
- 문제 없으면 Production 승격
- 초기 출시 시 단계별 (Staged Rollout — 5% → 20% → 50% → 100%)

---

## §8 트러블슈팅

배포 관련 자주 막히는 증상은 [`Android Deployment · 트러블슈팅`](../infra/android-deployment.md#트러블슈팅) 에 정리돼 있어요. 그 외 일반 셋업 함정은 [`Pitfalls`](./dogfood-pitfalls.md) 참고.

---

## 📖 책 목차 — Journey 6 · 7단계

| 방향 | 문서 | 한 줄 |
|---|---|---|
| ← 이전 | [`Build First App`](./build-first-app.md) | 첫 기능 완성 (5단계) |
| → 다음 | 도메인 확장 · 본인 앱 만들기 | 책은 여기까지. 이후는 자율 |

---

## 관련 문서

- [`Android Deployment`](../infra/android-deployment.md) — Android 상세
- [`iOS Deployment`](../infra/ios-deployment.md) — iOS 상세
- [`CI / CD`](../infra/ci-cd.md) — 워크플로우 상세
- [`Secrets Management`](../infra/secrets-management.md) — Secrets 관리
- [`Security`](../infra/security.md) — 난독화 · 보안
