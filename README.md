# 생존일지 (Saengjonil)

커리어PT 취준 활동 트래커 — 매일의 취준 활동을 기록하고, 주간/월간 목표를 관리하며,
조원들과 현황을 비교하는 웹 앱입니다.

> **이 문서는 다른 개발자가 이어받을 수 있도록 최신 구조·규칙·운영 절차를 정리한 문서입니다.** 최종 갱신: 2026-07-07.

---

## 개요

- **빌드 스텝이 없는 정적 웹 앱** + Firebase 백엔드(Auth · Firestore). 번들러/트랜스파일 없이 브라우저 **네이티브 ES 모듈** + CDN import로 동작.
- 사용자 흐름: **구글 로그인 → 온보딩(닉네임·취업확률/프로그램) → (관리자가 조 배정) → 일일 기록·주간/월간 목표 → 조별·전체 랭킹/비교**.
- 신규 가입자는 **미배정** 상태로 시작하며, **조 배정은 관리자만** 합니다(한 명이 여러 조에 소속 가능).

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트 | 바닐라 HTML · CSS · JavaScript (ES 모듈, 빌드 없음) |
| 인증 | Firebase Authentication (**구글 로그인 전용**) |
| DB | Cloud Firestore (NoSQL 문서 DB) |
| 차트 | Chart.js 4.4.1 (CDN) — `main.html`에서 사용 (`compare.html`은 로드하나 미사용 → 정리 후보) |
| SDK | Firebase JS SDK 10.12.2 (gstatic CDN import) |
| 호스팅 | GitHub Pages(운영) · Firebase Hosting(스테이징) |

## 프로젝트 구조

```
.
├── index.html            로그인 + 온보딩 (앱 진입점)
├── main.html             내 대시보드 · 일일 기록 · 목표 · 프로필
├── compare.html          함께 생존 (랭킹 · 비교 · 그룹별 현황)
├── admin.html            관리자 (그룹/유저 관리)
├── firebase-config.js    환경별 Firebase 설정 (호스트명 기반 자동 전환)
│
├── css/                  페이지별 스타일 (index / main / compare / admin .css)
├── js/                   페이지별 로직  (index / main / compare / admin .js)
│
├── firebase.json         Firebase Hosting · Firestore 설정 (scripts/·docs 등 배포 제외)
├── firestore.rules       Firestore 보안 규칙
├── firestore.indexes.json  Firestore 복합 인덱스 정의
├── .firebaserc           기본 프로젝트(saengjonil-dev) 지정
├── .nojekyll             GitHub Pages: Jekyll 끄고 파일을 그대로 서빙
│
├── package.json          개발 도구 의존성(firebase-admin) + 스크립트
└── scripts/              ⚙️ 개발/운영 전용 도구 (Hosting 배포에서 제외됨)
    ├── seed-lib.mjs           공용 헬퍼(PRNG·날짜·기록 생성기·admin 초기화·dev 가드)
    ├── seed-dev-data.mjs      벌크 테스트 데이터(그룹+유저+기록+목표)
    ├── seed-dev-user.mjs      특정 로그인 유저에게 리치 데이터 주입
    ├── seed-dev-groups.mjs    그룹만 최소 시드
    ├── inspect-dev.mjs        Firestore 상태 점검
    └── migrate-groupids.mjs   ⭐ 1회성 마이그레이션(groupId→groupIds, isLeader→groups.leaderUids)
```

> 각 HTML은 **마크업만**, 스타일은 `css/`, 로직은 `js/`에 분리돼 있습니다.
> HTML 파일은 진입 **URL**이므로 경로/파일명을 바꾸면 안 됩니다.

## 페이지 구성

