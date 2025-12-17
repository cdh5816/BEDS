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

function statusLabel(status) {
  if (status === 'SAFE') return '안전';
  if (status === 'CAUTION') return '위험';
  if (status === 'ALERT') return '경고';
  return status || 'SAFE';
}
function statusBadgeClass(status) {
  if (status === 'ALERT') return 'badge badge-alert';
  if (status === 'CAUTION') return 'badge badge-caution';
  return 'badge badge-safe';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginToggle = document.getElementById('login-toggle');
  const loginPanel = document.getElementById('login-panel');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const dashboardBtn = document.getElementById('landing-dashboard');
  const logoutBtn = document.getElementById('landing-logout');

  // ===== helper: body class toggle (mobile touch fix) =====
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

  // 패널 바깥 클릭 -> 닫기
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
  // Landing map & site list
  // =========================
  const mapEl = document.getElementById('landing-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('landing-map').setView([37.5665, 126.9780], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const siteListEl = document.getElementById('landing-site-list');

  // =========================
  // Pick exact location (click/drag)
  // =========================
  const pickCoordsEl = document.getElementById('pick-coords');
  const pickAddressEl = document.getElementById('pick-address');
  const pickCopyBtn = document.getElementById('pick-copy');
  const pickClearBtn = document.getElementById('pick-clear');

  let pickedLat = null;
  let pickedLon = null;
  let pickedAddress = null;

  function updatePickUI(lat, lon, addressText) {
    const coordText = lat != null && lon != null ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
    if (pickCoordsEl) pickCoordsEl.textContent = coordText;
    if (pickAddressEl) pickAddressEl.textContent = addressText || '-';
  }

  async function reverseGeocode(lat, lon) {
    // 서버에 /api/reverse 가 있으면 가장 안정적
    try {
      const r = await fetch(`/api/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      if (!r.ok) return null;
      const data = await r.json().catch(() => null);
      return data?.address || null;
    } catch (e) {
      return null;
    }
  }

  async function setPicked(lat, lon) {
    pickedLat = lat;
    pickedLon = lon;
    pickedAddress = null;

    updatePickUI(lat, lon, '주소 조회 중...');
    const addr = await reverseGeocode(lat, lon);
    pickedAddress = addr || null;
    updatePickUI(lat, lon, pickedAddress || '(주소를 찾지 못했습니다)');
  }

  if (pickCopyBtn) {
    pickCopyBtn.addEventListener('click', async () => {
      if (pickedLat == null || pickedLon == null) {
        alert('먼저 지도에서 위치를 클릭해 주세요.');
        return;
      }
      const coordText = `${fmtCoord(pickedLat)}, ${fmtCoord(pickedLon)}`;
      const text = pickedAddress ? `${pickedAddress}\n${coordText}` : coordText;

      try {
        await navigator.clipboard.writeText(text);
        alert('복사 완료!');
      } catch (e) {
        prompt('아래 내용을 복사하세요:', text);
      }
    });
  }

  let pickMarker = null;

  if (pickClearBtn) {
    pickClearBtn.addEventListener('click', () => {
      if (pickMarker) {
        map.removeLayer(pickMarker);
        pickMarker = null;
      }
      pickedLat = pickedLon = null;
      pickedAddress = null;
      updatePickUI(null, null, null);
    });
  }

  map.on('click', async (e) => {
    // 로그인 패널 열린 상태면 지도 클릭 무시
    if (document.body.classList.contains('login-open')) return;

    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    if (!pickMarker) {
      pickMarker = L.marker([lat, lon], { draggable: true }).addTo(map);
      pickMarker.on('dragend', async () => {
        const p = pickMarker.getLatLng();
        await setPicked(p.lat, p.lng);
      });
    } else {
      pickMarker.setLatLng([lat, lon]);
    }

    await setPicked(lat, lon);
  });

  updatePickUI(null, null, null);

  // =========================
  // Site modal (if exists)
  // =========================
  const modalEl = document.getElementById('site-modal');
  const modalBackdrop = document.getElementById('site-modal-backdrop');
  const modalClose = document.getElementById('site-modal-close');

  const modalTitle = document.getElementById('site-modal-title');
  const modalAddress = document.getElementById('site-modal-address');
  const modalStatus = document.getElementById('site-modal-status');
  const modalSensors = document.getElementById('site-modal-sensors');
  const modalSize = document.getElementById('site-modal-size');
  const modalYear = document.getElementById('site-modal-year');
  const modalCoords = document.getElementById('site-modal-coords');
  const modalNotes = document.getElementById('site-modal-notes');

  const modalPan = document.getElementById('site-modal-pan');
  const modalCopy = document.getElementById('site-modal-copy');

  let modalSite = null;

  function openModal(site) {
    if (!modalEl) return;
    modalSite = site || null;

    if (modalTitle) modalTitle.textContent = site?.name || '-';
    if (modalAddress) modalAddress.textContent = site?.address || '-';
    if (modalStatus) modalStatus.textContent = `${statusLabel(site?.status)} (${site?.status || 'SAFE'})`;
    if (modalSensors) modalSensors.textContent = `${site?.sensorCount ?? 0}개`;
    if (modalSize) modalSize.textContent = site?.buildingSize || '-';
    if (modalYear) modalYear.textContent = site?.buildingYear || '-';

    const lat = site?.latitude;
    const lon = site?.longitude;
    if (modalCoords) modalCoords.textContent = (Number.isFinite(lat) && Number.isFinite(lon)) ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
    if (modalNotes) modalNotes.textContent = site?.notes ? `메모: ${site.notes}` : '메모: -';

    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    // 모달 뜨면 지도 터치 방지(모바일)
    document.body.classList.add('login-open');
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
    modalSite = null;
    // 모달 닫으면 지도 터치 복구(로그인 패널 상태와 별개)
    document.body.classList.remove('login-open');
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
  // Load sites and markers + clickable list
  // =========================
  const siteMarkers = new Map(); // id -> marker
  let sitesCache = [];

  function renderLandingSiteList(sites) {
    if (!siteListEl) return;

    if (!sites || sites.length === 0) {
      siteListEl.innerHTML = '<p>등록된 현장이 없습니다. 관리자 페이지에서 현장을 등록해 주세요.</p>';
      return;
    }

    siteListEl.innerHTML = sites.map((s) => {
      const status = s.status || 'SAFE';
      const badgeClass = statusBadgeClass(status);
      const safeName = String(s.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeAddr = String(s.address || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `
        <button type="button"
                class="site-item w-full text-left"
                data-site-id="${s.id}">
          <div class="site-item-main">
            <span class="site-item-name">${safeName}</span>
            <span class="site-item-address">${safeAddr}</span>
          </div>
          <span class="${badgeClass}">${status}</span>
        </button>
      `;
    }).join('');

    // 클릭 이벤트(위임)
    siteListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-site-id]');
      if (!btn) return;

      const id = btn.getAttribute('data-site-id');
      const site = sitesCache.find((x) => String(x.id) === String(id));
      if (!site) return;

      const lat = site.latitude;
      const lon = site.longitude;

      // 지도 이동 + 마커 팝업
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        map.setView([lat, lon], 16, { animate: true });

        const mk = siteMarkers.get(site.id);
        if (mk) mk.openPopup();
      }

      // 상세 모달이 있으면 열기
      if (document.getElementById('site-modal')) {
        openModal(site);
      }
    }, { once: true }); // 중복 등록 방지
  }

  function upsertMarkers(sites) {
    const bounds = [];

    sites.forEach((s) => {
      const lat = s.latitude;
      const lon = s.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const popupHtml = `<strong>${s.name || ''}</strong><br>${s.address || ''}`;
      let mk = siteMarkers.get(s.id);

      if (!mk) {
        mk = L.marker([lat, lon]).addTo(map);
        mk.bindPopup(popupHtml);
        siteMarkers.set(s.id, mk);
      } else {
        mk.setLatLng([lat, lon]);
        mk.setPopupContent(popupHtml);
      }

      bounds.push([lat, lon]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  function updateSampleCard(first) {
    if (!first) return;
    const titleEl = document.getElementById('sample-title');
    const addrEl = document.getElementById('sample-address');
    if (titleEl) titleEl.textContent = first.name || '-';
    if (addrEl) addrEl.textContent = first.address || '-';
  }

  fetch('/api/sites')
    .then((res) => res.json())
    .then((data) => {
      const sites = normalizeSitesResponse(data);
      sitesCache = sites;

      renderLandingSiteList(sites);
      upsertMarkers(sites);
      updateSampleCard(sites[0]);
    })
    .catch((err) => {
      console.error(err);
      if (siteListEl) siteListEl.innerHTML = '<p>현장 정보를 불러오는 중 오류가 발생했습니다.</p>';
    });
});
