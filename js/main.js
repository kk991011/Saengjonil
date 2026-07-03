
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, query,
  where, orderBy, getDocs, deleteDoc, documentId }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Firebase 설정은 환경(운영/dev)에 따라 firebase-config.js에서 자동 선택됩니다.
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 오늘 날짜(로컬, YYYY-MM-DD) — 미래 날짜 선택 방지에 사용
const _todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
// 모든 날짜 입력의 max를 오늘로 → 달력에서 미래 날짜 비활성화
document.querySelectorAll('input[type="date"]').forEach(el => { if (!el.max) el.max = _todayStr; });

// 숫자(min/max) · 날짜(미래) 입력 clamp — 캡처 단계(요소의 인라인 oninput(예: updateTotalTime)보다 먼저 실행)
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.type === 'number') {
    if (el.value === '' || el.value === '-') return;      // 빈값/입력 중 '-' 는 허용
    const v = Number(el.value);
    if (Number.isNaN(v)) return;
    const min = el.min !== '' ? Number(el.min) : null;
    const max = el.max !== '' ? Number(el.max) : null;
    if (min !== null && v < min) el.value = String(min);
    else if (max !== null && v > max) el.value = String(max);
  } else if (el.type === 'date') {
    if (el.max && el.value && el.value > el.max) el.value = el.max;  // 미래 → 오늘로 보정
  }
}, true);

let user = null, userProfile = null;
let scoreSelected = 0, faSelected = null;
let allRecords = [], allGoals = [];
let groupRecords = [], groupUsers = [];

// ── 인증 확인 ──
onAuthStateChanged(auth, async u => {
  if (!u) { window.location.href = 'index.html'; return; }
  user = u;
  userProfile = (await getDoc(doc(db, 'users', u.uid))).data();
  if (!userProfile?.onboardingDone) { window.location.href = 'index.html'; return; }
  applyTheme(userProfile.themeColor || '#534AB7');
  initHeader();
  initInputForm();
  loadGoals();
  await loadAllRecords();
  loadDashboard();
});

function applyTheme(color) {
  document.documentElement.style.setProperty('--main', color);
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--main-dark',`rgb(${Math.round(r*.85)},${Math.round(g*.85)},${Math.round(b*.85)})`);
  document.documentElement.style.setProperty('--main-mid',`rgb(${Math.min(255,Math.round(r*1.12))},${Math.min(255,Math.round(g*1.12))},${Math.min(255,Math.round(b*1.12))})`);
  document.documentElement.style.setProperty('--main-light',`rgba(${r},${g},${b},0.12)`);
  document.documentElement.style.setProperty('--main-xlight',`rgba(${r},${g},${b},0.06)`);
}

