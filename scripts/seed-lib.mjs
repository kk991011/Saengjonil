// seed-lib.mjs — dev 시드 스크립트 공용 헬퍼
// seed-dev-data.mjs(벌크)와 seed-dev-user.mjs(단일 유저)가 공유합니다.
import { readFileSync } from 'node:fs';

export const EXPECTED_PROJECT = 'saengjonil-dev';
export const SEED = 20260703;
export const GROUPS = ['1조', '2조', '3조', '4조'];
export const groupIdOf = (name) => 'grp-' + name.trim().replace(/\s+/g, '-');

// ── 결정론적 PRNG (mulberry32) + 헬퍼 ────────────────────────────────────
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const chance = (r, p) => r() < p;
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const subset = (r, arr, k) => {
  const copy = [...arr], out = [];
  for (let i = 0; i < k && copy.length; i++) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
};

// ── 날짜 유틸(로컬 컴포넌트 기반, TZ 안전) ───────────────────────────────
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const weekNum = (startStr, asOf) => {
  const s = new Date(`${startStr}T12:00:00`);
  return Math.max(1, Math.floor(Math.floor((asOf - s) / 86400000) / 7) + 1);
};

// ── 어휘 풀 ──────────────────────────────────────────────────────────────
export const NICKS = ['취준왕','면접고수','새벽러너','합격기원','코딩곰','자소서장인','열공모드','갓생살기','포기란없다','오늘도한걸음',
  '취뽀가자','스터디짱','꾸준함이답','성장중','도전하는나','밤샘전사','아침형인간','기록의신','묵묵히','한계돌파',
  '취준생K','면접의달인','노력파','슬기로운취준','내일은합격','루틴마스터','집중또집중','끝까지간다','희망회로','존버는승리'];
export const BOOKS = ['클린 코드','함께 자라기','객체지향의 사실과 오해','이펙티브 자바','미움받을 용기','아주 작은 습관의 힘','원씽','데일 카네기 인간관계론','스피드 리딩','부의 추월차선'];
export const LECTURE_ITEMS = ['자료구조 강의','알고리즘 특강','SQL 기초','네트워크 개론','운영체제','CS 면접대비','React 실전','Spring 부트캠프','파이썬 데이터분석','디자인패턴'];
export const FOCUS_TAGS = ['자소서','필기','면접','FA5050/현장방문','골고루'];
export const EXERCISES = ['헬스','러닝','요가','필라테스','홈트','등산','수영','축구·풋살','배드민턴'];
export const THEME = ['#534AB7','#E4572E','#17BEBB','#2E86AB','#F25F5C','#3A7D44','#8E44AD','#D7263D','#1B998B','#C9184A'];
export const PROGRAMS = ['careerpt','careerpt','careerpt','maesipgyeong','maesipmyeon','maesipboth'];
export const WEEK_GOALS = ['매일 기사 3개 읽기','자소서 2개 완성','면접 스터디 참여','운동 주 3회','알고리즘 5문제','기업 분석 2곳','오피니언 작성 3회','필기 인강 완강','자기효능감 관리','생활 루틴 지키기'];
export const MONTH_GOALS = ['서류 10곳 지원','모의면접 4회','포트폴리오 완성','자격증 1개 취득','매십경 80% 달성','매십면 완주','독서 3권','네트워킹 이벤트 참석','건강 체중 유지','월말 회고 작성'];

// ── 일일 기록 1건 생성 (앱 saveRecord 스키마와 정확히 일치) ──────────────
export function genRecord(u, date, r) {
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

// ── 한 유저의 기록 + 주간/월간 목표 생성 (salt로 결정론적) ────────────────
export function buildUserData(u, salt, asOf, daysBack) {
  const records = [], goals = [];
  const rr = rng(salt + 7);
  const startD = new Date(`${u.startDate}T12:00:00`);
  for (let off = 0; off < daysBack; off++) {
    const d = addDays(asOf, -off);
    if (d < startD) continue;
    if (!chance(rr, u._consistency)) continue;
    records.push(genRecord(u, ymd(d), rr));
  }
  const curWk = weekNum(u.startDate, asOf);
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

// ── 공용 인자 파서 ───────────────────────────────────────────────────────
export function parseArgs(argv) {
  const flag = (name, def) => {
    const hit = argv.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : def;
  };
  return {
    flag,
    dry: argv.includes('--dry-run'),
    asOfArg: flag('as-of', null),
    keyPath: argv.find(a => !a.startsWith('--')) || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };
}
export const resolveAsOf = (asOfArg) => (asOfArg ? new Date(`${asOfArg}T12:00:00`) : new Date());

// ── firebase-admin 초기화 + 프로젝트 안전장치 ────────────────────────────
export async function initAdmin(keyPath, { needAuth = false } = {}) {
  if (!keyPath) throw new Error('서비스 계정 키 경로가 필요합니다 (또는 --dry-run).');
  let sa;
  try { sa = JSON.parse(readFileSync(keyPath, 'utf8')); }
  catch (e) { throw new Error(`키를 읽을 수 없습니다: ${keyPath} (${e.message})`); }
  if (sa.project_id !== EXPECTED_PROJECT) {
    throw new Error(`안전장치: 키 project_id="${sa.project_id}" ≠ "${EXPECTED_PROJECT}". 운영 시드 방지.`);
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(sa) });
  const out = { sa, db: getFirestore() };
  if (needAuth) { const { getAuth } = await import('firebase-admin/auth'); out.auth = getAuth(); }
  return out;
}
