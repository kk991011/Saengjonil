// seed-dev-user.mjs — 특정 "실제 로그인 유저"에게 리치 데이터 주입
// 이 앱은 구글 로그인 전용이라, 로그인해서 보려면 본인의 실제 구글 계정 UID 아래에 데이터를 넣어야 합니다.
//   users/<UID>를 onboardingDone=true로 세팅 + records + weekly_goals 대량 생성.
//   → 로그인하면 온보딩 없이 채워진 대시보드가 보입니다.
//
// 전제: 대상 계정이 dev(saengjonil-dev)에서 구글 로그인을 1회 해서 Auth 계정이 존재해야 함.
//
// 사용법:
//   미리보기:  node scripts/seed-dev-user.mjs --dry-run --as-user=<UID>
//   실행(이메일로 UID 자동조회):
//     node scripts/seed-dev-user.mjs ~/.secrets/saengjonil-dev-sa.json --as-email=you@gmail.com
//   실행(UID 직접):
//     node scripts/seed-dev-user.mjs ~/.secrets/saengjonil-dev-sa.json --as-user=<UID>
//   옵션: --nickname="내닉" --group=1조 --program=careerpt --days=70 --start-days=70
//
// 주의: 대상의 기존 dev 프로필(users doc)을 샘플 설정으로 덮어씁니다.
import {
  GROUPS, SEED, groupIdOf, ymd, addDays, buildUserData, parseArgs, resolveAsOf, initAdmin,
} from './seed-lib.mjs';

const argv = process.argv.slice(2);
const { flag, dry, asOfArg, keyPath } = parseArgs(argv);
const AS_USER = flag('as-user', null);
const AS_EMAIL = flag('as-email', null);
const NICK = flag('nickname', null);
const GROUP = flag('group', GROUPS[0]);
const PROGRAM = flag('program', 'careerpt');
const DAYS_BACK = Number(flag('days', 70));
const START_BACK = Number(flag('start-days', 70)); // 시작일: 며칠 전 (다주차 차트용)
const asOf = resolveAsOf(asOfArg);

if (!AS_USER && !AS_EMAIL) {
  console.error('대상 유저를 지정하세요: --as-email=you@gmail.com  또는  --as-user=<UID>');
  console.error('예) node scripts/seed-dev-user.mjs ~/.secrets/saengjonil-dev-sa.json --as-email=you@gmail.com --group=1조');
  process.exit(1);
}

function makeUser(uid, nick) {
  const start = ymd(addDays(asOf, -START_BACK));
  let startDate = start, gyeongStartDate = '', myeonStartDate = '';
  if (PROGRAM === 'maesipgyeong') gyeongStartDate = start;
  else if (PROGRAM === 'maesipmyeon') myeonStartDate = start;
  else if (PROGRAM === 'maesipboth') { gyeongStartDate = start; myeonStartDate = start; }
  return {
    uid, nickname: nick || '나(테스트)', email: AS_EMAIL || '', photoURL: '',
    startDate, gyeongStartDate, myeonStartDate, programType: PROGRAM,
    groupId: groupIdOf(GROUP), jobProb: 55, themeColor: '#534AB7', onboardingDone: true,
    createdAt: new Date(`${start}T09:00:00.000Z`).toISOString(),
    _diligence: 0.82, _consistency: 0.88,
  };
}

// ── DRY-RUN (쓰기 없음; UID는 --as-user일 때만 실제값) ────────────────────
if (dry) {
  const uid = AS_USER || 'PREVIEW_UID';
  const u = makeUser(uid, NICK);
  const d = buildUserData(u, SEED + 999000, asOf, DAYS_BACK);
  const strip = ({ _diligence, _consistency, ...rest }) => rest;
  console.log(`[DRY-RUN] uid=${AS_USER || '(live에서 이메일로 조회)'}, group=${GROUP}, program=${PROGRAM}, days=${DAYS_BACK}, start=${START_BACK}일전, as-of=${ymd(asOf)}`);
  console.log(`생성 예정: user 1, records ${d.records.length}, goals ${d.goals.length}`);
  console.log('\n— user —\n', JSON.stringify(strip(u), null, 2));
  console.log('\n— 샘플 record —\n', JSON.stringify(d.records.find(Boolean), null, 2));
  if (!AS_USER && AS_EMAIL) console.log(`\n(참고) live 실행 시 ${AS_EMAIL} → UID 조회 후 심습니다.`);
  process.exit(0);
}

// ── LIVE ─────────────────────────────────────────────────────────────────
let admin;
try { admin = await initAdmin(keyPath, { needAuth: !!AS_EMAIL && !AS_USER }); }
catch (e) { console.error('❌', e.message); process.exit(1); }
const { sa, db, auth } = admin;

let uid = AS_USER, nick = NICK;
if (!uid && AS_EMAIL) {
  try {
    const rec = await auth.getUserByEmail(AS_EMAIL);
    uid = rec.uid; nick = nick || rec.displayName || '나(테스트)';
    console.log(`조회: ${AS_EMAIL} → uid=${uid} (nickname="${nick}")`);
  } catch (e) {
    console.error(`❌ ${AS_EMAIL} 계정을 찾을 수 없습니다. dev(saengjonil-dev.web.app)에서 구글 로그인 1회 후 재실행하세요. (${e.code || e.message})`);
    process.exit(1);
  }
}

const u = makeUser(uid, nick);
const d = buildUserData(u, SEED + 999000, asOf, DAYS_BACK);
const { FieldValue } = await import('firebase-admin/firestore');
const bw = db.bulkWriter();
let n = 0;
const put = (coll, id, doc, opts) => { bw.set(db.collection(coll).doc(id), doc, opts || {}); n++; };

console.log(`\n쓰기 시작 → project=${sa.project_id}`);
// 대상 그룹 보장(없으면 생성) + 멤버 추가(arrayUnion → 기존 멤버 보존)
put('groups', groupIdOf(GROUP), {
  name: GROUP.trim(), members: FieldValue.arrayUnion(uid),
  createdAt: new Date(`${ymd(addDays(asOf, -120))}T09:00:00.000Z`).toISOString(),
}, { merge: true });
// 유저 프로필
{ const { uid: _u, _diligence, _consistency, ...doc } = u; put('users', uid, doc); }
// 기록 / 목표
for (const rec of d.records) put('records', `${rec.uid}_${rec.date}`, rec);
for (const gl of d.goals) { const { id, ...doc } = gl; put('weekly_goals', id, doc); }

await bw.close();
console.log(`✅ 완료: ${n} 문서 (uid=${uid}, group=${GROUP}). 로그인하면 온보딩 없이 대시보드가 보입니다.`);
process.exit(0);