| 페이지 | 역할 | 주요 기능 |
|---|---|---|
| `index.html` | 로그인·온보딩 | 구글 로그인, 신규 유저 **3단계 온보딩(기본정보 → 프로그램 → 완료)** — 조 선택 없음(미배정으로 시작, 관리자가 배정), 인앱 브라우저 탈출 |
| `main.html` | 내 일지 | 오늘 기록(매십경·면·독·운 루틴 + 취준활동: **강의 수강[정해진 강의별 분 입력]**·자소서·필기·면접·지원), 대시보드(내 추이 + **조별 추이[내 조 선택기]**), 주차별 추이, 주간/월간 목표, 누적 요약, 프로필/테마 설정(+**이전 시즌 기록** 입력, 소속 조 읽기전용) |
| `compare.html` | 함께 생존 | 탭 6개: **랭킹 / 매십경 상세 / 매십면 상세 / 항목 비교(+이전 시즌 컬럼·엑셀) / 강의 수강(강의별 기간 합산·엑셀) / 그룹별 현황**. 상단 **"내 조" 선택기**(다중 소속 시 노출, 그룹별 현황 탭에선 숨김) |
| `admin.html` | 관리자 | 전체 현황, 그룹 CRUD, 유저 **조 다중 배정(체크박스)**·프로그램 변경·온보딩 초기화·삭제, **그룹 수정에서 조장 지정**, 유저 상세 |

## 데이터 모델 (Firestore)

컬렉션은 4개이며 모두 **평면 구조**(서브컬렉션 없음)입니다. 문서 ID에 식별자를 넣는 **복합 키** 방식을 씁니다.

### `users` — 문서 ID = **Firebase Auth UID**
| 필드 | 타입 | 설명 |
|---|---|---|
| `nickname` / `email` / `photoURL` | string | 프로필 |
| `startDate` / `gyeongStartDate` / `myeonStartDate` | string(YYYY-MM-DD) | 프로그램별 시작일 |
| `programType` | string | `careerpt` / `maesipgyeong` / `maesipmyeon` / `maesipboth` |
| `groupIds` | array | 소속 조 문서 ID 목록(**다중 가입**, → `groups`). **관리자만** 배정(온보딩/프로필에서 못 바꿈, 보안 규칙으로 강제). 구버전 단일 `groupId`는 코드 헬퍼 `groupIdsOf()`로 호환 |
| `isAdmin` | boolean | 관리자 여부. **관리자 판정은 이 필드**(과거 `ADMIN_UIDS` 배열 방식은 폐기). 본인이 못 바꿈(규칙) |
| `jobProb` | number | 예상 취업 확률 (%) |
| `prevInterviewCount` / `prevInterviewHour` / `prevPilgiHour` / `prevApplications` | number \| null | 이전 시즌 기록 — 면접 경험(회)·면접 준비(시간)·필기 준비(시간)·지원 개수(개). 프로필에서 입력, 미입력은 `null`(비교표에 `-`). `compare` 항목 비교 표/엑셀에 표시(기간 무관) |
| `themeColor` | string | 테마 색상 (hex) |
| `onboardingDone` | boolean | 온보딩 완료 여부 |
| `createdAt` | string(ISO) | 생성 시각 |

> 구 필드 `groupId`(string)·`isLeader`(bool)는 **폐기**됐습니다. 코드는 `groupId`를 읽기 헬퍼로만 호환하고, `isLeader`는 `groups.leaderUids`로 이관됐습니다(마이그레이션 스크립트 참고).

### `groups` — 문서 ID = **자동 생성 ID**
| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | string | 조 이름 |
| `leaderUids` | array | 이 조의 **조장** uid 목록(조당 여러 명 가능). 관리자가 그룹 수정 모달에서 조원 체크로 지정 |
| `members` | array | (레거시·미사용) 실제 소속 판정은 `users.groupIds` 기준 |
| `createdAt` | string(ISO) | 생성 시각 |

### `records` — 문서 ID = **`{uid}_{YYYY-MM-DD}`** (하루 1문서)
| 그룹 | 필드 |
|---|---|
| 식별 | `uid`, `nickname`(복사본), `date` |
| 매십경 | `gyeong_article` / `gyeong_opinion` / `gyeong_comment` (bool), `gyeongScore`(0–3) |
| 매십면 | `myeon_am` / `myeon_pm` / `myeon_feedback` (bool), `myeonScore`(0–3) |
| 루틴 | `routineGyeong` / `routineMyeon` / `routineDok` / `routinePilsa` (bool) |
| 독서/운동 | `bookTitle`(str), `routineUn`(bool), `exercises`(array) |
| 취준활동 | `lecture` / `jasoseo` / `jasoseoCount` / `pilgi` / `interview` / `cert`(자격증 준비 분) / `totalTime` / `applications` (number), `lectureItems`(map: 강의명→분; `lecture`는 그 합계) |
| 기타 | `selfEsteem`(1–5), `jobProb`(복사본), `fa5050`(bool), `focusTags`(array), `createdAt`(ISO) |

