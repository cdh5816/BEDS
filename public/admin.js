// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Deb's (Detection Earthquake Building System) project.

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

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function toNumOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtCoord(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(6);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ======================
// ✅ 표기 통일(요청사항)
// - 안전상태 -> "현장조건"
// - SAFE/CAUTION/ALERT는 DB 코드값 유지
// - 화면에만 납품/공사중/영업중으로 보여주기
// ======================
function statusKo(status) {
  if (status === 'SAFE') return '납품현장';
  if (status === 'CAUTION') return '공사중 현장';
  if (status === 'ALERT') return '영업중 현장';
  return status || 'SAFE';
}

function statusBadgeClass(status) {
  if (status === 'ALERT') return 'badge badge-alert';
  if (status === 'CAUTION') return 'badge badge-caution';
  return 'badge badge-safe';
}

function constructionKo(v) {
  if (v === 'DONE') return '공사 완료';
  return '공사 진행 중';
}

function normalizeConstruction(v) {
  const s = String(v ?? '').toUpperCase();
  if (s === 'DONE') return 'DONE';
  return 'IN_PROGRESS';
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAdmin();

  // ======================
  // Top actions
  // ======================
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bedsUser');
      window.location.href = 'index.html';
    });
  }

  // ======================
  // Elements
  // ======================
  const statusFilter = document.getElementById('status-filter');
  const constructionFilter = document.getElementById('construction-filter');
  const qFilter = document.getElementById('q-filter');
  const siteListEl = document.getElementById('site-list');
  const siteSummaryEl = document.getElementById('site-summary');
  const detailBodyEl = document.getElementById('site-detail-body');

  const editForm = document.getElementById('edit-form');
  const editMsg = document.getElementById('edit-msg');
  const editBadge = document.getElementById('edit-badge');

  const editId = document.getElementById('edit-id');
  const editName = document.getElementById('edit-name');
  const editAddress = document.getElementById('edit-address');
  const editLat = document.getElementById('edit-lat');
  const editLon = document.getElementById('edit-lon');
  const editStatus = document.getElementById('edit-status');
  const editConstruction = document.getElementById('edit-construction');

  // ✅ 필드 이름은 그대로 쓰되, 화면 표기는 바뀜
  // sensorCount -> "공사일정"
  // buildingYear -> "실정보고 진행 상황"
  const editSensorCount = document.getElementById('edit-sensorCount');
  const editBuildingSize = document.getElementById('edit-buildingSize');
  const editBuildingYear = document.getElementById('edit-buildingYear');
  const editNotes = document.getElementById('edit-notes');
  const deleteBtn = document.getElementById('delete-site');

  const editGeocodeBtn = document.getElementById('edit-geocode');
  const editGeocodeResults = document.getElementById('edit-geocode-results');
  const editUsePickedBtn = document.getElementById('edit-use-picked');

  // pick
  const pickCoordsEl = document.getElementById('pick-coords');
  const pickAddressEl = document.getElementById('pick-address');
  const pickClearBtn = document.getElementById('pick-clear');

  // create modal
  const openCreateModalBtn = document.getElementById('open-create-modal');
  const createModal = document.getElementById('create-modal');
  const closeCreateModalBtn = document.getElementById('close-create-modal');
  const createBackdrop = document.getElementById('create-modal-backdrop');

  const createForm = document.getElementById('create-form');
  const createMsg = document.getElementById('create-msg');

  const createName = document.getElementById('create-name');
  const createAddress = document.getElementById('create-address');
  const createLat = document.getElementById('create-lat');
  const createLon = document.getElementById('create-lon');
  const createStatus = document.getElementById('create-status');
  const createConstruction = document.getElementById('create-construction');

  const createSensorCount = document.getElementById('create-sensorCount');
  const createBuildingSize = document.getElementById('create-buildingSize');
  const createBuildingYear = document.getElementById('create-buildingYear');
  const createNotes = document.getElementById('create-notes');

  const createGeocodeBtn = document.getElementById('create-geocode');
  const createGeocodeResults = document.getElementById('create-geocode-results');
  const createUsePickedBtn = document.getElementById('create-use-picked');
  const createClearPickedBtn = document.getElementById('create-clear-picked');

  // ======================
  // Map
  // ======================
  let map = null;
  let siteMarkerById = new Map();
  let pickMarker = null;

  let pickedLat = null;
  let pickedLon = null;
  let pickedAddress = null;

  function setPickUI(lat, lon, addr) {
    if (pickCoordsEl) pickCoordsEl.textContent = (lat != null && lon != null) ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
    if (pickAddressEl) pickAddressEl.textContent = addr || '-';
  }

  async function reverseGeocode(lat, lon) {
    // 서버 reverse 있으면 우선
    try {
      const r = await fetch(`/api/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      if (r.ok) {
        const data = await r.json().catch(() => null);
        if (data && data.address) return data.address;
      }
    } catch (_) {}

    // fallback: nominatim reverse
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      if (!r.ok) return null;
      const data = await r.json().catch(() => null);
      return data?.display_name || null;
    } catch (_) {
      return null;
    }
  }

  async function setPicked(lat, lon) {
    pickedLat = lat;
    pickedLon = lon;
    pickedAddress = null;
    setPickUI(lat, lon, '주소 조회 중...');

    const addr = await reverseGeocode(lat, lon);
    pickedAddress = addr || null;
    setPickUI(lat, lon, pickedAddress || '(주소를 찾지 못했습니다)');
  }

  function initMap() {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById('admin-map');
    if (!mapEl) return;

    map = L.map('admin-map').setView([37.5665, 126.9780], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    map.on('click', async (e) => {
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

    setPickUI(null, null, null);
  }

  function clearPickMarker() {
    if (map && pickMarker) map.removeLayer(pickMarker);
    pickMarker = null;
    pickedLat = pickedLon = null;
    pickedAddress = null;
    setPickUI(null, null, null);
  }

  // ======================
  // Data
  // ======================
  let sites = [];
  let selectedSiteId = null;

  function getConstruction(site) {
    return normalizeConstruction(site?.constructionState ?? site?.constructionStatus ?? site?.construction_state);
  }

  function renderDetail(site) {
    if (!detailBodyEl) return;
    if (!site) {
      detailBodyEl.textContent = '왼쪽 목록에서 현장을 선택하세요.';
      return;
    }

    const lat = isFiniteNumber(site.latitude) ? fmtCoord(site.latitude) : '-';
    const lon = isFiniteNumber(site.longitude) ? fmtCoord(site.longitude) : '-';

    detailBodyEl.innerHTML = `
      <div class="grid gap-1">
        <div><span class="text-slate-400">현장명:</span> ${escapeHtml(site.name || '')}</div>
        <div><span class="text-slate-400">주소:</span> ${escapeHtml(site.address || '')}</div>
        <div><span class="text-slate-400">현장조건:</span> ${escapeHtml(statusKo(site.status))} (${escapeHtml(site.status || 'SAFE')})</div>
        <div><span class="text-slate-400">공사:</span> ${escapeHtml(constructionKo(getConstruction(site)))} (${escapeHtml(getConstruction(site))})</div>
        <div><span class="text-slate-400">공사일정:</span> ${Number(site.sensorCount ?? 0)}</div>
        <div><span class="text-slate-400">규모:</span> ${escapeHtml(site.buildingSize || '-')}</div>
        <div><span class="text-slate-400">실정보고 진행 상황:</span> ${escapeHtml(site.buildingYear || '-')}</div>
        <div><span class="text-slate-400">좌표:</span> ${lat}, ${lon}</div>
        ${site.notes ? `<div class="mt-1"><span class="text-slate-400">메모:</span> ${escapeHtml(site.notes)}</div>` : ''}
      </div>
    `;
  }

  function upsertMarkers(filtered) {
    if (!map) return;

    // remove all
    for (const [, mk] of siteMarkerById) {
      try { map.removeLayer(mk); } catch (_) {}
    }
    siteMarkerById = new Map();

    const bounds = [];
    filtered.forEach((s) => {
      const lat = s.latitude;
      const lon = s.longitude;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return;

      const badge = statusKo(s.status || 'SAFE');
      const cko = constructionKo(getConstruction(s));

      const popupHtml = `
        <div style="min-width:240px">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.name || '')}</div>
          <div style="font-size:12px;color:#cbd5e1">${escapeHtml(s.address || '')}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">
            ${badge} · ${cko} · 공사일정 ${Number(s.sensorCount ?? 0)}
          </div>
        </div>
      `;

      const mk = L.marker([lat, lon]).addTo(map);
      mk.bindPopup(popupHtml);
      mk.on('click', () => {
        selectSite(s.id, { pan: false });
      });

      siteMarkerById.set(String(s.id), mk);
      bounds.push([lat, lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  }

  function focusSite(site) {
    if (!map) return;
    const lat = site?.latitude;
    const lon = site?.longitude;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return;

    map.setView([lat, lon], 16, { animate: true });
    const mk = siteMarkerById.get(String(site.id));
    if (mk) mk.openPopup();
  }

  function fillEditForm(site) {
    if (!site) return;

    if (editBadge) editBadge.classList.remove('hidden');

    if (editId) editId.value = String(site.id);
    if (editName) editName.value = site.name || '';
    if (editAddress) editAddress.value = site.address || '';
    if (editLat) editLat.value = isFiniteNumber(site.latitude) ? String(site.latitude) : '';
    if (editLon) editLon.value = isFiniteNumber(site.longitude) ? String(site.longitude) : '';
    if (editSensorCount) editSensorCount.value = String(Number(site.sensorCount ?? 0));
    if (editBuildingSize) editBuildingSize.value = site.buildingSize || '';
    if (editBuildingYear) editBuildingYear.value = site.buildingYear || '';
    if (editNotes) editNotes.value = site.notes || '';

    if (editStatus) editStatus.value = (site.status || 'SAFE');
    if (editConstruction) editConstruction.value = getConstruction(site);

    if (editMsg) editMsg.textContent = '';
  }

  function getFilteredSites() {
    const st = statusFilter ? statusFilter.value : 'ALL';
    const ct = constructionFilter ? constructionFilter.value : 'ALL';
    const q = (qFilter?.value || '').trim().toLowerCase();

    return sites.filter((s) => {
      const status = s.status || 'SAFE';
      const construction = getConstruction(s);

      if (st !== 'ALL' && status !== st) return false;
      if (ct !== 'ALL' && construction !== ct) return false;

      if (q) {
        const hay = `${s.name || ''} ${s.address || ''} ${s.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderList() {
    if (!siteListEl) return;

    const filtered = getFilteredSites();

    if (siteSummaryEl) {
      siteSummaryEl.textContent = `총 ${sites.length}개 · 표시 ${filtered.length}개`;
    }

    siteListEl.innerHTML = '';

    if (!filtered.length) {
      siteListEl.innerHTML = `<div class="empty-state">조건에 맞는 현장이 없습니다.</div>`;
      renderDetail(null);
      upsertMarkers([]);
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

      const badge = document.createElement('span');
      badge.className = statusBadgeClass(s.status || 'SAFE');
      // ✅ SAFE/CAUTION/ALERT 코드 대신 “납품현장/공사중/영업중” 표시
      badge.textContent = statusKo(s.status || 'SAFE');

      item.appendChild(main);
      item.appendChild(badge);

      item.addEventListener('click', () => {
        selectSite(s.id, { pan: true });
      });

      siteListEl.appendChild(item);
    });

    upsertMarkers(filtered);

    // 선택 유지/보정
    if (!selectedSiteId) {
      selectSite(filtered[0].id, { pan: false, silent: true });
    } else {
      const cur = sites.find((x) => String(x.id) === String(selectedSiteId));
      if (cur) {
        renderDetail(cur);
        fillEditForm(cur);
      }
    }
  }

  function selectSite(id, opt = {}) {
    const { pan = true, silent = false } = opt;
    const site = sites.find((x) => String(x.id) === String(id));
    if (!site) return;

    selectedSiteId = site.id;

    renderList(); // active 갱신

    renderDetail(site);
    fillEditForm(site);
    if (pan) focusSite(site);

    if (!silent && editMsg) {
      editMsg.textContent = `선택됨: ${site.name || site.id}`;
    }
  }

  async function loadSites() {
    const res = await fetch('/api/sites');
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.sites) ? data.sites : [];
    sites = list;

    if (!selectedSiteId && sites.length) selectedSiteId = sites[0].id;
    renderList();

    const cur = sites.find((x) => String(x.id) === String(selectedSiteId));
    if (cur) {
      renderDetail(cur);
      fillEditForm(cur);
      focusSite(cur);
    }
  }

  // ======================
  // Geocode helpers
  // ======================
  async function runGeocode(query, mountEl, onPick) {
    if (!mountEl) return;
    mountEl.innerHTML = '';
    if (!query) {
      mountEl.textContent = '주소를 입력해 주세요.';
      return;
    }

    mountEl.textContent = '주소를 검색 중입니다...';

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=7&addressdetails=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      if (!res.ok) {
        mountEl.textContent = '주소 검색에 실패했습니다.';
        return;
      }

      const list = await res.json().catch(() => []);
      if (!Array.isArray(list) || !list.length) {
        mountEl.textContent = '검색 결과가 없습니다.';
        return;
      }

      mountEl.innerHTML = '';
      list.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'geocode-item';
        div.textContent = item.display_name;

        div.addEventListener('click', async () => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);

          onPick?.({
            address: item.display_name,
            latitude: Number.isFinite(lat) ? lat : null,
            longitude: Number.isFinite(lon) ? lon : null
          });

          // 지도 이동 + 핀도 같이
          if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
            map.setView([lat, lon], 16, { animate: true });

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
          }

          mountEl.innerHTML = '';
        });

        mountEl.appendChild(div);
      });
    } catch (e) {
      console.error(e);
      mountEl.textContent = '주소 검색에 실패했습니다.';
    }
  }

  // ======================
  // Edit actions
  // ======================
  if (editGeocodeBtn) {
    editGeocodeBtn.addEventListener('click', async () => {
      if (editGeocodeResults) editGeocodeResults.innerHTML = '';
      await runGeocode(editAddress?.value?.trim() || '', editGeocodeResults, ({ address, latitude, longitude }) => {
        if (editAddress) editAddress.value = address || '';
        if (editLat) editLat.value = latitude != null ? String(latitude) : '';
        if (editLon) editLon.value = longitude != null ? String(longitude) : '';
      });
    });
  }

  if (editUsePickedBtn) {
    editUsePickedBtn.addEventListener('click', () => {
      if (pickedLat == null || pickedLon == null) {
        alert('먼저 지도에서 핀을 찍어 주세요.');
        return;
      }
      if (editLat) editLat.value = String(pickedLat);
      if (editLon) editLon.value = String(pickedLon);
      if (pickedAddress && editAddress) editAddress.value = pickedAddress;
      if (editMsg) editMsg.textContent = '핀 좌표가 수정 폼에 반영되었습니다.';
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editMsg) editMsg.textContent = '';

      const id = editId?.value;
      if (!id) {
        alert('수정할 현장을 먼저 선택하세요.');
        return;
      }

      const body = {
        name: (editName?.value || '').trim(),
        address: (editAddress?.value || '').trim(),
        latitude: toNumOrNull(editLat?.value),
        longitude: toNumOrNull(editLon?.value),
        status: (editStatus?.value || 'SAFE'),
        constructionState: (editConstruction?.value || 'IN_PROGRESS'),
        sensorCount: Number(editSensorCount?.value || 0), // 공사일정
        buildingSize: (editBuildingSize?.value || '').trim(),
        buildingYear: (editBuildingYear?.value || '').trim(), // 실정보고 진행 상황
        notes: (editNotes?.value || '').trim()
      };

      if (!body.name || !body.address) {
        alert('현장명과 주소는 필수입니다.');
        return;
      }

      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          alert(data.message || '저장에 실패했습니다.');
          return;
        }

        if (editMsg) editMsg.textContent = '저장 완료 ✔';
        await loadSites();
        selectSite(id, { pan: false, silent: true });
      } catch (err) {
        console.error(err);
        alert('서버 오류로 저장에 실패했습니다.');
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const id = editId?.value;
      if (!id) {
        alert('삭제할 현장을 먼저 선택하세요.');
        return;
      }
      const site = sites.find((x) => String(x.id) === String(id));
      const name = site?.name || id;

      if (!confirm(`정말로 "${name}" 현장을 삭제할까요?`)) return;

      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          alert(data.message || '삭제에 실패했습니다.');
          return;
        }

        if (editMsg) editMsg.textContent = '삭제 완료';
        selectedSiteId = null;
        if (editBadge) editBadge.classList.add('hidden');
        if (editForm) editForm.reset();
        await loadSites();
      } catch (err) {
        console.error(err);
        alert('서버 오류로 삭제에 실패했습니다.');
      }
    });
  }

  // ======================
  // Pick clear
  // ======================
  if (pickClearBtn) {
    pickClearBtn.addEventListener('click', () => {
      clearPickMarker();
    });
  }

  // ======================
  // Filters
  // ======================
  if (statusFilter) statusFilter.addEventListener('change', renderList);
  if (constructionFilter) constructionFilter.addEventListener('change', renderList);
  if (qFilter) qFilter.addEventListener('input', renderList);

  // ======================
  // Create modal open/close
  // ======================
  function openCreateModal() {
    if (!createModal) return;
    createModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (createMsg) createMsg.textContent = '';
  }
  function closeCreateModal() {
    if (!createModal) return;
    createModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (createForm) createForm.reset();
    if (createGeocodeResults) createGeocodeResults.innerHTML = '';
  }

  if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', openCreateModal);
  if (closeCreateModalBtn) closeCreateModalBtn.addEventListener('click', closeCreateModal);
  if (createBackdrop) createBackdrop.addEventListener('click', closeCreateModal);

  // create geocode
  if (createGeocodeBtn) {
    createGeocodeBtn.addEventListener('click', async () => {
      if (createGeocodeResults) createGeocodeResults.innerHTML = '';
      await runGeocode(createAddress?.value?.trim() || '', createGeocodeResults, ({ address, latitude, longitude }) => {
        if (createAddress) createAddress.value = address || '';
        if (createLat) createLat.value = latitude != null ? String(latitude) : '';
        if (createLon) createLon.value = longitude != null ? String(longitude) : '';
      });
    });
  }

  if (createUsePickedBtn) {
    createUsePickedBtn.addEventListener('click', () => {
      if (pickedLat == null || pickedLon == null) {
        alert('먼저 지도에서 핀을 찍어 주세요.');
        return;
      }
      if (createLat) createLat.value = String(pickedLat);
      if (createLon) createLon.value = String(pickedLon);
      if (pickedAddress && createAddress) createAddress.value = pickedAddress;
      if (createMsg) createMsg.textContent = '핀 좌표가 등록 폼에 반영되었습니다.';
    });
  }

  if (createClearPickedBtn) {
    createClearPickedBtn.addEventListener('click', () => {
      clearPickMarker();
    });
  }

  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (createMsg) createMsg.textContent = '';

      const body = {
        name: (createName?.value || '').trim(),
        address: (createAddress?.value || '').trim(),
        latitude: toNumOrNull(createLat?.value),
        longitude: toNumOrNull(createLon?.value),
        status: (createStatus?.value || 'SAFE'),
        constructionState: (createConstruction?.value || 'IN_PROGRESS'),
        sensorCount: Number(createSensorCount?.value || 0), // 공사일정
        buildingSize: (createBuildingSize?.value || '').trim(),
        buildingYear: (createBuildingYear?.value || '').trim(), // 실정보고 진행 상황
        notes: (createNotes?.value || '').trim()
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

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          alert(data.message || '등록에 실패했습니다.');
          return;
        }

        if (createMsg) createMsg.textContent = '등록 완료 ✔';
        await loadSites();

        // 새로 만든 것 선택
        const createdId = data?.site?.id;
        if (createdId) selectSite(createdId, { pan: true, silent: true });

        closeCreateModal();
      } catch (err) {
        console.error(err);
        alert('서버 오류로 등록에 실패했습니다.');
      }
    });
  }

  // ======================
  // Boot
  // ======================
  initMap();
  loadSites().catch((e) => {
    console.error(e);
    if (siteSummaryEl) siteSummaryEl.textContent = '현장 목록을 불러오지 못했습니다.';
  });
});
