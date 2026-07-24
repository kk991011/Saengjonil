
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, deleteDoc,
  updateDoc, collection, getDocs, query, orderBy, where }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Firebase 설정은 환경(운영/dev)에 따라 firebase-config.js에서 자동 선택됩니다.
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ★ 관리자 UID 목록 — Firebase 콘솔에서 본인 UID 확인 후 추가
// Authentication → 사용자 탭에서 UID 확인 가능
// 관리자 판정은 users 문서의 isAdmin === true (아래 onAuthStateChanged 참고)
let allUsers = [], allGroups = [], allRecords = [];

// ── 인증 ──
onAuthStateChanged(auth, async u => {
  if (!u) { window.location.href = 'index.html'; return; }

  // 관리자 여부: 본인 users 문서의 isAdmin === true (필드 없으면 비관리자)
  const meSnap = await getDoc(doc(db, 'users', u.uid));
  if (!meSnap.exists() || meSnap.data().isAdmin !== true) {
    document.getElementById('access-denied').style.display = 'block';
    return;
  }

  document.getElementById('admin-content').style.display = 'block';
  document.getElementById('admin-email').textContent = `로그인: ${u.email}`;
  await loadData();
  renderStats();
  renderTodayStatus();
  renderGroups();
  renderUsers();
  renderDashboard();
});

// ── 전체 데이터 로드 ──
async function loadData() {
  const [uSnap, gSnap, rSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'groups')),
    getDocs(collection(db, 'records')),
  ]);
  allUsers = uSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  allGroups = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allGroups.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  allRecords = rSnap.docs.map(d => d.data());
}

// ── 통계 ──
function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('st-users').textContent = allUsers.length;
  document.getElementById('st-groups').textContent = allGroups.length;
  document.getElementById('st-records').textContent = allRecords.length;
  document.getElementById('st-today').textContent = allRecords.filter(r=>r.date===today).length;
}

// ── 오늘 기록 현황 ──
function renderTodayStatus() {
  const el = document.getElementById('today-missing-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const todaySet = new Set(allRecords.filter(r => r.date === today).map(r => r.uid));
  const missing = allUsers.filter(u => !todaySet.has(u.uid));
  document.getElementById('today-done-count').textContent = allUsers.length - missing.length;
  document.getElementById('today-missing-count').textContent = missing.length;
  el.innerHTML = missing.length
    ? missing.map(u => `<span class="member-chip">${u.nickname || u.email || '-'}</span>`).join('')
    : '<span style="font-size:12px;color:#ccc">전원 기록 완료했어요 🎉</span>';
}

// 유저의 소속 조 목록 (groupIds 배열 / 구 단일 groupId 호환)
const groupIdsOf = (u) => Array.isArray(u.groupIds) ? u.groupIds : (u.groupId ? [u.groupId] : []);

// 조의 매십경/매십면 조장 uid 목록. leaderUidsGyeong/leaderUidsMyeon 필드가 없는(구버전) 그룹은
// 구 leaderUids를 경/면 양쪽에 임시 배정 — 관리자가 재지정할 때까지 기존 조장을 잃지 않도록.
function leaderUidsOf(g, type) {
  const specific = type === 'gyeong' ? g.leaderUidsGyeong : g.leaderUidsMyeon;
  if (Array.isArray(specific)) return specific;
  return Array.isArray(g.leaderUids) ? g.leaderUids : [];
}

// ── 함께 생존 대시보드 ──
let dashPeriod = 'week';       // week | month | specific_week | specific_month
let dashSelectedWeek = null;   // 선택 주(월요일, YYYY-MM-DD)
let dashSelectedMonth = null;  // 선택 월(YYYY-MM)
let dashScope = 'all';         // 'all' 또는 groupId

function mondayOf(d) {
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);
  return mon;
}

function getCalendarWeekRange(mondayStr) {
  const to = new Date(mondayStr);
  to.setDate(to.getDate() + 6);
  return { from: mondayStr, to: localDateStr(to) };
}

function getDashPeriodRecords() {
  if (dashPeriod === 'specific_week') {
    if (!dashSelectedWeek) return [];
    const { from, to } = getCalendarWeekRange(dashSelectedWeek);
    return allRecords.filter(r => r.date >= from && r.date <= to);
  }
  if (dashPeriod === 'specific_month') {
    if (!dashSelectedMonth) return [];
    return allRecords.filter(r => r.date.startsWith(dashSelectedMonth));
  }
  const now = new Date();
  const from = dashPeriod === 'month'
    ? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    : localDateStr(mondayOf(now));
  return allRecords.filter(r => r.date >= from);
}

