# Glossary

프로젝트 특유 용어 사전. 표기 고정 — 검색 · 치환 · 문서 일관성을 위해.

---

## 레포 · 조직

| 용어 | 표기 | 설명 |
|------|------|------|
| 템플릿 레포 | `template-flutter` | 본 레포. GitHub Template Repository |
| 짝 백엔드 | `template-spring` | 함께 쓰이는 백엔드 레포 |
| 파생 레포 | 앱별 고유 이름 | 템플릿에서 "Use this template" 으로 만든 레포 |
| fork | (금지) | "파생 레포" 로 대체 — Use Template 방식이라 fork 아님 |
| cherry-pick 전파 | — | 템플릿 개선을 파생 레포로 수동 가져오기 |

---

## 아키텍처

| 용어 | 표기 | 설명 |
|------|------|------|
| Kit · AppKit | `AppKit` (클래스), `auth_kit` (폴더) | 기능 단위 플러그인 |
| FeatureKit 레지스트리 | `AppKits` | 설치된 Kit 중앙 관리 |
| Kit 계약 | — | `AppKit` 추상 클래스의 속성 · 메서드 |
| Kit 조립 | — | `app_kits.yaml` + `main.dart` 에 Kit 선언 |
| BootStep | `BootStep` | 스플래시에서 순차 실행되는 부팅 단계 |
| SplashController | `SplashController` | BootStep 실행기 |
| 3계층 모듈 | — | `core/ · kits/ · common/ · features/` |
| Port · Adapter | — | (본 프로젝트는 용어 안 씀. Kit 이 이 역할) |

---

## 상태 관리

| 용어 | 표기 | 설명 |
|------|------|------|
| ViewModel | `*ViewModel` | `StateNotifier<*State>` 상속 |
| State 클래스 | `*State` | 불변 데이터 + `copyWith` |
| Provider | `Provider` (영문) | Riverpod DI 노드 |
| 전역 DI | `lib/common/providers.dart` | 모든 전역 Provider 정의 |
| autoDispose | — | 화면 이탈 시 자동 정리 |
| Late Binding | — | `ref.read` 콜백으로 순환 의존 해결 ([`ADR-007`](../philosophy/adr-007-late-binding.md)) |

---

## 네트워크 · 인증

| 용어 | 표기 | 설명 |
|------|------|------|
| ApiClient | `ApiClient` | Dio 래퍼 |
| ApiResponse · PageResponse | 영문 유지 | 응답 래퍼 |
| ApiException | `ApiException` | 표준 예외 |
| ErrorCode | `ErrorCode.*` 상수 | 서버 enum 1:1 매핑 |
| safeErrorCode · safeErrorMessage | — | UI 안전 에러 추출 |
| AuthInterceptor · ErrorInterceptor · LoggingInterceptor | 영문 | 3층 인터셉터 |
| `appSlug` | 단일 문자열 | JWT · URL 경로의 앱 식별자 |
| skipAuth | — | `ApiClient.postRaw` 등의 토큰 우회 플래그 |

---

## 저장소

| 용어 | 표기 | 설명 |
|------|------|------|
| SecureStorage | `SecureStorage` | Keychain · EncryptedSharedPreferences 래퍼 |
| PrefsStorage | `PrefsStorage` | SharedPreferences 래퍼 |
| TokenStorage | `TokenStorage` | access · refresh 원자 저장 |
| CachedRepository | `CachedRepository` | 5가지 캐시 정책 |
| SWR · staleWhileRevalidate | 영문 | 캐시 즉시 + 백그라운드 갱신 |
| `repairIfPartial` | — | 반쪽 토큰 상태 복구 |

---

## UI · 테마

| 용어 | 표기 | 설명 |
|------|------|------|
| AppPalette | `AppPalette` | 브랜드 색상 추상 |
| AppPaletteRegistry | `AppPaletteRegistry` | 팔레트 등록 · 교체 |
| 시드 색상 | `seed` | Material 3 `ColorScheme.fromSeed` |
| 디자인 토큰 | — | spacing · typography · shadow 등 |
| Skeleton | — | 로딩 UX 패턴 1 ([`ADR-017`](../philosophy/adr-017-loading-ux.md)) |
| Pull-to-refresh | — | 로딩 UX 패턴 2 |
| 버튼 스피너 | — | 로딩 UX 패턴 3 |
| TopProgressBar | `TopProgressBar` | 로딩 UX 패턴 4 |

---

## i18n

| 용어 | 표기 | 설명 |
|------|------|------|
| ARB | `.arb` 파일 | Application Resource Bundle (JSON 기반) |
| gen_l10n | `flutter gen-l10n` | Flutter i18n 코드 생성기 |
| 템플릿 언어 | — | 원문 언어 (본 프로젝트는 한국어) |
| S 클래스 | `S.of(context)` | 자동 생성 i18n 접근자 |
| ICU format | — | 복수형 · 성별 · 날짜 포맷 표준 |

---

## 배포 · 운영

| 용어 | 표기 | 설명 |
|------|------|------|
| Recipe | `recipes/*.yaml` | 3개 앱 샘플 구성 |
| 난독화 | Dart obfuscate · Android R8 | 리버스 엔지니어링 방어 |
| SSL pinning | opt-in | MITM 방어 |
| Keychain · EncryptedSharedPreferences | 네이티브 | 하드웨어 지원 암호화 |
| Fastlane | `fastlane` | 배포 자동화 |
| Play Internal · TestFlight | — | 각 스토어의 내부 테스트 track |

---

## 솔로 인디 운영

| 용어 | 표기 | 설명 |
|------|------|------|
| 솔로 | — | 한 명의 개발자 |
| 앱 공장 전략 | — | 한 사람이 여러 앱을 고 cadence 로 출시 |
| 3가지 제약 | — | 운영 가능성 · 시간 희소성 · 복권 사기 모델 ([`philosophy/README`](../philosophy/README.md)) |
| 비목표 | — | 명시적으로 "안 하는 것" — HA 99.99% · 멀티 리전 등 |
| 관리형 서비스 | — | Sentry · PostHog · Firebase 등 자체 운영 대신 |

---

## 약어

| 약어 | 풀어쓰기 |
|------|---------|
| ADR | Architecture Decision Record |
| MVVM | Model-View-ViewModel |
| DI | Dependency Injection |
| JWT | JSON Web Token |
| FCM | Firebase Cloud Messaging |
| APNs | Apple Push Notification service |
| ATT | App Tracking Transparency |
| UMP | User Messaging Platform |
| AAB | Android App Bundle |
| SWR | Stale-While-Revalidate |
| CTA | Call To Action |
| PII | Personally Identifiable Information |
| MITM | Man-In-The-Middle |

---

## 표기 규칙

- **영문 유지**: AppKit · Provider · Riverpod · ADR · Port 같은 개념어
- **한글 사용**: 솔로 · 파생 레포 · 비목표 · 앱 공장 같은 프로젝트 특유 용어
- **혼용 금지**: "Kit" 과 "키트" 동시 사용 금지. 본 프로젝트는 "Kit" 만

---

## 관련 문서

- [`STYLE_GUIDE`](../STYLE_GUIDE.md) — §4 용어집 규칙 원본
- [`Philosophy 인덱스`](../philosophy/README.md) — 철학 · 제약 용어
