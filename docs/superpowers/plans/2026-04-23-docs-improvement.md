# flutter-mobile-template Docs Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** flutter-mobile-template-docs-viewer의 문서 수준을 spring-backend-template-docs-viewer 수준으로 끌어올린다.

**Architecture:** 기존 docs를 코드와 대조해 정확도를 높이고, Critical/High 우선순위 순으로 누락 문서를 신규 작성한다. 모든 변경은 flutter-mobile-template/docs/ 에 반영 후 flutter-mobile-template-docs-viewer/docs/ 로 동기화(rsync)한다.

**Tech Stack:** Markdown, flutter-mobile-template 코드베이스 (Dart/Flutter), docs-viewer manifest.json

---

## 작업 원칙

- 각 Task 완료 후 사용자 확인 후 다음 Task 진행
- 코드에 없는 내용은 추측으로 작성하지 않는다
- 확인이 필요한 사항은 사용자에게 질문 후 진행
- 모든 변경은 flutter-mobile-template 원본 레포에 먼저 작성 → docs-viewer로 rsync

## 동기화 명령 (매 Task 완료 후 실행)

```bash
rsync -av --exclude='superpowers/' \
  /Users/twosun/workspace/flutter-mobile-template/docs/ \
  /Users/twosun/workspace/flutter-mobile-template-docs-viwer/docs/
```

---

## Task 1: conventions/kits.md 보완

**파악된 갭:**
- `onDispose()` 메서드 미문서화 (`app_kit.dart:52`)
- `navigatorObservers` getter 미문서화 (`app_kit.dart:36`)
- `AppKits.attachContainer()` 패턴 설명 없음 (`app_kits.dart:22`)
- `AppKits.resetForTest()` 미문서화 (`app_kits.dart:164`)
- Kit 내부 폴더 구조 규칙 없음

**파일:** `docs/conventions/kits.md`

- [ ] `lib/core/kits/app_kit.dart` 전체 읽기 — `onDispose`, `navigatorObservers` 시그니처 확인
- [ ] `lib/core/kits/app_kits.dart` 전체 읽기 — `attachContainer`, `resetForTest`, rollback 로직 파악
- [ ] **사용자 확인:** `attachContainer()`가 필요한 이유 (lazy provider 문제)가 코드 주석과 일치하는지
- [ ] `AppKit` 인터페이스 섹션에 `onDispose()`, `navigatorObservers` 추가
- [ ] `AppKits.attachContainer()` — "왜 필요한가" 다이어그램 + 코드 예시 추가
- [ ] `AppKits.resetForTest()` — 테스트에서 사용법 예시 추가
- [ ] Kit 폴더 내부 구조 규칙 섹션 추가 (interceptor, service, constant 위치)
- [ ] 원본 반영 후 docs-viewer rsync
- [ ] 커밋: `docs: expand kits.md with lifecycle, attachContainer, test patterns`

---

## Task 2: conventions/api-contract.md 보완

**파악된 갭:**
- `ApiException` 클래스 미문서화
- `safeErrorCode()` / `safeErrorMessage()` 패턴 없음 (`api_exception.dart:55,63`)
- `postRaw()` 언급만 있고 설명 없음
- `SearchRequestBuilder` 사용법 예시 부족

**파일:** `docs/conventions/api-contract.md`

- [ ] `lib/kits/backend_api_kit/api_exception.dart` 전체 읽기
- [ ] `lib/kits/backend_api_kit/api_client.dart` 전체 읽기 — `postRaw()` 위치 확인
- [ ] `lib/kits/backend_api_kit/search_request.dart` 읽기
- [ ] `ApiException` 클래스 섹션 추가 — 생성자, 주요 필드
- [ ] `safeErrorCode()` / `safeErrorMessage()` 패턴 섹션 추가 — 실제 사용 예시 포함
- [ ] `postRaw()` 설명 추가 — 언제 쓰는지, auth 인터셉터 우회 이유
- [ ] `SearchRequestBuilder` 실전 예시 보강 (체이닝 패턴, 빌드 결과물)
- [ ] rsync → 커밋: `docs: expand api-contract.md with ApiException, safeErrorCode, postRaw`

---

## Task 3: 에러 핸들링 흐름 문서 신규 작성

**파악된 갭:**
- `DioException → ApiException` 변환 흐름 미문서화
- `AuthInterceptor` 토큰 갱신 + 큐 패턴 미설명
- 네트워크 실패 vs API 에러 구분 방법 없음

**파일:** `docs/conventions/error-handling.md` (신규)
**manifest 추가:** `conventions` 그룹에 삽입

- [ ] `lib/kits/backend_api_kit/interceptors/auth_interceptor.dart` 전체 읽기
- [ ] `lib/kits/backend_api_kit/api_exception.dart` 재확인
- [ ] **사용자 확인:** ErrorInterceptor가 별도 파일로 있는지, 아니면 ApiClient 내부에 있는지
- [ ] `DioException → ApiException` 변환 흐름 다이어그램 작성 (mermaid)
- [ ] `AuthInterceptor` 토큰 갱신 + 큐잉 메커니즘 설명
- [ ] 네트워크 실패 / API 에러 / 인증 에러 3가지 케이스 분기 예시
- [ ] ViewModel에서 에러 처리하는 표준 패턴 예시
- [ ] manifest.json에 `error-handling.md` 항목 추가
- [ ] rsync → 커밋: `docs: add error-handling.md with interceptor flow and ApiException patterns`

---

## Task 4: integrations/update-kit.md 신규 작성

**파악된 갭:**
- `UpdateKit` 기본 설치 대상이지만 문서 전무
- `redirectPriority: 1` (최우선) 임에도 설명 없음

**파일:** `docs/integrations/update-kit.md` (신규)

