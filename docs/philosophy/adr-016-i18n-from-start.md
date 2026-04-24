# ADR-016 · i18n 처음부터 (ARB + gen_l10n)

**Status**: Accepted. 현재 유효. 2026-04-24 기준 `l10n.yaml` 설정 + `lib/core/i18n/app_ko.arb` (템플릿) + `app_en.arb` + `flutter gen-l10n` 자동 생성 `app_localizations.dart`. 모든 사용자 가시 문자열은 ARB 에 선언.

## 결론부터

템플릿은 **첫 커밋부터 i18n 활성화** 상태예요. 한국어만 쓸 계획이어도 `S.of(context).loginButton` 같이 i18n 키로 접근. ARB 파일에 **ko / en 두 언어** 를 유지하고 `flutter gen-l10n` 으로 자동 생성. 나중에 영어 시장 진출 시 **기존 코드 수정 0**, 새 언어 추가 시 ARB 한 파일만. "나중에 i18n 도입" 의 비용이 1만배 차이 난다는 교훈에서 출발한 결정이에요.

## 왜 이런 고민이 시작됐나?

"이 앱은 한국어만" 이라고 시작한 프로젝트가 1년 뒤 영어권 출시를 결정하면 어떻게 되나요?

- 화면마다 `Text('로그인')` · `Text('비밀번호')` · `Text('오류가 발생했습니다')` 수백 군데
- 에러 메시지 하드코딩: `throw Exception('이메일 형식이 잘못됐습니다')`
- 다이얼로그 · 스낵바 · 버튼 레이블 전부

이걸 **일괄 검색해서 교체** 하는 비용이 어마어마해요. 실제 경험상 **"처음부터 넣은 비용의 10배, 100배, 극단적으로 1만배"** 가 될 수 있어요.

압력들이 부딪혀요.

**압력 A — 초기 진입 속도**  
"일단 MVP 빨리 만들자" 관점에선 i18n 키 선언 · ARB 파일 업데이트 · `flutter gen-l10n` 실행이 오버헤드. `Text('로그인')` 이 빠름.

**압력 B — 미래의 확장성**  
성공한 앱은 영어권 · 일본어권 · 스페인어권으로 확장 가능. 이때 코드베이스 수정 없이 **ARB 파일 추가** 만으로 끝나야.

**압력 C — 일관된 경험**  
에러 메시지 · 라벨 · 플레이스홀더를 한 곳 (ARB) 에서 관리. "이메일" 용어가 어떤 화면은 "메일", 어떤 화면은 "이메일 주소" 같은 불일치 방지.

**압력 D — 번역 외주 가능성**  
나중에 번역가에게 맡길 때 ARB 파일 전달 → 번역 후 반영. 코드에 문자열이 흩어져 있으면 번역 외주도 안 됨.

이 결정이 답해야 했던 물음이에요.

> **i18n 도입 시점을 "초기 MVP 이후" 가 아닌 "처음부터" 로 강제하는 게 솔로 환경에서 이득인가?**

## 고민했던 대안들

### Option 1 — 나중에 도입 (MVP 는 하드코딩)

`Text('로그인')` 으로 빠르게 진행. 필요할 때 i18n 전환.

- **장점**: 초기 개발 속도 빠름.
- **단점 1**: **전환 비용이 기하급수적**. 화면 10개일 때 1시간, 50개일 때 1주일, 200개일 때 포기 수준.
- **단점 2**: 전환 과정에서 **버그 폭탄** — 동일 문자열이 여러 곳에 중복, 어떤 건 놓침, i18n 키 충돌.
- **단점 3**: 에러 메시지 하드코딩 → i18n 전환 어려움 (throw 위치가 비-UI 라 `BuildContext` 없음).
- **탈락 이유**: 단기 이득 vs 장기 비용 비대칭. 압력 B 위반.

### Option 2 — 직접 Map 관리

`Map<String, Map<String, String>>` 으로 언어별 문자열 관리. `getTranslation('login', 'ko')`.

