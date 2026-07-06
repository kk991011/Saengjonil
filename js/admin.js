
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
  renderGroups();
  renderUsers();
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

// 유저의 소속 조 목록 (groupIds 배열 / 구 단일 groupId 호환)
const groupIdsOf = (u) => Array.isArray(u.groupIds) ? u.groupIds : (u.groupId ? [u.groupId] : []);

// ── 그룹 렌더 ──
function renderGroups() {
  const el = document.getElementById('group-list');
  if (!allGroups.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc;font-size:14px">그룹이 없어요. 위 버튼으로 추가해주세요.</div>';
    return;
  }
  el.innerHTML = allGroups.map(g => {
    const members = allUsers.filter(u => groupIdsOf(u).includes(g.id));
    const leaders = new Set(g.leaderUids || []);
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
          `<div class="member-chip">${leaders.has(m.uid) ? '<span style="font-size:9px;font-weight:700;color:#fff;background:var(--main);padding:1px 5px;border-radius:5px;margin-right:4px">조장</span>' : ''}${m.nickname}
            <button class="remove-btn" onclick="removeMemberFromGroup('${m.uid}','${g.id}')" title="그룹에서 제거">×</button>
          </div>`).join('') : '<span style="font-size:12px;color:#ccc">멤버 없음</span>'}
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

function renderUsers(search='') {
  const groupMap = {};
  allGroups.forEach(g => { groupMap[g.id] = g.name; });
  const leaderSet = new Set(allGroups.flatMap(g => g.leaderUids || []));
  const filtered = search ? allUsers.filter(u =>
    u.nickname?.includes(search) || u.email?.includes(search)) : allUsers;
  const lastRecMap = {};
  allRecords.forEach(r => {
    if (!lastRecMap[r.uid] || r.date > lastRecMap[r.uid]) lastRecMap[r.uid] = r.date;
  });
  const groupChips = (u) => {
    const names = groupIdsOf(u).map(id => groupMap[id]).filter(Boolean);
    if (!names.length) return '<span style="background:#f0f0f0;color:#aaa;padding:2px 8px;border-radius:6px;font-size:11px">미배정</span>';
    return names.map(n => `<span style="background:var(--main-light);color:var(--main-dark);padding:2px 8px;border-radius:6px;font-size:11px;margin-right:3px">${n}</span>`).join('');
  };
  document.getElementById('user-table-body').innerHTML = filtered.map(u => `
    <tr>
      <td><div class="user-avatar">${u.photoURL ? `<img src="${u.photoURL}">` : (u.nickname?.[0]||'?')}</div></td>
      <td style="font-weight:500">${u.nickname||'-'}${leaderSet.has(u.uid) ? ' <span style="font-size:10px;font-weight:700;color:#fff;background:var(--main);padding:1px 6px;border-radius:6px">조장</span>' : ''}</td>
      <td style="font-size:12px;color:#aaa">${u.email||'-'}</td>
      <td>${groupChips(u)}</td>
      <td style="font-size:12px;color:#aaa">${u.startDate ? calcWeek(u.startDate)+'주차' : '-'}</td>
      <td style="font-size:12px;color:#aaa">${lastRecMap[u.uid]||'없음'}</td>
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
    renderGroups();
    showToast(`"${name}" 그룹이 만들어졌어요!`);
  } catch(e) { showToast('오류가 발생했어요'); console.error(e); }
};

// ── 그룹 수정 ──
window.openEditGroup = (id, name) => {
  document.getElementById('edit-group-id').value = id;
  document.getElementById('edit-group-name').value = name;
  document.getElementById('edit-group-title').textContent = `"${name}" 수정`;
  // 조장 지정 — 이 조의 조원 체크리스트 (현재 groups.leaderUids 반영)
  const g = allGroups.find(x => x.id === id);
  const leaders = new Set(g?.leaderUids || []);
  const members = allUsers.filter(u => groupIdsOf(u).includes(id));
  const listEl = document.getElementById('edit-group-leaders');
  listEl.innerHTML = members.length
    ? members.map(m => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" class="leader-check" data-uid="${m.uid}" ${leaders.has(m.uid) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
        <span>${m.nickname || '-'}</span>
      </label>`).join('')
    : '<div style="font-size:12px;color:#ccc">조원이 없어요</div>';
  openModal('edit-group-modal');
};

window.saveGroupEdit = async () => {
  const id = document.getElementById('edit-group-id').value;
  const name = document.getElementById('edit-group-name').value.trim();
  if (!name) { showToast('그룹 이름을 입력해주세요'); return; }
  // 조장 = 체크된 조원 uid 목록을 그 조 문서(groups.leaderUids)에 저장
  const leaderUids = [...document.querySelectorAll('#edit-group-leaders .leader-check:checked')].map(c => c.dataset.uid);
  try {
    await updateDoc(doc(db, 'groups', id), { name, leaderUids });
    const g = allGroups.find(x=>x.id===id);
    if (g) { g.name = name; g.leaderUids = leaderUids; }
    closeModal('edit-group-modal');
    renderGroups();
    renderUsers();
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
    renderGroups();
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
    // 그 조의 조장이었다면 leaderUids에서도 제거
    if (g && (g.leaderUids || []).includes(uid)) {
      const newLeaders = g.leaderUids.filter(x => x !== uid);
      await updateDoc(doc(db, 'groups', gid), { leaderUids: newLeaders });
      g.leaderUids = newLeaders;
    }
    renderGroups();
    renderUsers();
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
  const apps = recs.reduce((a,r)=>a+(r.applications||0),0);
  const moodAvg = (() => {
    const m = recs.filter(r=>r.selfEsteem>0);
    return m.length ? (m.reduce((a,r)=>a+r.selfEsteem,0)/m.length).toFixed(1) : '-';
  })();

  const content = document.getElementById('user-detail-content');

  if (!n) {
    content.innerHTML = `<div style="text-align:center;padding:30px;color:#ccc;font-size:14px">선택한 기간에 기록이 없어요</div>`;
    return;
  }

  content.innerHTML = `
    <div class="stat-row" style="margin-bottom:18px">
      <div class="stat-box"><div class="num">${n}</div><div class="lbl">기록일</div></div>
      <div class="stat-box"><div class="num">${apps}</div><div class="lbl">지원개수</div></div>
      <div class="stat-box"><div class="num">${moodAvg}</div><div class="lbl">평균 자존감</div></div>
      <div class="stat-box"><div class="num">${avg('lecture')}</div><div class="lbl">강의(분/일)</div></div>
    </div>
    <div class="sec-label">루틴 달성률</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px">
      ${[
        ['gyeong_article','매십경·기사읽기'],['gyeong_opinion','매십경·오피니언'],['gyeong_comment','매십경·댓글'],
        ['myeon_am','매십면·오전'],['myeon_pm','매십면·오후'],['myeon_feedback','매십면·피드백'],
        ['routineDok','매십독'],['routineUn','매십운'],['fa5050','FA5050/현장방문'],
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
    </div>
    <div class="sec-label">일별 기록 (${n}개)</div>
    <div style="max-height:280px;overflow-y:auto;border:1px solid #f0f0f0;border-radius:10px">
      <table class="user-table" style="font-size:12px">
        <thead><tr>
          <th>날짜</th><th>경</th><th>면</th><th>독</th><th>운</th><th>FA</th>
          <th>강의</th><th>자소서</th><th>지원</th><th>자존감</th>
        </tr></thead>
        <tbody>
          ${recs.map(r => `
            <tr>
              <td>${r.date}</td>
              <td>${r.routineGyeong?'✓':'-'}</td>
              <td>${r.routineMyeon?'✓':'-'}</td>
              <td>${r.bookTitle || (r.routineDok?'✓':'-')}</td>
              <td>${(r.exercises&&r.exercises.length)?r.exercises.join('/'):(r.routineUn?'✓':'-')}</td>
              <td>${r.fa5050===true?'✓':r.fa5050===false?'X':'-'}</td>
              <td>${r.lecture||0}</td>
              <td>${r.jasoseo||0}</td>
              <td>${r.applications||0}</td>
              <td>${r.selfEsteem||'-'}</td>
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
    renderGroups();
    renderUsers();
    showToast(`"${u.nickname}" 회원이 삭제됐어요`);
  } catch(e) { showToast('삭제 중 오류가 발생했어요'); console.error(e); }
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
