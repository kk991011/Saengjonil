
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, where,
  orderBy, getDocs, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Firebase 설정은 환경(운영/dev)에 따라 firebase-config.js에서 자동 선택됩니다.
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null, userProfile = null;
let allUsers = [], allRecords = [], allGroups = [];
let filters = { scope:'all', period:'week', progfilter:'all', gyscope:'all', gyperiod:'week', gyprogfilter:'all', myscope:'all', myperiod:'week', myprogfilter:'all', cscope:'all', cperiod:'week', gperiod:'week', selectedWeek: null, selectedMonth: null };
let currentTab = 'rank';

// ── 인증 ──
onAuthStateChanged(auth, async u => {
  if (!u) { window.location.href = 'index.html'; return; }
  user = u;
  const uSnap = await getDoc(doc(db, 'users', u.uid));
  if (!uSnap.exists() || !uSnap.data().onboardingDone) { window.location.href = 'index.html'; return; }
  userProfile = uSnap.data();
  applyTheme(userProfile.themeColor || '#534AB7');
  initHeader();
  await loadAllData();
  await refresh();
});

function applyTheme(color) {
  document.documentElement.style.setProperty('--main', color);
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--main-dark',`rgb(${Math.round(r*.8)},${Math.round(g*.8)},${Math.round(b*.8)})`);
  document.documentElement.style.setProperty('--main-mid',`rgb(${Math.min(255,Math.round(r*1.15))},${Math.min(255,Math.round(g*1.15))},${Math.min(255,Math.round(b*1.15))})`);
  document.documentElement.style.setProperty('--main-light',`rgba(${r},${g},${b},0.12)`);
  document.documentElement.style.setProperty('--main-xlight',`rgba(${r},${g},${b},0.06)`);
}