- **장점**: 커스텀 가능. 플러그인 의존 없음.
- **단점 1**: Flutter 공식 `flutter gen-l10n` 을 포기하면 **타입 안전 상실** (`S.of(context).login` vs `getTranslation('login')` — 전자는 오타 컴파일 에러).
- **단점 2**: 파라미터 치환 (`"안녕하세요, {name}!"`) 을 수동으로 구현 → 재발명.
- **단점 3**: ICU format (복수형 · 성별 등) 지원 0.
- **탈락 이유**: Flutter 공식 도구를 피할 이유 없음.

### Option 3 — ARB + gen_l10n (Flutter 공식) ★ (채택)

Flutter 공식 `intl` 패키지 + `flutter gen-l10n` 자동 코드 생성.

- **압력 A 부분 만족**: 초기 설정 비용 있음. 하지만 IDE extension · snippet 으로 완화.
- **압력 B 만족**: 새 언어 = ARB 파일 추가. 코드 0 수정.
- **압력 C 만족**: ARB 가 중앙 출처. 모든 문자열 단일 파일.
- **압력 D 만족**: ARB 는 JSON 표준 → 번역 플랫폼 · 외주 호환.

## 결정

### l10n.yaml 설정

```yaml
# l10n.yaml 전체
arb-dir: lib/core/i18n
template-arb-file: app_ko.arb      # 한국어를 템플릿 (원본) 으로
output-localization-file: app_localizations.dart
output-class: S                     # ShortCut — S.of(context)
nullable-getter: false              # ErrorCode enum 등 required
```

한국어를 **템플릿 언어** 로 지정. 즉 새 키는 먼저 `app_ko.arb` 에 추가되고, 다른 언어 (`app_en.arb`) 는 번역본.

### ARB 파일 구조

```json
// lib/core/i18n/app_ko.arb (템플릿)
{
  "@@locale": "ko",
  "login": "로그인",
  "signUp": "회원가입",
  "loginFailed": "로그인에 실패했습니다",
  "@loginFailed": {
    "description": "이메일 또는 비밀번호 오류 시"
  },
  "welcomeMessage": "안녕하세요, {name}!",
  "@welcomeMessage": {
    "description": "홈 화면 인사말",
    "placeholders": {
      "name": {"type": "String"}
    }
  }
}
```

```json
// lib/core/i18n/app_en.arb
{
  "@@locale": "en",
  "login": "Sign In",
  "signUp": "Sign Up",
  "loginFailed": "Sign in failed",
  "welcomeMessage": "Hello, {name}!"
}
```

### 자동 생성 코드

`flutter gen-l10n` 실행 시:

```
lib/core/i18n/
├── app_localizations.dart        # 진입점 (S 클래스)
├── app_localizations_ko.dart     # 한국어
└── app_localizations_en.dart     # 영어
```

### 사용 예

```dart
// Screen 에서
import 'package:flutter/material.dart';
import 'package:my_app/core/i18n/app_localizations.dart';

class LoginScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Column(children: [
        Text(S.of(context).login),                              // "로그인" / "Sign In"
        Text(S.of(context).welcomeMessage('Alice')),            // 파라미터 치환
        if (errorCode != null)
          Text(S.of(context).loginFailed),                      // 에러 메시지
      ]),
    );
  }
}
```

### MaterialApp 설정

```dart
// lib/app.dart 발췌
MaterialApp.router(
  localizationsDelegates: const [
    S.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: S.supportedLocales,  // ko, en
  // ...
)
```

### ViewModel 의 에러 처리 (핵심 패턴)

ViewModel 은 `BuildContext` 가 없으므로 **`S.of(context)` 접근 불가**. 대신 **에러 코드만 state 에 저장**.

```dart
// lib/kits/auth_kit/ui/login/login_view_model.dart 발췌
Future<void> signInWithEmail(String email, String password) async {
  try {
    await _ref.read(authServiceProvider).signInWithEmail(email, password);
  } catch (e) {
    state = state.copyWith(
      errorCode: safeErrorCode(e, fallbackCode: 'LOGIN_FAILED'),  // ← 코드만
    );
  }
}
```

```dart
// Screen 에서 번역
if (state.errorCode != null) {
  Text(_localizedError(context, state.errorCode!))
}

String _localizedError(BuildContext context, String code) {
  switch (code) {
    case 'LOGIN_FAILED': return S.of(context).loginFailed;
    case 'INVALID_CREDENTIALS': return S.of(context).invalidCredentials;
    // ...
    default: return S.of(context).unknownError;
  }
}
```

