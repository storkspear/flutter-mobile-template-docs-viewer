# Android Deployment

**Fastlane + GitHub Actions + Play Console Internal** 배포. `git tag v1.0.0 && git push --tags` 만으로 자동 배포.

---

## 전체 흐름

```
개발자                         GitHub                    Play Console
  │                              │                          │
  │ git tag v1.0.0               │                          │
  │ git push --tags              │                          │
  │─────────────────────────────▶│                          │
  │                              │                          │
  │                 release-android.yml 트리거                │
  │                  1. Keystore 디코딩                        │
  │                  2. fastlane android beta                  │
  │                     (AAB 빌드 + 난독화 + 심볼 생성)           │
  │                  3. Play Store 업로드 (Internal track)      │
  │                  4. Sentry 심볼 업로드                       │
  │                              │─────────────────────────▶│
  │                              │                          │ 내부 테스터 배포
  │                              │                          │
```

---

## 최초 설정 (1회)

### 1. 업로드 키스토어 생성

```bash
./scripts/generate-upload-keystore.sh
```

생성 파일: `android/app/upload-keystore.jks` (커밋 금지)

### 2. 키스토어 · Play Console 자격 증명 GitHub Secrets 등록

```bash
./scripts/upload-secrets-to-github.sh
```

필요한 GitHub Secrets:
- `ANDROID_KEYSTORE_BASE64` — 업로드 키스토어 (base64 인코딩)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `PLAY_STORE_JSON_KEY` — Play Console 서비스 계정 JSON
- `SENTRY_AUTH_TOKEN` — 심볼 업로드
- `SENTRY_ORG` · `SENTRY_PROJECT`

### 3. Play Console 설정

- [Play Console](https://play.google.com/console) 에서 앱 생성
- 서비스 계정 생성 → JSON 키 다운로드 → Google Cloud Console 에서 "Android Publisher" 권한 부여
- 내부 테스트 track 활성화
- 최초 1번은 **수동 업로드** 필요 (AAB 직접 업로드) — 이후 API 로 가능

---

## 배포 트리거

```bash
# 버전 업 (pubspec.yaml 의 version 필드)
# version: 1.2.3+45
#         |     |
#         |     +- build number (Android versionCode)
#         +- semver (Android versionName)

git commit -am "chore: bump to 1.2.3+45"
git tag v1.2.3
git push origin main --tags
```

**GHA 워크플로우 자동 실행** → `release-android.yml`.

---

## 워크플로우 상세

```yaml
# .github/workflows/release-android.yml (개요)
on:
  push:
    tags: ['v*']

jobs:
  release-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2

      - name: Decode Keystore
        run: echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/app/upload-keystore.jks
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}

      - name: Write Play Store JSON
        run: echo "$PLAY_STORE_JSON_KEY" > android/play-store-credentials.json

      - name: Run fastlane beta (build + Play Internal upload)
        working-directory: android
        env:
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
          POSTHOG_HOST: ${{ secrets.POSTHOG_HOST }}
        # Fastfile 의 build_release lane 이 ENV → --dart-define 으로 주입
        # (--obfuscate + --split-debug-info=build/symbols 포함)
        run: bundle exec fastlane android beta

      - name: Upload Sentry mapping
        # ProGuard mapping (Kotlin/Java) + Dart split-debug-info 둘 다 업로드
        working-directory: android
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        run: bundle exec fastlane android upload_sentry_mapping version:${{ steps.version.outputs.version }}

      - name: Cleanup
        run: rm -f android/app/upload-keystore.jks android/play-store-credentials.json
```

---

## Fastlane 구성

```ruby
# android/fastlane/Fastfile (요약 — 실제 4 lane 구성)
default_platform(:android)

platform :android do
  # 1) AAB 빌드 + Dart 난독화 + 관측성 키 주입
  lane :build_release do
    sh "cd ../.. && flutter build appbundle --release " \
       "--obfuscate --split-debug-info=build/symbols " \
       "--dart-define=SENTRY_DSN=#{ENV['SENTRY_DSN'] || ''} " \
       "--dart-define=POSTHOG_KEY=#{ENV['POSTHOG_KEY'] || ''}"
  end

  # 2) Play Internal 업로드 (build_release 호출 후)
  lane :beta do
    build_release
    upload_to_play_store(
      track: 'internal',
      aab: '../build/app/outputs/bundle/release/app-release.aab',
      json_key: ENV['PLAY_STORE_JSON_KEY_PATH'] || 'play-store-credentials.json',
      skip_upload_metadata: true,
      skip_upload_images: true,
      skip_upload_screenshots: true,
    )
  end

  # 3) Production 트랙 승격 (수동)
  lane :deploy do
    upload_to_play_store(track: 'production', track_promote_to: 'production', ...)
  end

  # 4) Sentry 심볼 업로드 (ProGuard mapping + Dart split-debug-info)
  lane :upload_sentry_mapping do |options|
    # sentry-cli 로 release new → upload-proguard → upload-dif → finalize
  end
end
```

---

## Internal → Closed → Open → Production

Play Console 워크플로우:

1. **Internal test**: 100명 이하 · 즉시 · 승인 불필요
2. **Closed test** (Alpha): 1000명 이하 · 이메일 초대
3. **Open test** (Beta): 무제한 · 공개 URL
4. **Production**: 정식 배포 · 심사 1~7일

본 GHA 는 **Internal 만** 자동 배포. 상위 track 승격은 Play Console 에서 수동.

---

## 트러블슈팅

### "Upload key not matching"

Play Console 의 App Signing 에서 "Upload certificate" 가 `upload-keystore.jks` 와 다르면 발생. 처음 앱 등록 시 **Play App Signing 활성화** + upload 인증서 지문 맞추기.

### "Version code already used"

`pubspec.yaml` 의 `version` 의 `+` 뒤 숫자가 Play 에 이미 올라간 값과 같거나 작으면 실패. 항상 증가.

### "Package name conflict"

Play Console 앱 패키지명과 Android `applicationId` 가 달라야. 새 앱 생성 시 `rename-app.sh` 결과 확인.

---

## 파생 레포 체크리스트

- [ ] `scripts/rename-app.sh <slug> com.<org>.<slug>` 실행 완료
- [ ] Play Console 앱 생성 + Play App Signing 활성화
- [ ] 서비스 계정 · JSON 키 발급 + Android Publisher 권한
- [ ] `generate-upload-keystore.sh` 로 keystore 생성
- [ ] `upload-secrets-to-github.sh` 로 모든 secrets 업로드
- [ ] 최초 AAB 수동 업로드 (Play Console)
- [ ] 내부 테스터 이메일 등록
- [ ] `v1.0.0` 태그 push → 자동 배포 확인

---

## 관련 문서

- [`ios-deployment.md`](./ios-deployment.md)
- [`security.md`](./security.md) — 난독화 · 심볼 업로드
- [`ci-cd.md`](./ci-cd.md)
- [`secrets-management.md`](./secrets-management.md)
- [`ADR-020 · 보안 방어선`](../philosophy/adr-020-security-hardening.md)