function calcWeek(startDate) {
  const diff = Math.floor((new Date() - new Date(startDate)) / 86400000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

// 탭 컨텍스트에 따라 유저의 주차 레이블 반환
function calcWeekForUser(u, context) {
  if (context === 'gyeong' && u.gyeongStartDate) {
    return `경${calcWeek(u.gyeongStartDate)}주차`;
  }
  if (context === 'myeon' && u.myeonStartDate) {
    return `면${calcWeek(u.myeonStartDate)}주차`;
  }
  return `${calcWeek(u.startDate)}주차`;
}

let currentContext = 'default';

function initHeader() {
  const wk = calcWeek(userProfile.startDate);
  document.getElementById('user-name').textContent = userProfile.nickname;
  document.getElementById('week-badge').textContent = `${wk}`;
  const av = document.getElementById('avatar');
  if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" alt="프로필">`;
  else av.textContent = userProfile.nickname[0];
}

// ── 데이터 전체 로드 ──
async function loadAllData() {
  // 그룹 + 유저만 로드. records는 선택된 기간에 맞춰 ensureRecords에서 로드(읽기 절약).
  const gSnap = await getDocs(collection(db, 'groups'));
  allGroups = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const uSnap = await getDocs(collection(db, 'users'));
  allUsers = uSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ── 기간에 필요한 records만 로드 (단조 확장) ──
// 현재 탭의 기간 필터가 요구하는 날짜 하한을 계산. filterRecords가 쓰는 getDateRange와
// 동일 기준이라, 이 하한 이상만 로드해도 클라이언트 필터 결과는 동일(정확).
let loadedFloor = null;
function periodFloor() {
  const period = filters[TAB_KEY_MAP[currentTab] || 'period'] || 'week';
  if (period === 'specific_week') {
    if (!filters.selectedWeek) return getDateRange('week');
    let min = null;
    allUsers.forEach(u => {
      if (!u.startDate) return;
      const { from } = getWeekRange(u.startDate, Number(filters.selectedWeek));
      if (min === null || from < min) min = from;
    });
    return min || '2000-01-01';
  }
  if (period === 'specific_month') return (filters.selectedMonth || '2000-01') + '-01';
  return getDateRange(period);
}
async function ensureRecords() {
  const floor = periodFloor();
  if (loadedFloor !== null && floor >= loadedFloor) return; // 이미 커버됨
  const snap = await getDocs(query(collection(db, 'records'), where('date', '>=', floor), orderBy('date', 'desc')));
  allRecords = snap.docs.map(d => d.data());
  loadedFloor = floor;
}
function renderCurrentTab() {
  if (currentTab === 'rank') renderRank();
  else if (currentTab === 'gyeong') renderGyeongDetail();
  else if (currentTab === 'myeon') renderMyeonDetail();
  else if (currentTab === 'compare') renderCompare();
  else if (currentTab === 'group') renderGroups();
}
async function refresh() { await ensureRecords(); renderCurrentTab(); }

// ── 기간 필터 함수 ──
function getDateRange(period) {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    return mon.toISOString().split('T')[0];
  }
  if (period === 'month') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  return '2000-01-01';
}

// 특정 주차(N주차)의 시작일~종료일 계산 — 각 유저의 startDate 기준
function getWeekRange(startDate, weekNum) {
  const start = new Date(startDate);
  const from = new Date(start);
  from.setDate(start.getDate() + (weekNum - 1) * 7);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  return { from: localDateStr(from), to: localDateStr(to) };
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function filterRecords(recs, period, startDate) {
  if (period === 'specific_week' && filters.selectedWeek && startDate) {
    const { from, to } = getWeekRange(startDate, Number(filters.selectedWeek));
    return recs.filter(r => r.date >= from && r.date <= to);
  }
  if (period === 'specific_month' && filters.selectedMonth) {
    return recs.filter(r => r.date.startsWith(filters.selectedMonth));
  }
  const from = getDateRange(period);
  return recs.filter(r => r.date >= from);
}

function getUserRecords(uid, period) {
  const u = allUsers.find(x => x.uid === uid);
  return filterRecords(allRecords.filter(r => r.uid === uid), period, u?.startDate);
}

function getGroupUsers(scope, progfilter) {
  let users = allUsers;
  if (scope === 'mine') users = users.filter(u => u.groupId === userProfile.groupId);
  const pf = progfilter || filters.progfilter || 'all';
  if (pf !== 'all') users = users.filter(u => (u.programType || 'careerpt') === pf);
  return users;
}

// 상위 N명 + 내 순위가 N위 밖이면 내 행도 별도로 추가
// 내 행을 상단에 고정하고 나머지를 순위대로 정렬 (전체 표시)
function buildRankRows(sorted) {
  const myIdx = sorted.findIndex(u => u.uid === user.uid);
  const rows = [];
  // 1) 내 행 먼저 (고정)
  if (myIdx !== -1) {
    rows.push({ u: sorted[myIdx], rank: myIdx + 1, isMe: true, pinned: true });
  }
  // 2) 나머지 전체 (순위순)
  sorted.forEach((u, i) => {
    if (u.uid !== user.uid) rows.push({ u, rank: i + 1, isMe: false });
  });
  return rows;
}

// ── 유저별 통계 계산 ──
function calcStats(uid, period) {
  const recs = getUserRecords(uid, period);
  const n = recs.length || 1;
  const pct = k => recs.length ? Math.round(recs.filter(r=>r[k]).length / recs.length * 100) : 0;
  const avg = k => Math.round(recs.reduce((a,r)=>a+(r[k]||0),0) / n);
  const gA = pct('gyeong_article'), gO = pct('gyeong_opinion'), gC = pct('gyeong_comment');
  const mA = pct('myeon_am'), mP = pct('myeon_pm'), mF = pct('myeon_feedback');
  return {
    gyeong: pct('routineGyeong'),
    gyeong_article: gA, gyeong_opinion: gO, gyeong_comment: gC,
    gyeongAvg: Math.round((gA + gO + gC) / 3),
    myeon: pct('routineMyeon'),
    myeon_am: mA, myeon_pm: mP, myeon_feedback: mF,
    myeonAvg: Math.round((mA + mP + mF) / 3),
    dok: pct('routineDok'), un: pct('routineUn'), fa: pct('fa5050'),
    lecture: avg('lecture'), jasoseo: avg('jasoseo'),
    pilgi: avg('pilgi'), interview: avg('interview'),
    apps: recs.reduce((a,r)=>a+(r.applications||0),0),
    days: recs.length,
  };
}

// 공통 랭킹 카드 HTML 생성 (내 행 고정 상단, 나머지 스크롤)
function buildRankCardHtml(sorted, statsMap, item, unit, context, cardStyle) {
  const maxVal = statsMap[sorted[0]?.uid]?.[item.key] || 1;
  const rows = buildRankRows(sorted);
  const myRow = rows.find(r => r.isMe);
  const othersRows = rows.filter(r => !r.isMe);

  const rowHtml = (u, rank, isMe) => {
    const val = statsMap[u.uid]?.[item.key] || 0;
    const wk = calcWeekForUser(u, context);
    const numCls = rank===1?'top1':rank===2?'top2':rank===3?'top3':'';
    return `<div class="rank-row ${isMe?'me':''}">
      <div class="rank-num ${numCls}">${rank}</div>
      <div class="rank-name">${u.nickname}<span class="rank-week">${wk}</span></div>
      ${isMe?'<span class="me-tag">나</span>':''}
      <div class="rank-bar-wrap"><div class="rank-bar-track"><div class="rank-bar-fill" style="width:${maxVal?Math.round(val/maxVal*100):0}%"></div></div></div>
      <div class="rank-val">${val}${unit}</div>
    </div>`;
  };

  let html = `<div class="rank-card" ${cardStyle||''}>
    <div class="rank-card-title">${item.label}</div>`;
  // 내 행 상단 고정 (스크롤 밖)
  if (myRow) {
    html += `<div style="border-bottom:1px solid var(--main-light)">
      ${rowHtml(myRow.u, myRow.rank, true)}
    </div>`;
  }
  // 나머지 전체 스크롤
  html += `<div style="max-height:260px;overflow-y:auto;overflow-x:hidden">`;
  othersRows.forEach(({u, rank}) => { html += rowHtml(u, rank, false); });
  html += `</div></div>`;
  return html;
}
function renderGyeongDetail() {
  const users = getGroupUsers(filters.gyscope || 'all', filters.gyprogfilter || 'all');
  const period = filters.gyperiod || 'week';
  const statsMap = {};
  users.forEach(u => { statsMap[u.uid] = calcStats(u.uid, period); });
  const items = [
    { key:'gyeongAvg', label:'매십경 — 종합 달성률', highlight:true },
    { key:'gyeong_article', label:'매십경 — 기사 읽기' },
    { key:'gyeong_opinion', label:'매십경 — 오피니언 작성' },
    { key:'gyeong_comment', label:'매십경 — 댓글 작성' },
  ];
  let html = '';
  items.forEach(item => {
    const sorted = [...users].sort((a,b) => (statsMap[b.uid]?.[item.key]||0) - (statsMap[a.uid]?.[item.key]||0));
    html += buildRankCardHtml(sorted, statsMap, item, '%', currentContext, item.highlight?'style="border:1.5px solid var(--main-mid)"':'');
  });
  document.getElementById('gyeong-content').innerHTML = html || '<div class="empty-state"><p>기록이 없어요</p></div>';
}

// ── 매십면 상세 렌더 ──
function renderMyeonDetail() {
  const users = getGroupUsers(filters.myscope || 'all', filters.myprogfilter || 'all');
  const period = filters.myperiod || 'week';
  const statsMap = {};
  users.forEach(u => { statsMap[u.uid] = calcStats(u.uid, period); });
  const items = [
    { key:'myeonAvg', label:'매십면 — 종합 달성률', highlight:true },
    { key:'myeon_am', label:'매십면 — 오전' },
    { key:'myeon_pm', label:'매십면 — 오후' },
    { key:'myeon_feedback', label:'매십면 — 동료 피드백' },
  ];
  let html = '';
  items.forEach(item => {
    const sorted = [...users].sort((a,b) => (statsMap[b.uid]?.[item.key]||0) - (statsMap[a.uid]?.[item.key]||0));
    html += buildRankCardHtml(sorted, statsMap, item, '%', currentContext, item.highlight?'style="border:1.5px solid var(--main-mid)"':'');
  });
  document.getElementById('myeon-content').innerHTML = html || '<div class="empty-state"><p>기록이 없어요</p></div>';
}

// ── 탭 전환 ──
window.switchTab = (id, btn) => {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
  currentTab = id;
  // 탭에 따라 주차 컨텍스트 설정
  if (id === 'gyeong') currentContext = 'gyeong';
  else if (id === 'myeon') currentContext = 'myeon';
  else currentContext = 'default';
  refresh();
};

// ── 필터 ──
const WEEK_PICKER_MAP = { period:'rank-week-picker', gyperiod:'gyeong-week-picker', myperiod:'myeon-week-picker', cperiod:'compare-week-picker', gperiod:'group-week-picker' };
const MONTH_PICKER_MAP = { period:'rank-month-picker', gyperiod:'gyeong-month-picker', myperiod:'myeon-month-picker', cperiod:'compare-month-picker', gperiod:'group-month-picker' };
const MONTH_INPUT_MAP = { period:'rank-month-input', gyperiod:'gyeong-month-input', myperiod:'myeon-month-input', cperiod:'compare-month-input', gperiod:'group-month-input' };
const TAB_KEY_MAP = { rank:'period', gyeong:'gyperiod', myeon:'myperiod', compare:'cperiod', group:'gperiod' };

window.setFilter = (key, val, btn) => {
  filters[key] = val;
  const row = btn.parentElement;
  row.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');

  // 주차/월 선택 피커 표시 처리
  const weekPickerId = WEEK_PICKER_MAP[key];
  const monthPickerId = MONTH_PICKER_MAP[key];
  if (weekPickerId) {
    const weekPicker = document.getElementById(weekPickerId);
    const monthPicker = monthPickerId ? document.getElementById(monthPickerId) : null;
    if (val === 'specific_week') {
      weekPicker.style.display = 'flex';
      if (monthPicker) monthPicker.style.display = 'none';
      populateWeekPicker(weekPicker.querySelector('select'));
    } else if (val === 'specific_month') {
      weekPicker.style.display = 'none';
      if (monthPicker) {
        monthPicker.style.display = 'flex';
        // 기본값: 이번 달
        const inputId = MONTH_INPUT_MAP[key];
        const inputEl = inputId ? document.getElementById(inputId) : null;
        if (inputEl && !inputEl.value) {
          const now = new Date();
          inputEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        }
        // 선택된 월로 바로 필터 적용
        if (inputEl) {
          filters.selectedMonth = inputEl.value;
        }
      }
    } else {
      weekPicker.style.display = 'none';
      if (monthPicker) monthPicker.style.display = 'none';
    }
  }

  refresh();
};

// 월 선택 변경 시 호출
window.setMonthFilter = (monthVal, tabKey) => {
  filters.selectedMonth = monthVal;
  refresh();
};

// 주차 드롭다운 채우기 — 내 기준 현재 주차부터 1주차까지
function populateWeekPicker(sel) {
  const myWeek = calcWeek(userProfile.startDate);
  sel.innerHTML = '<option value="">주차 선택...</option>';
  for (let w = myWeek; w >= 1; w--) {
    sel.innerHTML += `<option value="${w}">${w}주차</option>`;
  }
}

window.setWeekFilter = (weekVal, tabKey) => {
  filters.selectedWeek = weekVal;
  refresh();
};

// ── 랭킹 렌더 ──
function renderRank() {
  const users = getGroupUsers(filters.scope, filters.progfilter);
  const period = filters.period;

  const RANK_ITEMS = [
    { key:'gyeong', label:'매십경 달성률', unit:'%' },
    { key:'myeon',  label:'매십면 달성률', unit:'%' },
    { key:'dok',    label:'매십독 달성률', unit:'%' },
    { key:'un',     label:'매십운 달성률', unit:'%' },
    { key:'fa',     label:'FA5050/현장방문 달성률', unit:'%' },
    { key:'apps',   label:'총 지원 개수', unit:'개' },
    { key:'jasoseo',label:'자소서 시간 (일평균)', unit:'분' },
    { key:'lecture',label:'강의 시간 (일평균)', unit:'분' },
    { key:'pilgi',  label:'필기 시간 (일평균)', unit:'분' },
    { key:'interview',label:'면접 시간 (일평균)', unit:'분' },
  ];

  const statsMap = {};
  users.forEach(u => { statsMap[u.uid] = calcStats(u.uid, period); });

  let html = '';
  RANK_ITEMS.forEach(item => {
    const sorted = [...users].sort((a,b) => (statsMap[b.uid]?.[item.key]||0) - (statsMap[a.uid]?.[item.key]||0));
    html += buildRankCardHtml(sorted, statsMap, item, item.unit, currentContext, '');
  });

  document.getElementById('rank-content').innerHTML = html || '<div class="empty-state"><p>기록이 없어요</p></div>';
}

// ── 항목 비교 렌더 ──
function renderCompare() {
  const users = getGroupUsers(filters.cscope, filters.progfilter);
  const period = filters.cperiod;
  const statsMap = {};
  users.forEach(u => { statsMap[u.uid] = calcStats(u.uid, period); });

  // 전체 평균 계산
  const keys = ['gyeong','myeon','dok','un','fa','lecture','jasoseo','pilgi','interview','apps'];
  const avg = {};
  keys.forEach(k => {
    avg[k] = users.length ? Math.round(users.reduce((a,u)=>a+(statsMap[u.uid]?.[k]||0),0)/users.length) : 0;
  });

  // 각 항목 최대값
  const maxMap = {};
  keys.forEach(k => { maxMap[k] = Math.max(...users.map(u=>statsMap[u.uid]?.[k]||0)); });

  // 이전 시즌 기록 — 프로필 고정값(기간 무관). 미입력(null)은 '-'로 표시, 평균은 입력한 사람만.
  const PREV_KEYS = ['prevInterviewCount','prevInterviewMin','prevPilgiMin','prevApplications'];
  const prevAvg = {};
  PREV_KEYS.forEach(k => {
    const vals = users.map(u => u[k]).filter(v => v != null && v !== '');
    prevAvg[k] = vals.length ? Math.round(vals.reduce((a,v)=>a+Number(v),0)/vals.length) : null;
  });
  const prevCells = (data, isAvg) => {
    const g = k => isAvg ? (prevAvg[k] == null ? '-' : prevAvg[k])
                         : (data[k] == null || data[k] === '' ? '-' : data[k]);
    return `<td class="prev-col prev-first">${g('prevInterviewCount')}</td>`
         + `<td class="prev-col">${g('prevInterviewMin')}</td>`
         + `<td class="prev-col">${g('prevPilgiMin')}</td>`
         + `<td class="prev-col">${g('prevApplications')}</td>`;
  };

  const row = (data, isAvg, isMe) => {
    const cls = isAvg ? 'avg-row' : isMe ? 'me-row' : '';
    const name = isAvg ? '전체 평균' : (data.nickname + (isMe ? ' 나' : ''));
    const wk = isAvg ? '—' : calcWeek(data.startDate)+'주';
    const s = isAvg ? avg : statsMap[data.uid];
    return `<tr class="${cls}">
      <td class="name-col" title="${name}">${name}</td><td>${wk}</td>
      <td class="${!isAvg&&s.gyeong===maxMap.gyeong?'hi':''}">${s.gyeong}%</td>
      <td class="${!isAvg&&s.myeon===maxMap.myeon?'hi':''}">${s.myeon}%</td>
      <td class="${!isAvg&&s.dok===maxMap.dok?'hi':''}">${s.dok}%</td>
      <td class="${!isAvg&&s.un===maxMap.un?'hi':''}">${s.un}%</td>
      <td class="${!isAvg&&s.fa===maxMap.fa?'hi':''}">${s.fa}%</td>
      <td class="${!isAvg&&s.lecture===maxMap.lecture?'hi':''}">${s.lecture}</td>
      <td class="${!isAvg&&s.jasoseo===maxMap.jasoseo?'hi':''}">${s.jasoseo}</td>
      <td class="${!isAvg&&s.pilgi===maxMap.pilgi?'hi':''}">${s.pilgi}</td>
      <td class="${!isAvg&&s.interview===maxMap.interview?'hi':''}">${s.interview}</td>
      <td class="${!isAvg&&s.apps===maxMap.apps?'hi':''}">${s.apps}</td>
      ${prevCells(data, isAvg)}
    </tr>`;
  };

  let html = row(null, true, false);
  // 나를 제외한 나머지를 매십경 기준 내림차순 정렬
  const others = users.filter(u => u.uid !== user.uid)
    .sort((a,b) => (statsMap[b.uid]?.gyeong||0) - (statsMap[a.uid]?.gyeong||0));
  const me = users.find(u => u.uid === user.uid);
  // 전체 평균 바로 아래에 내 행을 고정, 그 다음 나머지
  if (me) html += row(me, false, true);
  others.forEach(u => { html += row(u, false, false); });
  document.getElementById('cmp-body').innerHTML = html;

  // 엑셀 다운로드용 데이터 저장 (전체 평균 바로 아래 내 행 고정 순서 유지)
  window._compareData = { users: me ? [me, ...others] : others, statsMap, avg, prevAvg };
}

// ── 엑셀 다운로드 ──
window.downloadExcel = () => {
  if (!window._compareData) { alert('먼저 항목 비교 탭을 열어주세요'); return; }
  const { users, statsMap, avg, prevAvg } = window._compareData;
  const PREV_KEYS = ['prevInterviewCount','prevInterviewMin','prevPilgiMin','prevApplications'];
  const pv = v => (v == null || v === '' ? '-' : v);
  const headers = ['닉네임','주차','매십경','매십면','매십독','매십운','FA','강의','자소서','필기','면접','지원수',
    '이전_면접경험(회)','이전_면접준비(분)','이전_필기준비(분)','이전_지원수(개)'];
  const rows = [
    ['전체 평균','—',...['gyeong','myeon','dok','un','fa','lecture','jasoseo','pilgi','interview','apps'].map(k=>avg[k]),
      ...PREV_KEYS.map(k => pv(prevAvg?.[k]))],
    ...users.map(u => {
      const s = statsMap[u.uid];
      return [u.nickname, calcWeek(u.startDate)+'주', s.gyeong+'%', s.myeon+'%', s.dok+'%', s.un+'%', s.fa+'%', s.lecture, s.jasoseo, s.pilgi, s.interview, s.apps,
        ...PREV_KEYS.map(k => pv(u[k]))];
    })
  ];
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `생존일지_항목비교_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};

// ── 그룹 현황 렌더 ──
function renderGroups() {
  const period = filters.gperiod;
  if (!allGroups.length) {
    document.getElementById('group-grid-wrap').innerHTML = '<div class="empty-state"><p>등록된 그룹이 없어요</p></div>';
    return;
  }

  // 그룹별 통계
  const groupStats = allGroups.map(g => {
    const members = allUsers.filter(u => u.groupId === g.id);
    const statsArr = members.map(u => calcStats(u.uid, period));
    const n = statsArr.length || 1;
    const avgStat = k => Math.round(statsArr.reduce((a,s)=>a+(s[k]||0),0)/n);
    return {
      ...g, memberCount: members.length,
      routineAvg: avgStat('gyeong'),
      lectureAvg: avgStat('lecture'),
      totalApps: statsArr.reduce((a,s)=>a+(s.apps||0),0),
      members,
    };
  }).sort((a,b) => b.routineAvg - a.routineAvg);

  const topGroup = groupStats[0]?.id;
  let html = '<div class="group-grid">';
  groupStats.forEach(g => {
    const isMe = g.id === userProfile.groupId;
    const isTop = g.id === topGroup;
    html += `<div class="group-card ${isMe?'mine':''}" onclick="showGroupDetail('${g.id}')">
      <div class="group-name">${g.name}
        ${isMe ? '<span class="group-badge badge-mine">내 그룹</span>' : ''}
        ${isTop && !isMe ? '<span class="group-badge badge-rank1">1위</span>' : ''}
      </div>
      <div class="group-count">${g.memberCount}명 · 클릭해서 조원 보기</div>
      <div class="group-stat-row"><span class="group-stat-label">루틴 달성</span><span class="group-stat-val">${g.routineAvg}%</span></div>
      <div class="group-stat-row"><span class="group-stat-label">강의 평균</span><span class="group-stat-val">${g.lectureAvg}분</span></div>
      <div class="group-stat-row"><span class="group-stat-label">총 지원수</span><span class="group-stat-val">${g.totalApps}개</span></div>
      <div class="group-prog-track"><div class="group-prog-fill" style="width:${g.routineAvg}%"></div></div>
    </div>`;
  });
  html += '</div>';
  document.getElementById('group-grid-wrap').innerHTML = html;
  window._groupStats = groupStats;
}

window.showGroupDetail = (groupId) => {
  const g = window._groupStats?.find(x=>x.id===groupId);
  if (!g) return;
  document.getElementById('group-overview').style.display = 'none';
  document.getElementById('group-detail').style.display = 'block';
  document.getElementById('detail-title').textContent = `${g.name} 조원 현황`;
  document.getElementById('detail-sub').textContent = `${g.memberCount}명 · 루틴 달성 평균 ${g.routineAvg}%`;

  const period = filters.gperiod;
  const members = [...g.members].sort((a,b) => {
    const sa = calcStats(a.uid, period), sb = calcStats(b.uid, period);
    return sb.gyeong - sa.gyeong;
  });

  let html = '';
  members.forEach((m, i) => {
    const s = calcStats(m.uid, period);
    const wk = calcWeek(m.startDate);
    const isMe = m.uid === user.uid;
    html += `<div class="member-row ${isMe?'me':''}">
      <div class="member-rank ${i<3?'top':''}">${i+1}</div>
      <div class="member-av">${m.nickname[0]}</div>
      <div class="member-name">${m.nickname}${isMe?' <span style="font-size:10px;color:var(--main);font-weight:600">나</span>':''}<br>
        <span style="font-size:10px;color:#aaa">${wk}</span>
      </div>
      <div class="member-bars">
        <div class="mini-bar-row"><span class="mini-bar-label">경</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${s.gyeong}%"></div></div><span class="mini-bar-pct">${s.gyeong}%</span></div>
        <div class="mini-bar-row"><span class="mini-bar-label">면</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${s.myeon}%;opacity:.8"></div></div><span class="mini-bar-pct">${s.myeon}%</span></div>
        <div class="mini-bar-row"><span class="mini-bar-label">독</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${s.dok}%;opacity:.6"></div></div><span class="mini-bar-pct">${s.dok}%</span></div>
        <div class="mini-bar-row"><span class="mini-bar-label">운</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${s.un}%;opacity:.4"></div></div><span class="mini-bar-pct">${s.un}%</span></div>
      </div>
    </div>`;
  });
  document.getElementById('member-list').innerHTML = html || '<div class="empty-state"><p>조원 기록이 없어요</p></div>';
};

window.showGroupOverview = () => {
  document.getElementById('group-overview').style.display = 'block';
  document.getElementById('group-detail').style.display = 'none';
};