이 패턴이 **ViewModel 과 UI 의 책임 분리** 를 가능하게 해요. ViewModel 은 i18n 의존 0.

### 설계 선택 포인트

**포인트 1 — 한국어를 템플릿 언어로**  
템플릿 개발자가 한국어 사용자이므로 **한국어 원문 작성이 가장 빠름**. 영어는 번역본. 반대 (영어 템플릿 · 한국어 번역) 도 가능하지만 원문 언어가 템플릿이 자연.

**포인트 2 — `nullable-getter: false`**  
gen_l10n 의 기본은 `S.maybeOf(context)` (nullable) + `S.of(context)` (non-null). `nullable: false` 로 **non-null 만 생성** → 호출처가 `?.` 없이 바로 접근. delegate 가 항상 등록되어 있으니 안전.

**포인트 3 — ARB 의 `@키` 메타데이터 활용**  
`"@loginFailed": {"description": "..."}` 는 **번역가 지침**. 파라미터 있는 키는 `placeholders` 로 타입 명시 → 자동 생성 코드가 `String Function(String)` 이 아닌 `String Function({required String name})` 같이 named param 을 만들어 줌.

**포인트 4 — 에러 메시지는 "코드 + 번역" 분리**  
ViewModel 은 `errorCode`, Screen 에서 `S.of(context)` 변환. 이 관용은 **ADR-009 (백엔드 계약)** 의 `ErrorCode` enum 과 자연 연결 — 서버 에러 코드가 UI i18n 키로 직결.

**포인트 5 — 새 문자열 추가 시 양쪽 ARB 모두**  
한쪽만 추가하고 `gen-l10n` 돌리면 **빌드 실패** (다른 언어 파일에 키 없음). 이 제약이 오히려 안전장치 — "한국어만 넣고 영어 까먹음" 을 빌드에서 잡음.

**포인트 6 — `flutter gen-l10n` 은 수동 호출**  
빌드 시 자동 실행되게 할 수도 있지만, 명시적 수동 호출이 디버깅에 낫음. 새 키 추가 → `flutter gen-l10n` → 빌드 순서.

## 이 선택이 가져온 것

### 긍정적 결과

- **새 언어 추가 비용 최소**: 일본어 출시 결정 시 `app_ja.arb` 파일 하나 추가 + `flutter gen-l10n`. 코드 0 수정.
- **타입 안전**: `S.of(context).login` 의 `login` 오타 시 컴파일 에러. 런타임 실수 방지.
- **번역 외주 가능**: `app_en.arb` 파일을 번역가에게 전달 → 번역 → 되돌려받기. 코드 모름.
- **에러 메시지 구조화**: `errorCode` + i18n 변환 패턴이 서버 에러 코드와 자연 매핑.
- **파라미터 치환 안전**: `S.of(context).welcomeMessage('Alice')` 로 ICU format 지원.
- **복수형 · 성별 지원**: ICU format 으로 `"items": "{count, plural, =0{no items} =1{1 item} other{{count} items}}"` 같이 선언.

### 부정적 결과

- **초기 오버헤드**: `Text('로그인')` 한 줄 vs `ARB 키 정의 + gen-l10n + S.of(context).login` 3단계. 첫 앱 만들 때 2시간 추가.
- **gen-l10n 호출 잊기 쉬움**: ARB 수정 후 `flutter gen-l10n` 안 돌리면 IDE 자동완성이 옛 버전. "왜 새 키가 안 보이지?" 디버깅.
- **에러 메시지 변환 보일러플레이트**: 위의 `_localizedError` 함수가 각 Screen 에 필요. 중앙화 가능 (e.g., `extension ErrorCodeL10n on String`) 하지만 추가 설계.
- **ARB 파일이 커지면 관리 복잡**: 문자열 500개 넘으면 ARB 파일 수백 줄. 기능별 파일 분리 고려 필요 (gen-l10n 이 지원).
- **ViewModel 이 i18n 모름 원칙 지키기 어려움**: 일부 ViewModel 은 스낵바 띄우려고 `BuildContext` 받고 싶어짐 — 규율로 막아야.

