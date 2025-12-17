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
  if (!user) {
    localStorage.removeItem('bedsUser');
  } else {
    localStorage.setItem('bedsUser', JSON.stringify(user));
  }
}

function fmtCoord(n) {
  return Number(n).toFixed(6);
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
    if (logoutBtn) {
      logoutBtn.classList.remove('hidden');
    }
  }

  updateHeaderForUser();
  syncLoginOpenClass();

  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) return;
      if (user.role === 'ADMIN') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'client.html';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUser(null);
      // ✅ 혹시 로그인 패널 열림 상태로 꼬이는 것 방지
      document.body.classList.remove('login-open');
      window.location.href = 'index.html';
    });
  }

  // 로그인 토글 버튼: open/close + body.login-open 동기화
  if (loginToggle && loginPanel) {
    loginToggle.addEventListener('click', () => {
      loginPanel.classList.toggle('open');
      syncLoginOpenClass();
    });
  }

  // 패널 바깥 클릭하면 닫기(모바일에서 특히 유용)
  document.addEventListener('click', (e) => {
    if (!loginPanel || !loginToggle) return;
    const t = e.target;
    const clickedInsidePanel = loginPanel.contains(t);
    const clickedToggle = loginToggle.contains(t);
    if (!clickedInsidePanel && !clickedToggle) {
      closeLoginPanel();
    }
  });

  // ESC로 닫기(PC)
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

        // ✅ 로그인 성공 시 패널 닫기 + 지도 터치 차단 해제
        closeLoginPanel();

        if (data.role === 'ADMIN') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'client.html';
        }
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

  let pickedLat = null;
  let pickedLon = null;
  let pickedAddress = null;

  function updatePickUI(lat, lon, addressText) {
    const coordText = lat != null && lon != null ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
    if (pickCoordsEl) pickCoordsEl.textContent = coordText;
    if (pickAddressEl) pickAddressEl.textContent = addressText || '-';
  }

  async function reverseGeocode(lat, lon) {
    // 서버에 /api/reverse 가 있으면 가장 안정적(키 노출/차단 리스크 최소화)
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

  // 복사 버튼
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

  // 클릭/드래그 마커
  let pickMarker = null;

  map.on('click', async (e) => {
    // ✅ 로그인 패널이 열린 상태면, 지도가 클릭 먹지 않도록 (CSS로 차단되지만 이중 안전)
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

  // 초기 UI
  updatePickUI(null, null, null);

  // =========================
  // Load sites and markers
  // =========================
  fetch('/api/sites')
    .then((res) => res.json())
    .then((data) => {
      const sites = data && Array.isArray(data.sites) ? data.sites : [];
      if (!sites.length) {
        if (siteListEl) {
          siteListEl.innerHTML = '<p>등록된 현장이 없습니다. 관리자 페이지에서 현장을 등록해 주세요.</p>';
        }
        return;
      }

      const bounds = [];
      sites.forEach((s) => {
        if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
          const marker = L.marker([s.latitude, s.longitude]).addTo(map);
          marker.bindPopup(`<strong>${s.name}</strong><br>${s.address || ''}`);
          bounds.push([s.latitude, s.longitude]);
        }
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      if (siteListEl) {
        siteListEl.innerHTML = sites
          .map((s) => {
            const status = s.status || 'SAFE';
            let badgeClass = 'badge badge-safe';
            if (status === 'ALERT') badgeClass = 'badge badge-alert';
            else if (status === 'CAUTION') badgeClass = 'badge badge-caution';
            return `
              <div class="site-item">
                <div class="site-item-main">
                  <span class="site-item-name">${s.name}</span>
                  <span class="site-item-address">${s.address || ''}</span>
                </div>
                <span class="${badgeClass}">${status}</span>
              </div>
            `;
          })
          .join('');
      }

      const first = sites[0];
      if (first) {
        const titleEl = document.getElementById('sample-title');
        const addrEl = document.getElementById('sample-address');
        if (titleEl) titleEl.textContent = first.name;
        if (addrEl) addrEl.textContent = first.address || '';
      }
    })
    .catch((err) => {
      console.error(err);
      if (siteListEl) {
        siteListEl.innerHTML = '<p>현장 정보를 불러오는 중 오류가 발생했습니다.</p>';
      }
    });
});
