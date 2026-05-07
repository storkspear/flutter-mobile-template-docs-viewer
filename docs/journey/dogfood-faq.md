# Dogfood FAQ

파생 레포 개발자가 자주 묻는 질문.

> 에러 증상 기반 트러블슈팅은 [`Pitfalls`](./dogfood-pitfalls.md) 참조.

---

## 기본

### Q. 이 템플릿을 어떻게 복제하나요?

**A.** GitHub 의 **"Use this template"** 버튼을 사용해주세요. 히스토리가 끊긴 독립 레포가 생성돼요. 근거: [`ADR-001`](../philosophy/adr-001-template-cherry-pick.md).

### Q. 템플릿 업데이트를 어떻게 가져오나요?

**A.** 수동 cherry-pick. [`Migration from Template`](../reference/migration-from-template.md) 참조.

### Q. 왜 Kit 이 나눠져 있나요?

**A.** 앱마다 필요 기능이 다름. 로컬 전용 앱에 Sentry SDK · Apple Sign In 플러그인이 박혀 있으면 바이너리 낭비 + 스토어 리뷰 문제. 근거: [`ADR-003`](../philosophy/adr-003-featurekit-registry.md).

---

## 아키텍처

### Q. `core/`, `kits/`, `common/`, `features/` 차이가 뭐예요?

**A.**
- `core/` — 모든 앱 필수 기반 (테마 · 저장소 · 위젯)
- `kits/` — 선택 14개 (인증 · 알림 · 차트 · 결제 등)
- `common/` — 여러 Kit 조립 지점 (DI · 라우터 · 스플래시)
- `features/` — 파생 레포 도메인 영역 (템플릿은 스텁)

자세한 건 [`ADR-002`](../philosophy/adr-002-layered-modules.md).

### Q. 왜 `common/` 에 DI 가 있나요? Kit 이 Provider 를 기여하는 거 아닌가요?

**A.** Kit 은 **자기 관련** Provider 만 기여. 여러 Kit 을 **조립** 하는 DI (예: `apiClientProvider` 가 `authServiceProvider` 와 연결) 는 `common/providers.dart` 에. `features/` 가 사용하는 Provider 도 여기.

### Q. ViewModel 이 다른 ViewModel 을 쓸 수 있나요?

**A.** 권장하지 않아요. ViewModel 은 **Screen-local 상태**예요. 공유 상태는 Service (Kit 레벨) 로 올려서 두 ViewModel 이 같은 Service 를 참조하게 해주세요.

---

## 네트워크

### Q. 401 을 ViewModel 이 직접 처리해야 하나요?

**A.** 아니요. `AuthInterceptor` 가 **자동으로** refresh + 재시도. ViewModel 은 `ApiException.isUnauthorized` 만 체크 → 진짜 인증 실패 (refresh 도 실패) 시 signOut. [`ADR-010`](../philosophy/adr-010-queued-interceptor.md).

### Q. 왜 서버 응답이 `{data, error}` 구조인가요?

**A.** 성공 · 실패가 **상호 배타** 라 클라이언트가 간단히 분기 가능. [`ADR-009`](../philosophy/adr-009-backend-contract.md).

### Q. `snake_case` JSON 도 지원하나요?

**A.** 지원하지 않아요. 백엔드 · 프론트 둘 다 **camelCase** 로 고정돼 있어요. 짝 `template-spring` 이 Jackson 기본값 camelCase 로 직렬화해요.

### Q. GraphQL · tRPC 로 바꾸고 싶어요.

**A.** 가능하지만 템플릿이 지원하지 않아요. 파생 레포에서 자체 통합이 필요해요. 이 경우 `backend_api_kit` 대신 새 Kit 을 만들고, 에러 처리 · 인터셉터 패턴을 자체 설계해야 해요.

---

## 인증

### Q. 같은 이메일로 여러 앱에 가입할 수 있나요?

**A.** 네. **앱별 독립 유저 모델** 이라 각 앱의 `users` 테이블이 다름. 같은 이메일이라도 앱 A · B 는 별개 계정. [`ADR-012`](../philosophy/adr-012-per-app-user.md).

### Q. 통합 계정 (한 번 가입하면 모든 앱 로그인) 가능한가요?

