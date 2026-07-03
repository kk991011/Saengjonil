// seed-dev-data.mjs
// ─────────────────────────────────────────────────────────────────────────
// DEV(saengjonil-dev) Firestore에 "풍부한 테스트 데이터"를 시드합니다.
//   groups + users + records(일일 기록) + weekly_goals(주간/월간 목표)
// 앱 스키마에 정확히 맞추고, 결정론적 PRNG로 생성해 재실행해도 동일합니다(멱등).
//
// ── 사용법 ──
//   준비:  npm i firebase-admin  +  saengjonil-dev 서비스 계정 키 JSON
//   검증(쓰기 없음):  node scripts/seed-dev-data.mjs --dry-run
//   실행:  node scripts/seed-dev-data.mjs ~/.secrets/saengjonil-dev-sa.json
//   개수/기간:  --users=30  --days=84  --as-of=2026-07-03
//
//   ★ 본인 계정으로 "로그인해서 보는" 리치 데이터도 심기(구글 로그인 전용 앱이라 실제 계정에 심음):
//     먼저 dev에서 구글 로그인 1회(계정 생성) →
//     node scripts/seed-dev-data.mjs <키.json> --as-email=you@gmail.com
//     (또는 UID 직접: --as-user=<UID>)  옵션: --nickname="내닉" --group="1조"
//     → users/<내UID>를 onboardingDone=true로 세팅 + 기록/목표 대량 생성.
//       로그인하면 온보딩 건너뛰고 바로 채워진 대시보드가 보입니다.
//       (주의: 기존 dev 프로필을 샘플 설정으로 덮어씁니다)
//
// 안전장치: 키의 project_id가 'saengjonil-dev'가 아니면 실행 거부(운영 보호).
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';

// ── 설정(기본값) ─────────────────────────────────────────────────────────
const EXPECTED_PROJECT = 'saengjonil-dev';
const GROUPS = ['1조', '2조', '3조', '4조'];
const SEED = 20260703;

// ── 인자 파싱 ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const DRY = argv.includes('--dry-run');
const NUM_USERS = Number(flag('users', 24));
const DAYS_BACK = Number(flag('days', 60));
const AS_OF = flag('as-of', null);
const AS_USER = flag('as-user', null);      // 본인 UID 직접 지정
const AS_EMAIL = flag('as-email', null);    // 본인 이메일 → live에서 UID 자동 조회
const HERO_NICK = flag('nickname', null);
const HERO_GROUP = flag('group', GROUPS[0]);
const keyPath = argv.find(a => !a.startsWith('--')) || process.env.GOOGLE_APPLICATION_CREDENTIALS;

// ── 결정론적 PRNG (mulberry32) ───────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const chance = (r, p) => r() < p;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const subset = (r, arr, k) => {
  const copy = [...arr], out = [];
  for (let i = 0; i < k && copy.length; i++) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
};

// ── 날짜 유틸(로컬 컴포넌트 기반, TZ 안전) ───────────────────────────────
const asOf = AS_OF ? new Date(`${AS_OF}T12:00:00`) : new Date();
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekNum = (startStr) => {
  const s = new Date(`${startStr}T12:00:00`);
  return Math.max(1, Math.floor(Math.floor((asOf - s) / 86400000) / 7) + 1);
};
const groupIdOf = (name) => 'grp-' + name.trim().replace(/\s+/g, '-');

// ── 어휘 풀 ──────────────────────────────────────────────────────────────
const NICKS = ['취준왕','면접고수','새벽러너','합격기원','코딩곰','자소서장인','열공모드','갓생살기','포기란없다','오늘도한걸음',
  '취뽀가자','스터디짱','꾸준함이답','성장중','도전하는나','밤샘전사','아침형인간','기록의신','묵묵히','한계돌파',
  '취준생K','면접의달인','노력파','슬기로운취준','내일은합격','루틴마스터','집중또집중','끝까지간다','희망회로','존버는승리'];
