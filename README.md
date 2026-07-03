# 생존일지 (Saengjonil)

커리어PT 취준 활동 트래커 — 매일의 취준 활동을 기록하고, 주간/월간 목표를 관리하며,
조원들과 현황을 비교하는 웹 앱입니다.

---

## 개요

- **빌드 스텝이 없는 정적 웹 앱** + Firebase 백엔드(Auth · Firestore).
- 흐름: **구글 로그인 → 온보딩(닉네임/프로그램/그룹) → 일일 기록 · 주간/월간 목표 → 조별·전체 랭킹/비교**.
- 번들러/트랜스파일 없이 브라우저 **네이티브 ES 모듈**과 CDN import로 동작합니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트 | 바닐라 HTML · CSS · JavaScript (ES 모듈) |
| 인증 | Firebase Authentication (**구글 로그인 전용**) |
| DB | Cloud Firestore (NoSQL 문서 DB) |
| 차트 | Chart.js 4.4.1 (CDN) — `main.html` 대시보드·추이 차트에서 사용 |
| SDK | Firebase JS SDK 10.12.2 (gstatic CDN import) |
| 호스팅 | GitHub Pages(운영) · Firebase Hosting(스테이징) |

## 프로젝트 구조

```
.
├── index.html            로그인 + 온보딩 (앱 진입점)
├── main.html             내 대시보드 · 일일 기록 · 목표 · 프로필
├── compare.html          랭킹 · 조별 비교
├── admin.html            관리자 대시보드 (그룹/유저 관리)
├── firebase-config.js    환경별 Firebase 설정 (호스트명 기반 자동 전환)
│
├── css/                  페이지별 스타일 (index / main / compare / admin .css)
├── js/                   페이지별 로직  (index / main / compare / admin .js)
│
├── firebase.json         Firebase Hosting · Firestore 설정
├── firestore.indexes.json  Firestore 복합 인덱스 정의
├── .firebaserc           기본 프로젝트(saengjonil-dev) 지정
├── .nojekyll             GitHub Pages: Jekyll 끄고 파일을 그대로 서빙
│
├── package.json          개발 도구 의존성(firebase-admin) + 시드 스크립트
└── scripts/              ⚙️ 개발 전용 도구 (배포에서 제외됨)
    ├── seed-lib.mjs          공용 헬퍼(PRNG·날짜·기록 생성기·admin 초기화)
    ├── seed-dev-data.mjs     벌크 테스트 데이터(그룹+유저+기록+목표)
    ├── seed-dev-user.mjs     특정 로그인 유저에게 리치 데이터 주입
    ├── seed-dev-groups.mjs   그룹만 최소 시드
    └── inspect-dev.mjs       Firestore 상태 점검
```

> 각 HTML은 **마크업만**, 스타일은 `css/`, 로직은 `js/`에 분리돼 있습니다.
> HTML 파일은 진입 **URL**이므로 경로/파일명을 바꾸면 안 됩니다.

## 페이지 구성

| 페이지 | 역할 | 주요 기능 |
|---|---|---|
| `index.html` | 로그인·온보딩 | 구글 로그인, 신규 유저 4단계 온보딩(기본정보→프로그램→그룹→완료), 인앱 브라우저 탈출 |
| `main.html` | 내 일지 | 오늘 기록 입력/저장, 대시보드 통계, 주차별 추이 차트, 주간/월간 목표, 프로필/테마 설정 |
| `compare.html` | 함께 생존 | 항목별 랭킹(전체/조별), 조별 비교 |
| `admin.html` | 관리자 | 전체 현황, 그룹 CRUD, 유저 그룹/프로그램 변경·온보딩 초기화·삭제, 유저 상세 |

## 데이터 모델 (Firestore)

컬렉션은 4개이며 모두 **평면 구조**(서브컬렉션 없음)입니다. 문서 ID에 식별자를 넣는 **복합 키** 방식을 씁니다.

