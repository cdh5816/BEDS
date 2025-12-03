// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const API_BASE = ''; // same origin

const siteListEl = document.getElementById('site-list');
const siteSummaryEl = document.getElementById('site-summary');
const statusFilterEl = document.getElementById('status-filter');
const sizeFilterEl = document.getElementById('size-filter');

const formEl = document.getElementById('site-form');
const nameEl = document.getElementById('name');
const addressEl = document.getElementById('address');
const latitudeEl = document.getElementById('latitude');
const longitudeEl = document.getElementById('longitude');
const sensorCountEl = document.getElementById('sensorCount');
const buildingSizeEl = document.getElementById('buildingSize');
const buildingYearEl = document.getElementById('buildingYear');
const notesEl = document.getElementById('notes');
const searchAddressBtn = document.getElementById('search-address');
const geocodeResultsEl = document.getElementById('geocode-results');

let sites = [];
let adminMap;
let adminMarkersLayer;

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem('beds_logged_in');
    window.location.href = 'index.html';
  });
}

function ensureLoggedIn() {
  const loggedIn = localStorage.getItem('beds_logged_in') === '1';
  if (!loggedIn) {
    window.location.href = 'index.html';
  }
}

function initAdminMap() {
  const mapEl = document.getElementById('admin-map');
  if (!mapEl || typeof L === 'undefined') return;

  adminMap = L.map('admin-map', {
    zoomControl: false
  }).setView([37.5665, 126.9780], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ''
  }).addTo(adminMap);

  adminMarkersLayer = L.layerGroup().addTo(adminMap);
}

function renderAdminMap() {
  if (!adminMap || !adminMarkersLayer) return;

  adminMarkersLayer.clearLayers();
  const coordsSites = sites.filter(
    (s) => s.latitude && s.longitude && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude))
  );

  if (!coordsSites.length) {
    adminMap.setView([37.5665, 126.9780], 11);
    return;
  }

  const bounds = [];
  coordsSites.forEach((site) => {
    const lat = Number(site.latitude);
    const lon = Number(site.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    let color = '#22c55e';
    if (site.status === 'CAUTION') color = '#fbbf24';
    else if (site.status === 'ALERT') color = '#f97373';

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.9
    }).addTo(adminMarkersLayer);

    marker.bindPopup(site.name);
    bounds.push([lat, lon]);
  });

  if (bounds.length === 1) {
    adminMap.setView(bounds[0], 14);
  } else {
    adminMap.fitBounds(bounds, { padding: [20, 20] });
  }
}

function focusSiteOnMap(site) {
  if (!adminMap || !site || !site.latitude || !site.longitude) return;
  const lat = Number(site.latitude);
  const lon = Number(site.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  adminMap.setView([lat, lon], 15);
}

// ---- 데이터 로딩 및 렌더링 ----

async function fetchSites() {
  const res = await fetch(`${API_BASE}/api/sites`);
  sites = await res.json();
  renderSites();
  renderAdminMap();
}

function renderSummary() {
  const total = sites.length;
  const safe = sites.filter((s) => s.status === 'SAFE').length;
  const caution = sites.filter((s) => s.status === 'CAUTION').length;
  const alert = sites.filter((s) => s.status === 'ALERT').length;

  siteSummaryEl.innerHTML = '';

  const items = [
    { label: '전체', value: total, className: '' },
    { label: '안전', value: safe, className: 'site-summary-safe' },
    { label: '주의', value: caution, className: 'site-summary-caution' },
    { label: '경고', value: alert, className: 'site-summary-alert' }
  ];

  items.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = `site-summary-pill ${item.className}`.trim();

    if (item.className) {
      const dot = document.createElement('span');
      dot.className = 'site-summary-dot';
      pill.appendChild(dot);
    }

    const text = document.createElement('span');
    text.textContent = `${item.label} ${item.value}`;
    pill.appendChild(text);

    siteSummaryEl.appendChild(pill);
  });
}

