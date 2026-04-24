# Migration from Template

템플릿 원본의 개선을 파생 레포로 가져오는 **cherry-pick 워크플로우**. 근거는 [`ADR-001 · GitHub Template + cherry-pick`](../philosophy/adr-001-template-cherry-pick.md).

---

## 전제

- 파생 레포는 **Use this template** 으로 생성됨 — fork 아님
- 템플릿과 git 히스토리가 **끊어진** 독립 레포
- 자동 merge 안 함 — **수동 cherry-pick** 만

---

## 최초 1회: 템플릿을 remote 로 등록

```bash
cd /path/to/your-derived-repo

git remote add template https://github.com/storkspear/flutter-mobile-template.git
git fetch template

git remote -v
# origin    git@github.com:your-org/your-app.git (fetch)
# origin    git@github.com:your-org/your-app.git (push)
# template  https://github.com/storkspear/flutter-mobile-template.git (fetch)
# template  https://github.com/storkspear/flutter-mobile-template.git (push)
```

---

## 변경 사항 확인

```bash
git fetch template
git log template/main --oneline --not main
```

예시 출력:

```
a1b2c3d feat(kit): add charts_kit donut gauge
d4e5f6g fix(auth): handle refresh race condition
h7i8j9k chore(docs): update error handling convention
```

---

## 특정 커밋만 가져오기

```bash
# 단일 커밋
git cherry-pick a1b2c3d

# 여러 커밋 (순서 유지)
git cherry-pick a1b2c3d d4e5f6g h7i8j9k

# 범위 (A..B 는 A 이후 B 포함까지)
git cherry-pick a1b2c3d..h7i8j9k
```

### Conflict 해결

```bash
# 충돌 발생
git cherry-pick a1b2c3d
# CONFLICT (content): Merge conflict in lib/...

# 1. 파일 수동 수정
$EDITOR lib/kits/auth_kit/...

# 2. 해결 표시
git add lib/kits/auth_kit/...

# 3. cherry-pick 계속
git cherry-pick --continue
```

### Cherry-pick 포기

도메인 코드 충돌이 크면 **포기가 정당**. 억지로 가져오지 마세요.

```bash
git cherry-pick --abort
```

---

## 권장 주기

| 주기 | 대상 |
|------|------|
| 주 1회 | 템플릿 변경 로그 확인 (`git log template/main --since="1 week ago"`) |
| 월 1회 | 보안 패치 · 중요 버그 수정 cherry-pick |
| 필요 시 | 새 Kit · 주요 기능 |

자동화 도구는 아직 없음. 수동 운영 (솔로 친화적).

---

## 선택 기준

### 가져오는 게 좋은 것

- ✅ 보안 패치 (토큰 저장 · 인터셉터 수정 등)
- ✅ 공통 버그 픽스 (도메인 무관)
- ✅ 새 Kit 추가
- ✅ 문서 업데이트 (`docs/`)

### 가져올 필요 없는 것

- ❌ 템플릿 고유 스텁 변경 (`features/home` 등 — 이미 도메인 코드로 대체)
- ❌ 템플릿 CI 설정 (파생 레포는 자체 CI)
- ❌ 템플릿의 예제 변경

### 판단 어려운 것

- 🤔 ViewModel 패턴 변경 — 파생 레포의 ViewModel 들 대거 수정 필요 가능
- 🤔 AppKit 계약 변경 — 모든 Kit 영향

이런 건 **담당 커밋을 신중히 리뷰** 후 결정. 때론 수동 리팩터가 더 나음.

---

## 오래된 파생 레포

1년 이상 템플릿과 gap 이 크면 cherry-pick 이 현실적이지 않음. 이땐:

1. 해당 개선의 **개념만 참고** (파일 그대로 X)
2. 파생 레포에 맞게 **수동 리팩터**
3. 커밋 메시지에 "inspired by template commit abc1234" 정도 명시

---

## 템플릿 측 커밋 규칙

파생 레포가 cherry-pick 하기 쉽도록 템플릿에서:

- **Conventional Commits**: `feat(kit): ...`, `fix(auth): ...`
- **작은 커밋**: 하나의 주제 · 하나의 변경
- **파일 경로 명확**: `lib/kits/auth_kit/` 같이 범위 한정 변경
- **템플릿 고유 변경** (스텁 등) 과 **공통 개선** 분리

---

## 파생 레포가 템플릿으로 기여

발견한 공통 개선이 있으면 **템플릿 레포에 PR**:

1. 파생 레포에서 먼저 해결 (즉각 필요)
2. 해당 개선을 템플릿 스타일로 일반화 (도메인 제거)
3. 템플릿 레포에 PR 제출
4. merge 후 다른 파생 레포도 cherry-pick 으로 가져감

---

## 관련 문서

- [`ADR-001 · GitHub Template + cherry-pick`](../philosophy/adr-001-template-cherry-pick.md)
- [Git rerere](https://git-scm.com/book/en/v2/Git-Tools-Rerere) — 반복 cherry-pick conflict 자동 해결
- [`Onboarding`](../journey/onboarding.md) — 파생 레포 최초 셋업
