// ── 환경별 Firebase 설정 (호스트명 기반 자동 전환) ──
// 운영 도메인이면 운영(saengjonil), 그 외(localhost·스테이징)면 dev 프로젝트를 사용합니다.
// 각 HTML은 이 파일에서 firebaseConfig 하나만 import 하면 됩니다.
//   import { firebaseConfig } from './firebase-config.js';

// 운영(prod) — https://kk991011.github.io/Saengjonil/
const PROD = {
  apiKey: "AIzaSyDxt2OyXE_ZkYo6NSIHf_AJf2-8IOP5yFk",
  authDomain: "saengjonil.firebaseapp.com",
  projectId: "saengjonil",
  storageBucket: "saengjonil.firebasestorage.app",
  messagingSenderId: "148403039390",
  appId: "1:148403039390:web:a1052eede7dcc9d94e9f8f"
};

// 테스트(dev) — saengjonil-dev 프로젝트. localhost·스테이징에서 사용됩니다.
// (비워두면 운영 설정으로 자동 폴백하고 콘솔에 경고를 남깁니다)
const DEV = {
  apiKey: "AIzaSyDGwiuR-20ETXn_tTzzk5mLv71Ym6RjwHg",
  authDomain: "saengjonil-dev.firebaseapp.com",
  projectId: "saengjonil-dev",
  storageBucket: "saengjonil-dev.firebasestorage.app",
  messagingSenderId: "93717685236",
  appId: "1:93717685236:web:3a2f78e1e6cebb5fc80fa1"
};

// 운영으로 취급할 호스트 목록. 커스텀 도메인을 붙이면 여기에 추가하세요.
const PROD_HOSTS = ["kk991011.github.io"];

export const isProd = PROD_HOSTS.includes(location.hostname);

const devReady = !!DEV.projectId;
if (!isProd && !devReady) {
  console.warn(
    "[firebase-config] dev 프로젝트 설정이 비어 있어 운영(saengjonil) 설정으로 폴백합니다. " +
    "테스트 데이터가 운영 데이터에 섞이지 않게 하려면 firebase-config.js의 DEV 값을 채워주세요."
  );
}

export const firebaseEnv = isProd ? "prod" : (devReady ? "dev" : "prod-fallback");
export const firebaseConfig = isProd ? PROD : (devReady ? DEV : PROD);

console.log("[firebase-config] env =", firebaseEnv, "/ host =", location.hostname, "/ projectId =", firebaseConfig.projectId);
