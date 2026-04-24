# API Contract

`flutter-mobile-template` 과 짝 백엔드 [`spring-backend-template`](https://github.com/storkspear/spring-backend-template) 의 **1:1 계약** 정리. 응답 스키마 · 에러 코드 · 인증 흐름이 양쪽에서 **완전 동일** 해요.

> **왜 1:1?** 같은 개발자가 프론트와 백엔드를 함께 운영하는 앱 공장 전제. Mapper 층 제거. 근거는 [`ADR-009`](../philosophy/adr-009-backend-contract.md).

---

## 문서 구성

| 파일 | 내용 |
|------|------|
| [`response-schema.md`](./response-schema.md) | `{data, error}` 래퍼 · `PageResponse<T>` |
| [`search-request.md`](./search-request.md) | 검색 요청 DSL · 연산자 목록 |
| [`error-codes.md`](./error-codes.md) | ErrorCode enum 매핑 (양쪽 동기화) |
| [`auth-flow.md`](./auth-flow.md) | 로그인 · 갱신 · 로그아웃 시퀀스 |

---

## 쌍 운영 규칙

### 서버 변경 시

1. 백엔드의 `ApiResponse.java` · `ErrorCode.java` 수정
2. 프론트의 `api_response.dart` · `error_code.dart` **동시** 수정
3. 두 레포에 **같은 커밋 메시지** 로 PR
4. 통합 테스트에서 스키마 일치 확인

### 프론트 변경 시

- 프론트 단독으로 계약을 바꾸지 **마세요**. 백엔드에 요청 먼저.
- DTO 필드 추가 · 삭제는 반드시 백엔드 리드.

---

## 계약 변경 시 확인 포인트

- [ ] 양쪽 레포의 스키마 파일 수정 확인
- [ ] 기존 클라이언트 앱 호환 (하위 호환 필드 추가 우선)
- [ ] 통합 테스트 갱신
- [ ] 문서 업데이트 (이 폴더)

---

## 관련 문서

- [`ADR-009 · 백엔드 응답 1:1 계약`](../philosophy/adr-009-backend-contract.md)
- [`ADR-012 · 앱별 독립 유저 + JWT appSlug`](../philosophy/adr-012-per-app-user.md)
- [짝 백엔드: spring-backend-template](https://github.com/storkspear/spring-backend-template)
