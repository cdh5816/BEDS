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

function isNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function fmtCoord(n) {
  return Number(n).toFixed(6);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAdmin();

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

  const detailBodyEl = document.getElementById('site-detail-body');

  // form
  const siteForm = document.getElementById('site-form');
  const addrInput = document.getElementById('address');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');

  const geocodeResults = document.getElementById('geocode-results');
  const searchBtn = document.getElementById('search-address');

  // pick panel
  const pickCoordsEl = document.getElementById('pick-coords');
  const pickAddressEl = document.getElementById('pick-address');
  const pickUseBtn = document.getElementById('pick-use');
  const pickClearBtn = document.getElementById('pick-clear');

  let sites = [];
  let selectedSiteId = null;

  // map
  let map = null;
  let siteMarkers = [];      // markers for sites
  let siteMarkerById = {};   // id -> marker
  let pickMarker = null;     // marker for registration pick

  let pickedLat = null;
  let pickedLon = null;
  let pickedAddress = null;

  function setPickUI(lat, lon, addressText) {
    if (pickCoordsEl) pickCoordsEl.textContent = (lat != null && lon != null) ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : '-';
    if (pickAddressEl) pickAddressEl.textContent = addressText || '-';
  }

  async function reverseGeocode(lat, lon) {
    // 1) 서버 reverse(있으면 제일 안정적)
    try {
      const r = await fetch(`/api/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      if (r.ok) {
        const data = await r.json().catch(() => null);
        if (data && data.address) return data.address;
      }
    } catch (e) {
      // ignore
    }

    // 2) 없으면 Nominatim reverse (무료, 가끔 느릴 수 있음)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      if (!r.ok) return null;
      const data = await r.json().catch(() => null);
      return data?.display_name || null;
    } catch (e) {
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

    // ✅ 지도 클릭 = 등록 좌표 보정 핀 찍기
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

    // 초기 pick UI
    setPickUI(null, null, null);
  }

  function clearSiteMarkers() {
    if (!map) return;
    siteMarkers.forEach((m) => map.removeLayer(m));
    siteMarkers = [];
    siteMarkerById = {};
  }

  function renderSiteMarkers(currentSites) {
    if (!map) return;
    clearSiteMarkers();

    const bounds = [];
    currentSites.forEach((s) => {
      if (isNumber(s.latitude) && isNumber(s.longitude)) {
        const marker = L.marker([s.latitude, s.longitude]).addTo(map);
        marker.bindPopup(`
          <div style="min-width:220px">
            <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.name || '')}</div>
            <div style="font-size:12px;color:#cbd5e1">${escapeHtml(s.address || '')}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:6px">
              센서 ${Number(s.sensorCount ?? 0)}개 · ${escapeHtml(s.buildingSize || '-')} · ${escapeHtml(s.buildingYear || '-')}
            </div>
          </div>
        `);
        marker.on('click', () => {
          selectedSiteId = s.id;
          renderSites();
          renderDetail(s);
        });

        siteMarkers.push(marker);
        siteMarkerById[String(s.id)] = marker;
        bounds.push([s.latitude, s.longitude]);
      }
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  }

  function renderDetail(site) {
    if (!detailBodyEl) return;
    if (!site) {
      detailBodyEl.textContent = '현장을 선택하면 여기서 상세 정보가 표시됩니다.';
      return;
    }

    const status = site.status || 'SAFE';
    const statusKo = status === 'SAFE' ? '안전' : status === 'CAUTION' ? '주의' : '경고';

    const latText = isNumber(site.latitude) ? fmtCoord(site.latitude) : '-';
    const lonText = isNumber(site.longitude) ? fmtCoord(site.longitude) : '-';

    detailBodyEl.innerHTML = `
      <div class="grid gap-1">
        <div><span class="text-slate-400">현장명:</span> ${escapeHtml(site.name || '')}</div>
        <div><span class="text-slate-400">주소:</span> ${escapeHtml(site.address || '')}</div>
        <div><span class="text-slate-400">상태:</span> ${escapeHtml(statusKo)} (${escapeHtml(status)})</div>
        <div><span class="text-slate-400">센서:</span> ${Number(site.sensorCount ?? 0)}개</div>
        <div><span class="text-slate-400">규모:</span> ${escapeHtml(site.buildingSize || '-')}</div>
        <div><span class="text-slate-400">준공:</span> ${escapeHtml(site.buildingYear || '-')}</div>
        <div><span class="text-slate-400">좌표:</span> ${latText}, ${lonText}</div>
        ${site.notes ? `<div class="mt-1"><span class="text-slate-400">메모:</span> ${escapeHtml(site.notes)}</div>` : ''}
      </div>
    `;
  }

  function focusOnSite(site) {
    if (!map) return;
    if (!isNumber(site.latitude) || !isNumber(site.longitude)) return;

    map.setView([site.latitude, site.longitude], 17);

    const mk = siteMarkerById[String(site.id)];
    if (mk) {
      mk.openPopup();
    }
  }

  function renderSites() {
    if (!siteListEl) return;

    const statusValue = statusFilter ? statusFilter.value : 'ALL';
    const sizeValue = sizeFilter ? sizeFilter.value.trim().toLowerCase() : '';

    const filtered = sites.filter((s) => {
      if (statusValue !== 'ALL' && (s.status || 'SAFE') !== statusValue) return false;
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

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '등록된 현장이 없거나, 필터에 해당하는 현장이 없습니다.';
      siteListEl.appendChild(empty);
      renderDetail(null);
      renderSiteMarkers(filtered);
      return;
    }

    filtered.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'site-item' + (selectedSiteId === s.id ? ' site-item-active' : '');

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

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-secondary btn-xs';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm(`정말로 현장 "${s.name}"을(를) 삭제하시겠습니까?`)) return;
        try {
          const res = await fetch(`/api/sites/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            alert(data.message || '현장 삭제에 실패했습니다.');
            return;
          }
          await loadSites();
        } catch (err) {
          console.error(err);
          alert('서버 오류로 현장 삭제에 실패했습니다.');
        }
      });
      item.appendChild(deleteBtn);

      // ✅ 현장 클릭 시: 선택 + 상세 + 지도 이동 + 팝업
      item.addEventListener('click', () => {
        selectedSiteId = s.id;
        renderSites();     // active 표시 갱신
        renderDetail(s);
        focusOnSite(s);
      });

      siteListEl.appendChild(item);
    });

    renderSiteMarkers(filtered);

    // 선택된 현장이 있으면 상세 표시 보정
    const selected = sites.find((x) => x.id === selectedSiteId) || filtered[0];
    if (selected) renderDetail(selected);
  }

  async function loadSites() {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      sites = data && Array.isArray(data.sites) ? data.sites : [];

      if (!selectedSiteId && sites.length) selectedSiteId = sites[0].id;
      renderSites();
    } catch (err) {
      console.error(err);
      if (siteSummaryEl) siteSummaryEl.textContent = '현장 목록을 불러오는 중 오류가 발생했습니다.';
    }
  }

  if (statusFilter) statusFilter.addEventListener('change', renderSites);
  if (sizeFilter) sizeFilter.addEventListener('input', renderSites);

  // =========================
  // 주소 검색 (Nominatim)
  // =========================
  if (searchBtn && addrInput && geocodeResults) {
    searchBtn.addEventListener('click', async () => {
      const query = addrInput.value.trim();
      geocodeResults.innerHTML = '';
      if (latInput) latInput.value = '';
      if (lngInput) lngInput.value = '';

      if (!query) {
        geocodeResults.textContent = '주소를 입력해 주세요.';
        return;
      }

      geocodeResults.textContent = '주소를 검색 중입니다...';

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=7&addressdetails=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
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

          div.addEventListener('click', async () => {
            addrInput.value = item.display_name;

            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);

            if (latInput) latInput.value = String(lat);
            if (lngInput) lngInput.value = String(lon);

            geocodeResults.innerHTML = '';

            // 지도 이동 + 등록 핀도 같이 찍어줌(바로 미세조정 가능)
            if (map) {
              map.setView([lat, lon], 16);

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
          });

          geocodeResults.appendChild(div);
        });
      } catch (err) {
        console.error(err);
        geocodeResults.textContent = '주소 검색에 실패했습니다.';
      }
    });
  }

  // =========================
  // 핀 좌표 -> 등록 반영
  // =========================
  if (pickUseBtn) {
    pickUseBtn.addEventListener('click', () => {
      if (pickedLat == null || pickedLon == null) {
        alert('먼저 지도에서 위치를 클릭해 핀을 찍어 주세요.');
        return;
      }
      if (latInput) latInput.value = String(pickedLat);
      if (lngInput) lngInput.value = String(pickedLon);

      // 주소도 보정된 값이 있으면 주소 input도 같이 바꿔줌(선택)
      if (pickedAddress && addrInput) {
        addrInput.value = pickedAddress;
      }

      alert('좌표(및 가능하면 주소)가 현장 등록 폼에 반영되었습니다.');
    });
  }

  if (pickClearBtn) {
    pickClearBtn.addEventListener('click', () => {
      if (map && pickMarker) {
        map.removeLayer(pickMarker);
      }
      pickMarker = null;
      pickedLat = null;
      pickedLon = null;
      pickedAddress = null;
      setPickUI(null, null, null);
    });
  }

  // =========================
  // 현장 생성
  // =========================
  if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const body = {
        name: document.getElementById('name').value.trim(),
        address: (addrInput?.value || '').trim(),
        latitude: latInput && latInput.value ? parseFloat(latInput.value) : null,
        longitude: lngInput && lngInput.value ? parseFloat(lngInput.value) : null,
        sensorCount: parseInt(document.getElementById('sensorCount').value || '0', 10),
        buildingSize: document.getElementById('buildingSize').value.trim(),
        buildingYear: document.getElementById('buildingYear').value.trim(),
        notes: document.getElementById('notes').value.trim()
      };

      if (!body.name || !body.address) {
        alert('현장명과 주소는 필수입니다.');
        return;
      }

      // 좌표가 없으면 강하게 유도(형님이 원하는 “정확한 위치” 핵심)
      if (!isNumber(body.latitude) || !isNumber(body.longitude)) {
        const ok = confirm('좌표(위도/경도)가 비어 있습니다.\n지도에서 핀을 찍고 “이 좌표를 등록에 반영”을 누른 뒤 등록하는 걸 권장합니다.\n그래도 등록할까요?');
        if (!ok) return;
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

        await res.json().catch(() => null);

        siteForm.reset();
        if (latInput) latInput.value = '';
        if (lngInput) lngInput.value = '';
        if (geocodeResults) geocodeResults.innerHTML = '';

        await loadSites();
        alert('현장이 등록되었습니다.');
      } catch (err) {
        console.error(err);
        alert('서버 오류로 현장 생성에 실패했습니다.');
      }
    });
  }

  // util: XSS-safe for popup/detail
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  initMap();
  loadSites();
});
