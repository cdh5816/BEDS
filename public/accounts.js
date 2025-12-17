// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('bedsUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function ensureAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    window.location.href = 'index.html';
  }
  return user;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normSitesResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sites)) return data.sites;
  return [];
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAdmin();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bedsUser');
      window.location.href = 'index.html';
    });
  }

  // LEFT
  const userForm = document.getElementById('user-form');
  const userFormMsg = document.getElementById('user-form-message');
  const userSitesCreate = document.getElementById('user-sites-create');

  const userListEl = document.getElementById('user-list');
  const usersSummaryEl = document.getElementById('users-summary');
  const userSearchEl = document.getElementById('user-search');
  const userFilterEl = document.getElementById('user-filter');

  // RIGHT
  const detailEmpty = document.getElementById('detail-empty');
  const detailPanel = document.getElementById('detail-panel');
  const selectedUserBadge = document.getElementById('selected-user-badge');

  const kpiSites = document.getElementById('kpi-sites');
  const kpiInprogress = document.getElementById('kpi-inprogress');
  const kpiAlert = document.getElementById('kpi-alert');

  const siteSearchEl = document.getElementById('site-search');
  const siteChecklistEl = document.getElementById('site-checklist');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnSaveSites = document.getElementById('btn-save-sites');
  const btnDeleteUser = document.getElementById('btn-delete-user');
  const saveMessage = document.getElementById('save-message');

  let sites = [];
  let users = [];

  let selectedUser = null;           // {id, username, role, siteIds}
  let workingSiteIds = new Set();    // 체크 UI 작업용
  let baselineSiteIds = new Set();   // 저장 기준 비교용

  function setMsg(el, text, tone = 'muted') {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-message ' + (tone === 'ok' ? 'msg-ok' : tone === 'bad' ? 'msg-bad' : '');
  }

  function isInProgress(site) {
    const v = site?.constructionStatus ?? site?.construction_state;
    if (!v) return true; // 기존 데이터 호환
    return String(v) === 'IN_PROGRESS';
  }

  function updateSaveButtonState() {
    if (!btnSaveSites) return;
    const a = Array.from(workingSiteIds).sort().join('|');
    const b = Array.from(baselineSiteIds).sort().join('|');
    const changed = a !== b;
    btnSaveSites.disabled = !selectedUser || !changed;
  }

  function openUser(u) {
    selectedUser = u;
    baselineSiteIds = new Set(Array.isArray(u.siteIds) ? u.siteIds : []);
    workingSiteIds = new Set(Array.isArray(u.siteIds) ? u.siteIds : []);

    if (selectedUserBadge) selectedUserBadge.textContent = `선택: ${u.username}`;
    if (detailEmpty) detailEmpty.classList.add('hidden');
    if (detailPanel) detailPanel.classList.remove('hidden');

    setMsg(saveMessage, '');

    renderChecklist();   // 체크리스트 재그림
    renderKPIs();
    updateSaveButtonState();
    renderUsers();       // 좌측 active 표시 갱신
  }

  function closeUser() {
    selectedUser = null;
    baselineSiteIds = new Set();
    workingSiteIds = new Set();

    if (selectedUserBadge) selectedUserBadge.textContent = '선택: 없음';
    if (detailEmpty) detailEmpty.classList.remove('hidden');
    if (detailPanel) detailPanel.classList.add('hidden');

    setMsg(saveMessage, '');
    updateSaveButtonState();
    renderUsers();
  }

  function renderKPIs() {
    if (!selectedUser) return;

    const assigned = new Set(Array.isArray(selectedUser.siteIds) ? selectedUser.siteIds : []);
    const assignedSites = sites.filter(s => assigned.has(s.id));

    const inprog = assignedSites.filter(isInProgress).length;
    const alert = assignedSites.filter(s => (s.status || 'SAFE') === 'ALERT').length;

    if (kpiSites) kpiSites.textContent = String(workingSiteIds.size);
    if (kpiInprogress) kpiInprogress.textContent = String(inprog);
    if (kpiAlert) kpiAlert.textContent = String(alert);
  }

  function renderCreateSiteOptions() {
    if (!userSitesCreate) return;
    userSitesCreate.innerHTML = '';
    sites.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      userSitesCreate.appendChild(opt);
    });
  }

  function filteredUsers() {
    const q = (userSearchEl?.value || '').trim().toLowerCase();
    const f = userFilterEl?.value || 'ALL';

    return users
      .filter(u => u.role !== 'ADMIN')
      .filter(u => {
        if (q && !String(u.username || '').toLowerCase().includes(q)) return false;
        const has = Array.isArray(u.siteIds) && u.siteIds.length > 0;
        if (f === 'HAS_SITES' && !has) return false;
        if (f === 'NO_SITES' && has) return false;
        return true;
      });
  }

  function renderUsers() {
    if (!userListEl) return;

    const list = filteredUsers();
    if (usersSummaryEl) {
      const total = users.filter(u => u.role !== 'ADMIN').length;
      usersSummaryEl.textContent = `총 ${total}명 / 결과 ${list.length}명`;
    }

    userListEl.innerHTML = '';
    if (!list.length) {
      userListEl.innerHTML = '<p class="text-xs text-slate-400">표시할 고객 계정이 없습니다.</p>';
      return;
    }

    list.forEach((u) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'user-card beds-user-card' + (selectedUser && selectedUser.id === u.id ? ' beds-user-card-active' : '');
      card.setAttribute('data-user-id', u.id);

      const assignedNames = (Array.isArray(u.siteIds) ? u.siteIds : [])
        .map((id) => {
          const s = sites.find((x) => x.id === id);
          return s ? s.name : id;
        });

      const assignedLine = assignedNames.length
        ? `현장 ${assignedNames.length}개 · ${assignedNames.slice(0, 2).join(', ')}${assignedNames.length > 2 ? '…' : ''}`
        : '연결된 현장이 없습니다';

      card.innerHTML = `
        <div class="user-card-header">
          <span class="user-card-id">${escapeHtml(u.username)}</span>
          <span class="user-card-role">고객</span>
        </div>
        <div class="user-card-sites">${escapeHtml(assignedLine)}</div>
      `;

      card.addEventListener('click', () => openUser(u));
      userListEl.appendChild(card);
    });
  }

  function renderChecklist() {
    if (!siteChecklistEl) return;

    const q = (siteSearchEl?.value || '').trim().toLowerCase();

    const view = sites.filter((s) => {
      if (!q) return true;
      const name = String(s.name || '').toLowerCase();
      const addr = String(s.address || '').toLowerCase();
      return name.includes(q) || addr.includes(q);
    });

    if (!view.length) {
      siteChecklistEl.innerHTML = '<div class="text-xs text-slate-400">검색 결과가 없습니다.</div>';
      return;
    }

    siteChecklistEl.innerHTML = view.map((s) => {
      const checked = workingSiteIds.has(s.id) ? 'checked' : '';
      const status = s.status || 'SAFE';
      const badge =
        status === 'ALERT' ? 'badge badge-alert' :
        status === 'CAUTION' ? 'badge badge-caution' : 'badge badge-safe';

      return `
        <label class="beds-checkitem">
          <input class="beds-check" type="checkbox" data-site-id="${escapeHtml(s.id)}" ${checked} />
          <div class="beds-checkmeta">
            <div class="beds-checktitle">
              <span>${escapeHtml(s.name || s.id)}</span>
              <span class="${badge}">${escapeHtml(status)}</span>
            </div>
            <div class="beds-checksub">${escapeHtml(s.address || '')}</div>
          </div>
        </label>
      `;
    }).join('');

    // 이벤트 위임 (한 번만)
    if (!siteChecklistEl.__bound) {
      siteChecklistEl.addEventListener('change', (e) => {
        const el = e.target;
        if (!el || el.tagName !== 'INPUT') return;
        const id = el.getAttribute('data-site-id');
        if (!id) return;

        if (el.checked) workingSiteIds.add(id);
        else workingSiteIds.delete(id);

        if (kpiSites) kpiSites.textContent = String(workingSiteIds.size);
        updateSaveButtonState();
      });
      siteChecklistEl.__bound = true;
    }
  }

  async function loadSites() {
    const res = await fetch('/api/sites');
    const data = await res.json().catch(() => null);
    sites = normSitesResponse(data);
    renderCreateSiteOptions();
  }

  async function loadUsers() {
    const res = await fetch('/api/users');
    const data = await res.json().catch(() => null);
    users = data && Array.isArray(data.users) ? data.users : [];

    // 선택 유지(있으면)
    if (selectedUser) {
      const fresh = users.find(u => u.id === selectedUser.id);
      if (fresh) {
        selectedUser = fresh;
        baselineSiteIds = new Set(Array.isArray(fresh.siteIds) ? fresh.siteIds : []);
        // working은 유지(사용자가 체크 변경 중일 수 있음) -> 다만 유저가 삭제되면 닫기
      } else {
        closeUser();
      }
    }

    renderUsers();
    renderKPIs();
    updateSaveButtonState();
  }

  // 생성 폼
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMsg(userFormMsg, '');

      const usernameEl = document.getElementById('user-username');
      const passwordEl = document.getElementById('user-password');
      const username = (usernameEl?.value || '').trim();
      const password = passwordEl?.value || '';

      if (!username || !password) {
        setMsg(userFormMsg, 'ID와 비밀번호를 입력해 주세요.', 'bad');
        return;
      }

      const selectedSiteIds = userSitesCreate
        ? Array.from(userSitesCreate.selectedOptions).map(opt => opt.value)
        : [];

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role: 'CLIENT', siteIds: selectedSiteIds })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setMsg(userFormMsg, data.message || '계정 생성에 실패했습니다.', 'bad');
          return;
        }

        userForm.reset();
        setMsg(userFormMsg, '계정이 생성되었습니다.', 'ok');
        await loadUsers();
      } catch (err) {
        console.error(err);
        setMsg(userFormMsg, '서버 오류로 계정 생성에 실패했습니다.', 'bad');
      }
    });
  }

  // 좌측 검색/필터
  if (userSearchEl) userSearchEl.addEventListener('input', renderUsers);
  if (userFilterEl) userFilterEl.addEventListener('change', renderUsers);

  // 우측 검색
  if (siteSearchEl) siteSearchEl.addEventListener('input', renderChecklist);

  // 전체 선택/해제
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      sites.forEach(s => workingSiteIds.add(s.id));
      renderChecklist();
      if (kpiSites) kpiSites.textContent = String(workingSiteIds.size);
      updateSaveButtonState();
    });
  }
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      workingSiteIds = new Set();
      renderChecklist();
      if (kpiSites) kpiSites.textContent = '0';
      updateSaveButtonState();
    });
  }

  // 저장(핵심)
  if (btnSaveSites) {
    btnSaveSites.addEventListener('click', async () => {
      if (!selectedUser) return;

      setMsg(saveMessage, '저장 중...', 'muted');
      btnSaveSites.disabled = true;

      const siteIds = Array.from(workingSiteIds);

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(selectedUser.id)}/sites`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteIds })
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          setMsg(saveMessage, json.message || '저장에 실패했습니다.', 'bad');
          updateSaveButtonState();
          return;
        }

        // 로컬 상태 동기화
        baselineSiteIds = new Set(siteIds);
        selectedUser.siteIds = siteIds;

        // users 배열에도 반영
        users = users.map(u => u.id === selectedUser.id ? { ...u, siteIds } : u);

        setMsg(saveMessage, '저장 완료!', 'ok');
        renderUsers();
        renderKPIs();
        updateSaveButtonState();
      } catch (err) {
        console.error(err);
        setMsg(saveMessage, '서버 오류로 저장에 실패했습니다.', 'bad');
        updateSaveButtonState();
      }
    });
  }

  // 선택 유저 삭제
  if (btnDeleteUser) {
    btnDeleteUser.addEventListener('click', async () => {
      if (!selectedUser) return;
      if (!confirm(`정말로 계정 "${selectedUser.username}"을(를) 삭제하시겠습니까?`)) return;

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(selectedUser.id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setMsg(saveMessage, data.message || '계정 삭제에 실패했습니다.', 'bad');
          return;
        }
        closeUser();
        await loadUsers();
      } catch (err) {
        console.error(err);
        setMsg(saveMessage, '서버 오류로 계정 삭제에 실패했습니다.', 'bad');
      }
    });
  }

  // 초기 로드
  (async () => {
    try {
      await loadSites();
      await loadUsers();
      // 첫 고객 자동 선택(있으면)
      const first = users.find(u => u.role !== 'ADMIN');
      if (first) openUser(first);
    } catch (e) {
      console.error(e);
    }
  })();
});
