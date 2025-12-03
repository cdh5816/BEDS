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
    { label: 'All', value: total, className: '' },
    { label: 'Safe', value: safe, className: 'site-summary-safe' },
    { label: 'Caution', value: caution, className: 'site-summary-caution' },
    { label: 'Alert', value: alert, className: 'site-summary-alert' }
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
    empty.textContent = 'No sites found.';
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
    sizePill.innerHTML = `<strong>Size</strong>${site.buildingSize || '-'}`;
    meta.appendChild(sizePill);

    const yearPill = document.createElement('span');
    yearPill.className = 'meta-pill';
    yearPill.innerHTML = `<strong>Year</strong>${site.buildingYear || '-'}`;
    meta.appendChild(yearPill);

    const sensorPill = document.createElement('span');
    sensorPill.className = 'meta-pill';
    sensorPill.innerHTML = `<strong>Sensors</strong>${site.sensorCount ?? 0}`;
    meta.appendChild(sensorPill);

    if (site.notes) {
      const notesPill = document.createElement('span');
      notesPill.className = 'meta-pill';
      notesPill.innerHTML = `<strong>Notes</strong>${site.notes}`;
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
    if (site.status === 'SAFE') labelText = 'SAFE';
    else if (site.status === 'CAUTION') labelText = 'CAUTION';
    else labelText = 'ALERT';
    label.textContent = labelText;
    badge.appendChild(label);

    statusCol.appendChild(badge);

    const selectWrap = document.createElement('div');
    selectWrap.className = 'status-select-wrapper';

    const select = document.createElement('select');
    ['SAFE', 'CAUTION', 'ALERT'].forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      if (value === 'SAFE') opt.textContent = 'Safe (green)';
      else if (value === 'CAUTION') opt.textContent = 'Caution (yellow)';
      else opt.textContent = 'Alert (red)';

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
    noteInput.placeholder = 'note';
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
    saveBtn.textContent = 'Add measurement';

    saveBtn.addEventListener('click', async () => {
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
          alert('Failed to add measurement.');
          return;
        }

        shakesInput.value = '';
        driftInput.value = '';
        magInput.value = '';
        noteInput.value = '';
      } catch (err) {
        console.error(err);
        alert('Error while adding measurement.');
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
    metaCol.textContent = `Created: ${created.toLocaleDateString('ko-KR')} · Updated: ${updated.toLocaleString(
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
      alert('Failed to update status.');
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
    alert('Error while updating status.');
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
    alert('Site name and address are required.');
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
      alert(data.message || 'Failed to create site.');
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
    alert('Error while creating site.');
  }
}

async function searchAddress() {
  const query = addressEl.value.trim();
  if (!query) {
    alert('Enter address before searching.');
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
  fetchSites();

  statusFilterEl.addEventListener('change', renderSites);
  sizeFilterEl.addEventListener('input', () => {
    renderSites();
  });

  formEl.addEventListener('submit', handleSubmit);
  searchAddressBtn.addEventListener('click', searchAddress);
}

document.addEventListener('DOMContentLoaded', initAdmin);
