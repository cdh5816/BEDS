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

function setCurrentUser(user) {
  if (!user) localStorage.removeItem('bedsUser');
  else localStorage.setItem('bedsUser', JSON.stringify(user));
}

function fmtCoord(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(6);
}

// /api/sites 응답이 {sites:[...]} 또는 [...] 둘 다 받기
function normalizeSitesResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sites)) return data.sites;
  return [];
}

// ✅ 현장조건 라벨
function statusLabel(status) {
  if (status === 'SAFE') return '납품현장';
  if (status === 'CAUTION') return '공사중 현장';
  if (status === 'ALERT') return '영업중 현장';
  return status || 'SAFE';
}

// ✅ 배지에 찍힐 텍스트(코드값 SAFE/CAUTION/ALERT 노출 방지)
function statusCodeLabel(status) {
  if (status === 'SAFE') return '납품현장';
  if (status === 'CAUTION') return '공사중';
  if (status === 'ALERT') return '영업중';
  return status || '납품현장';
}

function statusBadgeClass(status) {
  if (status === 'ALERT') return 'badge badge-alert';
  if (status === 'CAUTION') return 'badge badge-caution';
  return 'badge badge-safe';
}

function constructionLabel(v) {
  if (v === 'IN_PROGRESS') return '공사 진행 중';
  if (v === 'DONE') return '공사 완료';
  // 기존 데이터 호환
  return v ? String(v) : '공사 진행 중';
}