## 교훈

### 교훈 1 — i18n 은 "나중에" 가 진짜 비싸다

초기 MVP 때 한국어 하드코딩. 3개월 뒤 영어 출시 결정. 화면 30개 × 평균 10개 문자열 = 300개 전환 작업. **3일 걸렸고 버그 5개**. 처음부터 넣었다면 하루 만에 ARB 파일 하나 추가로 끝. **전환 비용이 10배**.

**교훈**: 특정 관행 (i18n · 테스트 · 타입 체크) 은 **"나중에 도입" 의 비용이 기하급수적** 이에요. 처음부터 / 시작할 때 / 첫 커밋에서 도입이 정답.

### 교훈 2 — 템플릿 언어는 "원문" 이 맞다

영어 템플릿 + 한국어 번역본을 시도해봤어요. 개발자 (한국어 모국어) 가 영어로 원문을 쓰면 **어색한 영어 + 번역 단계마다 퇴화**. 한국어 템플릿 → 영어 번역은 자연스러움.

**교훈**: 템플릿 언어는 **원문 작성자의 모국어**. "영어가 기본이어야" 라는 편견 경계.

### 교훈 3 — `errorCode + i18n` 분리가 ViewModel 순수성의 열쇠

초기엔 ViewModel 이 한국어 메시지 직접 저장: `state = state.copyWith(errorMessage: '로그인 실패')`. 영어 전환 시 ViewModel 이 i18n 의존 → BuildContext 필요 → 구조 뒤틀림. `errorCode` 만 저장하고 Screen 에서 번역하자 **ViewModel 이 UI 와 완전 독립**.

**교훈**: 도메인 레이어 (ViewModel · Service) 는 **표현 관심사 (언어 · 포맷) 에 의존하면 안 됨**. 코드 · 원시 데이터만 다루고 UI 가 최종 변환.

## 관련 사례 (Prior Art)

- [Flutter i18n 공식 가이드](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization) — 본 ADR 의 기반
- [ARB 파일 포맷 (Google)](https://github.com/google/app-resource-bundle/wiki/ApplicationResourceBundleSpecification) — JSON 기반 표준
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) — 복수형 · 성별 · 날짜 포맷
- [Phrase · Crowdin · Lokalise](https://phrase.com/) — ARB 지원 번역 플랫폼
- [Android 개발 — Support different languages and cultures](https://developer.android.com/guide/topics/resources/localization) — 네이티브 플랫폼 관용 비교

## Code References

**설정 파일**
- [`l10n.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/l10n.yaml) — gen-l10n 설정
- [`pubspec.yaml`](https://github.com/storkspear/flutter-mobile-template/blob/main/pubspec.yaml) — `generate: true` 플래그

**ARB 파일**
- [`lib/core/i18n/app_ko.arb`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/i18n/app_ko.arb) — 템플릿 언어
- [`lib/core/i18n/app_en.arb`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/i18n/app_en.arb) — 영어 번역

**자동 생성 (커밋 대상)**
- [`lib/core/i18n/app_localizations.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/i18n/app_localizations.dart) — `S` 클래스
- [`lib/core/i18n/app_localizations_ko.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/i18n/app_localizations_ko.dart)
- [`lib/core/i18n/app_localizations_en.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/core/i18n/app_localizations_en.dart)

**사용 예시**
- [`lib/common/router/app_router.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/common/router/app_router.dart) — `S.of(context).loading` 호출
- [`lib/kits/auth_kit/ui/login/login_screen.dart`](https://github.com/storkspear/flutter-mobile-template/blob/main/lib/kits/auth_kit/ui/login/login_screen.dart) — Screen 에서 번역

**관련 ADR**:
- [`ADR-005 · Riverpod + MVVM`](./adr-005-riverpod-mvvm.md) — ViewModel 이 i18n 의존 안 하는 원칙
- [`ADR-009 · 백엔드 응답 1:1 계약`](./adr-009-backend-contract.md) — `ErrorCode` 를 i18n 키로 매핑
- [`ADR-019 · 솔로 친화적 운영`](./adr-019-solo-friendly.md) — "처음부터 도입 vs 나중에" 의 솔로 환경 판단