function renderSites() {
  renderSummary();

  const statusFilter = statusFilterEl.value;
  const sizeFilter = sizeFilterEl.value.trim().toLowerCase();

  const filtered = sites.filter((site) => {
    if (statusFilter !== 'ALL' && site.status !== statusFilter) return false;
    if (sizeFilter && !(site.buildingSize || '').toLowerCase().includes(sizeFilter)) return false;
    return true;
  });

  siteListEl.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '등록된 현장이 없습니다.';
    siteListEl.appendChild(empty);
    return;
  }

  filtered.forEach((site) => {
    const card = document.createElement('article');
    card.className = 'site-card';

    card.addEventListener('click', () => {
      focusSiteOnMap(site);
    });

    const main = document.createElement('div');
    main.className = 'site-main';

    const nameRow = document.createElement('div');
    nameRow.className = 'site-name-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'site-name';
    nameSpan.textContent = site.name;

    nameRow.appendChild(nameSpan);
    main.appendChild(nameRow);

    const address = document.createElement('div');
    address.className = 'site-address';
    address.textContent = site.address;
    main.appendChild(address);

    const meta = document.createElement('div');
    meta.className = 'site-meta';

    const sizePill = document.createElement('span');
    sizePill.className = 'meta-pill';
    sizePill.innerHTML = `<strong>규모</strong>${site.buildingSize || '-'}`;
    meta.appendChild(sizePill);

    const yearPill = document.createElement('span');
    yearPill.className = 'meta-pill';
    yearPill.innerHTML = `<strong>준공</strong>${site.buildingYear || '-'}`;
    meta.appendChild(yearPill);

    const sensorPill = document.createElement('span');
    sensorPill.className = 'meta-pill';
    sensorPill.innerHTML = `<strong>센서</strong>${site.sensorCount ?? 0}`;
    meta.appendChild(sensorPill);

    if (site.notes) {
      const notesPill = document.createElement('span');
      notesPill.className = 'meta-pill';
      notesPill.innerHTML = `<strong>메모</strong>${site.notes}`;
      meta.appendChild(notesPill);
    }

    main.appendChild(meta);

    // Status column
    const statusCol = document.createElement('div');
    statusCol.className = 'site-status';

    const badge = document.createElement('div');
    const statusClass =
      site.status === 'SAFE'
        ? 'status-safe'
        : site.status === 'CAUTION'
        ? 'status-caution'
        : 'status-alert';
    badge.className = `status-badge ${statusClass}`;

    const dot = document.createElement('span');
    dot.className = 'status-dot';
    badge.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'status-label-text';
    let labelText = '';
    if (site.status === 'SAFE') labelText = '안전';
    else if (site.status === 'CAUTION') labelText = '주의';
    else labelText = '경고';
    label.textContent = labelText;
    badge.appendChild(label);

    statusCol.appendChild(badge);

    const selectWrap = document.createElement('div');
    selectWrap.className = 'status-select-wrapper';

    const select = document.createElement('select');
    ['SAFE', 'CAUTION', 'ALERT'].forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      if (value === 'SAFE') opt.textContent = '안전 (초록)';
      else if (value === 'CAUTION') opt.textContent = '주의 (노랑)';
      else opt.textContent = '경고 (빨강)';

      if (value === site.status) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      updateStatus(site.id, select.value);
    });

    selectWrap.appendChild(select);
    statusCol.appendChild(selectWrap);

    // Measurement mini-form
    const measureForm = document.createElement('div');
    measureForm.className = 'measurement-form';
    const measureRow = document.createElement('div');
    measureRow.className = 'measurement-form-row';

    const shakesInput = document.createElement('input');
    shakesInput.type = 'number';
    shakesInput.placeholder = 'shk';
    shakesInput.className = 'measure-input-small';

    const driftInput = document.createElement('input');
    driftInput.type = 'number';
    driftInput.placeholder = 'drift';
    driftInput.step = '0.01';
    driftInput.className = 'measure-input-small';

    const magInput = document.createElement('input');
    magInput.type = 'number';
    magInput.placeholder = 'mag';
    magInput.step = '0.001';
    magInput.className = 'measure-input-small';

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = '메모';
    noteInput.className = 'measure-input-note';

    measureRow.appendChild(shakesInput);
    measureRow.appendChild(driftInput);
    measureRow.appendChild(magInput);
    measureRow.appendChild(noteInput);

    const measureButtonRow = document.createElement('div');
    measureButtonRow.style.display = 'flex';
    measureButtonRow.style.justifyContent = 'flex-end';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn--secondary';
    saveBtn.style.fontSize = '11px';
    saveBtn.textContent = '측정값 추가';

    saveBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const payload = {
        shakes: shakesInput.value ? Number(shakesInput.value) : 0,
        maxDrift: driftInput.value ? Number(driftInput.value) : 0,
        maxMagnitude: magInput.value ? Number(magInput.value) : 0,
        note: noteInput.value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/api/sites/${site.id}/measurements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          alert('측정값 추가에 실패했습니다.');
          return;
        }

        shakesInput.value = '';
        driftInput.value = '';
        magInput.value = '';
        noteInput.value = '';
      } catch (err) {
        console.error(err);
        alert('측정값 추가 중 오류가 발생했습니다.');
      }
    });

    measureButtonRow.appendChild(saveBtn);
    measureForm.appendChild(measureRow);
    measureForm.appendChild(measureButtonRow);

    statusCol.appendChild(measureForm);

    // Time col
    const metaCol = document.createElement('div');
    metaCol.className = 'site-meta-time';
    const created = new Date(site.createdAt || Date.now());
    const updated = new Date(site.updatedAt || site.createdAt || Date.now());
    metaCol.textContent = `생성: ${created.toLocaleDateString('ko-KR')} · 수정: ${updated.toLocaleString(
      'ko-KR'
    )}`;

    card.appendChild(main);
    card.appendChild(statusCol);
    card.appendChild(metaCol);

    siteListEl.appendChild(card);
  });
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/api/sites/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      alert('상태 업데이트에 실패했습니다.');
      return;
    }

    const updated = await res.json();
    const idx = sites.findIndex((s) => s.id === id);
    if (idx !== -1) {
      sites[idx] = updated;
      renderSites();
      renderAdminMap();
    }
  } catch (err) {
    console.error(err);
    alert('상태 업데이트 중 오류가 발생했습니다.');
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const payload = {
    name: nameEl.value.trim(),
    address: addressEl.value.trim(),
    latitude: latitudeEl.value || null,
    longitude: longitudeEl.value || null,
    sensorCount: sensorCountEl.value ? Number(sensorCountEl.value) : 0,
    buildingSize: buildingSizeEl.value.trim(),
    buildingYear: buildingYearEl.value.trim(),
    notes: notesEl.value.trim()
  };

  if (!payload.name || !payload.address) {
    alert('현장명과 주소는 필수입니다.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || '현장 생성에 실패했습니다.');
      return;
    }

    const created = await res.json();
    sites.push(created);
    renderSites();
    renderAdminMap();

    formEl.reset();
    latitudeEl.value = '';
    longitudeEl.value = '';
    geocodeResultsEl.innerHTML = '';
    geocodeResultsEl.style.display = 'none';
  } catch (err) {
    console.error(err);
    alert('현장 생성 중 오류가 발생했습니다.');
  }
}