// ✅ 공사상태 필드 통일: 새 필드 constructionState 우선
function getConstructionState(site) {
  return site?.constructionState ?? site?.constructionStatus ?? site?.construction_state ?? null;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  const loginToggle = document.getElementById('login-toggle');
  const loginPanel = document.getElementById('login-panel');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const dashboardBtn = document.getElementById('landing-dashboard');
  const logoutBtn = document.getElementById('landing-logout');

  function syncLoginOpenClass() {
    const isOpen = !!(loginPanel && loginPanel.classList.contains('open'));
    document.body.classList.toggle('login-open', isOpen);
  }
  function closeLoginPanel() {
    if (loginPanel) loginPanel.classList.remove('open');
    syncLoginOpenClass();
  }

  function updateHeaderForUser() {
    const user = getCurrentUser();
    if (!user) {
      if (dashboardBtn) dashboardBtn.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      if (loginToggle) loginToggle.classList.remove('hidden');
      return;
    }
    if (loginToggle) loginToggle.classList.add('hidden');
    if (dashboardBtn) {
      dashboardBtn.classList.remove('hidden');
      dashboardBtn.textContent = user.role === 'ADMIN' ? '관리자 콘솔' : '모니터링';
    }
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  }

  updateHeaderForUser();
  syncLoginOpenClass();

  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) return;
      window.location.href = user.role === 'ADMIN' ? 'admin.html' : 'client.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUser(null);
      document.body.classList.remove('login-open');
      window.location.href = 'index.html';
    });
  }

  if (loginToggle && loginPanel) {
    loginToggle.addEventListener('click', () => {
      loginPanel.classList.toggle('open');
      syncLoginOpenClass();
    });
  }

  document.addEventListener('click', (e) => {
    if (!loginPanel || !loginToggle) return;
    const t = e.target;
    const clickedInsidePanel = loginPanel.contains(t);
    const clickedToggle = loginToggle.contains(t);
    if (!clickedInsidePanel && !clickedToggle) closeLoginPanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLoginPanel();
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = '';

      const idEl = document.getElementById('login-id');
      const pwEl = document.getElementById('login-password');
      const username = (idEl?.value || '').trim();
      const password = pwEl?.value || '';

      if (!username || !password) {
        if (loginError) loginError.textContent = 'ID와 비밀번호를 입력해 주세요.';
        return;
      }

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
          if (loginError) loginError.textContent = '로그인에 실패했습니다.';
          return;
        }

        const data = await res.json();
        if (!data || !data.ok) {
          if (loginError) loginError.textContent = data.message || 'ID 또는 비밀번호를 확인해 주세요.';
          return;
        }

        setCurrentUser({
          username: data.username,
          role: data.role,
          siteIds: data.siteIds || []
        });

        closeLoginPanel();
        window.location.href = data.role === 'ADMIN' ? 'admin.html' : 'client.html';
      } catch (err) {
        console.error(err);
        if (loginError) loginError.textContent = '서버와 통신 중 오류가 발생했습니다.';
      }
    });
  }

  // =========================
  // Landing map
  // =========================
  const mapEl = document.getElementById('landing-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('landing-map').setView([37.5665, 126.9780], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // =========================
  // Modal
  // =========================
  const modalEl = document.getElementById('site-modal');
  const modalBackdrop = document.getElementById('site-modal-backdrop');
  const modalClose = document.getElementById('site-modal-close');

  const modalTitle = document.getElementById('site-modal-title');
  const modalAddress = document.getElementById('site-modal-address');
  const modalStatus = document.getElementById('site-modal-status');
  const modalConstruction = document.getElementById('site-modal-construction');
  const modalSensors = document.getElementById('site-modal-sensors'); // ✅ 공사일정 표시로 사용
  const modalSize = document.getElementById('site-modal-size');
  const modalYear = document.getElementById('site-modal-year');       // ✅ 실정보고 진행 상황 표시로 사용
  const modalNotes = document.getElementById('site-modal-notes');

  const modalPan = document.getElementById('site-modal-pan');
  const modalCopy = document.getElementById('site-modal-copy');

  let modalSite = null;

  function openModal(site) {
    if (!modalEl) return;
    modalSite = site || null;

    if (modalTitle) modalTitle.textContent = site?.name || '-';
    if (modalAddress) modalAddress.textContent = site?.address || '-';

    // ✅ "현장조건" 값 표시 (SAFE/CAUTION/ALERT 코드 노출 X)
    if (modalStatus) modalStatus.textContent = statusLabel(site?.status);

    const c = getConstructionState(site);
    if (modalConstruction) modalConstruction.textContent = constructionLabel(c);

    // ✅ 기존 sensorCount / buildingYear 필드를 "공사일정 / 실정보고 진행 상황"으로만 표시(필드명은 그대로 사용)
    if (modalSensors) modalSensors.textContent = `${site?.sensorCount ?? 0}`;
    if (modalSize) modalSize.textContent = site?.buildingSize || '-';
    if (modalYear) modalYear.textContent = site?.buildingYear || '-';
    if (modalNotes) modalNotes.textContent = site?.notes ? site.notes : '-';

    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
    modalSite = null;
    document.body.classList.remove('modal-open');
  }

  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if (modalPan) {
    modalPan.addEventListener('click', () => {
      if (!modalSite) return;
      const lat = modalSite.latitude;
      const lon = modalSite.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.setView([lat, lon], 16, { animate: true });
    });
  }

  if (modalCopy) {
    modalCopy.addEventListener('click', async () => {
      if (!modalSite) return;
      const lat = modalSite.latitude;
      const lon = modalSite.longitude;

      const coordText = (Number.isFinite(lat) && Number.isFinite(lon)) ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
      const text = `${modalSite.name || ''}\n${modalSite.address || ''}\n${coordText}`;

      try {
        await navigator.clipboard.writeText(text);
        alert('복사 완료!');
      } catch (e) {
        prompt('아래 내용을 복사하세요:', text);
      }
    });
  }

  // =========================
  // Sites + markers
  // =========================
  const siteListEl = document.getElementById('landing-site-list');          // 왼쪽: 진행중 요약
  const inprogressListEl = document.getElementById('inprogress-site-list'); // 오른쪽: 진행중 카드
  const inprogressEmptyEl = document.getElementById('inprogress-empty');

  const siteMarkers = new Map(); // id -> marker
  let sitesCache = [];

  function upsertMarkers(allSites) {
    const bounds = [];

    allSites.forEach((s) => {
      const lat = s.latitude;
      const lon = s.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      // ✅ 팝업에서도 상태코드 노출 X
      const popupHtml = `
        <div style="min-width:240px">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.name || '')}</div>
          <div style="font-size:12px;color:#cbd5e1">${escapeHtml(s.address || '')}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">
            현장조건: ${escapeHtml(statusLabel(s.status))}
          </div>
        </div>
      `;

      let mk = siteMarkers.get(s.id);
      if (!mk) {
        mk = L.marker([lat, lon]).addTo(map);
        mk.bindPopup(popupHtml);
        siteMarkers.set(s.id, mk);
      } else {
        mk.setLatLng([lat, lon]);
        mk.setPopupContent(popupHtml);
      }

      mk.off('click');
      mk.on('click', () => openModal(s));

      bounds.push([lat, lon]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  function goSite(site) {
    if (!site) return;
    const lat = site.latitude;
    const lon = site.longitude;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.setView([lat, lon], 16, { animate: true });
      const mk = siteMarkers.get(site.id);
      if (mk) mk.openPopup();
    }

    openModal(site);
  }

  function renderInProgressLeftList(inProgress) {
    if (!siteListEl) return;

    if (!inProgress.length) {
      siteListEl.innerHTML = '<p>현재 “공사 진행 중” 현장이 없습니다.</p>';
      return;
    }

    siteListEl.innerHTML = inProgress.map((s) => {
      const status = s.status || 'SAFE';
      const badgeClass = statusBadgeClass(status);

      return `
        <button type="button"
                class="site-item w-full text-left"
                data-site-id="${escapeHtml(s.id)}">
          <div class="site-item-main">
            <span class="site-item-name">${escapeHtml(s.name || '')}</span>
            <span class="site-item-address">${escapeHtml(s.address || '')}</span>
          </div>
          <span class="${badgeClass}">${escapeHtml(statusCodeLabel(status))}</span>
        </button>
      `;
    }).join('');

    if (!siteListEl.__boundClick) {
      siteListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-site-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-site-id');
        const site = sitesCache.find((x) => String(x.id) === String(id));
        if (!site) return;
        goSite(site);
      });
      siteListEl.__boundClick = true;
    }
  }

  function renderInProgressRightCards(inProgress) {
    if (!inprogressListEl) return;

    if (!inProgress.length) {
      inprogressListEl.innerHTML = '';
      if (inprogressEmptyEl) inprogressEmptyEl.classList.remove('hidden');
      return;
    }
    if (inprogressEmptyEl) inprogressEmptyEl.classList.add('hidden');

    inprogressListEl.innerHTML = inProgress.map((s) => {
      const status = s.status || 'SAFE';
      const badgeClass = statusBadgeClass(status);
      const c = getConstructionState(s);

      return `
        <button type="button"
                class="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/60 p-3 hover:bg-slate-900/40 transition"
                data-site-id="${escapeHtml(s.id)}">
          <div class="flex items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-100">${escapeHtml(s.name || '')}</div>
            <span class="${badgeClass}">${escapeHtml(statusCodeLabel(status))}</span>
          </div>
          <div class="mt-1 text-xs text-slate-400">${escapeHtml(s.address || '')}</div>
          <div class="mt-2 text-[11px] text-slate-400">
            <span class="mr-2">공사: ${escapeHtml(constructionLabel(c))}</span>
            <span class="mr-2">공사일정: ${escapeHtml(String(s.sensorCount ?? 0))}</span>
          </div>
        </button>
      `;
    }).join('');

    if (!inprogressListEl.__boundClick) {
      inprogressListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-site-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-site-id');
        const site = sitesCache.find((x) => String(x.id) === String(id));
        if (!site) return;
        goSite(site);
      });
      inprogressListEl.__boundClick = true;
    }
  }

  function isInProgress(site) {
    const v = getConstructionState(site);
    if (!v) return true; // 호환: 없으면 진행중으로 간주
    return String(v) === 'IN_PROGRESS';
  }

  fetch('/api/sites')
    .then((res) => res.json())
    .then((data) => {
      const sites = normalizeSitesResponse(data);
      sitesCache = sites;

      // 지도에는 전체 표시(마커 클릭 시 모달)
      upsertMarkers(sites);

      // 메인(좌/우)은 진행중만
      const inProgress = sites.filter(isInProgress);
      renderInProgressLeftList(inProgress);
      renderInProgressRightCards(inProgress);
    })
    .catch((err) => {
      console.error(err);
      if (siteListEl) siteListEl.innerHTML = '<p>현장 정보를 불러오는 중 오류가 발생했습니다.</p>';
      if (inprogressListEl) inprogressListEl.innerHTML = '';
      if (inprogressEmptyEl) inprogressEmptyEl.classList.remove('hidden');
    });
});