function calcWeek(startDate) {
  if (!startDate) return 1;
  const diff = Math.floor((new Date() - new Date(startDate)) / 86400000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

// 컨텍스트에 따라 적절한 주차 표시 반환
// context: 'default'(커리어PT 기준), 'gyeong'(매십경), 'myeon'(매십면)
function getWeekByContext(profile, context) {
  if (context === 'gyeong' && profile.gyeongStartDate) {
    return { week: calcWeek(profile.gyeongStartDate), label: '경' };
  }
  if (context === 'myeon' && profile.myeonStartDate) {
    return { week: calcWeek(profile.myeonStartDate), label: '면' };
  }
  return { week: calcWeek(profile.startDate), label: 'PT' };
}

// 현재 탭에 맞는 주차 컨텍스트
function getTabContext(tabId) {
  if (tabId === 'gyeong' || tabId === 'maesipgyeong') return 'gyeong';
  if (tabId === 'myeon' || tabId === 'maesipmyeon') return 'myeon';
  return 'default';
}

function initHeader(context) {
  const p = userProfile;
  const ctx = context || 'default';
  const { week, label } = getWeekByContext(p, ctx);
  document.getElementById('user-name').textContent = p.nickname;
  // 커리어PT는 레이블 없이 주차만, 전용은 경/면 레이블 붙임
  const type = p.programType || 'careerpt';
  const showLabel = type !== 'careerpt' || ctx !== 'default';
  document.getElementById('week-badge').textContent = showLabel ? `${label}${week}주차` : `${week}주차`;
  const av = document.getElementById('avatar');
  if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" alt="프로필">`;
  else av.textContent = p.nickname[0];
  const jp = document.getElementById('jobprob-display');
  if (jp) jp.textContent = (p.jobProb || 0) + '%';
}

function localDate(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function initInputForm() {
  document.getElementById('f-nickname').value = userProfile.nickname;
  // 로컬 시간 기준 오늘 날짜
  const today = localDate();
  document.getElementById('f-date').value = today;
  applyProgramType(userProfile.programType || 'careerpt');
}

// programType에 따라 입력 섹션 표시/숨김
function applyProgramType(type) {
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };
  if (type === 'maesipgyeong') {
    // 매십경만
    show('section-gyeong', true);
    show('section-myeon', false);
    show('section-dok', false);
    show('section-un', false);
    show('section-jwijun', false);
  } else if (type === 'maesipmyeon') {
    // 매십면만
    show('section-gyeong', false);
    show('section-myeon', true);
    show('section-dok', false);
    show('section-un', false);
    show('section-jwijun', false);
  } else if (type === 'maesipboth') {
    // 매십경 + 매십면
    show('section-gyeong', true);
    show('section-myeon', true);
    show('section-dok', false);
    show('section-un', false);
    show('section-jwijun', false);
  } else {
    // 커리어PT — 전체
    show('section-gyeong', true);
    show('section-myeon', true);
    show('section-dok', true);
    show('section-un', true);
    show('section-jwijun', true);
  }
}

// ── 탭 전환 ──
window.switchTab = (id, btn) => {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  // 탭에 따라 헤더 주차 자동 전환
  initHeader(getTabContext(id));
  if (id === 'dashboard') loadDashboard();
  if (id === 'summary') loadSummary();
  if (id === 'trend') loadTrend();
  if (id === 'records') loadRecords();
};

// ── 루틴 토글 ──
window.toggleRoutine = (row, id) => {
  const chk = document.getElementById(id);
  chk.classList.toggle('checked');
  row.classList.toggle('checked');
};

// 세부 루틴 토글 (매십경/매십면)
window.toggleSubRoutine = (row, id) => {
  const chk = document.getElementById(id);
  chk.classList.toggle('checked');
  row.classList.toggle('checked');
  updateGyeongPct();
  updateMyeonPct();
};

// 매십운: 운동 종류 선택
let customExercises = [];
window.toggleExercise = (el) => {
  el.classList.toggle('selected');
  updateExerciseStatus();
};

window.addCustomExercise = () => {
  const inp = document.getElementById('exercise-custom-input');
  const val = inp.value.trim();
  if (!val) return;
  if (customExercises.includes(val)) { inp.value = ''; return; }
  customExercises.push(val);
  inp.value = '';
  renderCustomExercises();
  updateExerciseStatus();
};

function renderCustomExercises() {
  const wrap = document.getElementById('custom-exercise-list');
  wrap.innerHTML = customExercises.map(name => `
    <div class="focus-tag exercise-tag selected" data-custom="1" onclick="toggleCustomExercise(this,'${name.replace(/'/g,"\\'")}')">
      ${name} <span style="margin-left:4px;opacity:.6">×</span>
    </div>`).join('');
}

window.toggleCustomExercise = (el, name) => {
  if (event.target.tagName === 'SPAN' || el.classList.contains('selected') && event.offsetX > el.offsetWidth - 24) {
    customExercises = customExercises.filter(n => n !== name);
    renderCustomExercises();
  } else {
    el.classList.toggle('selected');
  }
  updateExerciseStatus();
};

function updateExerciseStatus() {
  const selected = getSelectedExercises();
  document.getElementById('un-status').textContent = selected.length ? `${selected.length}개 선택` : '선택 안 함';
}

function getSelectedExercises() {
  const preset = [...document.querySelectorAll('.exercise-tag.selected:not([data-custom])')].map(t => t.textContent.trim());
  const custom = [...document.querySelectorAll('.exercise-tag.selected[data-custom]')].map(t => t.textContent.replace('×','').trim());
  return [...preset, ...custom];
}

function updateGyeongPct() {
  const cnt = ['r-gyeong-1','r-gyeong-2','r-gyeong-3'].filter(id => document.getElementById(id).classList.contains('checked')).length;
  document.getElementById('gyeong-pct').textContent = `${cnt} / 3`;
}
function updateMyeonPct() {
  const cnt = ['r-myeon-1','r-myeon-2','r-myeon-3'].filter(id => document.getElementById(id).classList.contains('checked')).length;
  document.getElementById('myeon-pct').textContent = `${cnt} / 3`;
}

// 매십독: 책 이름 입력 상태 업데이트
window.updateDokStatus = () => {
  const title = document.getElementById('f-book-title').value.trim();
  const statusEl = document.getElementById('dok-status');
  if (!title) {
    statusEl.textContent = '미입력';
  } else {
    statusEl.textContent = title.length > 12 ? title.slice(0,12) + '…' : title;
  }
};

// 취준 활동 총 시간 자동 합산
window.updateTotalTime = () => {
  const manualInput = document.getElementById('f-total-time-manual');
  if (manualInput && manualInput.style.display !== 'none') return; // 수동 모드일 때는 합산 안 함
  const lecture = Number(document.getElementById('f-lecture').value) || 0;
  const jasoseo = Number(document.getElementById('f-jasoseo').value) || 0;
  const pilgi = Number(document.getElementById('f-pilgi').value) || 0;
  const interview = Number(document.getElementById('f-interview').value) || 0;
  const total = lecture + jasoseo + pilgi + interview;
  document.getElementById('total-time-display').textContent = total;
};

// 총 취준 시간 직접 수정 토글
window.toggleTotalTimeEdit = () => {
  const displayWrap = document.getElementById('total-time-display-wrap');
  const manualInput = document.getElementById('f-total-time-manual');
  const btn = document.getElementById('total-time-edit-btn');
  const hint = document.getElementById('total-time-hint');
  const isManual = manualInput.style.display !== 'none';
  if (isManual) {
    // 자동 합산으로 복귀
    manualInput.style.display = 'none';
    displayWrap.style.display = '';
    btn.textContent = '직접 수정';
    hint.textContent = '수강+자소서+필기+면접 자동 합산';
    updateTotalTime();
  } else {
    // 직접 수정 모드
    const cur = document.getElementById('total-time-display').textContent;
    manualInput.value = cur;
    manualInput.style.display = '';
    displayWrap.style.display = 'none';
    btn.textContent = '자동 합산';
    hint.textContent = '직접 총 시간을 입력해주세요 (분)';
  }
};

// ── 점수 선택 ──
window.selectScore = (btn, val) => {
  document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  scoreSelected = val;
};

// ── FA 선택 ──
window.selectFA = (yes) => {
  document.querySelectorAll('.fa-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(yes ? '.fa-btn.yes' : '.fa-btn.no').classList.add('selected');
  faSelected = yes;
};

// ── 태그 토글 ──
window.toggleTag = el => el.classList.toggle('selected');

// ── 기록 저장 ──
window.saveRecord = async () => {
  const date = document.getElementById('f-date').value;
  if (!date) { showToast('날짜를 선택해주세요'); return; }
  const btn = document.querySelector('.save-btn');
  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    const focusTags = [...document.querySelectorAll('.focus-tag.selected:not(.exercise-tag)')].map(t => t.textContent);
    const chk = id => document.getElementById(id).classList.contains('checked');
    const data = {
      uid: user.uid, nickname: userProfile.nickname, date,
      // 매십경 세부
      gyeong_article: chk('r-gyeong-1'),
      gyeong_opinion: chk('r-gyeong-2'),
      gyeong_comment: chk('r-gyeong-3'),
      gyeongScore: [chk('r-gyeong-1'),chk('r-gyeong-2'),chk('r-gyeong-3')].filter(Boolean).length,
      // 매십면 세부
      myeon_am: chk('r-myeon-1'),
      myeon_pm: chk('r-myeon-2'),
      myeon_feedback: chk('r-myeon-3'),
      myeonScore: [chk('r-myeon-1'),chk('r-myeon-2'),chk('r-myeon-3')].filter(Boolean).length,
      // 기존 호환성 유지
      routineGyeong: chk('r-gyeong-1') && chk('r-gyeong-2') && chk('r-gyeong-3'),
      routineMyeon:  chk('r-myeon-1')  && chk('r-myeon-2')  && chk('r-myeon-3'),
      routineDok: chk('r-dok'),
      routinePilsa: chk('r-pilsa'),
      bookTitle:  document.getElementById('f-book-title').value.trim(),
      routineUn:  getSelectedExercises().length > 0,
      exercises:  getSelectedExercises(),
      lecture: Number(document.getElementById('f-lecture').value) || 0,
      lectureItem: document.getElementById('f-lecture-item').value.trim(),
      jasoseo: Number(document.getElementById('f-jasoseo').value) || 0,
      jasoseoCount: Number(document.getElementById('f-jasoseo-count').value) || 0,
      pilgi: Number(document.getElementById('f-pilgi').value) || 0,
      interview: Number(document.getElementById('f-interview').value) || 0,
      totalTime: (() => {
        const manualInput = document.getElementById('f-total-time-manual');
        if (manualInput && manualInput.style.display !== 'none') {
          return Number(manualInput.value) || 0;
        }
        return (Number(document.getElementById('f-lecture').value)||0) + (Number(document.getElementById('f-jasoseo').value)||0) + (Number(document.getElementById('f-pilgi').value)||0) + (Number(document.getElementById('f-interview').value)||0);
      })(),
      applications: Number(document.getElementById('f-applications').value) || 0,
      selfEsteem: scoreSelected || 0,
      jobProb: userProfile.jobProb || 0,
      fa5050: faSelected,
      focusTags,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'records', `${user.uid}_${date}`), data);
    showToast('기록이 저장되었어요! 🎉');
    allRecords = allRecords.filter(r => r.date !== date);
    allRecords.unshift(data);
    allRecords.sort((a,b) => b.date.localeCompare(a.date));
  } catch(e) { showToast('저장 중 오류가 발생했어요'); console.error(e); }
  btn.disabled = false; btn.textContent = '오늘 기록 저장하기';
};

// ── 기록 전체 로드 ──
async function loadAllRecords() {
  const q = query(collection(db,'records'), where('uid','==',user.uid), orderBy('date','desc'));
  const snap = await getDocs(q);
  allRecords = snap.docs.map(d => d.data());

  // 주간 목표도 같이 로드 (본인 것만 — 문서ID 접두 범위로 스코핑)
  const goalSnap = await getDocs(query(collection(db, 'weekly_goals'),
    where(documentId(), '>=', `${user.uid}_`), where(documentId(), '<=', `${user.uid}_\uf8ff`)));
  allGoals = goalSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ── 누적 요약 ──
async function loadSummary() {
  document.getElementById('summary-loading').style.display = 'block';
  document.getElementById('summary-content').style.display = 'none';
  try {
    if (!allRecords.length) await loadAllRecords();
    const recs = allRecords;
    const n = recs.length;
    if (!n) { return; }
  document.getElementById('s-days').textContent = n;
  document.getElementById('s-apps').textContent = recs.reduce((a,r)=>a+(r.applications||0),0);
  document.getElementById('s-lecture').textContent = Math.round(recs.reduce((a,r)=>a+(r.totalTime ?? ((r.lecture||0)+(r.jasoseo||0)+(r.pilgi||0)+(r.interview||0))),0)/60);
  const pct = k => Math.round(recs.filter(r=>r[k]).length/n*100);
  const setPct = (id,pb,v) => { document.getElementById(id).textContent=v+'%'; document.getElementById(pb).style.width=v+'%'; };
  // 매십경 세부
  const gA = pct('gyeong_article'), gO = pct('gyeong_opinion'), gC = pct('gyeong_comment');
  setPct('p-gyeong-all','pb-gyeong-all',Math.round((gA+gO+gC)/3));  // 종합 = 세 항목 평균
  setPct('p-gyeong-1','pb-gyeong-1',gA);
  setPct('p-gyeong-2','pb-gyeong-2',gO);
  setPct('p-gyeong-3','pb-gyeong-3',gC);
  // 매십면 세부
  const mA = pct('myeon_am'), mP = pct('myeon_pm'), mF = pct('myeon_feedback');
  setPct('p-myeon-all','pb-myeon-all',Math.round((mA+mP+mF)/3));  // 종합 = 세 항목 평균
  setPct('p-myeon-1','pb-myeon-1',mA);
  setPct('p-myeon-2','pb-myeon-2',mP);
  setPct('p-myeon-3','pb-myeon-3',mF);
  // 나머지
  setPct('p-dok','pb-dok',pct('routineDok'));
  setPct('p-un','pb-un',pct('routineUn'));
  setPct('p-fa','pb-fa',pct('fa5050'));
  const avg = k => n ? Math.round(recs.reduce((a,r)=>a+(r[k]||0),0)/n) : 0;
  const total = k => recs.reduce((a,r)=>a+(r[k]||0),0);
  document.getElementById('s-lec-avg').textContent = avg('lecture');
  document.getElementById('s-jas-avg').textContent = avg('jasoseo');
  document.getElementById('s-pil-avg').textContent = avg('pilgi');
  document.getElementById('s-int-avg').textContent = avg('interview');
  document.getElementById('s-lec-total').textContent = total('lecture');
  document.getElementById('s-jas-total').textContent = total('jasoseo');
  document.getElementById('s-pil-total').textContent = total('pilgi');
  document.getElementById('s-int-total').textContent = total('interview');

  // 집중 활동 분포 도넛 차트
  const focusCount = { '자소서':0, '필기':0, '면접':0, 'FA5050/현장방문':0, '골고루':0 };
  recs.forEach(r => { (r.focusTags||[]).forEach(t => { if(focusCount[t]!==undefined) focusCount[t]++; }); });
  const focusLabels = Object.keys(focusCount).filter(k => focusCount[k] > 0);
  const focusData = focusLabels.map(k => focusCount[k]);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--main').trim() || '#534AB7';
  const r2 = parseInt(color.slice(1,3)||'53',16), g2 = parseInt(color.slice(3,5)||'4a',16), b2 = parseInt(color.slice(5,7)||'b7',16);
  const palette = [
    color,
    `rgba(${r2},${g2},${b2},.75)`,
    `rgba(${r2},${g2},${b2},.55)`,
    `rgba(${r2},${g2},${b2},.35)`,
    `rgba(${r2},${g2},${b2},.2)`,
  ];
  const donutEl = document.getElementById('focus-donut');
  const donutWrap = document.getElementById('focus-donut-wrap');
  const emptyEl = document.getElementById('focus-empty');
  const exD = Chart.getChart(donutEl); if(exD) exD.destroy();
  if (focusData.length) {
    donutWrap.style.display = 'block';
    emptyEl.style.display = 'none';
    new Chart(donutEl, {
      type: 'doughnut',
      data: { labels: focusLabels, datasets: [{ data: focusData, backgroundColor: palette, borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: 24 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } } },
      plugins: [{ id: 'dl', afterDraw(chart) {
        const { ctx, data } = chart;
        const meta = chart.getDatasetMeta(0);
        const total = data.datasets[0].data.reduce((a,b)=>a+b,0);
        meta.data.forEach((arc, i) => {
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const r = arc.outerRadius + 18;
          const x = arc.x + Math.cos(angle) * r;
          const y = arc.y + Math.sin(angle) * r;
          const pct = Math.round(data.datasets[0].data[i] / total * 100);
          ctx.save();
          ctx.font = '500 11px sans-serif';
          ctx.fillStyle = '#444';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(data.labels[i], x, y - 6);
          ctx.font = '400 10px sans-serif';
          ctx.fillStyle = '#888';
          ctx.fillText(pct + '%', x, y + 7);
          ctx.restore();
        });
      }}]
    });
    document.getElementById('focus-legend').innerHTML = focusLabels.map((l,i) =>
      `<span style="display:flex;align-items:center;gap:4px">
        <span style="width:10px;height:10px;border-radius:2px;background:${palette[i]};display:inline-block"></span>${l}
      </span>`).join('');
  } else {
    donutWrap.style.display = 'none';
    emptyEl.style.display = 'block';
    document.getElementById('focus-legend').innerHTML = '';
  }
  } catch(e) {
    console.error('누적 요약 로딩 오류:', e);
  } finally {
    document.getElementById('summary-loading').style.display = 'none';
    document.getElementById('summary-content').style.display = 'block';
  }
}

// ── 차트 계열 색 (테마와 독립된 고정 팔레트 — 항목 구분용) ──
const ITEM_COLORS = {
  gyeong: '#3B5BDB', // 매십경 — 블루
  myeon:  '#0CA678', // 매십면 — 틸
  dok:    '#E64980', // 매십독 — 마젠타
  un:     '#F59E0B', // 매십운 — 앰버
  fa:     '#7950F2', // FA5050 — 바이올렛
  apps:   '#868E96', // 지원수 — 그레이
};

// ── 추이 차트 ──
let trendChartInst, moodChartInst, goalChartInst;
async function loadTrend() {
  if (!allRecords.length) await loadAllRecords();
  const recs = [...allRecords].reverse().slice(-14);
  const labels = recs.map(r => r.date.slice(5));
  const color = getComputedStyle(document.documentElement).getPropertyValue('--main').trim() || '#534AB7';
  const mkChart = (id,ds,opts={}) => {
    const el = document.getElementById(id);
    const ex = Chart.getChart(el); if(ex) ex.destroy();
    return new Chart(el,{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{ticks:{font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}}},...opts}});
  };
  trendChartInst = mkChart('trend-chart',[
    {label:'강의',data:recs.map(r=>r.lecture||0),borderColor:color,borderWidth:2,pointRadius:2,tension:.3,fill:false},
    {label:'자소서',data:recs.map(r=>r.jasoseo||0),borderColor:color+'99',borderWidth:1.5,borderDash:[4,3],pointRadius:2,tension:.3,fill:false},
    {label:'필기',data:recs.map(r=>r.pilgi||0),borderColor:color+'66',borderWidth:1.5,pointRadius:2,tension:.3,fill:false},
    {label:'면접',data:recs.map(r=>r.interview||0),borderColor:color+'44',borderWidth:1.5,borderDash:[4,3],pointRadius:2,tension:.3,fill:false},
  ]);
  // 매십면·매십운·매십독·FA5050 주차별 달성률 (각 항목별 그래프)
  const iWk = calcWeek(userProfile.startDate);
  const iFrom = Math.max(1, iWk - 7);
  const itemWeekly = (field) => {
    const ls = [], ds = [];
    for (let w = iFrom; w <= iWk; w++) {
      const st = new Date(userProfile.startDate);
      const f = new Date(st); f.setDate(st.getDate() + (w - 1) * 7);
      const t = new Date(f); t.setDate(f.getDate() + 6);
      const fs = localDate(f), ts = localDate(t);
      const wr = allRecords.filter(r => r.date >= fs && r.date <= ts);
      ls.push(`${w}주차`);
      ds.push(wr.length ? Math.round(wr.filter(r => r[field]).length / wr.length * 100) : null);
    }
    return { ls, ds };
  };
  const mkRateChart = (id, field, c) => {
    const el = document.getElementById(id); if (!el) return;
    const ex = Chart.getChart(el); if (ex) ex.destroy();
    const { ls, ds } = itemWeekly(field);
    new Chart(el, { type:'line', data:{ labels:ls, datasets:[{ data:ds, borderColor:c, borderWidth:2, pointRadius:3, pointBackgroundColor:c, tension:.3, fill:true, backgroundColor:c+'15', spanGaps:true }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
        scales:{ x:{ ticks:{ font:{ size:10 } }, grid:{ display:false } },
          y:{ min:0, max:100, ticks:{ callback:v=>v+'%', font:{ size:10 } }, grid:{ color:'rgba(0,0,0,.04)' } } } } });
  };
  mkRateChart('itrend-myeon', 'routineMyeon', ITEM_COLORS.myeon);
  mkRateChart('itrend-gyeong', 'routineGyeong', ITEM_COLORS.gyeong);
  mkRateChart('itrend-un', 'routineUn', ITEM_COLORS.un);
  mkRateChart('itrend-dok', 'routineDok', ITEM_COLORS.dok);
  mkRateChart('itrend-fa', 'fa5050', ITEM_COLORS.fa);

  // 주간 목표 달성률 차트
  const wk = calcWeek(userProfile.startDate);
  const goalLabels = [], goalData = [];
  for (let w = Math.max(1, wk-7); w <= wk; w++) {
    const snap = allGoals.find ? null : null; // allGoals는 배열
    const gDoc = allGoals.filter ? allGoals.find(g => g._id === `${user.uid}_week${w}`) : null;
    goalLabels.push(`${w}주차`);
    if (gDoc) {
      const goals = gDoc.goals || [];
      goalData.push(goals.length ? Math.round(goals.filter(g=>g.done).length/goals.length*100) : 0);
    } else { goalData.push(null); }
  }
  const goalEl = document.getElementById('goal-chart');
  if (goalEl) {
    const exG = Chart.getChart(goalEl); if(exG) exG.destroy();
    new Chart(goalEl, { type:'line', data:{ labels:goalLabels,
      datasets:[{ label:'목표달성률', data:goalData, borderColor:color, borderWidth:2,
        pointRadius:4, pointBackgroundColor:color, tension:.3, fill:true,
        backgroundColor:color+'15', spanGaps:true }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{ x:{ ticks:{ font:{ size:10 } }, grid:{ display:false } },
          y:{ min:0, max:100, ticks:{ callback:v=>v+'%', font:{ size:10 } },
          grid:{ color:'rgba(0,0,0,.04)' } } } } });
  }
}

// ── 대시보드 ──
let dashMyChartInst, dashGroupChartInst;

async function loadDashboard() {
  if (!allRecords.length) await loadAllRecords();
  if (userProfile.groupId) await loadGroupRecords();

  const myWeek = calcWeek(userProfile.startDate);
  const fromWeek = Math.max(1, myWeek - 7);
  const weekLabels = [];
  for (let w = fromWeek; w <= myWeek; w++) weekLabels.push(w);

  const color = getComputedStyle(document.documentElement).getPropertyValue('--main').trim() || '#534AB7';
  const colorMid = getComputedStyle(document.documentElement).getPropertyValue('--main-mid').trim() || '#7F77DD';

  // 내 추이: 주차별 매십경·매십독 달성률(%) + 지원수(개)
  const myStats = weekLabels.map(w => calcWeekStats(allRecords, userProfile.startDate, w));
  renderDashChart('dash-my-chart', weekLabels, myStats, color, colorMid);

  // 조별 추이
  if (userProfile.groupId && groupUsers.length) {
    const groupName = (await getGroupName(userProfile.groupId)) || '내 그룹';
    document.getElementById('dash-group-name').textContent = `(${groupName})`;

    const groupStats = weekLabels.map(w => {
      // 그룹 내 각 멤버의 본인 시작일 기준 N주차(w) 통계를 평균
      const memberStats = groupUsers.map(u => calcWeekStats(groupRecords.filter(r=>r.uid===u.uid), u.startDate, w));
      const n = memberStats.length || 1;
      return {
        gyeong: Math.round(memberStats.reduce((a,s)=>a+s.gyeong,0)/n),
        myeon: Math.round(memberStats.reduce((a,s)=>a+s.myeon,0)/n),
        dok: Math.round(memberStats.reduce((a,s)=>a+s.dok,0)/n),
        un: Math.round(memberStats.reduce((a,s)=>a+s.un,0)/n),
        apps: Math.round(memberStats.reduce((a,s)=>a+s.apps,0)/n*10)/10,
      };
    });
    renderDashChart('dash-group-chart', weekLabels, groupStats, color, colorMid);
  } else {
    document.getElementById('dash-group-name').textContent = '';
    const el = document.getElementById('dash-group-chart');
    if (el) { const ex = Chart.getChart(el); if (ex) ex.destroy(); }
  }
}

// 특정 주차(w)에 해당하는 날짜 범위의 기록으로부터 매십경·매십독 달성률, 지원수 계산
function calcWeekStats(recs, startDate, weekNum) {
  if (!startDate || !weekNum) return { gyeong: 0, myeon: 0, dok: 0, un: 0, apps: 0 };
  const start = new Date(startDate);
  const from = new Date(start); from.setDate(start.getDate() + (weekNum - 1) * 7);
  const to = new Date(from); to.setDate(from.getDate() + 6);
  const fromStr = localDate(from), toStr = localDate(to);
  const weekRecs = recs.filter(r => r.date >= fromStr && r.date <= toStr);
  const n = weekRecs.length;
  if (!n) return { gyeong: 0, myeon: 0, dok: 0, un: 0, apps: 0 };
  return {
    gyeong: Math.round(weekRecs.filter(r=>r.routineGyeong).length / n * 100),
    myeon: Math.round(weekRecs.filter(r=>r.routineMyeon).length / n * 100),
    dok: Math.round(weekRecs.filter(r=>r.routineDok).length / n * 100),
    un: Math.round(weekRecs.filter(r=>r.routineUn).length / n * 100),
    apps: weekRecs.reduce((a,r)=>a+(r.applications||0),0),
  };
}

function renderDashChart(canvasId, labels, statsArr, color, colorMid) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ex = Chart.getChart(el); if (ex) ex.destroy();
  new Chart(el, {
    type: 'line',
    data: {
      labels: labels.map(w => `${w}주`),
      datasets: [
        { label:'매십경', data: statsArr.map(s=>s.gyeong), borderColor:ITEM_COLORS.gyeong, borderWidth:2, pointRadius:2, tension:.3, fill:false, yAxisID:'y' },
        { label:'매십면', data: statsArr.map(s=>s.myeon), borderColor:ITEM_COLORS.myeon, borderWidth:2, pointRadius:2, tension:.3, fill:false, yAxisID:'y' },
        { label:'매십독', data: statsArr.map(s=>s.dok), borderColor:ITEM_COLORS.dok, borderWidth:2, pointRadius:2, tension:.3, fill:false, yAxisID:'y' },
        { label:'매십운', data: statsArr.map(s=>s.un), borderColor:ITEM_COLORS.un, borderWidth:2, pointRadius:2, tension:.3, fill:false, yAxisID:'y' },
        { label:'지원수', data: statsArr.map(s=>s.apps), borderColor:ITEM_COLORS.apps, borderWidth:1.5, borderDash:[4,3], pointRadius:2, tension:.3, fill:false, yAxisID:'y1' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks:{font:{size:10}}, grid:{display:false} },
        y: { position:'left', min:0, max:100, ticks:{callback:v=>v+'%',font:{size:10}}, grid:{color:'rgba(0,0,0,.04)'} },
        y1: { position:'right', min:0, ticks:{font:{size:10}}, grid:{display:false} },
      }
    }
  });
}

async function loadGroupRecords() {
  const uSnap = await getDocs(query(collection(db,'users'), where('groupId','==',userProfile.groupId)));
  groupUsers = uSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const uids = groupUsers.map(u => u.uid);
  if (!uids.length) { groupRecords = []; return; }
  // Firestore 'in' 쿼리는 최대 30개 제한 — 그룹 인원이 적으니 우선 단순 처리
  const rSnap = await getDocs(query(collection(db,'records'), where('uid','in', uids.slice(0,30))));
  groupRecords = rSnap.docs.map(d => d.data());
}

async function getGroupName(groupId) {
  try {
    const gDoc = await getDoc(doc(db, 'groups', groupId));
    return gDoc.exists() ? gDoc.data().name : null;
  } catch(e) { return null; }
}

window.loadRecords = async () => {
  if (!allRecords.length) await loadAllRecords();
  const filter = document.getElementById('rec-filter').value;
  const recs = filter ? allRecords.filter(r => r.date.startsWith(filter)) : allRecords;
  const today = localDate();
  document.getElementById('rec-count').textContent = `총 ${recs.length}개 기록`;
  const list = document.getElementById('records-list');
  if (!recs.length) { list.innerHTML = '<div class="empty-state"><p>아직 기록이 없어요.<br>오늘 입력 탭에서 첫 기록을 남겨보세요!</p></div>'; return; }
  list.innerHTML = recs.map(r => {
    const routineDone = [r.routineGyeong,r.routineMyeon,r.routineDok,r.routineUn].filter(Boolean).length;
    const dateStr = new Date(r.date).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
    const isToday = r.date === today;
    return `<div class="record-card" ${isToday ? 'style="border-color:var(--main-mid)"' : ''}>
      <div class="record-header">
        <div>
          <div class="record-date">${dateStr}${isToday ? ' <span style="font-size:11px;background:var(--main);color:white;padding:1px 7px;border-radius:6px;margin-left:4px">오늘</span>' : ''}</div>
        </div>
        <div class="record-badges">
          ${r.fa5050 ? '<span class="badge badge-purple">FA완료 ✦</span>' : ''}
          <span class="badge ${routineDone===4?'badge-purple':routineDone>=2?'badge-green':'badge-gray'}">루틴 ${routineDone}/4</span>
        </div>
      </div>
      <div class="record-grid">
        <div class="record-item">강의 <span>${r.lecture||0}분</span></div>
        <div class="record-item">자소서 <span>${r.jasoseo||0}분</span></div>
        <div class="record-item">필기 <span>${r.pilgi||0}분</span></div>
        <div class="record-item">면접 <span>${r.interview||0}분</span></div>
        <div class="record-item">지원 <span>${r.applications||0}개</span></div>
        <div class="record-item">자존감 <span>${r.selfEsteem||'-'}점</span></div>
      </div>
      <div class="routine-tags">
        <span class="rtag ${r.routineGyeong?'rtag-done':'rtag-miss'}">매십경${r.routineGyeong?' ✓':''}</span>
        <span class="rtag ${r.routineMyeon?'rtag-done':'rtag-miss'}">매십면${r.routineMyeon?' ✓':''}</span>
        <span class="rtag ${r.routineDok?'rtag-done':'rtag-miss'}">매십독${r.bookTitle?' · '+r.bookTitle:''}</span>
        <span class="rtag ${r.routineUn?'rtag-done':'rtag-miss'}">매십운${r.routineUn?' ✓':''}</span>
      </div>
      ${r.focusTags?.length ? `<div style="font-size:12px;color:#aaa;margin-bottom:8px">집중: <span style="color:var(--main)">${r.focusTags.join(', ')}</span></div>` : ''}
      ${isToday ? `
      <div class="record-actions">
        <button class="btn-sm btn-sm-primary" onclick="editTodayRecord()">수정</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteRecord('${r.date}')">삭제</button>
      </div>` : `<div style="font-size:11px;color:#ccc;text-align:right">당일만 수정 가능</div>`}
    </div>`;
  }).join('');
};

window.deleteRecord = async (date) => {
  const today = localDate();
  if (date !== today) { showToast('당일 기록만 삭제할 수 있어요'); return; }
  if (!confirm('오늘 기록을 삭제할까요?')) return;
  await deleteDoc(doc(db, 'records', `${user.uid}_${date}`));
  allRecords = allRecords.filter(r => r.date !== date);
  loadRecords();
  showToast('기록이 삭제됐어요');
};

// 오늘 기록 수정
window.editTodayRecord = () => {
  const today = localDate();
  const r = allRecords.find(rec => rec.date === today);
  if (!r) return;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-input').classList.add('active');
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
  ['r-gyeong-1','r-gyeong-2','r-gyeong-3','r-myeon-1','r-myeon-2','r-myeon-3','r-dok','r-pilsa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('checked'); el.closest('.routine-row')?.classList.remove('checked'); }
  });
  if (r.gyeong_article) { document.getElementById('r-gyeong-1').classList.add('checked'); document.getElementById('r-gyeong-1').closest('.routine-row').classList.add('checked'); }
  if (r.gyeong_opinion) { document.getElementById('r-gyeong-2').classList.add('checked'); document.getElementById('r-gyeong-2').closest('.routine-row').classList.add('checked'); }
  if (r.gyeong_comment) { document.getElementById('r-gyeong-3').classList.add('checked'); document.getElementById('r-gyeong-3').closest('.routine-row').classList.add('checked'); }
  if (r.myeon_am)        { document.getElementById('r-myeon-1').classList.add('checked'); document.getElementById('r-myeon-1').closest('.routine-row').classList.add('checked'); }
  if (r.myeon_pm)        { document.getElementById('r-myeon-2').classList.add('checked'); document.getElementById('r-myeon-2').closest('.routine-row').classList.add('checked'); }
  if (r.myeon_feedback)  { document.getElementById('r-myeon-3').classList.add('checked'); document.getElementById('r-myeon-3').closest('.routine-row').classList.add('checked'); }
  if (r.routineDok)      { document.getElementById('r-dok').classList.add('checked'); document.getElementById('r-dok').closest('.routine-row').classList.add('checked'); }
  if (r.routinePilsa)    { document.getElementById('r-pilsa').classList.add('checked'); document.getElementById('r-pilsa').closest('.routine-row').classList.add('checked'); }
  document.getElementById('f-book-title').value = r.bookTitle || '';
  const lectureItemEl = document.getElementById('f-lecture-item');
  if (lectureItemEl) lectureItemEl.value = r.lectureItem || '';
  const jasoseoCountEl = document.getElementById('f-jasoseo-count');
  if (jasoseoCountEl) jasoseoCountEl.value = r.jasoseoCount || '';
  updateDokStatus();
  updateGyeongPct();
  updateMyeonPct();

  // 운동 선택 복원
  document.querySelectorAll('#exercise-tags .exercise-tag').forEach(tag => tag.classList.remove('selected'));
  customExercises = [];
  const presetList = ['헬스','러닝','요가','필라테스','홈트','등산','수영','축구·풋살','배드민턴'];
  (r.exercises || []).forEach(ex => {
    if (presetList.includes(ex)) {
      [...document.querySelectorAll('#exercise-tags .exercise-tag')].find(t => t.textContent.trim() === ex)?.classList.add('selected');
    } else {
      customExercises.push(ex);
    }
  });
  renderCustomExercises();
  updateExerciseStatus();

  document.getElementById('f-lecture').value      = r.lecture || 0;
  document.getElementById('f-jasoseo').value      = r.jasoseo || 0;
  document.getElementById('f-pilgi').value        = r.pilgi || 0;
  document.getElementById('f-interview').value    = r.interview || 0;
  document.getElementById('f-applications').value = r.applications || 0;
  updateTotalTime();
  scoreSelected = r.selfEsteem || 0;
  document.querySelectorAll('.score-btn').forEach((btn,i) => btn.classList.toggle('selected', i+1 === r.selfEsteem));
  if (r.fa5050 !== null && r.fa5050 !== undefined) selectFA(r.fa5050);
  document.querySelectorAll('.tag-row:last-of-type .focus-tag').forEach(tag => tag.classList.toggle('selected', (r.focusTags||[]).includes(tag.textContent)));
  showToast('오늘 기록을 불러왔어요. 수정 후 저장해주세요! ✏️');
  window.scrollTo(0, 0);
};

