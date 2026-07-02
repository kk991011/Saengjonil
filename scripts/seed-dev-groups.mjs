// seed-dev-groups.mjs
// ─────────────────────────────────────────────────────────────────────────
// DEV(saengjonil-dev) Firestore의 'groups' 컬렉션에 그룹 문서를 시드합니다.
// 온보딩 3단계(그룹 선택)가 groups를 읽으므로, 최소 1개가 있어야 회원가입이 끝납니다.
//
// Firebase Admin SDK를 쓰므로 보안 규칙을 우회합니다(관리자 권한).
// 안전장치: 서비스 계정 키의 project_id가 'saengjonil-dev'가 아니면 실행을 거부합니다
//            → 운영(saengjonil)에 실수로 시드하는 것을 방지.
//
// ── 사용법 (최초 1회 준비) ──
//  1) Firebase 콘솔 → saengjonil-dev → ⚙ 프로젝트 설정 → 서비스 계정
//     → "새 비공개 키 생성" → JSON 저장 (repo 밖 권장, 예: ~/.secrets/saengjonil-dev-sa.json)
//     ※ 이 키는 '비밀'입니다. 절대 git에 커밋하지 마세요(.gitignore에 패턴 등록해둠).
//  2) 의존성 설치:  npm i firebase-admin
//  3) 실행:
//       node scripts/seed-dev-groups.mjs ~/.secrets/saengjonil-dev-sa.json
//     그룹명을 직접 지정하려면 뒤에 이어서:
//       node scripts/seed-dev-groups.mjs ~/.secrets/saengjonil-dev-sa.json "1조" "2조" "3조"
//     (환경변수도 가능: GOOGLE_APPLICATION_CREDENTIALS=경로 node scripts/seed-dev-groups.mjs)
// ─────────────────────────────────────────────────────────────────────────

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const EXPECTED_PROJECT = 'saengjonil-dev';            // 안전장치: dev 외엔 쓰지 않음
const DEFAULT_GROUPS = ['1조', '2조', '3조', '4조'];  // 인자 미지정 시 사용. 필요에 맞게 수정.

const [, , keyArg, ...nameArgs] = process.argv;
const keyPath = keyArg || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const names = nameArgs.length ? nameArgs : DEFAULT_GROUPS;

if (!keyPath) {
  console.error('사용법: node scripts/seed-dev-groups.mjs <서비스계정.json 경로> [그룹명...]');
  console.error('   또는 GOOGLE_APPLICATION_CREDENTIALS 환경변수로 키 경로를 지정하세요.');
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (e) {
  console.error(`❌ 서비스 계정 키를 읽을 수 없습니다: ${keyPath}\n   ${e.message}`);
  process.exit(1);
}

if (sa.project_id !== EXPECTED_PROJECT) {
  console.error(`❌ 안전장치 발동: 키의 project_id="${sa.project_id}" — "${EXPECTED_PROJECT}"가 아닙니다.`);
  console.error('   운영 프로젝트에 실수로 시드하는 것을 막았습니다. dev 서비스 계정 키를 사용하세요.');
  process.exit(1);
}

initializeApp({ credential: cert(sa) });
const db = getFirestore();

// 문서 ID를 이름 기반 slug로 고정 → 재실행해도 중복 생성되지 않음(멱등).
const slug = (s) => 'grp-' + s.trim().replace(/\s+/g, '-');

console.log(`시드 대상 project=${sa.project_id}, groups=${JSON.stringify(names)}`);
for (const name of names) {
  const id = slug(name);
  await db.collection('groups').doc(id).set(
    { name: name.trim(), members: [], createdAt: new Date().toISOString() },
    { merge: true }   // 있으면 갱신, 없으면 생성
  );
  console.log(`  ✅ groups/${id}  name="${name.trim()}"`);
}
console.log(`완료: ${names.length}개 그룹 시드됨 (project=${sa.project_id}).`);
process.exit(0);
