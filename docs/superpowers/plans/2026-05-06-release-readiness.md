# template-flutter 마지막 docs 점검 (2026-05-06)

## Context

이번 세션에서 진행한 변경(P1 CI audit / N3 Environment.dev guard / N1 cross-import 제거 / Flutter 3.41.8 동기화 / kit cross-import 룰 명문화) 후 사용자가 "마지막으로 문서 점검" 요청. 이번 plan은 그 점검 결과 + 진행 가치 있는 후속 액션을 정리한다.

세 Explore 에이전트 병렬로 (1) 버전·CI·AppConfig 가드 sync, (2) kit cross-import 룰 일관성·dogfood 위치, (3) dev mock 문서화·STYLE_GUIDE·dead link를 전수 검사했고, 직접 read로 핵심 발견을 재검증했다.

---

## 점검 결과 요약

### ✅ 깔끔한 영역 (이번 세션 변경이 docs 전반에 정확히 반영)

| 영역 | 결과 |
|---|---|
| Flutter 3.32.8 → 3.41.8 동기화 | 잔존 0건 (`docs/superpowers/plans/` plan history 제외 — frozen artifact, 의도된 보존) |
| CI audit 약속 (CLAUDE.md / ADR-004 / ci-cd.md / kits.md / dogfood-pitfalls.md) | 5개 doc 일관, 모순 표현 0건 |
| AppConfig 5-pattern release 가드 | `dogfood-pitfalls.md` 신규 함정에 5건 정확히 명시 (`localhost` / `127.0.0.1` / `@example.com` / `example.com` / `Environment.dev`) |
| kit cross-import 룰 명문화 (CLAUDE.md / kits.md §3 / naming.md / adr-002 명확화 박스) | 17개 reference 모두 ✅ 또는 ⚠️(historical preservation OK). ADR-002 body의 5건 옛 표현은 명확화 박스로 정리됨 |
| DogfoodingPanel 위치 (home_screen만, auth_kit clean) | 정확히 일치 (`grep observability_kit lib/kits/auth_kit/` → 0건) |
| STYLE_GUIDE 준수 (편집 8개 docs) | 100% — 해요체 / 상대경로 / 코드블록 언어태그 / ADR 8섹션 |
| Dead link / broken anchor | 0건 (15개 internal link 샘플 + 신규 anchor 4건 모두 resolve) |

### ❌ 진짜 발견 — Dev mock 문서화 누락

이번 세션의 dogfooding으로 실증된 **사용성 결함**.

**증상**: 사용자가 `--dart-define=AUTH_DEV_MOCK=true`로 시뮬레이터 띄운 뒤 "구글 로그인 모달 안 뜨고 바로 로그인 됨" 의문 → 코드 reverse-engineering 후 답을 찾았음. 다른 솔로 dev도 같은 시나리오에 같은 부담.

**핵심 메커니즘** (코드만 있고 docs 없음):
- `lib/kits/auth_kit/social/dev_mock_gates.dart` — `isDevMockEnabled` flag
- `lib/kits/auth_kit/social/dev_offline_auth.dart` — `BackendReachability.probe()` + `DevOfflineAuthInterceptor` (fake JWT)
- `lib/kits/auth_kit/auth_check_step.dart:33-35` — boot 시 probe 호출
- `lib/common/providers.dart:62-75` — interceptor 조건부 등록

**누락 위치 (3건)**:
| 파일 | 현재 | 필요 |
|---|---|---|
| `docs/journey/onboarding.md` §5 첫 기동 | "백엔드 띄우고 `flutter run`" 외 대안 없음 | "백엔드 없이 시연" subsection 추가 |
| `lib/kits/auth_kit/README.md` (`## 의존` 다음) | 0 mention | "## Dev Mock (백엔드 없이 시연)" 신규 섹션 |
| `docs/features/auth-kit.md` | 0 mention | 짧은 요약 + auth_kit/README.md link |

**유일하게 문서화된 곳**: `.env.example:33-35` — 한 줄 설명만 있고 메커니즘·시연 흐름 부재.

---

## 추천 액션 (P1, 30~45분)

### 1. `docs/journey/onboarding.md` §5 — "백엔드 없이 시연" 추가 (10분)

`### 앱 실행` subsection 다음에 신규 subsection. 솔로 dev가 처음 첫 기동할 때 가장 먼저 보는 docs라 제일 가치 큼.

