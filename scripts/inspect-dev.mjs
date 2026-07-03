// inspect-dev.mjs — dev(saengjonil-dev) Firestore 현재 상태 점검
// 보안 규칙 때문에 브라우저로는 못 보므로, admin 키로 컬렉션 개수/그룹/유저분포를 출력합니다.
//
// 사용법:  node scripts/inspect-dev.mjs ~/.secrets/saengjonil-dev-sa.json
//         또는  node scripts/inspect-dev.mjs $KEY
import { initAdmin } from './seed-lib.mjs';

const keyPath = process.argv.slice(2).find(a => !a.startsWith('--')) || process.env.GOOGLE_APPLICATION_CREDENTIALS;

let admin;
try { admin = await initAdmin(keyPath); }
catch (e) { console.error('❌', e.message); process.exit(1); }
const { sa, db } = admin;

console.log(`project = ${sa.project_id}\n`);

console.log('[컬렉션 문서 수]');
for (const coll of ['groups', 'users', 'records', 'weekly_goals']) {
  try {
    const c = await db.collection(coll).count().get();
    console.log(`  ${coll.padEnd(13)} ${c.data().count}`);
  } catch (e) {
    console.log(`  ${coll.padEnd(13)} (count 실패: ${e.message})`);
  }
}

const gs = await db.collection('groups').get();
console.log(`\n[groups] (${gs.size}개)`);
gs.forEach(d => {
  const g = d.data();
  console.log(`  ${d.id.padEnd(14)} name="${g.name}"  members=${(g.members || []).length}`);
});

const us = await db.collection('users').get();
const byGroup = {};
us.forEach(d => { const g = d.data().groupId || '(none)'; byGroup[g] = (byGroup[g] || 0) + 1; });
console.log(`\n[users → groupId 분포] (총 ${us.size}명)`);
Object.entries(byGroup).sort().forEach(([g, n]) => console.log(`  ${String(g).padEnd(16)} ${n}명`));

// 실제 로그인 계정(합성 testuser 제외) 추정: uid가 testuser- 로 시작 안 하는 유저
const realUsers = [];
us.forEach(d => { if (!d.id.startsWith('testuser-')) realUsers.push({ uid: d.id, ...d.data() }); });
console.log(`\n[실제(비-testuser) 유저] (${realUsers.length}명)`);
realUsers.forEach(u => console.log(`  uid=${u.uid}  nickname="${u.nickname}"  group=${u.groupId}  email=${u.email || '-'}`));

process.exit(0);