const BOOKS = ['클린 코드','함께 자라기','객체지향의 사실과 오해','이펙티브 자바','미움받을 용기','아주 작은 습관의 힘','원씽','데일 카네기 인간관계론','스피드 리딩','부의 추월차선'];
const LECTURE_ITEMS = ['자료구조 강의','알고리즘 특강','SQL 기초','네트워크 개론','운영체제','CS 면접대비','React 실전','Spring 부트캠프','파이썬 데이터분석','디자인패턴'];
const FOCUS_TAGS = ['자소서','필기','면접','FA5050/현장방문','골고루'];
const EXERCISES = ['헬스','러닝','요가','필라테스','홈트','등산','수영','축구·풋살','배드민턴'];
const THEME = ['#534AB7','#E4572E','#17BEBB','#2E86AB','#F25F5C','#3A7D44','#8E44AD','#D7263D','#1B998B','#C9184A'];
const PROGRAMS = ['careerpt','careerpt','careerpt','maesipgyeong','maesipmyeon','maesipboth'];
const WEEK_GOALS = ['매일 기사 3개 읽기','자소서 2개 완성','면접 스터디 참여','운동 주 3회','알고리즘 5문제','기업 분석 2곳','오피니언 작성 3회','필기 인강 완강','자기효능감 관리','생활 루틴 지키기'];
const MONTH_GOALS = ['서류 10곳 지원','모의면접 4회','포트폴리오 완성','자격증 1개 취득','매십경 80% 달성','매십면 완주','독서 3권','네트워킹 이벤트 참석','건강 체중 유지','월말 회고 작성'];

// ── 유저/기록/목표 생성기 ────────────────────────────────────────────────
function genUsers() {
  const users = [];
  const groupIds = GROUPS.map(groupIdOf);
  for (let i = 0; i < NUM_USERS; i++) {
    const r = rng(SEED + i * 1000 + 1);
    const nickname = NICKS[i % NICKS.length] + (i >= NICKS.length ? String(Math.floor(i / NICKS.length) + 1) : '');
    const programType = pick(r, PROGRAMS);
    const start = ymd(addDays(asOf, -ri(r, 21, 100)));
    let startDate = start, gyeongStartDate = '', myeonStartDate = '';
    if (programType === 'maesipgyeong') gyeongStartDate = start;
    else if (programType === 'maesipmyeon') myeonStartDate = start;
    else if (programType === 'maesipboth') { gyeongStartDate = start; myeonStartDate = ymd(addDays(asOf, -ri(r, 21, 100))); }
    users.push({
      uid: `testuser-${String(i).padStart(2, '0')}`, nickname,
      email: `testuser${String(i).padStart(2, '0')}@example.com`, photoURL: '',
      startDate, gyeongStartDate, myeonStartDate, programType,
      groupId: groupIds[i % groupIds.length],
      jobProb: ri(r, 10, 90), themeColor: pick(r, THEME),
      onboardingDone: true, createdAt: new Date(`${start}T09:00:00.000Z`).toISOString(),
      _diligence: 0.35 + r() * 0.6, _consistency: 0.45 + r() * 0.5,
    });
  }
  return { users, groupIds };
}

function genRecord(u, date, r) {
  const dl = u._diligence;
  const hasG = ['careerpt', 'maesipgyeong', 'maesipboth'].includes(u.programType);
  const hasM = ['careerpt', 'maesipmyeon', 'maesipboth'].includes(u.programType);
  const full = ['careerpt', 'maesipboth'].includes(u.programType);
  const g1 = hasG && chance(r, dl * 0.95), g2 = hasG && chance(r, dl * 0.85), g3 = hasG && chance(r, dl * 0.8);
  const m1 = hasM && chance(r, dl * 0.9), m2 = hasM && chance(r, dl * 0.8), m3 = hasM && chance(r, dl * 0.75);
  const exercises = chance(r, dl * 0.6) ? subset(r, EXERCISES, ri(r, 1, dl > 0.6 ? 3 : 1)) : [];
  const lecture = full && chance(r, 0.55) ? ri(r, 20, 120) : 0;
  const jasoseo = full && chance(r, 0.4) ? ri(r, 30, 150) : 0;
  const pilgi = full && chance(r, 0.45) ? ri(r, 20, 100) : 0;
  const interview = (full || hasM) && chance(r, 0.3) ? ri(r, 15, 90) : 0;
  const dok = chance(r, dl * 0.55);
  return {
    uid: u.uid, nickname: u.nickname, date,
    gyeong_article: g1, gyeong_opinion: g2, gyeong_comment: g3, gyeongScore: [g1, g2, g3].filter(Boolean).length,
    myeon_am: m1, myeon_pm: m2, myeon_feedback: m3, myeonScore: [m1, m2, m3].filter(Boolean).length,
    routineGyeong: g1 && g2 && g3, routineMyeon: m1 && m2 && m3,
    routineDok: dok, routinePilsa: full && chance(r, dl * 0.4),
    bookTitle: dok ? pick(r, BOOKS) : '',
    routineUn: exercises.length > 0, exercises,
    lecture, lectureItem: lecture > 0 ? pick(r, LECTURE_ITEMS) : '',
    jasoseo, jasoseoCount: jasoseo > 0 ? ri(r, 1, 3) : 0, pilgi, interview,
    totalTime: lecture + jasoseo + pilgi + interview,
    applications: chance(r, 0.15) ? ri(r, 1, 3) : 0,
    selfEsteem: Math.max(1, Math.min(5, Math.round(2 + dl * 2.5 + (r() - 0.5)))),
    jobProb: u.jobProb, fa5050: chance(r, 0.18),
    focusTags: subset(r, FOCUS_TAGS, ri(r, 1, 3)),
    createdAt: new Date(`${date}T21:00:00.000Z`).toISOString(),
  };
}

