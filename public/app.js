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

async function fetchSites() {
  const res = await fetch(`${API_BASE}/api/sites`);
  sites = await res.json();
  renderSites();
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
    { label: '위험', value: caution, className: 'site-summary-caution' },
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
    empty.textContent = '등록된 현장이 없거나, 필터에 해당하는 현장이 없습니다.';
    siteListEl.appendChild(empty);
    return;
  }

  filtered.forEach((site) => {
    const card = document.createElement('article');
    card.className = 'site-card';

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
    sensorPill.innerHTML = `<strong>센서</strong>${site.sensorCount ?? 0}개`;
    meta.appendChild(sensorPill);

    if (site.notes) {
      const notesPill = document.createElement('span');
      notesPill.className = 'meta-pill';
      notesPill.innerHTML = `<strong>메모</strong>${site.notes}`;
      meta.appendChild(notesPill);
    }

    main.appendChild(meta);

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
    else if (site.status === 'CAUTION') labelText = '위험';
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
      else if (value === 'CAUTION') opt.textContent = '위험 (노랑)';
      else opt.textContent = '경고 (빨강)';

      if (value === site.status) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      updateStatus(site.id, select.value);
    });

    selectWrap.appendChild(select);
    statusCol.appendChild(selectWrap);

    const metaCol = document.createElement('div');
    metaCol.className = 'site-meta-time';
    const created = new Date(site.createdAt || Date.now());
    const updated = new Date(site.updatedAt || site.createdAt || Date.now());
    metaCol.textContent = `등록: ${created.toLocaleDateString('ko-KR')} · 수정: ${updated.toLocaleString(
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
      alert('상태 변경에 실패했습니다.');
      return;
    }

    const updated = await res.json();
    const idx = sites.findIndex((s) => s.id === id);
    if (idx !== -1) {
      sites[idx] = updated;
      renderSites();
    }
  } catch (err) {
    console.error(err);
    alert('상태 변경 중 오류가 발생했습니다.');
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
    alert('현장 이름과 주소는 필수입니다.');
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
      alert(data.message || '현장 등록에 실패했습니다.');
      return;
    }

    const created = await res.json();
    sites.push(created);
    renderSites();

    formEl.reset();
    latitudeEl.value = '';
    longitudeEl.value = '';
    geocodeResultsEl.innerHTML = '';
    geocodeResultsEl.style.display = 'none';
  } catch (err) {
    console.error(err);
    alert('현장 등록 중 오류가 발생했습니다.');
  }
}

async function searchAddress() {
  const query = addressEl.value.trim();
  if (!query) {
    alert('검색할 주소를 입력하세요.');
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

    // 결과 리스트 UI 표시
    geocodeResultsEl.style.display = 'block';
    geocodeResultsEl.innerHTML = '';

    results.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'geocode-results-item';
      row.textContent = item.address;
      row.addEventListener('click', () => {
        addressEl.value = item.address;
        latitudeEl.value = item.latitude;
        longitudeEl.value = item.longitude;
        geocodeResultsEl.innerHTML = '';
        geocodeResultsEl.style.display = 'none';
      });
      geocodeResultsEl.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    alert('주소 검색 중 오류가 발생했습니다.');
  }
}

function init() {
  fetchSites();

  statusFilterEl.addEventListener('change', renderSites);
  sizeFilterEl.addEventListener('input', () => {
    renderSites();
  });

  formEl.addEventListener('submit', handleSubmit);
  searchAddressBtn.addEventListener('click', searchAddress);
}

document.addEventListener('DOMContentLoaded', init);