### `users` — 문서 ID = **Firebase Auth UID**
| 필드 | 타입 | 설명 |
|---|---|---|
| `nickname` / `email` / `photoURL` | string | 프로필 |
| `startDate` / `gyeongStartDate` / `myeonStartDate` | string(YYYY-MM-DD) | 프로그램별 시작일 |
| `programType` | string | `careerpt` / `maesipgyeong` / `maesipmyeon` / `maesipboth` |
| `groupId` | string | 소속 그룹 문서 ID (→ `groups`) |
| `jobProb` | number | 예상 취업 확률 (%) |
| `themeColor` | string | 테마 색상 (hex) |
| `onboardingDone` | boolean | 온보딩 완료 여부 |
| `createdAt` | string(ISO) | 생성 시각 |

### `groups` — 문서 ID = **자동 생성 ID**
| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | string | 조 이름 |
| `members` | array | 표시용 멤버 목록(실제 소속 판정은 `users.groupId` 기준) |
| `createdAt` | string(ISO) | 생성 시각 |

### `records` — 문서 ID = **`{uid}_{YYYY-MM-DD}`** (하루 1문서)
| 그룹 | 필드 |
|---|---|
| 식별 | `uid`, `nickname`(복사본), `date` |
| 매십경 | `gyeong_article` / `gyeong_opinion` / `gyeong_comment` (bool), `gyeongScore`(0–3) |
| 매십면 | `myeon_am` / `myeon_pm` / `myeon_feedback` (bool), `myeonScore`(0–3) |
| 루틴 | `routineGyeong` / `routineMyeon` / `routineDok` / `routinePilsa` (bool) |
| 독서/운동 | `bookTitle`(str), `routineUn`(bool), `exercises`(array) |
| 취준활동 | `lecture` / `jasoseo` / `jasoseoCount` / `pilgi` / `interview` / `totalTime` / `applications` (number), `lectureItem`(str) |
| 기타 | `selfEsteem`(1–5), `jobProb`(복사본), `fa5050`(bool), `focusTags`(array), `createdAt`(ISO) |

### `weekly_goals` — 문서 ID = **`{uid}_week{N}`** 또는 **`{uid}_month_{YYYY-MM}`**
| 필드 | 타입 | 설명 |
|---|---|---|
| `goals` | array of `{ text, done }` | 목표 목록 |
| `updatedAt` | string(ISO) | 갱신 시각 |

> 주간·월간 목표가 **한 컬렉션**을 공유하고 문서 ID 접두(`_week` / `_month_`)로 구분됩니다.

**관계 (수동 참조, FK 강제 없음):**
```
users(uid) ──groupId──▶ groups(docId)
records(`{uid}_{date}`).uid ──▶ users(uid)
weekly_goals(`{uid}_...`) ── uid를 문서 ID에 내장
```
JOIN이 없으므로 `records`에 `nickname`·`jobProb`를 **복사(비정규화)** 해 저장합니다.

## 배포 & 환경

| | 🟢 운영(production) | 🟡 스테이징(staging) |
|---|---|---|
| 호스팅 | GitHub Pages | Firebase Hosting |
| URL | `https://kk991011.github.io/Saengjonil/` | `https://saengjonil-dev.web.app` |
| 브랜치 | `master` | `dev` |
| Firebase 프로젝트 | `saengjonil` | `saengjonil-dev` |
| 배포 방법 | master 커밋 시 **자동** | `firebase deploy --only hosting` |

- **환경 자동 전환:** `firebase-config.js`가 `location.hostname`으로 프로젝트를 선택합니다
  (`kk991011.github.io` → 운영, 그 외/localhost/`*.web.app` → dev).
- **개발 흐름:** `dev`에서 작업 → 스테이징 확인 → `master` 병합 시 운영 반영.
- **복합 인덱스 필수:** `records`의 `where uid== + orderBy date` 쿼리에 인덱스가 필요합니다.
  새 환경에선 `firebase deploy --only firestore:indexes`로 생성하세요(`firestore.indexes.json`).
  (`compare`의 `where date >=` 쿼리는 `date` 단일 필드라 자동 인덱스로 충분.)
- **GitHub Pages(운영):** legacy 브랜치 배포 — 워크플로 없이 `master`의 파일을 그대로 서빙합니다.
  `.nojekyll`로 Jekyll을 꺼 파일을 변환 없이(verbatim) 서빙합니다.
- **캐시:** 스테이징(Firebase Hosting)은 `firebase.json`에서 html/js/css를 `no-cache`로 서빙해 재배포가 즉시 반영됩니다. 운영(GitHub Pages)은 기본 캐시 정책을 따릅니다.

