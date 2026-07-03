// seed-dev-data.mjs — DEV(saengjonil-dev)에 "벌크 테스트 데이터" 시드
//   groups(4) + users(테스트 N명) + records(일일기록) + weekly_goals(주간/월간 목표)
// 특정 로그인 유저에게 데이터를 넣는 건 seed-dev-user.mjs 를 사용하세요.
//
// 사용법:
//   미리보기:  node scripts/seed-dev-data.mjs --dry-run
//   실행:      node scripts/seed-dev-data.mjs ~/.secrets/saengjonil-dev-sa.json
//   조절:      --users=30 --days=84 --as-of=2026-07-03
import {
  GROUPS, SEED, groupIdOf, rng, ri, pick, addDays, ymd,
  PROGRAMS, NICKS, THEME, buildUserData, parseArgs, resolveAsOf, initAdmin,
} from './seed-lib.mjs';

const { flag, dry, asOfArg, keyPath } = parseArgs(process.argv.slice(2));
const NUM_USERS = Number(flag('users', 24));
const DAYS_BACK = Number(flag('days', 60));
const asOf = resolveAsOf(asOfArg);

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

function assemble() {
  const { users, groupIds } = genUsers();
  const membersByGroup = Object.fromEntries(groupIds.map(g => [g, []]));
  let records = [], goals = [];
  users.forEach((u, i) => {
    membersByGroup[u.groupId].push(u.uid);
    const d = buildUserData(u, SEED + i * 1000, asOf, DAYS_BACK);
    records.push(...d.records); goals.push(...d.goals);
  });
  const groups = groupIds.map((id, idx) => ({
    id, name: GROUPS[idx].trim(), members: membersByGroup[id],
    createdAt: new Date(`${ymd(addDays(asOf, -120))}T09:00:00.000Z`).toISOString(),
  }));
  return { groups, users, records, goals };
}

const data = assemble();
const c = { groups: data.groups.length, users: data.users.length, records: data.records.length, goals: data.goals.length };
console.log(`생성됨: groups=${c.groups}, users=${c.users}, records=${c.records}, goals=${c.goals} (총 ${c.groups + c.users + c.records + c.goals})`);
console.log(`설정: users=${NUM_USERS}, days=${DAYS_BACK}, as-of=${ymd(asOf)}, seed=${SEED}`);

if (dry) {
  const strip = ({ _diligence, _consistency, ...rest }) => rest;
  console.log('\n[DRY-RUN]\n— 샘플 user —\n', JSON.stringify(strip(data.users[0]), null, 2));
  console.log('\n— 샘플 record —\n', JSON.stringify(data.records.find(Boolean), null, 2));
  console.log('\n— 그룹별 인원 —', data.groups.map(g => `${g.name}:${g.members.length}`).join(', '));
  process.exit(0);
}

let admin;
try { admin = await initAdmin(keyPath); }
catch (e) { console.error('❌', e.message); process.exit(1); }
const { sa, db } = admin;
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
process.exit(0);
