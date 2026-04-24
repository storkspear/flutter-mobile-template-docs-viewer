# iOS Deployment

**Fastlane + App Store Connect + TestFlight** 배포. macOS 러너 필수 (GitHub Actions 에서 `macos-latest`).

> ⚠️ 본 템플릿의 iOS 자동 배포 워크플로우는 **작성 예정**. 현재는 수동 배포 또는 Fastlane 로컬 실행.

---

## 최초 설정 (1회)

### 1. Apple Developer 계정 + Bundle ID

- [Apple Developer](https://developer.apple.com) 유료 계정 ($99/년)
- Bundle ID 등록: `Identifiers` → `+` → App IDs
- Capability: Sign in with Apple (auth_kit 쓰면) · Push Notifications (notifications_kit 쓰면)

### 2. 인증서 + 프로비저닝 프로파일

**Fastlane match 권장** — 팀원 간 자격 증명 동기화:

```bash
cd ios
bundle exec fastlane match appstore --readonly=false
```

또는 수동:
- Keychain Access → Certificate Assistant → Request Certificate
- Apple Developer Portal 에서 Distribution Certificate 생성
- App Store Provisioning Profile 다운로드 → Xcode 에 import

### 3. App Store Connect 앱 등록

- [App Store Connect](https://appstoreconnect.apple.com) → My Apps → `+`
- Bundle ID 선택 · SKU · 앱 이름 입력
- TestFlight 활성화

### 4. Fastlane API Key

App Store Connect → Users and Access → Keys → `+`  
권한: Developer · Access to Download Reports

생성된 `.p8` 파일 + Key ID + Issuer ID 를 GitHub Secrets 에.

---

## Fastlane 구성 (예정)

```ruby
# ios/fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Deploy to TestFlight"
  lane :beta do
    match(type: "appstore", readonly: true)

    build_app(
      scheme: "Runner",
      export_method: "app-store",
      export_options: {
        provisioningProfiles: {
          "com.example.app" => "match AppStore com.example.app"
        }
      }
    )

    upload_to_testflight(
      api_key_path: "fastlane/app_store_connect_api_key.json",
      skip_waiting_for_build_processing: true,
    )
  end
end
```

---

## GHA 워크플로우 (예정)

```yaml
# .github/workflows/release-ios.yml (예정)
on:
  push:
    tags: ['v*']

jobs:
  release-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - uses: ruby/setup-ruby@v1

      - name: Install CocoaPods
        run: cd ios && pod install

      - name: Write API Key
        run: |
          cat > ios/fastlane/app_store_connect_api_key.json <<EOF
          {
            "key_id": "${{ secrets.APP_STORE_KEY_ID }}",
            "issuer_id": "${{ secrets.APP_STORE_ISSUER_ID }}",
            "key": "${{ secrets.APP_STORE_KEY_CONTENT }}",
            "in_house": false
          }
          EOF

      - name: Fastlane beta
        run: cd ios && bundle exec fastlane beta

      - name: Upload Sentry symbols
        run: ...
```

---

## 주요 차이 (Android vs iOS)

| 항목 | Android | iOS |
|------|---------|-----|
| 빌드 환경 | Ubuntu (ubuntu-latest) | macOS (macos-latest) |
| 시간 | ~10분 | ~15~20분 |
| 비용 (GHA) | 낮음 | macOS 런타임이 10배 비쌈 |
| 인증서 | keystore 1개 | Cert + Provisioning Profile + (Push APNs key) |
| 심사 | Play: 시간 단위 | App Store: 1 ~ 7일 |
| 베타 track | Internal (100명) → Closed → Open → Prod | TestFlight (10,000명) → Production |

---

## TestFlight 내부 테스트

빌드 업로드 후 App Store Connect 에서:

1. TestFlight → Internal Testing → Testers 추가 (본인 Apple ID)
2. 앱 빌드 승인 (수 분 ~ 시간)
3. TestFlight 앱으로 설치

**외부 테스트** 는 Apple 리뷰 필요 (1~2일).

---

## 파생 레포 체크리스트

- [ ] Apple Developer 계정 확보
- [ ] Bundle ID 등록 + Capabilities 추가
- [ ] Fastlane match repo 생성 (git repo 로 인증서 동기화)
- [ ] App Store Connect 앱 등록
- [ ] API Key 발급 → GitHub Secrets (`APP_STORE_KEY_ID` · `ISSUER_ID` · `KEY_CONTENT`)
- [ ] `rename-app.sh` 로 Bundle ID 일괄 변경
- [ ] 로컬에서 `bundle exec fastlane beta` 테스트
- [ ] TestFlight 에 빌드 업로드 확인

---

## 관련 문서

- [`android-deployment.md`](./android-deployment.md)
- [`security.md`](./security.md) — Keychain accessibility
- [Fastlane iOS 공식](https://docs.fastlane.tools/getting-started/ios/setup/)