> `lectureItems` 강의 목록은 `js/main.js`(입력)와 `js/compare.js`(강의 수강 탭)에 **각각 고정 배열로 정의**돼 있습니다. 강의를 추가/수정할 땐 **두 파일 모두** 맞춰야 합니다. 구 필드 `lectureItem`(자유 텍스트)은 폐기.

### `weekly_goals` — 문서 ID = **`{uid}_week{N}`** 또는 **`{uid}_month_{YYYY-MM}`**
| 필드 | 타입 | 설명 |
|---|---|---|
| `goals` | array of `{ text, done }` | 목표 목록 |
| `updatedAt` | string(ISO) | 갱신 시각 |

> 주간·월간 목표가 **한 컬렉션**을 공유하고 문서 ID 접두(`_week` / `_month_`)로 구분됩니다.

**관계 (수동 참조, FK 강제 없음):**
```
users(uid) ──groupIds[]──▶ groups(docId)        (다중 소속)
groups(docId).leaderUids[] ──▶ users(uid)        (조장)
records(`{uid}_{date}`).uid ──▶ users(uid)
weekly_goals(`{uid}_...`) ── uid를 문서 ID에 내장
```
JOIN이 없으므로 `records`에 `nickname`·`jobProb`를 **복사(비정규화)** 해 저장합니다.

## 그룹 · 조장 · 다중 가입 모델 (중요)

- **다중 소속**: 유저는 `users.groupIds`(배열)로 **여러 조에 동시 소속**. 소속 판정은 어디서나 `groupIdsOf(u).includes(groupId)`.
  - 헬퍼(각 JS에 중복 정의): `groupIdsOf(u) = Array.isArray(u.groupIds) ? u.groupIds : (u.groupId ? [u.groupId] : [])` — 마이그레이션 전 구 데이터(단일 `groupId`)도 클라이언트에선 자동 호환.
- **조 배정 = 관리자 전용**: 온보딩·프로필에는 조 선택 UI가 없습니다. 관리자 페이지 유저 "관리" 모달의 **조 체크박스**로만 배정하며, 보안 규칙이 본인의 `groupIds` 변경을 막습니다.
- **조장(leader) = `groups.leaderUids`**: 조당 여러 명 가능. 관리자 페이지 **그룹 "수정"** 모달에서 그 조의 조원을 체크해 지정. 표시는 함께 생존의 "내 그룹" 랭킹/상세·그룹별 현황에서 이름 앞 **조장 태그**.
- **"내 그룹" 컨텍스트 = 선택기**: 내가 여러 조에 속하면 `compare.html` 상단 **"내 조" 드롭다운**(`myGroupSel`)으로 기준 조를 고릅니다. 랭킹/상세의 "내 그룹" 스코프·조장 태그가 이 선택 조 기준으로 동작. (그룹별 현황 탭은 전체 조를 보므로 선택기 숨김)
- **서버 쿼리 주의**: 대시보드 조별 추이 등은 `where('groupIds','array-contains', gid)`를 씁니다. **구 데이터(단일 `groupId`만 있는 유저)는 이 쿼리에 안 잡히므로 마이그레이션 필수**(아래).

## 보안 규칙 (`firestore.rules`) 요약

- `users`: 로그인 사용자는 모두 **읽기**(랭킹/집계용). **본인 문서만** 생성/수정하되, **본인은 `isAdmin`·`groupIds`를 못 바꿈**(권한 상승·자가 조 배정 방지). 관리자(`isAdmin()`)는 전체 쓰기/삭제.
  - 첫 관리자는 콘솔에서 수동으로 `isAdmin=true` 설정(규칙 우회) → 부트스트랩.