```markdown
### 백엔드 없이 시연 (선택)

template-spring 백엔드를 아직 안 띄웠으면 `AUTH_DEV_MOCK` 으로 인증 흐름까지
시연 가능해요. (commit `96779bb` keyless e2e demo)

​```bash
flutter run --dart-define=AUTH_DEV_MOCK=true
​```

동작:
- 부팅 시 `BackendReachability.probe()` 가 baseUrl 의 `/actuator/health` 핑 → 실패
- `DevOfflineAuthInterceptor` 가 `/auth/*` 호출 가로채서 fake JWT 응답 반환
- 구글/애플 로그인 버튼은 SDK 모달 우회 → 즉시 fake credential 으로 로그인 완료
- 로그인 후 `/home` 진입까지 keyless 시연

⚠️ **운영 빌드 절대 금지** — release 에서 `AUTH_DEV_MOCK=true` 박으면 모든 인증이 fake JWT.
`.env.example` 의 `AUTH_DEV_MOCK=false` 가 운영 기본값.
```

### 2. `lib/kits/auth_kit/README.md` — Dev Mock 섹션 (15분)

`## 의존` 다음 또는 `## 사용법` 다음에 신규 섹션 추가. 코드 메커니즘 자세히.

내용:
- 활성 조건 (`AUTH_DEV_MOCK=true` + 백엔드 unreachable)
- 동작 흐름 5단계 (probe → interceptor → fake JWT → AuthService 파싱 → /home redirect)
- 4-row 표 (probe / interceptor / SDK 우회 / fake JWT 만료 50년)
- 운영 빌드 안전장치 설명 (interceptor 조건부 등록 — `--dart-define` 미주입 시 등록 자체 안 됨)
- 코드 reference 5건 (dev_mock_gates / dev_offline_auth / auth_check_step / providers / .env.example)

### 3. `docs/features/auth-kit.md` — 짧은 요약 + link (5분)

auth_kit/README.md와 중복 회피. "## 개발 편의" 또는 "## 시연 모드" 같은 짧은 섹션:

```markdown
## 시연 모드 (Dev Mock)

백엔드 없이 인증 흐름 끝까지 시연하는 keyless 모드. 활성화:

​```bash
flutter run --dart-define=AUTH_DEV_MOCK=true
​```

자세한 메커니즘과 사용 시나리오는 [`auth_kit/README.md` Dev Mock 섹션](../../lib/kits/auth_kit/README.md) 참고.
```

### 4. (선택) `docs/journey/dogfood-pitfalls.md` — 함정 1건 추가 (5분)

"❌ 운영 빌드에 `AUTH_DEV_MOCK=true` 박혀서 출시" 가상 시나리오. 인증이 fake로 되는 보안 사고. 다만 release 빌드 절차에 포함되지 않으니 우선순위 낮음.

---

## 진행 안 할 것 (audit 결과 OK)

| 영역 | 이유 |
|---|---|
| ADR-002 body의 5건 옛 표현 | 명확화 박스로 historical preservation 처리 — 추가 변경 비용 > 이득 |
| `docs/superpowers/plans/2026-04-19-*.md`의 Flutter 3.32 언급 | plan history는 frozen artifact, 의도된 보존 |
| `features/README.md:75` "Kit 간 직접 import 금지" 짧은 요약 | acceptable summary + ADR-002 link 정상 |
| `docs/architecture/boot-sequence.md` AppConfig 가드 디테일 | 부팅 순서 다이어그램이라 가드 디테일 부적합. dogfood-pitfalls에 정확히 들어감 |
| Glossary "manifest requires" / "dev mock" 추가 | 솔로 운영자에게 ROI 약함. 핵심은 conventions/kits.md §3과 README |

---

## 비용·효과 정리

| 액션 | 비용 | 효과 |
|---|---|---|
| 1. onboarding.md §5 Dev Mock 안내 | 10분 | 솔로 dev가 첫 기동 단계에서 백엔드 없이 시연 가능. reverse-engineering 부담 0 |
| 2. auth_kit/README.md Dev Mock 섹션 | 15분 | 메커니즘 명확화. 향후 인증 흐름 디버깅 / 보안 검토 시 진실의 출처 |
| 3. features/auth-kit.md 짧은 요약 | 5분 | features 인덱스에서 발견 가능 |
| 4. (선택) dogfood-pitfalls 함정 추가 | 5분 | 운영 빌드 사고 예방 추가 안전망 |

**묶음 P1 (1+2+3)**: 30분, 솔로 dev 첫 시연 경험 직접 개선.

---

## 검증 방법

1. `dart format --output=none --set-exit-if-changed lib/ test/` (편집은 docs라 영향 없음 — 형식적 확인)
2. `dart run tool/configure_app.dart --audit` Status: OK
3. STYLE_GUIDE 준수: `grep -nE "하라$|해야 한다|하여야|되어야 한다"` docs 변경분 → 0건
4. 깨진 link 없는지: 새 파일 path/anchor 직접 click 또는 grep 검증
5. (수동) onboarding.md §5에 추가한 Dev Mock 안내가 첫 기동에서 자연스럽게 읽히는지 read-through

---

## 참고 — 이번 세션 누적 commit

| 커밋 | 내용 |
|---|---|
| `bfeb0c2` | release-readiness 3건 (P1 + N3 + N1) + docs 동기화 |
| `c3e832b` | Flutter 3.32.8 → 3.41.8 동기화 (a16a3f4 누락 fix) |
| `280a873` | kit cross-import 룰 명문화 |

이번 plan을 진행하면 4번째 commit (`docs(auth): document AUTH_DEV_MOCK keyless demo flow` 정도)이 추가됨.
