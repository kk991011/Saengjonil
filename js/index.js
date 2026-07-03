
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Firebase 설정은 환경(운영/dev)에 따라 firebase-config.js에서 자동 선택됩니다.
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let selectedGroupId = null;
let selectedProgram = null;
let currentStep = 1;

// 리다이렉트 로그인 결과를 먼저 명시적으로 처리
getRedirectResult(auth).catch((e) => {
  console.error('리다이렉트 로그인 오류:', e);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
  alert('로그인 중 문제가 발생했어요. 다시 시도해주세요.\n(' + (e.code || e.message) + ')');
});

// 인증 상태 감지
onAuthStateChanged(auth, async (user) => {
  document.getElementById('loading').style.display = 'none';
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().onboardingDone) {
      window.location.href = 'main.html';
    } else {
      showOnboarding(user);
    }
  } else {
    document.getElementById('login-section').style.display = 'block';
  }
});

// 구글 로그인
window.loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('팝업 로그인 오류:', e);
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
      try {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        await signInWithRedirect(auth, provider);
      } catch (e2) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
        alert('로그인에 실패했어요. 다시 시도해주세요.');
      }
    } else if (e.code !== 'auth/popup-closed-by-user') {
      alert('로그인에 실패했어요. 다시 시도해주세요.\n(' + e.code + ')');
    }
  }
};

// 온보딩 표시
async function showOnboarding(user) {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('onboarding-section').style.display = 'block';
  const nameInput = document.getElementById('ob-nickname');
  if (user.displayName) nameInput.value = user.displayName.split(' ')[0];
  await loadGroups();
}

// 그룹 목록 로드
async function loadGroups() {
  const snap = await getDocs(collection(db, 'groups'));
  const listEl = document.getElementById('group-list');
  listEl.innerHTML = '';
  if (snap.empty) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;font-size:14px">아직 등록된 그룹이 없어요.<br>관리자에게 문의해주세요.</div>';
    return;
  }
  // 이름 기준 오름차순 정렬
  const groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  groups.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  groups.forEach(g => {
    const el = document.createElement('div');
    el.className = 'group-option';
    el.dataset.id = g.id;
    el.innerHTML = `<div class="g-icon">${g.name[0]}</div><div><div class="g-name">${g.name}</div><div class="g-count">멤버 ${(g.members||[]).length}명</div></div>`;
    el.onclick = () => {
      document.querySelectorAll('.group-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      selectedGroupId = g.id;
    };
    listEl.appendChild(el);
  });
}

// 주차 계산
window.calcWeek = () => {
  const val = document.getElementById('ob-startdate').value;
  if (!val) return;
  const start = new Date(val);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const week = Math.max(1, Math.floor(diffDays / 7) + 1);
  document.getElementById('week-num').textContent = week;
  document.getElementById('week-preview').style.display = 'block';
};

// 프로그램 유형 선택
window.selectProgram = (type) => {
  selectedProgram = type;
  document.querySelectorAll('.program-card').forEach(c => {
    c.style.borderColor = '#e8e8e8';
    c.style.background = 'white';
  });
  const sel = document.getElementById('prog-' + type);
  if (sel) {
    sel.style.borderColor = 'var(--main)';
    sel.style.background = 'var(--main-xlight, #F5F4FF)';
  }

  // 시작일 입력 섹션 표시/숨김
  const show = (id, v) => { const el=document.getElementById(id); if(el) el.style.display=v?'block':'none'; };
  const showDates = type !== 'careerpt'; // 커리어PT는 이미 step1에서 입력
  document.getElementById('program-dates').style.display = showDates || type === 'careerpt' ? 'block' : 'none';

  if (type === 'careerpt') {
    // 커리어PT: 매십경/면 시작일 선택사항
    show('date-gyeong-section', true);
    show('date-myeon-section', true);
    show('date-gyeong-only', false);
    show('date-myeon-only', false);
  } else if (type === 'maesipgyeong') {
    show('date-gyeong-section', false);
    show('date-myeon-section', false);
    show('date-gyeong-only', true);
    show('date-myeon-only', false);
  } else if (type === 'maesipmyeon') {
    show('date-gyeong-section', false);
    show('date-myeon-section', false);
    show('date-gyeong-only', false);
    show('date-myeon-only', true);
  } else if (type === 'maesipboth') {
    show('date-gyeong-section', false);
    show('date-myeon-section', false);
    show('date-gyeong-only', true);
    show('date-myeon-only', true);
  }
};

