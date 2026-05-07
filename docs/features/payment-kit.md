# payment_kit

결제 통합 FeatureKit **골격**. Stripe 사용을 가정한 인터페이스 + Debug 폴백 + Stripe 구현체 placeholder. **template 에선 의도적으로 SDK 의존을 추가 안 했어요** — 결제 정책 (Stripe vs Toss vs PayPal · 가격 모델 · 정산 백엔드) 이 derived repo 마다 달라서.

> ⚠️ **이 kit 은 template 에 commit 됐지만 `app_kits.yaml` default 에는 enable 안 됨**. 결제 도입할 때만 활성화.

## 활성화 (template 시점, Debug 폴백)

`app_kits.yaml`:
```yaml
kits:
  backend_api_kit: {}    # requires 충족 필수
  payment_kit: {}
```

`lib/main.dart`:
```dart
await AppKits.install([
  BackendApiKit(),
  PaymentKit(),  // service 주입 안 하면 DebugPaymentService default
]);
```

→ 결제 호출 시 콘솔에 `[Payment] DebugPaymentService.charge ...` 로그 + fake `debug-{timestamp}` transactionId 반환.

## derived repo 활성화 (실구현)

1. `pubspec.yaml` 에 결제 SDK 추가 (`flutter_stripe` 또는 자체 SDK)
2. `lib/kits/payment_kit/stripe_payment_service.dart` 의 `init` / `charge` 채움
3. `lib/main.dart` 에서 실구현체 주입:
   ```dart
   PaymentKit(service: StripePaymentService(publishableKey: const String.fromEnvironment('STRIPE_KEY')))
   ```
4. `--dart-define=STRIPE_KEY=pk_test_...` 빌드

## 자세한 메커니즘

핵심 API · 파생 레포 체크리스트 · 제거 가이드 · 테스트 패턴은 [`lib/kits/payment_kit/README.md`](../../lib/kits/payment_kit/README.md) 참고.

## Code References

- [`lib/kits/payment_kit/payment_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/payment_kit/payment_kit.dart) — AppKit 구현 + `_PaymentInitStep`
- [`lib/kits/payment_kit/payment_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/payment_kit/payment_service.dart) — interface + `PaymentResult` + `PaymentException`
- [`lib/kits/payment_kit/debug_payment_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/payment_kit/debug_payment_service.dart) — Debug 폴백
- [`lib/kits/payment_kit/stripe_payment_service.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/payment_kit/stripe_payment_service.dart) — Stripe placeholder
