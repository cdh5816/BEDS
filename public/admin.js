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

document.addEventListener('DOMContentLoaded', () => {
  const user = ensureAdmin();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bedsUser');
      window.location.href = 'index.html';
    });
  }

  const statusFilter = document.getElementById('status-filter');
  const sizeFilter = document.getElementById('size-filter');
  const siteListEl = document.getElementById('site-list');
  const siteSummaryEl = document.getElementById('site-summary');

  let sites = [];
  let selectedSiteId = null;
  let map = null;
  let markers = [];

  function initMap() {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById('admin-map');
    if (!mapEl) return;
    map = L.map('admin-map').setView([37.5665, 126.9780], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }

  function renderMarkers(currentSites) {
    if (!map) return;
    markers.forEach((m) => map.removeLayer(m));
    markers = [];
    const bounds = [];
    currentSites.forEach((s) => {
      if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
        const marker = L.marker([s.latitude, s.longitude]).addTo(map);
        marker.bindPopup(`<strong>${s.name}</strong><br>${s.address || ''}`);
        markers.push(marker);
        bounds.push([s.latitude, s.longitude]);
      }
    });
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  function focusOnSite(site) {
    if (!map || typeof site.latitude !== 'number' || typeof site.longitude !== 'number') return;
    map.setView([site.latitude, site.longitude], 15);
  }

  function renderSites() {
    if (!siteListEl) return;
    const statusValue = statusFilter ? statusFilter.value : 'ALL';
    const sizeValue = sizeFilter ? sizeFilter.value.trim().toLowerCase() : '';

    const filtered = sites.filter((s) => {
      if (statusValue !== 'ALL' && s.status !== statusValue) return false;
      if (sizeValue) {
        const combined = (s.buildingSize || '').toLowerCase();
        if (!combined.includes(sizeValue)) return false;
      }
      return true;
    });

    if (siteSummaryEl) {
      siteSummaryEl.textContent = `총 ${sites.length}개 현장 / 필터 결과 ${filtered.length}개`;
    }

    siteListEl.innerHTML = '';
    filtered.forEach((s) => {
      const item = document.createElement('div');
      item.className =
        'site-item' + (selectedSiteId === s.id ? ' site-item-active' : '');
      const main = document.createElement('div');
      main.className = 'site-item-main';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'site-item-name';
      nameSpan.textContent = s.name;

      const addrSpan = document.createElement('span');
      addrSpan.className = 'site-item-address';
      addrSpan.textContent = s.address || '';

      main.appendChild(nameSpan);
      main.appendChild(addrSpan);

      const statusSpan = document.createElement('span');
      const status = s.status || 'SAFE';
      let badgeClass = 'badge badge-safe';
      if (status === 'ALERT') badgeClass = 'badge badge-alert';
      else if (status === 'CAUTION') badgeClass = 'badge badge-caution';
      statusSpan.className = badgeClass;
      statusSpan.textContent = status;

      item.appendChild(main);
      item.appendChild(statusSpan);

      item.addEventListener('click', () => {
        selectedSiteId = s.id;
        renderSites();
        focusOnSite(s);
      });

      siteListEl.appendChild(item);
    });

    renderMarkers(filtered);
  }

  async function loadSites() {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      sites = data && Array.isArray(data.sites) ? data.sites : [];
      if (!selectedSiteId && sites.length) {
        selectedSiteId = sites[0].id;
      }
      renderSites();
    } catch (err) {
      console.error(err);
      if (siteSummaryEl) siteSummaryEl.textContent = '현장 목록을 불러오는 중 오류가 발생했습니다.';
    }
  }

  if (statusFilter) statusFilter.addEventListener('change', renderSites);
  if (sizeFilter) sizeFilter.addEventListener('input', renderSites);

  // 지오코딩 (Nominatim)
  const searchBtn = document.getElementById('search-address');
  const addrInput = document.getElementById('address');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  const geocodeResults = document.getElementById('geocode-results');

  if (searchBtn && addrInput && geocodeResults) {
    searchBtn.addEventListener('click', async () => {
      const query = addrInput.value.trim();
      geocodeResults.innerHTML = '';
      latInput.value = '';
      lngInput.value = '';
      if (!query) {
        geocodeResults.textContent = '주소를 입력해 주세요.';
        return;
      }
      geocodeResults.textContent = '주소를 검색 중입니다...';
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'ko'
          }
        });
        if (!res.ok) {
          geocodeResults.textContent = '주소 검색에 실패했습니다.';
          return;
        }
        const list = await res.json();
        if (!list.length) {
          geocodeResults.textContent = '검색 결과가 없습니다.';
          return;
        }
        geocodeResults.innerHTML = '';
        list.forEach((item) => {
          const div = document.createElement('div');
          div.className = 'geocode-item';
          div.textContent = item.display_name;
          div.addEventListener('click', () => {
            addrInput.value = item.display_name;
            latInput.value = parseFloat(item.lat);
            lngInput.value = parseFloat(item.lon);
            geocodeResults.innerHTML = '';
            if (map) {
              map.setView([parseFloat(item.lat), parseFloat(item.lon)], 16);
            }
          });
          geocodeResults.appendChild(div);
        });
      } catch (err) {
        console.error(err);
        geocodeResults.textContent = '주소 검색에 실패했습니다.';
      }
    });
  }

  const siteForm = document.getElementById('site-form');
  if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('name').value.trim(),
        address: addrInput.value.trim(),
        latitude: latInput.value ? parseFloat(latInput.value) : null,
        longitude: lngInput.value ? parseFloat(lngInput.value) : null,
        sensorCount: parseInt(document.getElementById('sensorCount').value || '0', 10),
        buildingSize: document.getElementById('buildingSize').value.trim(),
        buildingYear: document.getElementById('buildingYear').value.trim(),
        notes: document.getElementById('notes').value.trim()
      };
      if (!body.name || !body.address) {
        alert('현장명과 주소는 필수입니다.');
        return;
      }
      try {
        const res = await fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          alert('현장 생성에 실패했습니다.');
          return;
        }
        await res.json();
        siteForm.reset();
        latInput.value = '';
        lngInput.value = '';
        geocodeResults.innerHTML = '';
        await loadSites();
        alert('현장이 등록되었습니다.');
      } catch (err) {
        console.error(err);
        alert('서버 오류로 현장 생성에 실패했습니다.');
      }
    });
  }

  initMap();
  loadSites();
});
