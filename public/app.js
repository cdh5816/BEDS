// © AIRX (individual business) - All rights reserved.
// BEDS (Building Earthquake Detection System) - frontend logic

(function () {
  const API_BASE = '';

  const mapElement = document.getElementById('beds-map');
  const loginButton = document.getElementById('beds-login-button');
  const logoutButton = document.getElementById('beds-logout-button');
  const loginModal = document.getElementById('beds-login-modal');
  const modalCloseButton = document.getElementById('beds-modal-close');
  const loginForm = document.getElementById('beds-login-form');
  const adminPanel = document.getElementById('beds-admin-panel');
  const buildingForm = document.getElementById('beds-building-form');
  const adminLabel = document.getElementById('beds-admin-label');
  const adminName = document.getElementById('beds-admin-name');

  let map;
  let markersLayer;

  function initMap() {
    if (!mapElement) return;

    map = L.map(mapElement, {
      zoomControl: true
    }).setView([36.5, 127.8], 7); // Center on South Korea

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    loadBuildingsForMap();
  }

  async function loadBuildingsForMap() {
    try {
      const res = await fetch(API_BASE + '/api/public/buildings');
      if (!res.ok) {
        console.error('Failed to fetch buildings:', res.status);
        return;
      }
      const data = await res.json();
      if (!data.buildings || !Array.isArray(data.buildings)) return;

      markersLayer.clearLayers();

      data.buildings.forEach((b) => {
        if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return;

        const marker = L.marker([b.lat, b.lng]);
        const popupHtml = `
          <div class="beds-popup">
            <strong>${escapeHtml(b.name || '')}</strong><br/>
            <span>${escapeHtml(b.address || '')}</span>
          </div>
        `;
        marker.bindPopup(popupHtml);
        marker.addTo(markersLayer);
      });
    } catch (err) {
      console.error('Error loading buildings:', err);
    }
  }

  function openLoginModal() {
    if (!loginModal) return;
    loginModal.classList.remove('hidden');
  }

  function closeLoginModal() {
    if (!loginModal) return;
    loginModal.classList.add('hidden');
  }

  function getStoredToken() {
    return localStorage.getItem('bedsToken');
  }

  function storeAuth(token, user) {
    localStorage.setItem('bedsToken', token);
    if (user && user.name) {
      localStorage.setItem('bedsUserName', user.name);
    }
    applyAuthUi();
  }

  function clearAuth() {
    localStorage.removeItem('bedsToken');
    localStorage.removeItem('bedsUserName');
    applyAuthUi();
  }

  function applyAuthUi() {
    const token = getStoredToken();
    const name = localStorage.getItem('bedsUserName') || '';

    if (token) {
      // Logged in
      if (loginButton) loginButton.classList.add('hidden');
      if (logoutButton) logoutButton.classList.remove('hidden');
      if (adminPanel) adminPanel.classList.remove('hidden');
      if (adminLabel) adminLabel.classList.remove('hidden');
      if (adminName) adminName.textContent = `관리자: ${name}`;
    } else {
      if (loginButton) loginButton.classList.remove('hidden');
      if (logoutButton) logoutButton.classList.add('hidden');
      if (adminPanel) adminPanel.classList.add('hidden');
      if (adminLabel) adminLabel.classList.add('hidden');
      if (adminName) adminName.textContent = '';
    }
  }

  function attachEvents() {
    if (loginButton) {
      loginButton.addEventListener('click', () => {
        openLoginModal();
      });
    }
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        clearAuth();
      });
    }
    if (modalCloseButton) {
      modalCloseButton.addEventListener('click', () => {
        closeLoginModal();
      });
    }
    if (loginModal) {
      loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
          closeLoginModal();
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) return;

        try {
          const res = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            const msg = (errorData && errorData.message) || '로그인 실패';
            alert(msg);
            return;
          }

          const data = await res.json();
          storeAuth(data.token, data.user);
          closeLoginModal();
          alert('로그인 성공!');
        } catch (err) {
          console.error('Login error:', err);
          alert('로그인 중 오류가 발생했습니다.');
        }
      });
    }

    if (buildingForm) {
      buildingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('building-name');
        const addressInput = document.getElementById('building-address');
        const latInput = document.getElementById('building-lat');
        const lngInput = document.getElementById('building-lng');

        const name = nameInput.value.trim();
        const address = addressInput.value.trim();
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);

        if (!name || !address || isNaN(lat) || isNaN(lng)) {
          alert('모든 필드를 올바르게 입력해주세요.');
          return;
        }

        const token = getStoredToken();
        if (!token) {
          alert('로그인이 필요합니다.');
          return;
        }

        try {
          const res = await fetch(API_BASE + '/api/buildings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({ name, address, lat, lng })
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            const msg = (errorData && errorData.message) || '건물 등록 실패';
            alert(msg);
            return;
          }

          await res.json();
          alert('건물이 등록되었습니다.');

          // Clear form
          nameInput.value = '';
          addressInput.value = '';
          latInput.value = '';
          lngInput.value = '';

          // Refresh map markers
          loadBuildingsForMap();
        } catch (err) {
          console.error('Error adding building:', err);
          alert('건물 등록 중 오류가 발생했습니다.');
        }
      });
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

  document.addEventListener('DOMContentLoaded', () => {
    applyAuthUi();
    attachEvents();
    initMap();
  });
})();