// 현재 선택된 기간 바로 이전 기간(전주/전월)의 records — 막대그래프 비교용
function getPrevDashPeriodRecords() {
  if (dashPeriod === 'week' || dashPeriod === 'specific_week') {
    const baseMonday = dashPeriod === 'specific_week' ? dashSelectedWeek : localDateStr(mondayOf(new Date()));
    if (!baseMonday) return null;
    const prevMonday = new Date(baseMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const { from, to } = getCalendarWeekRange(localDateStr(prevMonday));
    return allRecords.filter(r => r.date >= from && r.date <= to);
  }
  if (dashPeriod === 'month' || dashPeriod === 'specific_month') {
    const baseMonth = dashPeriod === 'specific_month' ? dashSelectedMonth
      : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    if (!baseMonth) return null;
    const [y, m] = baseMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const ym = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    return allRecords.filter(r => r.date.startsWith(ym));
  }
  return null;
}

function prevPeriodLabel() {
  return (dashPeriod === 'week' || dashPeriod === 'specific_week') ? '전주 대비' : '전월 대비';
}

function dashPeriodLabel() {
  if (dashPeriod === 'week') return '이번 주';
  if (dashPeriod === 'month') return '이번 달';
  if (dashPeriod === 'specific_week') return '선택한 주';
  if (dashPeriod === 'specific_month') return '선택한 달';
  return '이 기간';
}

function dashUserStats(uid, periodRecs) {
  const recs = periodRecs.filter(r => r.uid === uid);
  const n = recs.length || 1;
  const pct = k => recs.length ? Math.round(recs.filter(r=>r[k]).length/recs.length*100) : 0;
  const avg = k => Math.round(recs.reduce((a,r)=>a+(r[k]||0),0)/n);
  const gyeongAvg = Math.round((pct('gyeong_article')+pct('gyeong_opinion')+pct('gyeong_comment'))/3);
  const myeonAvg = Math.round((pct('myeon_am')+pct('myeon_pm')+pct('myeon_feedback'))/3);
  const dokAvg = Math.round((pct('routineDok')+pct('routinePilsa'))/2);
  const un = pct('routineUn');
  const fa = pct('fa5050');
  const type = allUsers.find(u=>u.uid===uid)?.programType || 'careerpt';
  const comps = type==='maesipgyeong' ? [gyeongAvg]
    : type==='maesipmyeon' ? [myeonAvg]
    : type==='maesipboth' ? [gyeongAvg, myeonAvg]
    : [gyeongAvg, myeonAvg, dokAvg, un];
  const routineTotal = Math.round(comps.reduce((a,b)=>a+b,0)/comps.length);
  return {
    routineTotal, gyeongAvg, myeonAvg, dokAvg, un, fa,
    lecture: avg('lecture'), jasoseo: avg('jasoseo'), pilgi: avg('pilgi'), interview: avg('interview'), cert: avg('cert'),
    apps: recs.reduce((a,r)=>a+(r.applications||0),0),
    active: recs.length > 0,
  };
}

function getDashUsers() {
  return dashScope === 'all' ? allUsers : allUsers.filter(u => groupIdsOf(u).includes(dashScope));
}

function renderDashScopeButtons() {
  const el = document.getElementById('dash-scope-row');
  if (!el) return;
  if (dashScope !== 'all' && !allGroups.some(g => g.id === dashScope)) dashScope = 'all';
  el.innerHTML = [{ id:'all', name:'전체' }, ...allGroups].map(g => `
    <button class="btn-sm detail-filter-btn dash-scope-btn ${g.id===dashScope?'on':''}" data-id="${g.id}" onclick="setDashScope('${g.id}',this)">${g.name}</button>
  `).join('');
}

window.setDashScope = (id, btn) => {
  dashScope = id;
  document.querySelectorAll('.dash-scope-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderDashboard();
};

window.setDashPeriod = (val, btn) => {
  dashPeriod = val;
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');

  const weekPicker = document.getElementById('dash-week-picker');
  const monthPicker = document.getElementById('dash-month-picker');
  weekPicker.style.display = 'none';
  monthPicker.style.display = 'none';

  if (val === 'specific_week') {
    weekPicker.style.display = 'block';
    populateDashWeekPicker();
  } else if (val === 'specific_month') {
    monthPicker.style.display = 'block';
    const inputEl = document.getElementById('dash-month-select');
    if (!inputEl.value) {
      const now = new Date();
      inputEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    dashSelectedMonth = inputEl.value;
  }
  renderDashboard();
};

function populateDashWeekPicker() {
  const sel = document.getElementById('dash-week-select');
  const thisMonday = mondayOf(new Date());
  const earliestStart = allUsers.reduce((min, u) => (u.startDate && (!min || u.startDate < min)) ? u.startDate : min, null);
  const earliestMonday = earliestStart ? mondayOf(new Date(earliestStart)) : thisMonday;
  const prevVal = sel.value;
  sel.innerHTML = '<option value="">주차 선택...</option>';
  const cur = new Date(thisMonday);
  while (cur >= earliestMonday) {
    const from = localDateStr(cur);
    const to = new Date(cur); to.setDate(cur.getDate() + 6);
    sel.innerHTML += `<option value="${from}">${cur.getMonth()+1}/${cur.getDate()} ~ ${to.getMonth()+1}/${to.getDate()}</option>`;
    cur.setDate(cur.getDate() - 7);
  }
  if (prevVal) sel.value = prevVal;
}

window.onDashWeekChange = () => {
  dashSelectedWeek = document.getElementById('dash-week-select').value;
  renderDashboard();
};
window.onDashMonthChange = () => {
  dashSelectedMonth = document.getElementById('dash-month-select').value;
  renderDashboard();
};

function renderDashboard() {
  renderDashScopeButtons();
  const el = document.getElementById('dash-content');
  const users = getDashUsers();
  if (!users.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:14px">인원이 없어요</div>';
    renderDashTrend();
    return;
  }

  const periodRecs = getDashPeriodRecords();
  const statsMap = {};
  users.forEach(u => { statsMap[u.uid] = dashUserStats(u.uid, periodRecs); });

  const activeCount = users.filter(u => statsMap[u.uid].active).length;
  const participRate = Math.round(activeCount/users.length*100);
  const avgOf = k => Math.round(users.reduce((a,u)=>a+(statsMap[u.uid][k]||0),0)/users.length);
  const totalApps = users.reduce((a,u)=>a+(statsMap[u.uid].apps||0),0);

  // MVP — 이 기간에 실제 기록을 남긴 사람 중 루틴 종합 달성률이 가장 높은 사람(동률이면 모두 표시)
  const mvpCandidates = users.filter(u => statsMap[u.uid].active);
  const mvpHtml = (() => {
    if (!mvpCandidates.length) {
      return `<div style="background:#f8f8ff;border-radius:12px;padding:14px 16px;margin-bottom:16px;text-align:center;color:#ccc;font-size:13px">${dashPeriodLabel()} 기록이 있는 사람이 없어요</div>`;
    }
    const maxVal = Math.max(...mvpCandidates.map(u => statsMap[u.uid].routineTotal));
    const top = mvpCandidates.filter(u => statsMap[u.uid].routineTotal === maxVal);
    const names = top.map(u => u.nickname).join(', ');
    return `<div style="background:linear-gradient(135deg,var(--main),var(--main-dark));border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;color:white">
      <div style="font-size:28px;line-height:1">🏆</div>
      <div>
        <div style="font-size:11px;opacity:.85;letter-spacing:.03em">${dashPeriodLabel()} MVP</div>
        <div style="font-size:16px;font-weight:700">${names} <span style="font-weight:500;opacity:.9">· 루틴 종합 달성률 ${maxVal}%</span></div>
      </div>
    </div>`;
  })();

  // 이전 기간(전주/전월) 비교 — specific_week/specific_month에서 미선택이면 null
  const prevRecs = getPrevDashPeriodRecords();
  let prevAvgOf = () => null;
  let prevActiveCount = null, prevTotalApps = null;
  if (prevRecs !== null) {
    const prevStatsMap = {};
    users.forEach(u => { prevStatsMap[u.uid] = dashUserStats(u.uid, prevRecs); });
    prevAvgOf = k => Math.round(users.reduce((a,u)=>a+(prevStatsMap[u.uid][k]||0),0)/users.length);
    prevActiveCount = users.filter(u => prevStatsMap[u.uid].active).length;
    prevTotalApps = users.reduce((a,u)=>a+(prevStatsMap[u.uid].apps||0),0);
  }
  const pLabel = prevPeriodLabel();

  const deltaBadge = (val, prevVal, unit) => {
    if (prevVal == null) return '';
    const d = val - prevVal;
    const color = d > 0 ? '#16a34a' : d < 0 ? '#dc2626' : '#999';
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '·';
    return `<span style="font-size:11px;font-weight:600;color:${color};margin-left:6px">${arrow} ${Math.abs(d)}${unit}</span>`;
  };

  const barRow = (label, val, unit, cap, prevVal) => {
    const width = cap ? Math.min(100, Math.round(val/cap*100)) : val;
    const prevWidth = prevVal == null ? null : (cap ? Math.min(100, Math.round(prevVal/cap*100)) : prevVal);
    const markerHtml = prevWidth == null ? '' : `<div title="${pLabel} ${prevVal}${unit}" style="position:absolute;left:${prevWidth}%;top:-2px;bottom:-2px;width:2px;background:#999"></div>`;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:120px;font-size:12px;color:#666;flex-shrink:0">${label}</div>
      <div style="position:relative;flex:1;height:8px;background:#eee;border-radius:4px">
        <div style="height:100%;background:var(--main);width:${width}%;border-radius:4px"></div>
        ${markerHtml}
      </div>
      <div style="width:auto;min-width:56px;text-align:right;font-size:12px;font-weight:600;color:var(--main);white-space:nowrap">${val}${unit}${deltaBadge(val, prevVal, unit)}</div>
    </div>`;
  };

  el.innerHTML = `
    ${mvpHtml}
    <div class="stat-row">
      <div class="stat-box"><div class="num">${activeCount}/${users.length}</div><div class="lbl">기록 참여율 (${participRate}%)${deltaBadge(activeCount, prevActiveCount, '명')}</div></div>
      <div class="stat-box"><div class="num">${avgOf('routineTotal')}%</div><div class="lbl">루틴 종합 달성률${deltaBadge(avgOf('routineTotal'), prevAvgOf('routineTotal'), '%p')}</div></div>
      <div class="stat-box"><div class="num">${totalApps}</div><div class="lbl">총 지원수${deltaBadge(totalApps, prevTotalApps, '개')}</div></div>
      <div class="stat-box"><div class="num">${avgOf('lecture')}분</div><div class="lbl">강의(일평균)${deltaBadge(avgOf('lecture'), prevAvgOf('lecture'), '분')}</div></div>
    </div>
    <div class="sec-label">루틴 항목별 평균 달성률 ${prevRecs !== null ? `<span style="text-transform:none;font-weight:400;color:#ccc">— 회색 선 = ${pLabel}</span>` : ''}</div>
    ${barRow('매십경', avgOf('gyeongAvg'), '%', null, prevAvgOf('gyeongAvg'))}
    ${barRow('매십면', avgOf('myeonAvg'), '%', null, prevAvgOf('myeonAvg'))}
    ${barRow('매십독', avgOf('dokAvg'), '%', null, prevAvgOf('dokAvg'))}
    ${barRow('매십운', avgOf('un'), '%', null, prevAvgOf('un'))}
    ${barRow('FA5050/현장방문', avgOf('fa'), '%', null, prevAvgOf('fa'))}
    <div class="sec-label">취준 활동 일평균 (분)</div>
    ${barRow('자소서', avgOf('jasoseo'), '분', 120, prevAvgOf('jasoseo'))}
    ${barRow('필기', avgOf('pilgi'), '분', 120, prevAvgOf('pilgi'))}
    ${barRow('면접', avgOf('interview'), '분', 120, prevAvgOf('interview'))}
    ${barRow('자격증', avgOf('cert'), '분', 120, prevAvgOf('cert'))}
  `;

  renderDashTrend();
}

// ── 주간 추이(선 그래프) ──
function getWeeklyTrendData(weeksBack) {
  const users = getDashUsers();
  const thisMonday = mondayOf(new Date());
  const weeks = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const mon = new Date(thisMonday);
    mon.setDate(thisMonday.getDate() - i * 7);
    weeks.push(localDateStr(mon));
  }
  return weeks.map(monStr => {
    const { from, to } = getCalendarWeekRange(monStr);
    const recs = allRecords.filter(r => r.date >= from && r.date <= to);
    const statsMap = {};
    users.forEach(u => { statsMap[u.uid] = dashUserStats(u.uid, recs); });
    const activeCount = users.filter(u => statsMap[u.uid].active).length;
    const avgOf = k => users.length ? Math.round(users.reduce((a,u)=>a+(statsMap[u.uid][k]||0),0)/users.length) : 0;
    const d = new Date(monStr);
    return {
      label: `${d.getMonth()+1}/${d.getDate()}`,
      routineTotal: avgOf('routineTotal'), gyeongAvg: avgOf('gyeongAvg'), myeonAvg: avgOf('myeonAvg'),
      dokAvg: avgOf('dokAvg'), un: avgOf('un'), fa: avgOf('fa'),
      jasoseo: avgOf('jasoseo'), pilgi: avgOf('pilgi'), interview: avgOf('interview'), cert: avgOf('cert'),
      apps: users.reduce((a,u)=>a+(statsMap[u.uid].apps||0),0),
      participRate: users.length ? Math.round(activeCount/users.length*100) : 0,
    };
  });
}

window.renderDashTrend = () => {
  const canvas = document.getElementById('dash-trend-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const metricSel = document.getElementById('dash-trend-metric');
  const metric = metricSel ? metricSel.value : 'routineTotal';
  const unit = ['jasoseo','pilgi','interview','cert'].includes(metric) ? '분' : metric === 'apps' ? '개' : '%';
  const weeks = getWeeklyTrendData(8);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--main').trim() || '#534AB7';

  const ex = Chart.getChart(canvas);
  if (ex) ex.destroy();
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        data: weeks.map(w => w[metric]),
        borderColor: color, backgroundColor: color + '20',
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: color,
        tension: .3, fill: true, spanGaps: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}${unit}` } },
      },
      scales: {
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: v => v + unit }, grid: { color: 'rgba(0,0,0,.04)' } },
      },
    },
  });
};