- `groups`: 모두 읽기, **쓰기는 관리자만** → 조장(`leaderUids`)도 자동 보호.
- `records`: 모두 읽기, 본인(`uid` 일치)만 생성/수정/삭제, 관리자는 전체 삭제.
- `weekly_goals`: 문서 ID 접두(`uid_...`)가 본인 것일 때만 읽기/쓰기.
- 규칙은 **운영·스테이징 각 프로젝트에 따로 배포**해야 합니다: `firebase deploy --only firestore:rules [--project <프로젝트>]`.

## 배포 & 환경

| | 🟢 운영(production) | 🟡 스테이징(staging) |
|---|---|---|
| 호스팅 | GitHub Pages | Firebase Hosting |
| URL | `https://kk991011.github.io/Saengjonil/` | `https://saengjonil-dev.web.app` |
| 브랜치/트리거 | `master` push | 수동 |
| Firebase 프로젝트 | `saengjonil` | `saengjonil-dev` |
| 코드 배포 | `git push origin master` (GitHub Pages 자동) | `firebase deploy --only hosting` |
| 규칙 배포 | `firebase deploy --only firestore:rules --project saengjonil` | `firebase deploy --only firestore:rules` |

- **환경 자동 전환:** `firebase-config.js`가 `location.hostname`으로 프로젝트 선택 (`kk991011.github.io` → 운영, 그 외/localhost/`*.web.app` → dev).
- **개발 흐름:** dev에 배포·확인 → `master` push로 운영 반영. (푸시는 사람이 직접)
- **복합 인덱스:** `records`의 `where uid== + orderBy date`에 인덱스 필요 → `firebase deploy --only firestore:indexes`. `array-contains`(groupIds)·`where date >=`는 단일 필드라 자동 인덱스로 충분.
- **캐시:** 스테이징(Firebase Hosting)은 `firebase.json`에서 html/js/css를 `no-cache`로 서빙(재배포 즉시 반영). 운영(GitHub Pages)은 기본 캐시 → 안 바뀌면 강력 새로고침(Cmd/Ctrl+Shift+R).

### GitHub Pages 배포 방식 & 문제 해결
- 의도한 설정은 **"Deploy from a branch"**(브랜치 파일 verbatim 서빙, `.nojekyll`). 그러나 현재 Pages API 상 **`build_type: "workflow"`**(Source = GitHub Actions)인데 **워크플로 파일이 없는 불일치 상태**입니다. 이 때문에 `master` push 시 GitHub 관리형 `pages-build-deployment`가 **간헐 실패/멈춤(stuck)** 이 납니다.
- **stuck 발생 시 대응:**
  1. `master`에 새 커밋 push로 재트리거 (`git commit --allow-empty -m "chore: retrigger pages" && git push`). 보통 회복됨.
  2. 그래도 안 되면 **소유자(admin 권한자, 현재 `kk991011`)** 가 GitHub → **Settings → Pages → Build and deployment → Source** 를 **"Deploy from a branch" → `master` / `(root)`** 로 저장. build_type을 legacy로 정리하고 stuck 상태도 리셋 → **재발 방지**.
  3. https://www.githubstatus.com 에서 Pages 장애 여부 확인.
- 협업자(비-admin)는 Pages 설정을 못 바꿉니다. push/재트리거만 가능.

### 다중 조 기능 릴리스 절차 (마이그레이션 포함)
`groupId→groupIds`, `isLeader→leaderUids` 변경은 **데이터 마이그레이션이 선행**돼야 서버 쿼리가 정확합니다. 각 환경에서:
1. **마이그레이션**(비파괴·멱등): `node scripts/migrate-groupids.mjs <키.json>`(미리보기) → `--yes`(반영).
2. **코드 배포**: dev는 `firebase deploy --only hosting`, 운영은 `git push origin master`.
3. **규칙 배포**: `firebase deploy --only firestore:rules [--project saengjonil]`.
> 마이그레이션은 하위호환·비파괴라 코드보다 **먼저** 돌려도 안전합니다.

## 로컬 개발

```bash
python3 -m http.server 8000       # 저장소 루트에서
# → http://localhost:8000/index.html  (localhost 이므로 dev 프로젝트 사용)
```
- 구글 로그인이 되려면 Firebase 콘솔 → Authentication → **승인된 도메인**에 `localhost` 필요.
- 내부 경로는 상대경로라 어느 base에서도 동작.

## 개발/운영 도구 (`scripts/`)