// 한 유저의 기록 + 주간/월간 목표 생성 (salt로 결정론적)
function buildUserData(u, salt) {
  const records = [], goals = [];
  const rr = rng(salt + 7);
  const startD = new Date(`${u.startDate}T12:00:00`);
  for (let off = 0; off < DAYS_BACK; off++) {
    const d = addDays(asOf, -off);
    if (d < startD) continue;
    if (!chance(rr, u._consistency)) continue;
    records.push(genRecord(u, ymd(d), rr));
  }
  const curWk = weekNum(u.startDate);
  for (let w = Math.max(1, curWk - 5); w <= curWk; w++) {
    const gr = rng(salt + 100 + w);
    goals.push({ id: `${u.uid}_week${w}`, goals: subset(gr, WEEK_GOALS, ri(gr, 2, 4)).map(t => ({ text: t, done: chance(gr, 0.55) })), updatedAt: new Date(`${u.startDate}T10:00:00.000Z`).toISOString() });
  }
  for (const mo of [0, 1]) {
    const md = new Date(asOf.getFullYear(), asOf.getMonth() - mo, 1);
    const ym = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`;
    const gr = rng(salt + 500 + mo);
    goals.push({ id: `${u.uid}_month_${ym}`, goals: subset(gr, MONTH_GOALS, ri(gr, 3, 6)).map(t => ({ text: t, done: chance(gr, 0.45) })), updatedAt: new Date(`${ym}-01T10:00:00.000Z`).toISOString() });
  }
  return { records, goals };
}

// 본인 계정(hero): 로그인해서 보는 리치 유저. 시작일 ~70일 전 → 다주차 차트가 채워짐.
function makeHero(uid, nick) {
  const start = ymd(addDays(asOf, -70));
  return {
    uid, nickname: nick || '나(테스트)', email: AS_EMAIL || '', photoURL: '',
    startDate: start, gyeongStartDate: '', myeonStartDate: '', programType: 'careerpt',
    groupId: groupIdOf(HERO_GROUP), jobProb: 55, themeColor: '#534AB7', onboardingDone: true,
    createdAt: new Date(`${start}T09:00:00.000Z`).toISOString(),
    _diligence: 0.82, _consistency: 0.88,
  };
}

// synthetic(테스트 24명) + 선택적 hero 를 조립
function assemble(heroUid, heroNick) {
  const { users, groupIds } = genUsers();
  const membersByGroup = Object.fromEntries(groupIds.map(g => [g, []]));
  let records = [], goals = [];
  users.forEach((u, i) => {
    membersByGroup[u.groupId].push(u.uid);
    const d = buildUserData(u, SEED + i * 1000);
    records.push(...d.records); goals.push(...d.goals);
  });
  let hero = null;
  if (heroUid) {
    hero = makeHero(heroUid, heroNick);
    const d = buildUserData(hero, SEED + 999000);
    users.push(hero); records.push(...d.records); goals.push(...d.goals);
    (membersByGroup[hero.groupId] ||= []).push(heroUid);
  }
  const groups = groupIds.map((id, idx) => ({
    id, name: GROUPS[idx].trim(), members: membersByGroup[id] || [],
    createdAt: new Date(`${ymd(addDays(asOf, -120))}T09:00:00.000Z`).toISOString(),
  }));
  return { groups, users, records, goals, hero };
}

// ── DRY-RUN (쓰기 없음) ──────────────────────────────────────────────────
if (DRY) {
  const data = assemble(AS_USER, HERO_NICK);  // dry-run에선 --as-user일 때만 hero 포함
  const c = { groups: data.groups.length, users: data.users.length, records: data.records.length, goals: data.goals.length };
  console.log(`생성됨: groups=${c.groups}, users=${c.users}, records=${c.records}, goals=${c.goals} (총 ${c.groups + c.users + c.records + c.goals})`);
  console.log(`설정: users=${NUM_USERS}, days=${DAYS_BACK}, as-of=${ymd(asOf)}, seed=${SEED}`);
  const strip = ({ _diligence, _consistency, ...rest }) => rest;
  console.log('\n[DRY-RUN]\n— 샘플 user —\n', JSON.stringify(strip(data.users[0]), null, 2));
  console.log('\n— 샘플 record —\n', JSON.stringify(data.records.find(Boolean), null, 2));
  console.log('\n— 그룹별 인원 —', data.groups.map(g => `${g.name}:${g.members.length}`).join(', '));
  if (data.hero) console.log('\n— hero(본인) —', JSON.stringify(strip(data.hero)));
  else if (AS_EMAIL) console.log(`\n(참고) --as-email=${AS_EMAIL} 는 실제 실행 시 UID를 조회해 hero를 심습니다.`);
  process.exit(0);
}

// ── 실제 쓰기: firebase-admin 필요 ───────────────────────────────────────
if (!keyPath) {
  console.error('❌ 서비스 계정 키 경로가 필요합니다 (또는 --dry-run).');
  process.exit(1);
}
let sa;
try { sa = JSON.parse(readFileSync(keyPath, 'utf8')); }
catch (e) { console.error(`❌ 키를 읽을 수 없습니다: ${keyPath}\n   ${e.message}`); process.exit(1); }
if (sa.project_id !== EXPECTED_PROJECT) {
  console.error(`❌ 안전장치: 키 project_id="${sa.project_id}" ≠ "${EXPECTED_PROJECT}". 운영 시드 방지.`);
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
initializeApp({ credential: cert(sa) });

// hero UID 결정: --as-user 우선, 없으면 --as-email로 Auth 조회
let heroUid = AS_USER, heroNick = HERO_NICK;
if (!heroUid && AS_EMAIL) {
  try {
    const u = await getAuth().getUserByEmail(AS_EMAIL);
    heroUid = u.uid; heroNick = heroNick || u.displayName || '나(테스트)';
    console.log(`hero 조회: ${AS_EMAIL} → uid=${heroUid} (nickname="${heroNick}")`);
  } catch (e) {
    console.error(`❌ ${AS_EMAIL} 계정을 찾을 수 없습니다. 먼저 dev(saengjonil-dev.web.app)에서 구글 로그인 1회 후 다시 실행하세요.\n   (${e.code || e.message})`);
    process.exit(1);
  }
}

const data = assemble(heroUid, heroNick);
const db = getFirestore();
const bw = db.bulkWriter();
let n = 0;
const put = (coll, id, doc) => { bw.set(db.collection(coll).doc(id), doc); n++; };

console.log(`\n쓰기 시작 → project=${sa.project_id}`);
for (const g of data.groups) { const { id, ...doc } = g; put('groups', id, doc); }
for (const u of data.users) { const { uid, _diligence, _consistency, ...doc } = u; put('users', uid, doc); }
for (const rec of data.records) put('records', `${rec.uid}_${rec.date}`, rec);
for (const gl of data.goals) { const { id, ...doc } = gl; put('weekly_goals', id, doc); }

await bw.close();
console.log(`✅ 완료: ${n} 문서 기록됨.`);
if (data.hero) console.log(`👤 본인 계정(uid=${data.hero.uid})에 리치 데이터 심음 → 로그인하면 바로 대시보드가 보입니다 (그룹=${HERO_GROUP}).`);
process.exit(0);