// 조 g에서 uid가 맡은 조장 태그 HTML (경/면 각각 있으면 둘 다 표시)
function leaderTagsHtml(g, uid) {
  let html = '';
  if (leaderUidsOf(g, 'gyeong').includes(uid)) html += '<span style="font-size:9px;font-weight:700;color:#fff;background:var(--main);padding:1px 5px;border-radius:5px;margin-right:4px;white-space:nowrap">매십경 조장</span>';
  if (leaderUidsOf(g, 'myeon').includes(uid)) html += '<span style="font-size:9px;font-weight:700;color:#fff;background:var(--main-dark);padding:1px 5px;border-radius:5px;margin-right:4px;white-space:nowrap">매십면 조장</span>';
  return html;
}

// ── 그룹 렌더 ──
function renderGroups() {
  const el = document.getElementById('group-list');
  if (!allGroups.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:14px">그룹이 없어요. 위 버튼으로 추가해주세요.</div>';
    renderLeaderOverview();
    return;
  }
  el.innerHTML = allGroups.map(g => {
    const members = allUsers.filter(u => groupIdsOf(u).includes(g.id));
    return `<div class="group-card">
      <div class="group-card-header">
        <div>
          <div class="group-card-name">${g.name}</div>
          <div class="group-card-count">${members.length}명</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm btn-sm-primary" onclick="openEditGroup('${g.id}','${g.name}')">수정</button>
        </div>
      </div>
      <div class="group-members">
        ${members.length ? members.map(m =>
          `<div class="member-chip">${leaderTagsHtml(g, m.uid)}${m.nickname}
            <button class="remove-btn" onclick="removeMemberFromGroup('${m.uid}','${g.id}')" title="그룹에서 제거">×</button>
          </div>`).join('') : '<span style="font-size:12px;color:#ccc">멤버 없음</span>'}
      </div>
    </div>`;
  }).join('');
  renderLeaderOverview();
}