```bash
npm i firebase-admin                       # 최초 1회
# 서비스 계정 키(JSON): 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 (프로젝트별로)

# 테스트 데이터 (dev 전용 — 키 project_id가 saengjonil-dev가 아니면 거부)
node scripts/seed-dev-data.mjs <키.json>                       # 벌크: 그룹+유저24+기록+목표
node scripts/seed-dev-user.mjs <키.json> --as-email=you@x.com  # 본인 계정에 리치 데이터
node scripts/inspect-dev.mjs   <키.json>                       # Firestore 상태 점검
node scripts/seed-dev-data.mjs --dry-run                       # 쓰기 없이 미리보기

# 다중 조 마이그레이션 (dev/운영 공용 — 키의 project로 동작, 기본 dry-run)
node scripts/migrate-groupids.mjs <키.json>                    # 미리보기 (project= 확인!)
node scripts/migrate-groupids.mjs <키.json> --yes             # 반영
```
- **시드 스크립트**는 키 `project_id`가 `saengjonil-dev`가 아니면 거부(운영 보호).
- **`migrate-groupids.mjs`는 dev 가드가 없습니다**(운영에도 돌려야 하므로). 안전장치는 ① 기본 dry-run ② 출력 첫 줄 `project = ...` 뿐 → **`--yes` 전에 프로젝트명 꼭 확인**. 멱등(재실행 안전)·비파괴(구 필드 유지).

## 주요 규칙 & 주의사항 (유지보수 시 필독)

- **빌드 없음** — 네이티브 ES 모듈. `import`는 상대경로 + `.js` 확장자까지 명시.
- **인라인 이벤트 핸들러는 전역 함수에 의존** — `onclick="foo()"`는 `window.foo = ...`로 등록된 전역 호출. 모듈은 전역을 안 만드므로 핸들러는 반드시 `window.X = ...`로 등록.
- **`index.html` 상단 인앱 브라우저 탈출 IIFE**는 일반 `<script>`(모듈 아님)로 **인라인 유지**(카카오톡/인스타 등 감지 → 외부 브라우저 유도, 최우선 즉시 실행).
- **관리자 권한 = `users.isAdmin === true`** (필드 기반, 보안 규칙과 연동). 과거 `ADMIN_UIDS` 화이트리스트는 폐기. 관리자 추가는 콘솔/관리자 도구로 `isAdmin` 세팅.
- **다중 조/조장** — 소속은 `groupIdsOf()` 헬퍼로 판정, 조장은 `groups.leaderUids`, "내 그룹"은 `myGroupSel` 선택기. 조 배정은 관리자만(규칙 강제). 서버 쿼리는 `array-contains` → 구 데이터는 마이그레이션 필요.
- **Firebase 웹 `apiKey`는 비밀값 아님**(공개돼도 안전). 실제 보호는 **Firestore 보안 규칙 + Auth 승인 도메인** → 운영/스테이징 두 프로젝트 모두 규칙 설정 필수.
- **`scripts/`는 배포 제외**(`firebase.json` ignore). 앱 코드는 `js/`에만.
- **읽기 비용(중요):** 랭킹·대시보드는 컬렉션을 **전체 읽지 말고 기간/관련 범위로 스코핑**. `compare`는 선택 기간(`where date >=`)만, `weekly_goals`는 본인 문서ID 범위만 읽음. 전체-컬렉션 읽기 재도입 금지. (`admin.html`은 "마지막 기록" 표시로 아직 `records` 전체 읽음 — 향후 사전집계 여지.)
- **차트 색:** 계열 색은 `js/main.js`의 고정 팔레트 **`ITEM_COLORS`**(테마 독립). 테마 색(`--main`)은 UI 크롬 전용.
- **숫자/날짜 입력:** `main.js`·`index.js`의 캡처단계 핸들러가 `min`/`max` 기준 clamp(음수·미래 방지). 새 입력엔 `min`/`max`만 붙이면 자동 적용.
- **넓은 표:** `compare.html` 표들은 `table-layout:auto` + 셀 nowrap으로 값이 잘리지 않게 하고, 컬럼이 많으면 가로 스크롤. 긴 닉네임만 `.name-col`로 말줄임.