## 로컬 개발

```bash
# 저장소 루트에서 정적 서버 실행
python3 -m http.server 8000
# → http://localhost:8000/index.html  (localhost 이므로 dev 프로젝트 사용)
```
- 구글 로그인이 되려면 Firebase 콘솔 → Authentication → **승인된 도메인**에 `localhost`가 있어야 합니다.
- 내부 경로는 상대경로라 어느 base(루트/서브폴더)에서도 동작합니다.

## 개발 도구 (테스트 데이터)

```bash
npm i firebase-admin                       # 최초 1회
# saengjonil-dev 서비스 계정 키(JSON) 준비 (콘솔 → 프로젝트 설정 → 서비스 계정)

node scripts/seed-dev-data.mjs <키.json>                       # 벌크: 그룹+유저24+기록+목표
node scripts/seed-dev-user.mjs <키.json> --as-email=you@x.com  # 본인 계정에 리치 데이터
node scripts/inspect-dev.mjs   <키.json>                       # 현재 Firestore 상태 점검
node scripts/seed-dev-data.mjs --dry-run                       # 쓰기 없이 미리보기
```
> 모든 시드 스크립트는 키의 `project_id`가 `saengjonil-dev`가 아니면 실행을 거부합니다(운영 보호).

## 주요 규칙 & 주의사항 (유지보수 시 필독)

- **빌드 없음** — 네이티브 ES 모듈. `import`는 상대경로 + `.js` 확장자까지 명시해야 합니다.
- **인라인 이벤트 핸들러는 전역 함수에 의존** — `onclick="foo()"` 등은 `window.foo = ...`로 등록된
  전역을 호출합니다. 모듈은 전역을 만들지 않으므로, JS에서 핸들러 함수는 반드시 `window.X = ...`로
  등록해야 HTML에서 호출됩니다.
- **`index.html` 상단 인앱 브라우저 탈출 IIFE**는 일반 `<script>`(모듈 아님)로 **인라인 유지**합니다.
  카카오톡/인스타 등 인앱 브라우저를 감지해 외부 브라우저(`kakaotalk://web/openExternal` 등)로
  유도하며, 최우선 즉시 실행돼야 하므로 외부 파일로 분리하지 마세요.
- **관리자 권한**은 `js/admin.js`의 `ADMIN_UIDS` 배열(UID 화이트리스트)로 제어합니다.
  관리자 추가 = 해당 배열에 UID를 넣고 배포.
- **Firebase 웹 `apiKey`는 비밀값이 아닙니다**(공개돼도 안전). 실제 보호는 **Firestore 보안 규칙**과
  Auth **승인 도메인**이 담당하므로, 운영/스테이징 두 프로젝트 모두 규칙을 설정해야 합니다.
- **`scripts/`는 개발 전용**이며 `firebase.json`의 `ignore`로 배포에서 제외됩니다.
  앱 코드는 절대 `scripts/`에 두지 말고 `js/`에 두세요.
- **읽기 비용(중요):** 랭킹·대시보드는 컬렉션을 **전체 읽지 말고 기간/관련 범위로 스코핑**하세요.
  현재 `compare`는 선택 기간(`where date >= 기간시작`)만, `weekly_goals`는 본인 문서ID 범위만 읽습니다.
  전체-컬렉션 읽기는 사용자·기록이 늘수록 Firestore 읽기 할당량을 빠르게 소진하니 재도입 금지.
  (단, `admin.html`은 유저별 "마지막 기록" 표시 때문에 아직 `records` 전체를 읽음 — 향후 사전집계로 개선 여지.)
- **차트 색:** 계열 색은 `js/main.js`의 고정 팔레트 **`ITEM_COLORS`**(테마 독립)를 사용합니다.
  테마 색(`--main`)은 UI 크롬 전용 — 차트 계열 색으로 쓰지 마세요.
- **숫자/날짜 입력:** `main.js`·`index.js`의 캡처단계 입력 핸들러가 `min`/`max` 속성 기준으로 clamp합니다
  (음수 방지·미래 날짜 방지). 새 숫자/날짜 입력엔 `min`/`max`만 붙이면 자동 적용됩니다.
- (정리 후보) `compare.html`은 Chart.js CDN을 로드하지만 현재 사용하지 않습니다.
