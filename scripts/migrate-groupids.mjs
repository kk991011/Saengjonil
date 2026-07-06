// migrate-groupids.mjs — 다중 조 가입으로 전환하는 1회성 마이그레이션
//   1) users.groupId(단일) → users.groupIds(배열)  [groupId 필드는 호환 위해 남김, 추가 전용]
//   2) users.isLeader(true) → 해당 유저 소속 조의 groups.leaderUids 배열에 추가
//
// 안전장치: 기본은 DRY-RUN(쓰기 없음). 실제 반영하려면 --yes 를 붙인다.
//   dev:  node scripts/migrate-groupids.mjs <dev-sa.json>          # 미리보기
//         node scripts/migrate-groupids.mjs <dev-sa.json> --yes    # 반영
//   운영: node scripts/migrate-groupids.mjs <prod-sa.json> --yes   # (프로젝트명 확인 후)
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const keyPath = args.find(a => !a.startsWith('--')) || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) { console.error('❌ 서비스 계정 키 경로가 필요합니다.'); process.exit(1); }

let sa;
try { sa = JSON.parse(readFileSync(keyPath, 'utf8')); }
catch (e) { console.error(`❌ 키를 읽을 수 없습니다: ${keyPath} (${e.message})`); process.exit(1); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`\nproject = ${sa.project_id}   mode = ${apply ? '✍️  APPLY (--yes)' : '👀 DRY-RUN'}\n`);

const usersSnap = await db.collection('users').get();
const groupLeaders = {};   // groupId -> Set(uid)  (isLeader 이관 집계)
let toGroupIds = 0, leaderCount = 0;

const batch = db.batch();
usersSnap.forEach(d => {
  const u = d.data();
  // 1) groupIds 백필 (배열이 아직 없을 때만)
  if (!Array.isArray(u.groupIds)) {
    const arr = u.groupId ? [u.groupId] : [];
    console.log(`  users/${d.id}: groupIds ← ${JSON.stringify(arr)}${u.nickname ? ` (${u.nickname})` : ''}`);
    if (apply) batch.update(d.ref, { groupIds: arr });
    toGroupIds++;
  }
  // 2) isLeader → 소속 조 leaderUids 집계
  if (u.isLeader === true && u.groupId) {
    (groupLeaders[u.groupId] ??= new Set()).add(d.id);
    leaderCount++;
  }
});

// groups.leaderUids 병합 (기존 값 유지 + 이관분 추가)
const groupsSnap = await db.collection('groups').get();
for (const g of groupsSnap.docs) {
  const add = groupLeaders[g.id];
  if (!add || !add.size) continue;
  const existing = new Set(Array.isArray(g.data().leaderUids) ? g.data().leaderUids : []);
  const before = existing.size;
  add.forEach(uid => existing.add(uid));
  if (existing.size !== before) {
    const merged = [...existing];
    console.log(`  groups/${g.id} (${g.data().name}): leaderUids ← ${JSON.stringify(merged)}`);
    if (apply) batch.update(g.ref, { leaderUids: merged });
  }
}

console.log(`\n요약: groupIds 백필 ${toGroupIds}명, 조장 이관 ${leaderCount}건`);
if (apply) { await batch.commit(); console.log('✅ 반영 완료'); }
else console.log('ℹ️  DRY-RUN이라 아무것도 쓰지 않았습니다. 반영하려면 --yes 추가.');
process.exit(0);
