# ads_kit

**AdMob 배너 광고 + UMP 동의 폼 + ATT 요청 (iOS 14+)**. 활성화 시 자동으로 동의 UX 처리.

---

## 개요

- **AdMob 배너**: `BannerAdWidget` 한 줄로 배치
- **UMP (User Messaging Platform)**: GDPR 지역 자동 동의 폼
- **ATT (App Tracking Transparency)**: iOS 14+ 자동 시스템 다이얼로그
- **테스트 ID**: 기본값. 출시 전 실제 AdMob ID 로 교체 필수

---

## 활성화

```yaml
# app_kits.yaml
kits:
  ads_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  AdsKit(
    androidBannerUnitId: 'ca-app-pub-XXXX/YYYY',
    iosBannerUnitId: 'ca-app-pub-XXXX/ZZZZ',
  ),
]);
```

기본값은 **Google 테스트 ID** — 개발 · 테스트만. 출시 빌드엔 반드시 교체.

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `AdsKit` | `AppKit` 구현. UMP · ATT BootStep 기여 |
| `BannerAdWidget` | 배너 광고 위젯 |
| `UmpConsentStep` | GDPR 동의 폼 (BootStep) |
| `AttPermissionStep` | iOS ATT 요청 (BootStep) |
| `AdConfig` | Unit ID · 테스트 모드 설정 |

---

## 사용 예

```dart
// 화면 하단에 배너
Scaffold(
  body: ListView(...),
  bottomNavigationBar: BannerAdWidget(),  // ← 한 줄로 끝
)
```

---

## 파생 레포 체크리스트

- [ ] [AdMob Console](https://apps.admob.com/) 앱 등록
- [ ] 광고 단위 생성 (배너 · 전면 · 리워드)
- [ ] Unit ID 복사 → `AdsKit(androidBannerUnitId: ..., iosBannerUnitId: ...)`
- [ ] `android/app/src/main/AndroidManifest.xml` 의 `com.google.android.gms.ads.APPLICATION_ID` meta-data 업데이트
- [ ] `ios/Runner/Info.plist` 의 `GADApplicationIdentifier` 업데이트
- [ ] `NSUserTrackingUsageDescription` 문구 앱 성격에 맞게 다듬기
- [ ] UMP: [Google 문서](https://developers.google.com/admob/flutter/privacy) 에 따라 privacy policy URL 등록
- [ ] 테스트: 실제 기기 (에뮬레이터 아님) 에서 광고 로딩 확인

---

## Code References

- [`lib/kits/ads_kit/ads_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/ads_kit/ads_kit.dart)
- [`lib/kits/ads_kit/banner_ad_widget.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/ads_kit/banner_ad_widget.dart)
- [`lib/kits/ads_kit/ump_consent_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/ads_kit/ump_consent_step.dart)
- [`lib/kits/ads_kit/att_permission_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/ads_kit/att_permission_step.dart)