**A.** 기본 설계는 통합 아님. 필요하면 백엔드에서 별도 설계 — 하지만 인디 앱 공장엔 권장 안 함 (복잡도 증가).

### Q. 소셜 로그인 중 하나 (예: Google 만) 만 쓸 수 있나요?

**A.** 가능. `auth_kit` 의 Google · Apple 은 독립. 사용 안 하는 건 로그인 화면에서 숨기면 돼요.

### Q. 이메일 인증 · 비번 재설정은 어떻게?

**A.** `auth_kit` 이 `/verify-email` · `/forgot-password` 화면 자동 제공. 백엔드가 관련 엔드포인트 제공해야 해요.

---

## Kit

### Q. 새 Kit 을 추가하려면?

**A.**
1. `lib/kits/<kit_name>/` 폴더 생성
2. `kit_manifest.yaml` · `<kit_name>.dart` 작성
3. `app_kits.yaml` · `main.dart` 활성화
4. `configure_app.dart` 검증

템플릿은 `update_kit` 같은 간단한 Kit 복사 추천. [`FeatureKit Contract`](../architecture/featurekit-contract.md).

### Q. Kit 은 꼭 AppKit 을 extends 해야 하나요?

**A.** 네. `AppKits.install` 이 `AppKit` 타입만 받음. 모든 라이프사이클 · 기여 메서드가 여기서 나옴.

### Q. Kit 간 공유 상태가 있어요. 어떻게 하나요?

**A.** Service 레벨로 올려서 두 Kit 의 Provider 가 같은 Service 참조. 또는 `common/providers.dart` 에 공통 Provider 정의.

---

## 상태 관리

### Q. Riverpod 2.x 의 `Notifier` · `AsyncNotifier` 는 왜 안 쓰나요?

**A.** 현재 `StateNotifier` 가 안정적 · 생태계 풍부. `Notifier` 는 아직 마이그레이션 도구 · 레퍼런스 덜 성숙. 전환 비용이 이득 초과. [`ADR-005 교훈 2`](../philosophy/adr-005-riverpod-mvvm.md).

### Q. BLoC 이나 GetX 로 바꿔도 되나요?

**A.** 가능하지만 템플릿의 모든 ViewModel · 테스트 · 컨벤션이 Riverpod 기준. 바꾸려면 대규모 리팩터 필요. 솔로 운영엔 비추천.

### Q. Provider 가 너무 많아져서 어떻게 관리하나요?

**A.** Kit 별 `lib/kits/<kit>/<kit>_providers.dart` 로 분리. 또는 도메인별 `lib/features/<domain>/providers.dart`. `common/providers.dart` 는 **전역 공유** 만.

---

## UI · 테마

### Q. 앱 색상을 바꾸려면?

**A.** `AppPalette` 를 extends 한 클래스 정의 + `seed` 색상만 지정. 나머지 Material 3 스키마 자동. [`ADR-015`](../philosophy/adr-015-palette-registry.md).

```dart
class MyPalette extends AppPalette {
  @override String get id => 'my-palette';
  @override String get name => 'My App';
  @override Color get seed => const Color(0xFFFF6B35);
}
```

### Q. 다크모드 지원 자동인가요?

**A.** 네. `AppPalette.supportsDarkMode = true` (기본값) 면 `darkScheme()` 자동 생성. `MaterialApp.darkTheme` 에 연결.

### Q. 폰트를 바꾸려면?

**A.** **폰트 패밀리 교체**는 `AppTypeface` 를 extends 한 클래스를 만든 뒤 `AppTypefaceRegistry.install(MyTypeface())` 로 등록해주세요. `pubspec.yaml` 의 `fonts:` + `assets/fonts/` 자산 등록도 필요해요. **텍스트 스타일 토큰**(headline/body/caption 등)은 `AppTypography` 에서 다루고, `Theme.of(context).textTheme` 에 반영돼요.

### Q. 스플래시 화면을 커스텀하려면?

**A.** `flutter_native_splash.yaml` 수정 + `regenerate-assets.sh`. 또는 Dart 스플래시 (`LoadingView`) 를 커스텀 위젯으로 교체.

---

## i18n

### Q. 한국어만 쓸 건데 i18n 꼭 해야 해요?

