// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('bedsUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ensureAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'ADMIN') window.location.href = 'index.html';
  return user;
}

function isNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function fmtCoord(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(6) : '-';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusKo(status) {
  if (status === 'SAFE') return '안전';
  if (status === 'CAUTION') return '주의';
  if (status === 'ALERT') return '경고';
  return status || 'SAFE';
}

function constructionKo(v) {
  if (v === 'DONE') return '공사 완료';
  return '공사 진행 중';
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAdmin();

  // ===== Header =====
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bedsUser');
      window.location.href = 'index.html';
    });
  }

  // ===== Filters/List =====
  const statusFilter = document.getElementById('status-filter');
  const constructionFilter = document.getElementById('construction-filter');
  const sizeFilter = document.getElementById('size-filter');
  const siteListEl = document.getElementById('site-list');
  const siteSummaryEl = document.getElementById('site-summary');
  const detailBodyEl = document.getElementById('site-detail-body');

  // ===== Form =====
  const formTitleEl = document.getElementById('form-title');
  const btnNew = document.getElementById('btn-new');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const siteForm = document.getElementById('site-form');
  const siteIdEl = document.getElementById('siteId');

  const nameEl = document.getElementById('name');
  const addressEl = document.getElementById('address');
  const latEl = document.getElementById('latitude');
  const lonEl = document.getElementById('longitude');

  const constructionStateEl = document.getElementById('constructionState');
  const statusEl = document.getElementById('status');

  const sensorCountEl = document.getElementById('sensorCount');
  const buildingSizeEl = document.getElementById('buildingSize');
  const buildingYearEl = document.getElementById('buildingYear');
  const notesEl = document.getElementById('notes');

  const btnSubmit = document.getElementById('btn-submit');
  const btnDelete = document.getElementById('btn-delete');

  // ===== Geocode =====
  const geocodeResults = document.getElementById('geocode-results');
  const searchBtn = document.getElementById('search-address');

  // ===== Map =====
  let map = null;
  const markerById = new Map(); // siteId -> marker
  let sites = [];
  let selectedSiteId = null;

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

  function clearMarkers() {
    if (!map) return;
    for (const mk of markerById.values()) map.removeLayer(mk);
    markerById.clear();
  }

  function upsertMarkers(list) {
    if (!map) return;
    clearMarkers();

    const bounds = [];
    list.forEach((s) => {
      if (!isNumber(s.latitude) || !isNumber(s.longitude)) return;

      const popup = `
        <div style="min-width:220px">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.name)}</div>
          <div style="font-size:12px;color:#cbd5e1">${escapeHtml(s.address || '')}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">
            ${escapeHtml(constructionKo(s.constructionState || 'IN_PROGRESS'))}
            · ${escapeHtml(statusKo(s.status || 'SAFE'))}
            · 센서 ${Number(s.sensorCount ?? 0)}개
          </div>
        </div>
      `;

      const mk = L.marker([s.latitude, s.longitude]).addTo(map);
      mk.bindPopup(popup);
      mk.on('click', () => {
        selectedSiteId = s.id;
        renderSites();
        renderDetail(s);
        enterEditMode(s);
      });

      markerById.set(String(s.id), mk);
      bounds.push([s.latitude, s.longitude]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  }

  function focusOnSite(s) {
    if (!map) return;
    if (!isNumber(s.latitude) || !isNumber(s.longitude)) return;
    map.setView([s.latitude, s.longitude], 17);

    const mk = markerById.get(String(s.id));
    if (mk) mk.openPopup();
  }

  function renderDetail(s) {
    if (!detailBodyEl) return;

    if (!s) {
      detailBodyEl.textContent = '현장을 선택하면 여기서 상세 정보가 표시됩니다.';
      return;
    }

    detailBodyEl.innerHTML = `
      <div class="grid gap-1">
        <div><span class="text-slate-400">현장명:</span> ${escapeHtml(s.name || '')}</div>
        <div><span class="text-slate-400">주소:</span> ${escapeHtml(s.address || '')}</div>
        <div><span class="text-slate-400">공사상태:</span> ${escapeHtml(constructionKo(s.constructionState || 'IN_PROGRESS'))}</div>
        <div><span class="text-slate-400">위험상태:</span> ${escapeHtml(statusKo(s.status || 'SAFE'))} (${escapeHtml(s.status || 'SAFE')})</div>
        <div><span class="text-slate-400">센서:</span> ${Number(s.sensorCount ?? 0)}개</div>
        <div><span class="text-slate-400">규모:</span> ${escapeHtml(s.buildingSize || '-')}</div>
        <div><span class="text-slate-400">준공:</span> ${escapeHtml(s.buildingYear || '-')}</div>
        <div><span class="text-slate-400">좌표:</span> ${fmtCoord(s.latitude)}, ${fmtCoord(s.longitude)}</div>
        ${s.notes ? `<div class="mt-1"><span class="text-slate-400">메모:</span> ${escapeHtml(s.notes)}</div>` : ''}
      </div>
    `;
  }

  function badgeClass(status) {
    if (status === 'ALERT') return 'badge badge-alert';
    if (status === 'CAUTION') return 'badge badge-caution';
    return 'badge badge-safe';
  }

  function renderSites() {
    if (!siteListEl) return;

    const statusValue = statusFilter ? statusFilter.value : 'ALL';
    const constructionValue = constructionFilter ? constructionFilter.value : 'ALL';
    const sizeValue = sizeFilter ? sizeFilter.value.trim().toLowerCase() : '';

    const filtered = sites.filter((s) => {
      const sStatus = s.status || 'SAFE';
      const sConst = s.constructionState || 'IN_PROGRESS';

      if (statusValue !== 'ALL' && sStatus !== statusValue) return false;
      if (constructionValue !== 'ALL' && sConst !== constructionValue) return false;

      if (sizeValue) {
        const combined = (s.buildingSize || '').toLowerCase();
        if (!combined.includes(sizeValue)) return false;
      }
      return true;
    });

    if (siteSummaryEl) {
      siteSummaryEl.textContent = `총 ${sites.length}개 / 필터 ${filtered.length}개`;
    }

    siteListEl.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '필터에 해당하는 현장이 없습니다.';
      siteListEl.appendChild(empty);
      renderDetail(null);
      upsertMarkers(filtered);
      return;
    }

    filtered.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'site-item' + (String(selectedSiteId) === String(s.id) ? ' site-item-active' : '');

      const main = document.createElement('div');
      main.className = 'site-item-main';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'site-item-name';
      nameSpan.textContent = s.name || '-';

      const addrSpan = document.createElement('span');
      addrSpan.className = 'site-item-address';
      addrSpan.textContent = s.address || '';

      main.appendChild(nameSpan);
      main.appendChild(addrSpan);

      const right = document.createElement('div');
      right.className = 'flex items-center gap-2';

      const cSpan = document.createElement('span');
      cSpan.className = 'badge';
      cSpan.textContent = (s.constructionState === 'DONE') ? 'DONE' : 'PROGRESS';

      const sSpan = document.createElement('span');
      sSpan.className = badgeClass(s.status || 'SAFE');
      sSpan.textContent = s.status || 'SAFE';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary btn-xs';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectedSiteId = s.id;
        renderSites();
        renderDetail(s);
        focusOnSite(s);
        enterEditMode(s);
      });

      right.appendChild(cSpan);
      right.appendChild(sSpan);
      right.appendChild(editBtn);

      item.appendChild(main);
      item.appendChild(right);

      item.addEventListener('click', () => {
        selectedSiteId = s.id;
        renderSites();
        renderDetail(s);
        focusOnSite(s);
      });

      siteListEl.appendChild(item);
    });

    upsertMarkers(filtered);

    const selected = sites.find((x) => String(x.id) === String(selectedSiteId)) || filtered[0];
    if (selected) renderDetail(selected);
  }

  function resetFormToCreate() {
    siteIdEl.value = '';
    siteForm.reset();
    if (geocodeResults) geocodeResults.innerHTML = '';

    if (formTitleEl) formTitleEl.textContent = '새 현장 등록';
    if (btnSubmit) btnSubmit.textContent = '현장 생성';
    if (btnDelete) btnDelete.classList.add('hidden');
    if (btnCancelEdit) btnCancelEdit.classList.add('hidden');
  }

  function enterEditMode(site) {
    if (!site) return;

    siteIdEl.value = site.id ?? '';
    nameEl.value = site.name || '';
    addressEl.value = site.address || '';
    latEl.value = isNumber(site.latitude) ? String(site.latitude) : '';
    lonEl.value = isNumber(site.longitude) ? String(site.longitude) : '';
    sensorCountEl.value = String(site.sensorCount ?? 0);
    buildingSizeEl.value = site.buildingSize || '';
    buildingYearEl.value = site.buildingYear || '';
    notesEl.value = site.notes || '';

    constructionStateEl.value = site.constructionState || 'IN_PROGRESS';
    statusEl.value = site.status || 'SAFE';

    if (geocodeResults) geocodeResults.innerHTML = '';

    if (formTitleEl) formTitleEl.textContent = '현장 수정';
    if (btnSubmit) btnSubmit.textContent = '수정 저장';
    if (btnDelete) btnDelete.classList.remove('hidden');
    if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');
  }

  async function loadSites() {
    const res = await fetch('/api/sites');
    const data = await res.json().catch(() => null);
    const list = data && Array.isArray(data.sites) ? data.sites : (Array.isArray(data) ? data : []);
    sites = list;

    if (!selectedSiteId && sites.length) selectedSiteId = sites[0].id;
    renderSites();
  }

  // ===== Filters events =====
  if (statusFilter) statusFilter.addEventListener('change', renderSites);
  if (constructionFilter) constructionFilter.addEventListener('change', renderSites);
  if (sizeFilter) sizeFilter.addEventListener('input', renderSites);

  // ===== Buttons =====
  if (btnNew) btnNew.addEventListener('click', resetFormToCreate);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetFormToCreate);

  // ===== Geocode: address -> lat/lon =====
  if (searchBtn && addressEl && geocodeResults) {
    searchBtn.addEventListener('click', async () => {
      const query = addressEl.value.trim();
      geocodeResults.innerHTML = '';
      latEl.value = '';
      lonEl.value = '';

      if (!query) {
        geocodeResults.textContent = '주소를 입력해 주세요.';
        return;
      }

      geocodeResults.textContent = '주소를 검색 중입니다...';

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=7&addressdetails=1&q=${encodeURIComponent(query)}`;
        const r = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
        if (!r.ok) {
          geocodeResults.textContent = '주소 검색에 실패했습니다.';
          return;
        }

        const list = await r.json().catch(() => []);
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
            addressEl.value = item.display_name;

            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            latEl.value = Number.isFinite(lat) ? String(lat) : '';
            lonEl.value = Number.isFinite(lon) ? String(lon) : '';

            geocodeResults.innerHTML = '';
            if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
              map.setView([lat, lon], 16);
            }
          });

          geocodeResults.appendChild(div);
        });
      } catch (e) {
        console.error(e);
        geocodeResults.textContent = '주소 검색에 실패했습니다.';
      }
    });
  }

  // ===== Create / Update =====
  if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = siteIdEl.value ? String(siteIdEl.value) : '';
      const payload = {
        name: nameEl.value.trim(),
        address: addressEl.value.trim(),
        latitude: latEl.value ? parseFloat(latEl.value) : null,
        longitude: lonEl.value ? parseFloat(lonEl.value) : null,
        sensorCount: parseInt(sensorCountEl.value || '0', 10),
        buildingSize: buildingSizeEl.value.trim(),
        buildingYear: buildingYearEl.value.trim(),
        notes: notesEl.value.trim(),
        status: statusEl.value,
        constructionState: constructionStateEl.value
      };

      if (!payload.name || !payload.address) {
        alert('현장명과 주소는 필수입니다.');
        return;
      }

      try {
        if (!id) {
          // CREATE
          const res = await fetch('/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false) {
            alert(data.message || '현장 생성에 실패했습니다.');
            return;
          }

          resetFormToCreate();
          await loadSites();
          alert('현장이 등록되었습니다.');
        } else {
          // UPDATE (서버에 PUT 지원 필요)
          const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false) {
            alert(data.message || '현장 수정에 실패했습니다. (서버 PUT 라우트 필요)');
            return;
          }

          await loadSites();
          alert('수정 저장 완료!');
        }
      } catch (err) {
        console.error(err);
        alert('서버 오류가 발생했습니다.');
      }
    });
  }

  // ===== Delete =====
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = siteIdEl.value ? String(siteIdEl.value) : '';
      if (!id) return;

      const s = sites.find((x) => String(x.id) === String(id));
      const name = s?.name || id;

      if (!confirm(`정말로 현장 "${name}"을(를) 삭제하시겠습니까?`)) return;

      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          alert(data.message || '현장 삭제에 실패했습니다.');
          return;
        }
        resetFormToCreate();
        await loadSites();
        alert('삭제 완료!');
      } catch (e) {
        console.error(e);
        alert('서버 오류로 삭제에 실패했습니다.');
      }
    });
  }

  // ===== init =====
  initMap();
  loadSites().catch((e) => {
    console.error(e);
    if (siteSummaryEl) siteSummaryEl.textContent = '현장 목록을 불러오는 중 오류가 발생했습니다.';
  });
});