- [ ] `lib/kits/update_kit/update_kit.dart` 전체 읽기
- [ ] `lib/kits/update_kit/force_update_dialog.dart` 읽기
- [ ] **사용자 확인:** 강제 업데이트 버전 체크 로직이 백엔드 API에 의존하는지, 스토어 버전 직접 비교인지
- [ ] UpdateKit 역할 및 redirectPriority 1의 의미 설명
- [ ] 강제 업데이트 다이얼로그 동작 방식 설명
- [ ] 파생 레포에서 활성화/비활성화 방법
- [ ] manifest.json `통합 가이드` 그룹에 추가
- [ ] rsync → 커밋: `docs: add update-kit.md`

---

## Task 5: conventions/architecture.md에 ReviewTrigger 섹션 추가

**파악된 갭:**
- `ReviewTrigger`가 tutorial에서 언급되지만 설명 전무
- `lib/core/review/review_trigger.dart` 존재하지만 docs 없음

**파일:** `docs/conventions/architecture.md`

- [ ] `lib/core/review/review_trigger.dart` 전체 읽기
- [ ] **사용자 확인:** ReviewTrigger 발동 조건이 고정값인지 파생 레포에서 커스터마이징 가능한지
- [ ] `ReviewTrigger` 섹션 추가 — 역할, 발동 시점, 사용법, 주의사항
- [ ] tutorial의 "ReviewTrigger" 언급과 연결
- [ ] rsync → 커밋: `docs: add ReviewTrigger section to architecture.md`

---

## Task 6: 테스트 가이드 신규 작성

**파악된 갭:**
- `AppKits.resetForTest()` 미문서화
- Provider 오버라이드 패턴 없음
- `test/helpers/` 존재하지만 언급 없음

**파일:** `docs/conventions/testing.md` (신규)

- [ ] `lib/core/kits/app_kits.dart`의 `resetForTest()` 재확인
- [ ] `test/helpers/` 디렉토리 전체 읽기
- [ ] `test/integration/main_assembly_test.dart` 읽기 (통합 테스트 패턴 파악)
- [ ] **사용자 확인:** 테스트에서 실제 ProviderScope 오버라이드를 쓰는지, mock 주입 패턴이 있는지
- [ ] ViewModel 단위 테스트 표준 패턴 작성
- [ ] Kit mock 교체 패턴 (`AppKits.resetForTest()` 활용)
- [ ] Widget 테스트에서 Provider 오버라이드 예시
- [ ] manifest.json `컨벤션` 그룹에 추가
- [ ] rsync → 커밋: `docs: add testing.md with AppKits test patterns and provider override examples`

---

## Task 7: README.md (시작하기) 품질 보강

**파악된 갭:**
- 현재 README.md는 이번 세션에 새로 작성된 것으로, spring의 책 목차 수준 대비 밀도가 낮음
- 각 단계에서 "막히면 어디로" 안내 부족
- 참조 표가 이미 추가된 신규 문서들을 미반영

**파일:** `docs/README.md`

- [ ] Task 1~6 완료 후 진행
- [ ] 신규 작성된 문서들(error-handling, update-kit, testing)을 참조 표에 추가
- [ ] 각 단계 말미에 "막히면" 링크 추가
- [ ] rsync → 커밋: `docs: update README.md with new doc references`

---

## Task 7-b: integrations/security.md 보완 (SSL 핀닝 + SecureStorage 코드 설명)

**파악된 갭:**
- SSL 핀닝 "활성화 방법"은 있으나 `SslPinning` 클래스 동작 원리 미설명
  - SHA256 기반 SPKI 핀닝 방식, `badCertificateCallback` 동작 메커니즘
  - `SslPinning.applyTo(dio, pins: ...)` 호출 위치 (ApiClient 초기화 시점)
- `SecureStorage` (Keychain/EncryptedSharedPreferences) 표에 한 줄만 있고 설명 없음
- `TokenStorage` 인터페이스와 `SecureStorage`의 관계 미설명

**파일:** `docs/integrations/security.md`

- [ ] `lib/core/storage/secure_storage.dart` 읽기
- [ ] `lib/core/storage/token_storage.dart` 읽기
- [ ] `lib/kits/backend_api_kit/api_client.dart`에서 `SslPinning.applyTo()` 호출 위치 확인
- [ ] SSL 핀닝 섹션에 클래스 동작 원리 추가 (SHA256 SPKI, badCertificateCallback, no-op 조건)
- [ ] `SecureStorage` / `TokenStorage` 섹션 추가 — 플랫폼별 저장소, 인터페이스 구조
- [ ] rsync → 커밋: `docs: expand security.md with SslPinning internals and SecureStorage`

---

## Task 8: 전체 manifest.json 최종 정리

**작업:**
- 신규 문서들 manifest 반영 확인
- desc 문구 일관성 검토
- 그룹 순서 최종 확인

**파일:**
- `flutter-mobile-template-docs-viwer/docs/manifest.json`

- [ ] 전체 manifest 리뷰
- [ ] 누락 항목 없는지 확인
- [ ] 커밋: `docs: finalize manifest.json with all new documents`
- [ ] flutter-mobile-template/docs 변경사항도 git push

---

## 우선순위 요약

| Task | 대상 | 우선순위 | 예상 소요 |
|------|------|----------|----------|
| 1 | kits.md 보완 | Critical | 30분 |
| 2 | api-contract.md 보완 | High | 20분 |
| 3 | error-handling.md 신규 | High | 30분 |
| 4 | update-kit.md 신규 | Critical | 20분 |
| 5 | architecture.md ReviewTrigger | High | 15분 |
| 6 | testing.md 신규 | High | 30분 |
| 7 | README.md 보강 | Medium | 15분 |
| 8 | manifest 정리 | Low | 10분 |