**A.** 네. 나중에 영어 · 일본어 등 추가하려면 비용이 기하급수적. 처음부터 하면 하루, 나중에 하면 1주. [`ADR-016`](../philosophy/adr-016-i18n-from-start.md).

### Q. ViewModel 에서 번역 문자열을 쓸 수 있나요?

**A.** 안 됨. ViewModel 은 `BuildContext` 가 없어 `S.of(context)` 접근 불가. **code 만 state 에 저장**, Screen 에서 번역.

### Q. 새 언어 추가는 어떻게?

**A.** `lib/core/i18n/app_<locale>.arb` 추가 → 모든 키 번역 → `flutter gen-l10n`. **코드 수정 0**.

---

## 테스트

### Q. 모든 Kit 에 대해 계약 테스트를 써야 하나요?

**A.** 네. `{kit_name}_contract_test.dart` 가 필수. [`Contract Testing`](../testing/contract-testing.md).

### Q. ViewModel 테스트에 Kit 설치 필요한가요?

**A.** 대부분 아니요. ViewModel 은 Provider 의존만 있으니 `ProviderContainer(overrides: [...])` 로 mock 주입. 통합 테스트만 `AppKits.install` 필요.

### Q. Golden 이미지 테스트 필요한가요?

**A.** 권장 아님 (유지 비용 큼). 복잡한 UI 만 선택적으로. 대부분은 위젯 테스트로 충분.

---

## 배포

### Q. Android · iOS 동시 배포 가능한가요?

**A.** 현재는 Android 만 GHA 자동 배포(`release-android.yml` — `git tag v*` 트리거). iOS 워크플로우는 미구현이라 fastlane 수동 또는 Xcode Archive 로 TestFlight 업로드해요. 향후 iOS 워크플로우가 추가되면 동시 배포가 됩니다 (단 GHA 의 `macos-latest` 는 비용이 높아 트리거 정책 설계 필요).

### Q. Play Console 에 최초 업로드는 수동이에요?

**A.** 네. Play Console API 는 **이미 존재하는 앱에만** 업로드 가능. 최초 1번은 Play Console 웹에서 AAB 직접 업로드 + 내부 테스트 track 릴리스.

### Q. Sentry 심볼 업로드 실패하면 어떻게?

**A.** 크래시 스택이 난독화 상태로 저장돼서 원인 추적 불가. 수동 재업로드:

```bash
npx @sentry/cli upload-dif --org $ORG --project $PROJECT build/app/symbols
```

---

## 운영

### Q. 앱 10개 운영하는데 Sentry 프로젝트도 10개인가요?

**A.** 네. 각 앱이 자기 Sentry 프로젝트 → 크래시 분리. PostHog 도 마찬가지. 대시보드 관리 비용이 감당 가능한 수준이어야 (프롤로그 제약 1).

### Q. 백엔드가 꺼지면 앱이 안 돼요. 어떻게?

**A.** 백엔드 연동 앱은 그럼. `CachedRepository.networkFirst` 정책으로 **오프라인 fallback** 제공하거나, 상태 페이지 알림 (Downtime banner). 단 완전한 오프라인 우선 앱은 `backend_api_kit` 빼고 `local_db_kit` 만 쓰는 유형.

---

## 기타

### Q. Flutter 말고 React Native · Swift · Kotlin 으로 바꿔도 되나요?

**A.** 템플릿이 Flutter 전제. 다른 프레임워크는 별도 템플릿 필요. 짝 `template-spring` 은 유지 가능.

### Q. 웹 · 데스크톱 지원?

**A.** 현재는 Android · iOS 만. Flutter 자체는 지원하지만 SSL pinning · Secure storage · push 같은 일부 Kit 이 모바일 전용.

### Q. 기여하고 싶어요.

**A.** 템플릿 레포에 PR. 단 **템플릿 중립성 규칙** 준수 — 특정 앱/회사 이름 · 자격증명 금지.

---

## 관련 문서

- [`Pitfalls`](./dogfood-pitfalls.md) — 증상별 트러블슈팅
- [`Philosophy 인덱스`](../philosophy/README.md) — 설계 결정 배경
- [`Conventions Overview`](../conventions/README.md) — 코딩 규약
- [`Features 인덱스`](../features/README.md) — Kit 상세