async function searchAddress() {
  const query = addressEl.value.trim();
  if (!query) {
    alert('주소를 입력한 후 검색을 눌러주세요.');
    return;
  }

  geocodeResultsEl.innerHTML = '';
  geocodeResultsEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      alert('주소 검색에 실패했습니다.');
      return;
    }

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) {
      alert('검색 결과가 없습니다.');
      return;
    }

    geocodeResultsEl.style.display = 'block';
    geocodeResultsEl.innerHTML = '';

    results.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'geocode-results-item';
      row.textContent = item.display_name;
      row.addEventListener('click', () => {
        addressEl.value = item.display_name;
        latitudeEl.value = item.lat;
        longitudeEl.value = item.lon;
        geocodeResultsEl.innerHTML = '';
        geocodeResultsEl.style.display = 'none';
      });
      geocodeResultsEl.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    alert('주소 검색에 실패했습니다.');
  }
}

function initAdmin() {
  ensureLoggedIn();
  setupLogout();
  initAdminMap();
  fetchSites();

  statusFilterEl.addEventListener('change', renderSites);
  sizeFilterEl.addEventListener('input', () => {
    renderSites();
  });

  formEl.addEventListener('submit', handleSubmit);
  searchAddressBtn.addEventListener('click', searchAddress);
}

document.addEventListener('DOMContentLoaded', initAdmin);