// ── 조장 관리(현황) ──
function renderLeaderOverview() {
  const el = document.getElementById('leader-overview');
  if (!el) return;
  if (!allGroups.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:14px">그룹이 없어요</div>';
    return;
  }
  const chip = (u) => `<span class="member-chip">${u.nickname}</span>`;
  el.innerHTML = allGroups.map(g => {
    const members = allUsers.filter(u => groupIdsOf(u).includes(g.id));
    const gyeongLeaders = members.filter(u => leaderUidsOf(g, 'gyeong').includes(u.uid));
    const myeonLeaders = members.filter(u => leaderUidsOf(g, 'myeon').includes(u.uid));
    return `<div class="group-card">
      <div class="group-card-header">
        <div class="group-card-name">${g.name}</div>
        <button class="btn-sm btn-sm-primary" onclick="openEditGroup('${g.id}','${g.name}')">조장 수정</button>
      </div>
      <div style="margin-top:8px">
        <div style="font-size:11px;font-weight:600;color:var(--main);margin-bottom:4px">매십경 조장</div>
        <div class="group-members">${gyeongLeaders.length ? gyeongLeaders.map(chip).join('') : '<span style="font-size:12px;color:#ccc">지정 안 됨</span>'}</div>
      </div>
      <div style="margin-top:8px">
        <div style="font-size:11px;font-weight:600;color:var(--main);margin-bottom:4px">매십면 조장</div>
        <div class="group-members">${myeonLeaders.length ? myeonLeaders.map(chip).join('') : '<span style="font-size:12px;color:#ccc">지정 안 됨</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

// ── 유저 테이블 렌더 ──
function calcWeek(sd) {
  if (!sd) return '-';
  const diff = Math.floor((new Date() - new Date(sd)) / 86400000);
  return Math.max(1, Math.floor(diff/7)+1);
}

// 소속된 조 중 하나에서라도 경/면 조장이면 각각 태그 표시
function userLeaderTagsHtml(u) {
  const myGroups = allGroups.filter(g => groupIdsOf(u).includes(g.id));
  const isGyeongLeader = myGroups.some(g => leaderUidsOf(g, 'gyeong').includes(u.uid));
  const isMyeonLeader = myGroups.some(g => leaderUidsOf(g, 'myeon').includes(u.uid));
  let html = '';
  if (isGyeongLeader) html += ' <span style="font-size:10px;font-weight:700;color:#fff;background:var(--main);padding:1px 6px;border-radius:6px;white-space:nowrap">매십경 조장</span>';
  if (isMyeonLeader) html += ' <span style="font-size:10px;font-weight:700;color:#fff;background:var(--main-dark);padding:1px 6px;border-radius:6px;white-space:nowrap">매십면 조장</span>';
  return html;
}

function renderUsers(search='') {
  const groupMap = {};
  allGroups.forEach(g => { groupMap[g.id] = g.name; });
  const filtered = search ? allUsers.filter(u =>
    u.nickname?.includes(search) || u.email?.includes(search)) : allUsers;
  const today = new Date().toISOString().split('T')[0];
  const lastRecMap = {};
  allRecords.forEach(r => {
    if (!lastRecMap[r.uid] || r.date > lastRecMap[r.uid]) lastRecMap[r.uid] = r.date;
  });
  const lastRecCell = (u) => {
    const d = lastRecMap[u.uid];
    if (!d) return '없음';
    return d === today ? '<span style="color:#16a34a;font-weight:600">오늘 ✓</span>' : d;
  };
  const groupChips = (u) => {
    const names = groupIdsOf(u).map(id => groupMap[id]).filter(Boolean);
    if (!names.length) return '<span style="background:#f0f0f0;color:#aaa;padding:2px 8px;border-radius:6px;font-size:11px">미배정</span>';
    return names.map(n => `<span style="background:var(--main-light);color:var(--main-dark);padding:2px 8px;border-radius:6px;font-size:11px;margin-right:3px">${n}</span>`).join('');
  };
  document.getElementById('user-table-body').innerHTML = filtered.map(u => `
    <tr>
      <td><div class="user-avatar">${u.photoURL ? `<img src="${u.photoURL}">` : (u.nickname?.[0]||'?')}</div></td>
      <td style="font-weight:500;white-space:nowrap">${u.nickname||'-'}${userLeaderTagsHtml(u)}</td>
      <td style="font-size:12px;color:#aaa">${u.email||'-'}</td>
      <td>${groupChips(u)}</td>
      <td style="font-size:12px;color:#aaa">${u.startDate ? calcWeek(u.startDate)+'주차' : '-'}</td>
      <td style="font-size:12px;color:#aaa">${lastRecCell(u)}</td>
      <td><button class="btn-sm btn-sm-primary" onclick="openUserDetail('${u.uid}')">상세보기</button></td>
      <td><button class="btn-sm btn-sm-primary" onclick="openUserManage('${u.uid}')">관리</button></td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#ccc">검색 결과 없음</td></tr>';
}

window.filterUsers = () => renderUsers(document.getElementById('user-search').value.trim());

// ── 그룹 생성 ──
window.openCreateGroup = () => {
  document.getElementById('new-group-name').value = '';
  openModal('create-group-modal');
};

window.createGroup = async () => {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) { showToast('그룹 이름을 입력해주세요'); return; }
  try {
    const ref = await addDoc(collection(db, 'groups'), { name, members: [], createdAt: new Date().toISOString() });
    allGroups.push({ id: ref.id, name, members: [] });
    allGroups.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
    closeModal('create-group-modal');
    renderStats();
    renderTodayStatus();
    renderGroups();
    renderDashboard();
    showToast(`"${name}" 그룹이 만들어졌어요!`);
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

// ── 그룹 수정 ──
window.openEditGroup = (id, name) => {
  document.getElementById('edit-group-id').value = id;
  document.getElementById('edit-group-name').value = name;
  document.getElementById('edit-group-title').textContent = `"${name}" 수정`;
  // 조장 지정 — 이 조의 조원 체크리스트 (경/면 각각. leaderUidsOf가 구버전 leaderUids도 호환 처리)
  const g = allGroups.find(x => x.id === id);
  const gyeongLeaders = new Set(leaderUidsOf(g || {}, 'gyeong'));
  const myeonLeaders = new Set(leaderUidsOf(g || {}, 'myeon'));
  const members = allUsers.filter(u => groupIdsOf(u).includes(id));
  const checklist = (leaders) => members.length
    ? members.map(m => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" class="leader-check" data-uid="${m.uid}" ${leaders.has(m.uid) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
        <span>${m.nickname || '-'}</span>
      </label>`).join('')
    : '<div style="font-size:12px;color:#ccc">조원이 없어요</div>';
  document.getElementById('edit-group-leaders-gyeong').innerHTML = checklist(gyeongLeaders);
  document.getElementById('edit-group-leaders-myeon').innerHTML = checklist(myeonLeaders);
  openModal('edit-group-modal');
};

window.saveGroupEdit = async () => {
  const id = document.getElementById('edit-group-id').value;
  const name = document.getElementById('edit-group-name').value.trim();
  if (!name) { showToast('그룹 이름을 입력해주세요'); return; }
  // 조장 = 체크된 조원 uid 목록을 경/면 각각 그 조 문서(groups.leaderUidsGyeong/leaderUidsMyeon)에 저장
  const leaderUidsGyeong = [...document.querySelectorAll('#edit-group-leaders-gyeong .leader-check:checked')].map(c => c.dataset.uid);
  const leaderUidsMyeon = [...document.querySelectorAll('#edit-group-leaders-myeon .leader-check:checked')].map(c => c.dataset.uid);
  try {
    await updateDoc(doc(db, 'groups', id), { name, leaderUidsGyeong, leaderUidsMyeon });
    const g = allGroups.find(x=>x.id===id);
    if (g) { g.name = name; g.leaderUidsGyeong = leaderUidsGyeong; g.leaderUidsMyeon = leaderUidsMyeon; }
    closeModal('edit-group-modal');
    renderGroups();
    renderUsers();
    renderDashboard();
    showToast('저장됐어요');
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

window.deleteGroup = async () => {
  const id = document.getElementById('edit-group-id').value;
  const g = allGroups.find(x=>x.id===id);
  if (!confirm(`"${g?.name}" 그룹을 삭제할까요?\n이 그룹의 멤버들은 미배정 상태가 됩니다.`)) return;
  try {
    await deleteDoc(doc(db, 'groups', id));
    allGroups = allGroups.filter(x=>x.id!==id);
    closeModal('edit-group-modal');
    renderStats();
    renderTodayStatus();
    renderGroups();
    renderDashboard();
    showToast('그룹이 삭제됐어요');
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

// ── 그룹에서 멤버 제거 (해당 조만; 다른 조 소속은 유지) ──
window.removeMemberFromGroup = async (uid, gid) => {
  const g = allGroups.find(x => x.id === gid);
  const u = allUsers.find(x => x.uid === uid);
  if (!confirm(`${u?.nickname || '이 멤버'}를 "${g?.name || ''}"에서 제거할까요?`)) return;
  try {
    const newGroupIds = groupIdsOf(u || {}).filter(id => id !== gid);
    await updateDoc(doc(db, 'users', uid), { groupIds: newGroupIds });
    if (u) u.groupIds = newGroupIds;
    // 그 조의 경/면 조장이었다면 양쪽에서 제거
    if (g) {
      const newGyeongLeaders = leaderUidsOf(g, 'gyeong').filter(x => x !== uid);
      const newMyeonLeaders = leaderUidsOf(g, 'myeon').filter(x => x !== uid);
      await updateDoc(doc(db, 'groups', gid), { leaderUidsGyeong: newGyeongLeaders, leaderUidsMyeon: newMyeonLeaders });
      g.leaderUidsGyeong = newGyeongLeaders;
      g.leaderUidsMyeon = newMyeonLeaders;
    }
    renderGroups();
    renderUsers();
    renderDashboard();
    showToast('멤버가 그룹에서 제거됐어요');
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

// ── 유저 상세보기 ──
let detailUid = null;
let detailFilter = 'week';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDateRangeFrom(period) {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    return localDateStr(mon);
  }
  if (period === 'month') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  return '2000-01-01';
}

function getWeekRange(startDate, weekNum) {
  const start = new Date(startDate);
  const from = new Date(start);
  from.setDate(start.getDate() + (weekNum - 1) * 7);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  return { from: localDateStr(from), to: localDateStr(to) };
}

window.openUserDetail = (uid) => {
  detailUid = uid;
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  document.getElementById('detail-modal-title').textContent = `${u.nickname} 상세보기`;

  // 필터 버튼 초기화
  document.querySelectorAll('.detail-filter-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.detail-filter-btn').classList.add('on');
  detailFilter = 'week';
  document.getElementById('detail-week-picker').style.display = 'none';
  document.getElementById('detail-month-picker').style.display = 'none';

  openModal('user-detail-modal');
  renderUserDetail();
};

window.setDetailFilter = (val, btn) => {
  detailFilter = val;
  document.querySelectorAll('.detail-filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');

  const weekPicker = document.getElementById('detail-week-picker');
  const monthPicker = document.getElementById('detail-month-picker');
  weekPicker.style.display = 'none';
  monthPicker.style.display = 'none';

  if (val === 'specific_week') {
    weekPicker.style.display = 'block';
    const u = allUsers.find(x => x.uid === detailUid);
    const myWeek = calcWeek(u?.startDate);
    const sel = document.getElementById('detail-week-select');
    sel.innerHTML = '<option value="">주차 선택...</option>';
    for (let w = myWeek; w >= 1; w--) sel.innerHTML += `<option value="${w}">${w}주차</option>`;
  } else if (val === 'specific_month') {
    monthPicker.style.display = 'block';
    if (!document.getElementById('detail-month-select').value) {
      const now = new Date();
      document.getElementById('detail-month-select').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
  }
  renderUserDetail();
};

window.renderUserDetail = () => {
  const u = allUsers.find(x => x.uid === detailUid);
  if (!u) return;

  let recs = allRecords.filter(r => r.uid === detailUid);
  if (detailFilter === 'specific_week') {
    const wkVal = document.getElementById('detail-week-select').value;
    if (wkVal && u.startDate) {
      const { from, to } = getWeekRange(u.startDate, Number(wkVal));
      recs = recs.filter(r => r.date >= from && r.date <= to);
    } else if (!wkVal) {
      recs = [];
    }
  } else if (detailFilter === 'specific_month') {
    const monthVal = document.getElementById('detail-month-select').value; // "YYYY-MM"
    if (monthVal) {
      recs = recs.filter(r => r.date.startsWith(monthVal));
    } else {
      recs = [];
    }
  } else {
    const from = getDateRangeFrom(detailFilter);
    recs = recs.filter(r => r.date >= from);
  }
  recs = [...recs].sort((a,b) => b.date.localeCompare(a.date));

  const n = recs.length;
  const pct = k => n ? Math.round(recs.filter(r=>r[k]).length/n*100) : 0;
  const avg = k => n ? Math.round(recs.reduce((a,r)=>a+(r[k]||0),0)/n) : 0;
  // 세부 항목 완료 정도: 전부=✓, 일부=△, 없음=-
  const mark = arr => { const c = arr.filter(Boolean).length; return c === 0 ? '-' : c === arr.length ? '✓' : '△'; };
  const apps = recs.reduce((a,r)=>a+(r.applications||0),0);

  const content = document.getElementById('user-detail-content');

  if (!n) {
    content.innerHTML = `<div style="text-align:center;padding:30px;color:#ccc;font-size:14px">선택한 기간에 기록이 없어요</div>`;
    return;
  }

  content.innerHTML = `
    <div class="stat-row" style="margin-bottom:18px">
      <div class="stat-box"><div class="num">${n}</div><div class="lbl">기록일</div></div>
      <div class="stat-box"><div class="num">${apps}</div><div class="lbl">지원개수</div></div>
      <div class="stat-box"><div class="num">${avg('lecture')}</div><div class="lbl">강의(분/일)</div></div>
    </div>
    <div class="sec-label">루틴 달성률</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px">
      ${[
        ['gyeong_article','매십경·기사읽기'],['gyeong_opinion','매십경·오피니언'],['gyeong_comment','매십경·댓글'],
        ['myeon_am','매십면·오전'],['myeon_pm','매십면·오후'],['myeon_feedback','매십면·피드백'],
        ['routineDok','매십독·책읽기'],['routinePilsa','매십독·필사'],['routineUn','매십운'],['fa5050','FA5050/현장방문'],
      ].map(([k,label]) => `
        <div style="background:#f8f8ff;border-radius:8px;padding:8px 10px">
          <div style="font-size:11px;color:#888;margin-bottom:4px">${label}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden">
              <div style="height:100%;background:var(--main);width:${pct(k)}%"></div>
            </div>
            <span style="font-size:11px;font-weight:600;color:var(--main);width:32px;text-align:right">${pct(k)}%</span>
          </div>
        </div>`).join('')}
    </div>
    <div class="sec-label">취준 활동 일 평균 (분)</div>
    <div class="stat-row" style="margin-bottom:18px">
      <div class="stat-box"><div class="num">${avg('jasoseo')}</div><div class="lbl">자소서</div></div>
      <div class="stat-box"><div class="num">${avg('pilgi')}</div><div class="lbl">필기</div></div>
      <div class="stat-box"><div class="num">${avg('interview')}</div><div class="lbl">면접</div></div>
      <div class="stat-box"><div class="num">${avg('cert')}</div><div class="lbl">자격증</div></div>
    </div>
    <div class="sec-label">일별 기록 (${n}개)</div>
    <div style="max-height:280px;overflow-y:auto;border:1px solid #f0f0f0;border-radius:10px">
      <table class="user-table" style="font-size:12px">
        <thead><tr>
          <th>날짜</th><th>경</th><th>면</th><th>독</th><th>운</th><th>FA</th>
          <th>강의</th><th>자소서</th><th>지원</th>
        </tr></thead>
        <tbody>
          ${recs.map(r => `
            <tr>
              <td>${r.date}</td>
              <td>${mark([r.gyeong_article,r.gyeong_opinion,r.gyeong_comment])}</td>
              <td>${mark([r.myeon_am,r.myeon_pm,r.myeon_feedback])}</td>
              <td>${r.bookTitle || (r.routineDok?'✓':'-')}</td>
              <td>${(r.exercises&&r.exercises.length)?r.exercises.join('/'):(r.routineUn?'✓':'-')}</td>
              <td>${r.fa5050===true?'✓':r.fa5050===false?'X':'-'}</td>
              <td>${r.lecture||0}</td>
              <td>${r.jasoseo||0}</td>
              <td>${r.applications||0}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// ── 유저 관리 모달 ──
window.openUserManage = (uid) => {
  const u = allUsers.find(x => x.uid === uid);
  document.getElementById('manage-user-uid').value = uid;
  document.getElementById('user-modal-title').textContent = `${u?.nickname || ''} 관리`;
  // 소속 조 다중 체크박스 (현재 소속 반영)
  const mine = new Set(groupIdsOf(u || {}));
  document.getElementById('user-group-checks').innerHTML = allGroups.length
    ? allGroups.map(g => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" class="ug-check" value="${g.id}" ${mine.has(g.id) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
        <span>${g.name}</span>
      </label>`).join('')
    : '<div style="font-size:12px;color:#ccc">등록된 조가 없어요</div>';
  const progSel = document.getElementById('user-program-select');
  progSel.value = u?.programType || 'careerpt';
  openModal('user-manage-modal');
};

window.saveUserGroup = async () => {
  const uid = document.getElementById('manage-user-uid').value;
  const groupIds = [...document.querySelectorAll('#user-group-checks .ug-check:checked')].map(c => c.value);
  const programType = document.getElementById('user-program-select').value;
  try {
    await updateDoc(doc(db, 'users', uid), { groupIds, programType });
    const u = allUsers.find(x=>x.uid===uid);
    if (u) { u.groupIds = groupIds; u.programType = programType; }
    closeModal('user-manage-modal');
    renderGroups();
    renderUsers();
    renderDashboard();
    showToast('변경사항이 저장됐어요');
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

window.resetOnboarding = async () => {
  const uid = document.getElementById('manage-user-uid').value;
  const u = allUsers.find(x=>x.uid===uid);
  if (!confirm(`${u?.nickname}의 온보딩을 초기화할까요?\n다음 로그인 시 온보딩 화면이 다시 표시됩니다.`)) return;
  try {
    await updateDoc(doc(db, 'users', uid), { onboardingDone: false });
    closeModal('user-manage-modal');
    showToast('온보딩이 초기화됐어요');
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

// 회원 삭제 — users 문서 + 해당 유저의 records 전체 삭제
window.deleteUser = async () => {
  const uid = document.getElementById('manage-user-uid').value;
  const u = allUsers.find(x=>x.uid===uid);
  if (!u) return;
  if (u.isAdmin === true) { showToast('관리자 계정은 삭제할 수 없어요'); return; }

  const ok1 = confirm(`"${u.nickname}" 회원을 삭제할까요?\n이 회원의 모든 기록(${allRecords.filter(r=>r.uid===uid).length}개)도 함께 삭제됩니다.`);
  if (!ok1) return;
  const ok2 = confirm('정말로 삭제하시겠어요?\n이 작업은 되돌릴 수 없어요.');
  if (!ok2) return;

  try {
    // 1) 해당 유저의 모든 records 삭제
    const userRecords = allRecords.filter(r => r.uid === uid);
    for (const r of userRecords) {
      await deleteDoc(doc(db, 'records', `${uid}_${r.date}`));
    }
    // 2) users 문서 삭제
    await deleteDoc(doc(db, 'users', uid));

    allUsers = allUsers.filter(x => x.uid !== uid);
    allRecords = allRecords.filter(r => r.uid !== uid);

    closeModal('user-manage-modal');
    renderStats();
    renderTodayStatus();
    renderGroups();
    renderUsers();
    renderDashboard();
    showToast(`"${u.nickname}" 회원이 삭제됐어요`);
  } catch(e) { showToast('삭제 중 오류가 발생했어요'); console.error(e); }
};

// ── 탭 전환 ──
window.switchAdminTab = (id, btn) => {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
};

// ── 모달 ──
window.openModal = id => document.getElementById(id).classList.add('open');
window.closeModal = id => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target===el) el.classList.remove('open'); });
});

// ── 토스트 ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2400);
}