// ── 주간 목표 ──
let goals = [], currentWeekKey = '';
let monthGoals = [], currentMonthKey = '';

async function loadGoals() {
  const wk = calcWeek(userProfile.startDate);
  currentWeekKey = `${user.uid}_week${wk}`;
  document.getElementById('goal-week-label').textContent = `${wk}주차 목표`;

  // 월 목표 키 (YYYY-MM)
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  currentMonthKey = `${user.uid}_month_${ym}`;
  document.getElementById('goal-month-label').textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 목표`;

  const [weekSnap, monthSnap] = await Promise.all([
    getDoc(doc(db, 'weekly_goals', currentWeekKey)),
    getDoc(doc(db, 'weekly_goals', currentMonthKey)),
  ]);
  goals = weekSnap.exists() ? (weekSnap.data().goals || []) : [];
  monthGoals = monthSnap.exists() ? (monthSnap.data().goals || []) : [];
  renderGoals();
  renderMonthGoals();
  populatePastWeeks(wk);
  populatePastMonths(now);
}

function populatePastMonths(now) {
  const sel = document.getElementById('past-month-sel');
  sel.innerHTML = '<option value="">월 선택...</option>';
  // 최근 12개월
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    sel.innerHTML += `<option value="${ym}">${d.getFullYear()}년 ${d.getMonth()+1}월</option>`;
  }
}

window.loadPastMonthGoal = async () => {
  const ym = document.getElementById('past-month-sel').value;
  const listEl = document.getElementById('past-month-goal-list');
  if (!ym) { listEl.innerHTML = ''; return; }
  const snap = await getDoc(doc(db, 'weekly_goals', `${user.uid}_month_${ym}`));
  const g = snap.exists() ? (snap.data().goals || []) : [];
  const done = g.filter(x => x.done).length;
  const [year, month] = ym.split('-');
  listEl.innerHTML = g.length
    ? `<div style="font-size:13px;color:#aaa;margin-bottom:10px">
        ${year}년 ${Number(month)}월 달성률:
        <strong style="color:var(--main)">${g.length ? Math.round(done/g.length*100) : 0}%</strong>
        (${done} / ${g.length})
       </div>`
      + g.map(x => `
        <div class="goal-item ${x.done?'done':''}">
          <div class="chk-box ${x.done?'checked':''}"></div>
          <div class="goal-text">${x.text}</div>
        </div>`).join('')
    : '<div style="font-size:13px;color:#ccc;text-align:center;padding:20px">이 달 목표 기록이 없어요</div>';
};

function renderGoals() {
  const done = goals.filter(g=>g.done).length;
  const pct = goals.length ? Math.round(done/goals.length*100) : 0;
  document.getElementById('goal-pct-label').textContent = `${done} / ${goals.length} 달성 (${pct}%)`;
  document.getElementById('goal-prog').style.width = pct + '%';
  document.getElementById('goal-list').innerHTML = goals.map((g,i) => `
    <div class="goal-item ${g.done?'done':''}" >
      <div class="chk-box ${g.done?'checked':''}" onclick="toggleGoal(${i})" style="cursor:pointer"></div>
      <div class="goal-text">${g.text}</div>
      <button class="goal-del" onclick="removeGoal(${i})">×</button>
    </div>`).join('');
}

function renderMonthGoals() {
  const done = monthGoals.filter(g=>g.done).length;
  const pct = monthGoals.length ? Math.round(done/monthGoals.length*100) : 0;
  document.getElementById('goal-month-pct-label').textContent = `${done} / ${monthGoals.length} 달성 (${pct}%)`;
  document.getElementById('goal-month-prog').style.width = pct + '%';
  document.getElementById('goal-month-list').innerHTML = monthGoals.map((g,i) => `
    <div class="goal-item ${g.done?'done':''}">
      <div class="chk-box ${g.done?'checked':''}" onclick="toggleMonthGoal(${i})" style="cursor:pointer"></div>
      <div class="goal-text">${g.text}</div>
      <button class="goal-del" onclick="removeMonthGoal(${i})">×</button>
    </div>`).join('');
}

window.addGoal = async () => {
  const inp = document.getElementById('goal-input');
  const text = inp.value.trim();
  if (!text) return;
  if (goals.length >= 10) { showToast('목표는 최대 10개까지 추가할 수 있어요'); return; }
  goals.push({ text, done: false });
  inp.value = '';
  await saveGoals();
  renderGoals();
};

window.addMonthGoal = async () => {
  const inp = document.getElementById('goal-month-input');
  const text = inp.value.trim();
  if (!text) return;
  if (monthGoals.length >= 15) { showToast('월 목표는 최대 15개까지 추가할 수 있어요'); return; }
  monthGoals.push({ text, done: false });
  inp.value = '';
  await saveMonthGoals();
  renderMonthGoals();
};

window.toggleGoal = async (i) => {
  goals[i].done = !goals[i].done;
  await saveGoals();
  renderGoals();
};

window.toggleMonthGoal = async (i) => {
  monthGoals[i].done = !monthGoals[i].done;
  await saveMonthGoals();
  renderMonthGoals();
};

window.removeGoal = async (i) => {
  goals.splice(i, 1);
  await saveGoals();
  renderGoals();
};

window.removeMonthGoal = async (i) => {
  monthGoals.splice(i, 1);
  await saveMonthGoals();
  renderMonthGoals();
};

async function saveGoals() {
  await setDoc(doc(db, 'weekly_goals', currentWeekKey), { goals, updatedAt: new Date().toISOString() });
}

async function saveMonthGoals() {
  await setDoc(doc(db, 'weekly_goals', currentMonthKey), { goals: monthGoals, updatedAt: new Date().toISOString() });
}

function populatePastWeeks(curWk) {
  const sel = document.getElementById('past-week-sel');
  sel.innerHTML = '<option value="">주차 선택...</option>';
  for (let w = curWk-1; w >= Math.max(1, curWk-10); w--) {
    sel.innerHTML += `<option value="${w}">${w}주차</option>`;
  }
}

window.loadPastGoal = async () => {
  const wk = document.getElementById('past-week-sel').value;
  if (!wk) return;
  const snap = await getDoc(doc(db, 'weekly_goals', `${user.uid}_week${wk}`));
  const g = snap.exists() ? (snap.data().goals||[]) : [];
  const done = g.filter(x=>x.done).length;
  document.getElementById('past-goal-list').innerHTML = g.length
    ? `<div style="font-size:13px;color:#aaa;margin-bottom:10px">${wk}주차 달성률: <strong style="color:var(--main)">${g.length?Math.round(done/g.length*100):0}%</strong></div>`
      + g.map(x=>`<div class="goal-item ${x.done?'done':''}"><div class="chk-box ${x.done?'checked':''}"></div><div class="goal-text">${x.text}</div></div>`).join('')
    : '<div style="font-size:13px;color:#ccc;text-align:center;padding:20px">이 주차 기록이 없어요</div>';
};

// ── 내 기록 엑셀 다운로드 ──
window.downloadMyExcel = () => {
  if (!allRecords.length) { showToast('다운로드할 기록이 없어요'); return; }
  const filter = document.getElementById('rec-filter').value;
  const recs = filter ? allRecords.filter(r => r.date.startsWith(filter)) : allRecords;
  if (!recs.length) { showToast('선택한 기간에 기록이 없어요'); return; }

  const headers = [
    '날짜', '매십경', '매십면', '매십독(책제목)', '매십운(운동종류)',
    '강의(분)', '자소서(분)', '필기(분)', '면접(분)', '총취준시간(분)', '지원개수',
    '자존감(1-5)', '취업확률(%)', 'FA5050/현장방문', '집중활동'
  ];

  const rows = [...recs].reverse().map(r => [
    r.date,
    r.routineGyeong ? 'O' : 'X',
    r.routineMyeon  ? 'O' : 'X',
    r.bookTitle     || (r.routineDok ? 'O' : 'X'),
    (r.exercises && r.exercises.length) ? r.exercises.join('/') : (r.routineUn ? 'O' : 'X'),
    r.lecture       || 0,
    r.jasoseo       || 0,
    r.pilgi         || 0,
    r.interview     || 0,
    r.totalTime || ((r.lecture||0)+(r.jasoseo||0)+(r.pilgi||0)+(r.interview||0)),
    r.applications  || 0,
    r.selfEsteem    || '',
    r.jobProb       || '',
    r.fa5050 === true ? 'O' : r.fa5050 === false ? 'X' : '',
    (r.focusTags || []).join('/'),
  ]);

  const nickname = userProfile.nickname || '기록';
  const filename = filter
    ? `생존일지_${nickname}_${filter}.csv`
    : `생존일지_${nickname}_전체.csv`;

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast(`${recs.length}개 기록을 다운로드했어요 📊`);
};

// ── 로그아웃 ──
window.doLogout = async () => {
  if (confirm('로그아웃 할까요?')) { await signOut(auth); window.location.href = 'index.html'; }
};

// ── 토스트 ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}
window.showToast = showToast;

// ────────────────────────────────────────
// 프로필 수정 모달
// ────────────────────────────────────────
const THEME_PRESETS = [
  { name:'보라', color:'#534AB7' }, { name:'파랑', color:'#185FA5' },
  { name:'초록', color:'#3B6D11' }, { name:'청록', color:'#0F6E56' },
  { name:'코랄', color:'#993C1D' }, { name:'핑크', color:'#993556' },
  { name:'황색', color:'#854F0B' }, { name:'회색', color:'#5F5E5A' },
];

let pmSelectedGroupId = null;
let pmSelectedColor = null;

window.openProfile = async () => {
  const p = userProfile;
  const overlay = document.getElementById('profile-overlay');
  overlay.classList.add('open');

  // 프로필 정보 표시
  const avEl = document.getElementById('pm-avatar');
  if (user.photoURL) avEl.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else avEl.textContent = p.nickname[0];
  document.getElementById('pm-email').textContent = user.email;
  document.getElementById('pm-joined').textContent = `가입일: ${p.createdAt ? p.createdAt.slice(0,10) : '-'}`;

  // 현재 값 채우기
  document.getElementById('pm-nickname').value = p.nickname;
  document.getElementById('pm-startdate').value = p.startDate;
  document.getElementById('pm-jobprob').value = p.jobProb || '';
  pmCalcWeek();

  // 매십경/매십면 시작일 표시 여부 (프로그램 유형에 따라)
  const type = p.programType || 'careerpt';
  const showGyeong = ['careerpt','maesipgyeong','maesipboth'].includes(type);
  const showMyeon  = ['careerpt','maesipmyeon','maesipboth'].includes(type);
  document.getElementById('pm-gyeong-date-wrap').style.display = showGyeong ? '' : 'none';
  document.getElementById('pm-myeon-date-wrap').style.display  = showMyeon  ? '' : 'none';
  if (showGyeong) {
    document.getElementById('pm-gyeong-startdate').value = p.gyeongStartDate || '';
    if (p.gyeongStartDate) pmCalcProgramWeek('gyeong');
  }
  if (showMyeon) {
    document.getElementById('pm-myeon-startdate').value = p.myeonStartDate || '';
    if (p.myeonStartDate) pmCalcProgramWeek('myeon');
  }

  // 현재 테마 컬러
  pmSelectedColor = p.themeColor || '#534AB7';
  document.getElementById('pm-hex').value = pmSelectedColor;

  // 스와치 렌더
  renderSwatches(pmSelectedColor);

  // 그룹 목록 로드
  await loadPmGroups(p.groupId);
};

window.closeProfile = () => {
  document.getElementById('profile-overlay').classList.remove('open');
};

// 모달 배경 클릭 시 닫기
document.getElementById('profile-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('profile-overlay')) closeProfile();
});

function renderSwatches(currentColor) {
  const el = document.getElementById('pm-swatches');
  el.innerHTML = '';
  THEME_PRESETS.forEach(t => {
    const sw = document.createElement('div');
    sw.className = 'pm-swatch' + (t.color.toLowerCase() === currentColor.toLowerCase() ? ' on' : '');
    sw.style.background = t.color;
    sw.title = t.name;
    sw.setAttribute('aria-label', t.name);
    sw.onclick = () => {
      pmSelectedColor = t.color;
      document.getElementById('pm-hex').value = t.color;
      document.querySelectorAll('.pm-swatch').forEach(s => s.classList.remove('on'));
      sw.classList.add('on');
    };
    el.appendChild(sw);
  });
}

window.pmApplyHex = () => {
  let hex = document.getElementById('pm-hex').value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { showToast('올바른 hex 코드를 입력해주세요 (예: #FF5500)'); return; }
  pmSelectedColor = hex;
  document.querySelectorAll('.pm-swatch').forEach(s => s.classList.remove('on'));
};

window.pmCalcWeek = () => {
  const val = document.getElementById('pm-startdate').value;
  if (!val) return;
  const diff = Math.floor((new Date() - new Date(val)) / 86400000);
  const wk = Math.max(1, Math.floor(diff / 7) + 1);
  document.getElementById('pm-week-num').textContent = wk;
  document.getElementById('pm-week-preview').style.display = 'block';
};

window.pmCalcProgramWeek = (prog) => {
  const idMap = {
    gyeong: ['pm-gyeong-startdate', 'pm-gyeong-week-num', 'pm-gyeong-week-preview'],
    myeon:  ['pm-myeon-startdate',  'pm-myeon-week-num',  'pm-myeon-week-preview'],
  };
  const [inputId, numId, previewId] = idMap[prog] || [];
  if (!inputId) return;
  const val = document.getElementById(inputId).value;
  if (!val) return;
  const diff = Math.floor((new Date() - new Date(val)) / 86400000);
  document.getElementById(numId).textContent = Math.max(1, Math.floor(diff/7)+1);
  document.getElementById(previewId).style.display = 'block';
};

async function loadPmGroups(currentGroupId) {
  pmSelectedGroupId = currentGroupId;
  const listEl = document.getElementById('pm-group-list');
  listEl.innerHTML = '<div style="font-size:13px;color:#ccc;padding:8px 0">불러오는 중...</div>';
  const snap = await getDocs(collection(db, 'groups'));
  listEl.innerHTML = '';
  if (snap.empty) {
    listEl.innerHTML = '<div style="font-size:13px;color:#ccc;padding:8px 0">등록된 그룹이 없어요. 관리자에게 문의해주세요.</div>';
    return;
  }
  const groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  groups.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true }));
  groups.forEach(g => {
    const opt = document.createElement('div');
    opt.className = 'pm-group-option' + (g.id === currentGroupId ? ' selected' : '');
    opt.dataset.id = g.id;
    opt.innerHTML = `<div class="g-icon">${g.name[0]}</div><div><div class="g-name">${g.name}</div><div class="g-count">멤버 ${(g.members||[]).length}명</div></div>`;
    opt.onclick = () => {
      document.querySelectorAll('.pm-group-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      pmSelectedGroupId = g.id;
    };
    listEl.appendChild(opt);
  });
}

window.saveProfile = async () => {
  const nickname = document.getElementById('pm-nickname').value.trim();
  const startDate = document.getElementById('pm-startdate').value;
  const jobProb = Number(document.getElementById('pm-jobprob').value) || 0;
  const gyeongStartDate = document.getElementById('pm-gyeong-startdate').value || '';
  const myeonStartDate  = document.getElementById('pm-myeon-startdate').value  || '';
  if (!nickname) { showToast('닉네임을 입력해주세요'); return; }
  if (!startDate) { showToast('참여 시작일을 선택해주세요'); return; }
  if (!pmSelectedGroupId) { showToast('그룹을 선택해주세요'); return; }

  const btn = document.getElementById('pm-save-btn');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    const color = pmSelectedColor || userProfile.themeColor || '#534AB7';
    await setDoc(doc(db, 'users', user.uid), {
      ...userProfile,
      nickname,
      startDate,
      gyeongStartDate,
      myeonStartDate,
      jobProb,
      groupId: pmSelectedGroupId,
      themeColor: color,
    });

    userProfile = { ...userProfile, nickname, startDate, gyeongStartDate, myeonStartDate, jobProb, groupId: pmSelectedGroupId, themeColor: color };
    applyTheme(color);
    initHeader();
    document.getElementById('f-nickname').value = nickname;

    closeProfile();
    showToast('프로필이 업데이트됐어요! 🎉');
  } catch(e) {
    showToast('저장 중 오류가 발생했어요');
    console.error(e);
  }
  btn.disabled = false; btn.textContent = '변경사항 저장';
};
