# charts_kit

**`fl_chart` 래핑 차트 위젯**. 라인 · 도넛 · 파이 차트 표준화.

---

## 개요

- **fl_chart 기반**: 검증된 Flutter 차트 라이브러리
- **래핑 위젯**: `AppLineChart` · `AppPieChart` · `DonutGauge`
- **테마 통합**: `AppPalette` 색상 자동 적용
- **접근성**: semanticLabel 지원

---

## 활성화

```yaml
# app_kits.yaml
kits:
  charts_kit: {}
```

```dart
// lib/main.dart
await AppKits.install([
  ChartsKit(),
  // ...
]);
```

---

## 제공 위젯

| 위젯 | 용도 |
|------|------|
| `AppLineChart` | 시계열 · 추이 |
| `AppPieChart` | 비율 (카테고리 분포) |
| `DonutGauge` | 목표 대비 진행률 (도넛) |

---

## 사용 예

```dart
AppLineChart(
  spots: [
    FlSpot(0, 100),
    FlSpot(1, 250),
    FlSpot(2, 180),
  ],
  semanticLabel: '지난 3일 지출 추이',
)

DonutGauge(
  value: 0.72,
  label: '72%',
  semanticLabel: '일일 목표 달성률',
)
```

---

## Code References

- [`lib/kits/charts_kit/charts_kit.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/charts_kit/charts_kit.dart)
- [`lib/kits/charts_kit/app_line_chart.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/charts_kit/app_line_chart.dart)
- [`lib/kits/charts_kit/app_pie_chart.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/charts_kit/app_pie_chart.dart)
- [`lib/kits/charts_kit/donut_gauge.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/charts_kit/donut_gauge.dart)
