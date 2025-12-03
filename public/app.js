
// © AIRX (individual business) - All rights reserved.
// BEDS v2 frontend logic (desktop & mobile responsive).

(function () {
  const API_BASE = '';
  const CONFIG = (window.BEDS_CONFIG || {});

  const loginButton = document.getElementById('beds-login-button');
  const logoutButton = document.getElementById('beds-logout-button');
  const roleBadge = document.getElementById('beds-role-badge');

  const loginModal = document.getElementById('beds-login-modal');
  const loginForm = document.getElementById('beds-login-form');
  const loginCloseButton = document.getElementById('beds-modal-close');

  const adminPanel = document.getElementById('beds-admin-panel');
  const adminTabSites = document.getElementById('beds-admin-tab-sites');
  const adminTabList = document.getElementById('beds-admin-tab-list');
  const adminTabContentSites = document.getElementById('beds-admin-tab-content-sites');
  const adminTabContentList = document.getElementById('beds-admin-tab-content-list');
  const adminSitesList = document.getElementById('beds-admin-sites-list');

  const customerPanel = document.getElementById('beds-customer-panel');
  const customerSiteSelect = document.getElementById('customer-site-select');
  const connectionAlert = document.getElementById('beds-connection-alert');
  const statusShake = document.getElementById('status-shake');
  const statusBending = document.getElementById('status-bending');
  const statusSensorCount = document.getElementById('status-sensor-count');
  const measurementsTimeline = document.getElementById('beds-measurements-timeline');

  const mapElement = document.getElementById('beds-map');
  const publicSitesContainer = document.getElementById('beds-public-sites-container');

  const siteForm = document.getElementById('beds-site-form');
  const siteNameInput = document.getElementById('site-name');
  const siteAddressInput = document.getElementById('site-address');
  const siteLatInput = document.getElementById('site-lat');
  const siteLngInput = document.getElementById('site-lng');
  const addressSearchButton = document.getElementById('beds-address-search-button');

  let map;
  let markersLayer;
  let statusPollTimer = null;

  function getToken() {
    return localStorage.getItem('beds_v2_token');
  }

  function getCurrentUser() {
    const raw = localStorage.getItem('beds_v2_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function storeAuth(token, user) {
    localStorage.setItem('beds_v2_token', token);
    localStorage.setItem('beds_v2_user', JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem('beds_v2_token');
    localStorage.removeItem('beds_v2_user');
  }

  function openLoginModal() {
    if (!loginModal) return;
    loginModal.classList.remove('hidden');
  }

  function closeLoginModal() {
    if (!loginModal) return;
    loginModal.classList.add('hidden');
  }

  function applyRoleUI() {
    const user = getCurrentUser();
    const token = getToken();

    if (!user || !token) {
      adminPanel.classList.add('hidden');
      customerPanel.classList.add('hidden');
      roleBadge.classList.add('hidden');
      loginButton.classList.remove('hidden');
      logoutButton.classList.add('hidden');
      stopStatusPolling();
      return;
    }

    loginButton.classList.add('hidden');
    logoutButton.classList.remove('hidden');
    roleBadge.classList.remove('hidden');
    roleBadge.textContent =
      user.role === 'ADMIN' ? `관리자 · ${user.name}` : `고객 · ${user.name}`;

    if (user.role === 'ADMIN') {
      adminPanel.classList.remove('hidden');
      customerPanel.classList.add('hidden');
      loadAdminSites();
    } else if (user.role === 'CUSTOMER') {
      adminPanel.classList.add('hidden');
      customerPanel.classList.remove('hidden');
      loadCustomerSites();
    }
  }

  function attachEvents() {
    if (loginButton) {
      loginButton.addEventListener('click', () => openLoginModal());
    }
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        clearAuth();
        applyRoleUI();
      });
    }
    if (loginCloseButton) {
      loginCloseButton.addEventListener('click', () => closeLoginModal());
    }
    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) return;

        try {
          const res = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            const msg = (errData && errData.message) || '로그인 실패';
            alert(msg);
            return;
          }
          const data = await res.json();
          storeAuth(data.token, data.user);
          closeLoginModal();
          applyRoleUI();
          alert('로그인 성공');
        } catch (err) {
          console.error('login error', err);
          alert('로그인 중 오류가 발생했습니다.');
        }
      });
    }

    if (siteForm) {
      siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = siteNameInput.value.trim();
        const address = siteAddressInput.value.trim();
        const lat = parseFloat(siteLatInput.value);
        const lng = parseFloat(siteLngInput.value);

        if (!name || !address || isNaN(lat) || isNaN(lng)) {
          alert('모든 필드를 올바르게 입력해주세요.');
          return;
        }
        const token = getToken();
        if (!token) {
          alert('관리자 로그인이 필요합니다.');
          return;
        }

        try {
          const res = await fetch(API_BASE + '/api/admin/sites', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({ name, address, lat, lng })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            alert((err && err.message) || '현장 등록 실패');
            return;
          }
          await res.json();
          alert('현장이 등록되었습니다.');
          siteNameInput.value = '';
          siteAddressInput.value = '';
          siteLatInput.value = '';
          siteLngInput.value = '';
          loadPublicSites();
          loadAdminSites();
        } catch (err) {
          console.error('add site error', err);
          alert('현장 등록 중 오류가 발생했습니다.');
        }
      });
    }

    if (addressSearchButton) {
      if (!CONFIG.kakaoRestApiKey || CONFIG.kakaoRestApiKey === 'YOUR_KAKAO_REST_API_KEY_HERE') {
        addressSearchButton.disabled = true;
        addressSearchButton.textContent = 'API 키 필요';
      } else {
        addressSearchButton.addEventListener('click', onAddressSearch);
      }
    }

    if (adminTabSites && adminTabList) {
      adminTabSites.addEventListener('click', () => setAdminTab('sites'));
      adminTabList.addEventListener('click', () => setAdminTab('list'));
    }

    if (customerSiteSelect) {
      customerSiteSelect.addEventListener('change', () => startStatusPolling());
    }
  }

  function setAdminTab(tab) {
    if (tab === 'sites') {
      adminTabSites.classList.add('active');
      adminTabList.classList.remove('active');
      adminTabContentSites.classList.add('active');
      adminTabContentList.classList.remove('active');
    } else {
      adminTabSites.classList.remove('active');
      adminTabList.classList.add('active');
      adminTabContentSites.classList.remove('active');
      adminTabContentList.classList.add('active');
    }
  }

  function initMap() {
    if (!mapElement) return;
    map = L.map(mapElement, { zoomControl: true }).setView([36.5, 127.8], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    loadPublicSites();
  }

  async function loadPublicSites() {
    try {
      const res = await fetch(API_BASE + '/api/public/sites');
      if (!res.ok) return;
      const data = await res.json();
      const sites = data.sites || [];

      markersLayer.clearLayers();
      sites.forEach((s) => {
        if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
        const marker = L.marker([s.lat, s.lng]);
        marker.bindPopup(
          `<div class="beds-popup"><strong>${escapeHtml(
            s.name
          )}</strong><br/><span>${escapeHtml(s.address)}</span></div>`
        );
        marker.addTo(markersLayer);
      });

      publicSitesContainer.innerHTML = '';
      if (sites.length === 0) {
        publicSitesContainer.innerHTML =
          '<div class="site-item"><div class="site-item-name">등록된 현장이 없습니다.</div></div>';
      } else {
        sites.forEach((s) => {
          const div = document.createElement('div');
          div.className = 'site-item';
          div.innerHTML = `
            <div class="site-item-name">${escapeHtml(s.name)}</div>
            <div class="site-item-address">${escapeHtml(s.address)}</div>
            <div class="site-item-coords">lat ${s.lat.toFixed(
              5
            )}, lng ${s.lng.toFixed(5)}</div>
          `;
          publicSitesContainer.appendChild(div);
        });
      }
    } catch (err) {
      console.error('public sites error', err);
    }
  }

  async function loadAdminSites() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(API_BASE + '/api/admin/sites', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const sites = data.sites || [];
      adminSitesList.innerHTML = '';
      if (sites.length === 0) {
        adminSitesList.innerHTML =
          '<div class="site-item"><div class="site-item-name">등록된 현장이 없습니다.</div></div>';
      } else {
        sites.forEach((s) => {
          const div = document.createElement('div');
          div.className = 'site-item';
          div.innerHTML = `
            <div class="site-item-name">${escapeHtml(s.name)}</div>
            <div class="site-item-address">${escapeHtml(s.address)}</div>
            <div class="site-item-coords">lat ${s.lat.toFixed(
              5
            )}, lng ${s.lng.toFixed(5)}</div>
          `;
          adminSitesList.appendChild(div);
        });
      }
    } catch (err) {
      console.error('admin sites error', err);
    }
  }

  async function loadCustomerSites() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(API_BASE + '/api/customer/sites', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const sites = data.sites || [];

      customerSiteSelect.innerHTML = '';
      if (sites.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '연결된 현장이 없습니다.';
        customerSiteSelect.appendChild(opt);
        stopStatusPolling();
        clearStatusUI();
        return;
      }
      sites.forEach((s, idx) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (idx === 0) opt.selected = true;
        customerSiteSelect.appendChild(opt);
      });
      startStatusPolling();
    } catch (err) {
      console.error('customer sites error', err);
    }
  }

  function clearStatusUI() {
    statusShake.textContent = '-';
    statusBending.textContent = '-';
    statusSensorCount.textContent = '-';
    connectionAlert.classList.add('hidden');
    measurementsTimeline.innerHTML = '';
  }

  function startStatusPolling() {
    stopStatusPolling();
    const siteId = customerSiteSelect.value;
    if (!siteId) return;
    pollStatusOnce(siteId);
    statusPollTimer = setInterval(() => pollStatusOnce(siteId), 5000);
  }

  function stopStatusPolling() {
    if (statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
  }

  async function pollStatusOnce(siteId) {
    const token = getToken();
    if (!token || !siteId) return;
    try {
      const res = await fetch(API_BASE + `/api/customer/sites/${siteId}/status`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        console.error('status error', res.status);
        return;
      }
      const data = await res.json();
      renderStatus(data);
    } catch (err) {
      console.error('status fetch error', err);
    }
  }

  function renderStatus(data) {
    const sensors = data.sensors || [];
    const latest = data.latestMeasurement || null;
    const measurements = data.measurements || [];

    statusSensorCount.textContent = sensors.length.toString();
    if (latest && latest.metrics) {
      const shake = latest.metrics.shake;
      const bending = latest.metrics.bending;
      statusShake.textContent =
        typeof shake === 'number' ? shake.toFixed(3) : '-';
      statusBending.textContent =
        typeof bending === 'number' ? bending.toFixed(3) : '-';
    } else {
      statusShake.textContent = '-';
      statusBending.textContent = '-';
    }

    if (data.connectionLost) {
      connectionAlert.classList.remove('hidden');
    } else {
      connectionAlert.classList.add('hidden');
    }

    measurementsTimeline.innerHTML = '';
    if (measurements.length === 0) {
      measurementsTimeline.innerHTML =
        '<div class="timeline-item">아직 수신된 데이터가 없습니다.</div>';
    } else {
      measurements.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        const t = formatKoreanTime(m.createdAt);
        const shake =
          m.metrics && typeof m.metrics.shake === 'number'
            ? m.metrics.shake.toFixed(3)
            : '-';
        const bending =
          m.metrics && typeof m.metrics.bending === 'number'
            ? m.metrics.bending.toFixed(3)
            : '-';
        div.innerHTML = `
          <div class="timeline-item-header">
            <span class="timeline-item-time">${t}</span>
            <span>센서 ID: ${shortenId(m.sensorId || '')}</span>
          </div>
          <div class="timeline-item-metrics">
            흔들림: ${shake}, 휨: ${bending}
          </div>
        `;
        measurementsTimeline.appendChild(div);
      });
    }
  }

  async function onAddressSearch() {
    const keyword = siteAddressInput.value.trim();
    if (!keyword) {
      alert('주소를 입력하세요.');
      return;
    }
    const key = CONFIG.kakaoRestApiKey;
    if (!key || key === 'YOUR_KAKAO_REST_API_KEY_HERE') {
      alert('카카오 REST API 키를 config.js에 설정해야 합니다.');
      return;
    }
    try {
      const url =
        'https://dapi.kakao.com/v2/local/search/address.json?query=' +
        encodeURIComponent(keyword);
      const res = await fetch(url, {
        headers: { Authorization: 'KakaoAK ' + key }
      });
      if (!res.ok) {
        alert('주소 검색 실패 (HTTP ' + res.status + ')');
        return;
      }
      const data = await res.json();
      if (!data.documents || data.documents.length === 0) {
        alert('검색 결과가 없습니다.');
        return;
      }
      const first = data.documents[0];
      const lat = parseFloat(first.y);
      const lng = parseFloat(first.x);
      siteLatInput.value = lat.toFixed(6);
      siteLngInput.value = lng.toFixed(6);
    } catch (err) {
      console.error('kakao address error', err);
      alert('주소 검색 중 오류가 발생했습니다.');
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatKoreanTime(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0') +
        ' ' +
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0') +
        ':' +
        String(d.getSeconds()).padStart(2, '0')
      );
    } catch {
      return isoString;
    }
  }

  function shortenId(id) {
    if (!id) return '-';
    if (id.length <= 8) return id;
    return id.slice(0, 4) + '…' + id.slice(-4);
  }

  document.addEventListener('DOMContentLoaded', () => {
    attachEvents();
    applyRoleUI();
    initMap();
  });
})();