// 프로그램별 주차 미리보기
window.calcProgramWeek = (prog) => {
  const idMap = {
    'gyeong': ['ob-gyeong-start', 'gyeong-week-num', 'gyeong-week-preview'],
    'myeon':  ['ob-myeon-start',  'myeon-week-num',  'myeon-week-preview'],
    'gyeong-only': ['ob-gyeong-only-start', 'gyeong-only-week-num', 'gyeong-only-week-preview'],
    'myeon-only':  ['ob-myeon-only-start',  'myeon-only-week-num',  'myeon-only-week-preview'],
  };
  const [inputId, numId, previewId] = idMap[prog] || [];
  if (!inputId) return;
  const val = document.getElementById(inputId).value;
  if (!val) return;
  const diff = Math.floor((new Date() - new Date(val)) / 86400000);
  const week = Math.max(1, Math.floor(diff/7)+1);
  document.getElementById(numId).textContent = week;
  document.getElementById(previewId).style.display = 'block';
};

// 온보딩 스텝 이동 (4스텝: 기본정보 → 프로그램 → 그룹 → 완료)
window.obNext = async () => {
  if (currentStep === 1) {
    const nick = document.getElementById('ob-nickname').value.trim();
    const start = document.getElementById('ob-startdate').value;
    if (!nick) { alert('닉네임을 입력해주세요.'); return; }
    if (!start) { alert('참여 시작일을 선택해주세요.'); return; }
    gotoStep(2);
  } else if (currentStep === 2) {
    if (!selectedProgram) { alert('참여 프로그램을 선택해주세요.'); return; }
    // 전용 참여자는 해당 시작일 필수
    if (selectedProgram === 'maesipgyeong' || selectedProgram === 'maesipboth') {
      if (!document.getElementById('ob-gyeong-only-start').value) { alert('매십경 시작일을 입력해주세요.'); return; }
    }
    if (selectedProgram === 'maesipmyeon' || selectedProgram === 'maesipboth') {
      if (!document.getElementById('ob-myeon-only-start').value) { alert('매십면 시작일을 입력해주세요.'); return; }
    }
    gotoStep(3);
  } else if (currentStep === 3) {
    if (!selectedGroupId) { alert('그룹을 선택해주세요.'); return; }
    gotoStep(4);
    await saveOnboarding();
    document.getElementById('btn-next').textContent = '내 일지 시작하기 →';
  } else if (currentStep === 4) {
    window.location.href = 'main.html';
  }
};

window.obBack = () => {
  if (currentStep > 1) gotoStep(currentStep - 1);
};

function gotoStep(n) {
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.getElementById(`sd${currentStep}`).classList.remove('active');
  document.getElementById(`sd${currentStep}`).classList.add('done');
  currentStep = n;
  document.getElementById(`step${n}`).classList.add('active');
  document.getElementById(`sd${n}`).classList.add('active');
  document.getElementById('btn-back').style.display = n > 1 ? 'block' : 'none';
  if (n === 4) document.getElementById('btn-back').style.display = 'none';
}

// 시작일 값 가져오기 헬퍼
function getProgramStartDate(type) {
  if (type === 'careerpt') {
    return {
      startDate: document.getElementById('ob-startdate').value,
      gyeongStartDate: document.getElementById('ob-gyeong-start').value || '',
      myeonStartDate:  document.getElementById('ob-myeon-start').value  || '',
    };
  } else if (type === 'maesipgyeong') {
    return {
      startDate: document.getElementById('ob-gyeong-only-start').value,
      gyeongStartDate: document.getElementById('ob-gyeong-only-start').value,
      myeonStartDate: '',
    };
  } else if (type === 'maesipmyeon') {
    return {
      startDate: document.getElementById('ob-myeon-only-start').value,
      gyeongStartDate: '',
      myeonStartDate: document.getElementById('ob-myeon-only-start').value,
    };
  } else if (type === 'maesipboth') {
    return {
      startDate: document.getElementById('ob-gyeong-only-start').value,
      gyeongStartDate: document.getElementById('ob-gyeong-only-start').value,
      myeonStartDate: document.getElementById('ob-myeon-only-start').value,
    };
  }
  return { startDate: '', gyeongStartDate: '', myeonStartDate: '' };
}

async function saveOnboarding() {
  const nick = document.getElementById('ob-nickname').value.trim();
  const jobProb = Number(document.getElementById('ob-jobprob').value) || 0;
  const { startDate, gyeongStartDate, myeonStartDate } = getProgramStartDate(selectedProgram);
  await setDoc(doc(db, 'users', currentUser.uid), {
    nickname: nick,
    startDate,
    gyeongStartDate,
    myeonStartDate,
    groupId: selectedGroupId,
    programType: selectedProgram,
    jobProb,
    email: currentUser.email,
    photoURL: currentUser.photoURL || '',
    themeColor: '#534AB7',
    onboardingDone: true,
    createdAt: new Date().toISOString(),
  });
  const programLabel = { careerpt:'커리어PT', maesipgyeong:'매십경', maesipmyeon:'매십면', maesipboth:'매십경+매십면' }[selectedProgram] || '';
  document.getElementById('complete-msg').textContent =
    `${nick}님, ${programLabel} 프로그램으로 생존일지를 시작할 수 있어요!\n매일 꾸준히 기록해서 함께 취업에 성공해요!`;
}
