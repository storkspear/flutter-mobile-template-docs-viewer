# Android 배포 (파생 레포 체크리스트)

이 템플릿은 Android 배포 인프라(서명·Fastlane·GHA 워크플로·Sentry mapping 업로드)를 이미 갖추고 있다. 파생 레포에서는 아래 절차만 수행하면 즉시 Play Internal 배포 가능.

## 준비 (한 번만)

1. **Google Play Developer 계정**: https://play.google.com/console 가입 ($25 일회성)
2. **Play Console에 앱 생성**: Create App → 이름 입력 → Package name은 이 레포 `android/app/build.gradle.kts`의 `applicationId`와 동일해야 함
3. **Service Account JSON 발급**:
   - Play Console → Settings → API access → Create Service Account
   - Google Cloud Console에서 JSON key 다운로드 (`play-store-credentials.json`)
   - **이 파일은 커밋 금지** (`.gitignore` 처리됨)
4. **Sentry Auth Token 발급** (이 레포의 관측성 기능 쓰는 경우):
   - https://<your-org>.sentry.io/settings/auth-tokens/ → Create Token
   - Scopes: `project:read`, `project:releases`, `project:write`

## 키스토어 생성 (앱당 한 번)

```bash
./scripts/generate-upload-keystore.sh <app-slug>
# 예: ./scripts/generate-upload-keystore.sh money-app
```

결과:
- `android/app/upload-keystore.jks` (gitignore됨)
- `android/key.properties` (gitignore됨)
- `~/Documents/keystores-pending/<app-slug>/` (임시 백업)

## GitHub Secrets 업로드 (앱당 한 번)

```bash
./scripts/upload-secrets-to-github.sh <app-slug>
```

이후 수동 등록 (안내 출력됨):

```bash
# Play Console service account JSON 내용 전체
gh secret set PLAY_STORE_JSON_KEY < path/to/play-store-credentials.json

# Sentry (관측성 사용 시)
gh secret set SENTRY_AUTH_TOKEN    # sntrys_...
gh secret set SENTRY_ORG           # 예: storkspear
gh secret set SENTRY_PROJECT       # 예: flutter
```

## 배포 실행

### 방법 A: Git tag 트리거 (추천)

```bash
git tag v1.0.0
git push origin v1.0.0
```

→ `.github/workflows/release-android.yml`이 자동으로:
1. 체크아웃 + Flutter/Ruby 셋업
2. 키스토어 디코딩
3. `fastlane android beta` 실행 — **Dart 심볼 난독화(`--obfuscate --split-debug-info=build/symbols`) 포함** AAB 빌드 + Play Internal 업로드
4. Sentry 심볼 업로드: ProGuard mapping(R8 결과) + **Dart debug symbols** (두 종류 다 `SENTRY_AUTH_TOKEN` 있으면 자동 업로드)

### 방법 B: 로컬 수동 실행

```bash
cd android
bundle install
bundle exec fastlane android beta
```

## 주기적 백업

월 1회 정도:
```bash
./scripts/batch-backup-keystores.sh /Volumes/NAS/keystores
```
→ `~/Documents/keystores-pending/`의 모든 앱 키스토어를 암호화 zip으로 묶어 지정 위치로 이전.

## 트러블슈팅

### `keystore not found` in CI
→ `ANDROID_KEYSTORE_BASE64` Secret이 비어있거나 잘못됨. `upload-secrets-to-github.sh` 재실행.

### Play Upload 실패: `APK signature does not match`
→ 이전에 업로드한 키와 다른 키로 서명. Play App Signing 활성화되어 있다면 upload key 재발급 가능.

### R8 runtime crash: `NoClassDefFoundError`
→ 새 의존성이 R8에 의해 제거됨. `android/app/proguard-rules.pro`에 `-keep class ...` 규칙 추가.

### mapping.txt 업로드 안 됨
→ `SENTRY_AUTH_TOKEN` Secret 미설정. 경고만 출력되고 빌드 자체는 통과.

### Sentry 대시보드의 Dart 스택트레이스가 `aA`, `bC` 같이 난독화돼 보임
→ Dart symbols(`build/symbols/`)가 Sentry에 업로드되지 않은 상태. 원인 체크:
1. `SENTRY_AUTH_TOKEN`에 `project:releases`, `project:write` 권한 포함됐는지
2. `upload_sentry_mapping` lane이 실행됐는지 (GHA 로그 확인)
3. Sentry 프로젝트의 Debug Files 페이지(`Settings → Debug Files`)에 심볼 올라왔는지

수동 재업로드:
```bash
cd android
SENTRY_ORG=<org> SENTRY_PROJECT=<project> SENTRY_AUTH_TOKEN=<token> \
  bundle exec fastlane android upload_sentry_mapping version:<version>
```
