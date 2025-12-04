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

  function renderSelectedSiteDetail() {
    const container = document.getElementById('selected-site-detail');
    if (!container) return;
    const site = sites.find((s) => s.id === selectedSiteId);
    if (!site) {
      container.innerHTML = '<p class="help-text">왼쪽 목록에서 현장을 선택하면 상세 정보와 계측값을 수정할 수 있습니다.</p>';
      return;
    }

    const fullAddress = [site.address || '', site.detailAddress || ''].filter(Boolean).join(' ').trim();
    const kpiTodayEvents = typeof site.kpiTodayEvents === 'number' ? site.kpiTodayEvents : 0;
    const kpiTodayMaxMag = typeof site.kpiTodayMaxMag === 'number' ? site.kpiTodayMaxMag : 0;
    const kpiTodayMaxDrift = typeof site.kpiTodayMaxDrift === 'number' ? site.kpiTodayMaxDrift : 0;
    const kpi30dAlerts = typeof site.kpi30dAlerts === 'number' ? site.kpi30dAlerts : 0;
    const status = site.status || 'SAFE';

    container.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">기본 정보</div>
        <div class="form-row">
          <label>현장명</label>
          <div class="text-xs text-slate-200">${site.name}</div>
        </div>
        <div class="form-row">
          <label>주소</label>
          <div class="text-xs text-slate-200">${fullAddress || '-'}</div>
        </div>
        <div class="form-row">
          <label for="detail-detailAddress">상세주소</label>
          <input type="text" id="detail-detailAddress" value="${site.detailAddress || ''}" placeholder="예: 10층 1001호" />
        </div>
        <div class="form-row">
          <label for="detail-status">상태</label>
          <select id="detail-status">
            <option value="SAFE"${status === 'SAFE' ? ' selected' : ''}>안전</option>
            <option value="CAUTION"${status === 'CAUTION' ? ' selected' : ''}>주의</option>
            <option value="ALERT"${status === 'ALERT' ? ' selected' : ''}>경고</option>
          </select>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">센서 및 건물 정보</div>
        <div class="form-row">
          <label for="detail-sensorCount">센서 설치 개수</label>
          <input type="number" id="detail-sensorCount" value="${typeof site.sensorCount === 'number' ? site.sensorCount : 0}" min="0" />
        </div>
        <div class="form-row">
          <label for="detail-buildingSize">건물 규모</label>
          <input type="text" id="detail-buildingSize" value="${site.buildingSize || ''}" placeholder="예: 지상 20F, 연면적 12,000㎡" />
        </div>
        <div class="form-row">
          <label for="detail-buildingYear">준공 연도</label>
          <input type="text" id="detail-buildingYear" value="${site.buildingYear || ''}" placeholder="예: 2005" />
        </div>
        <div class="form-row">
          <label for="detail-notes">비고 (분류용)</label>
          <textarea id="detail-notes" rows="2" placeholder="예: 병원동, 내진설계 적용, B동만 계측 등">${site.notes || ''}</textarea>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">계측값 (고객 페이지에 표시)</div>
        <div class="form-row">
          <label for="detail-kpi-events">오늘 이벤트 수</label>
          <input type="number" id="detail-kpi-events" min="0" value="${kpiTodayEvents}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxmag">오늘 최대 진동 (g)</label>
          <input type="number" id="detail-kpi-maxmag" step="0.01" min="0" value="${kpiTodayMaxMag}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxdrift">오늘 최대 변위 (mm)</label>
          <input type="number" id="detail-kpi-maxdrift" step="0.01" min="0" value="${kpiTodayMaxDrift}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-alerts">최근 30일 경고 횟수</label>
          <input type="number" id="detail-kpi-alerts" min="0" value="${kpi30dAlerts}" />
        </div>
      </div>

      <div class="detail-section">
        <button type="button" id="detail-save" class="btn btn-primary">변경 사항 저장</button>
        <button type="button" id="detail-delete" class="btn btn-danger" style="margin-left:0.5rem;">현장 삭제</button>
      </div>
    `;

    const saveBtn = container.querySelector('#detail-save');
    const deleteBtn = container.querySelector('#detail-delete');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const body = {
            detailAddress: container.querySelector('#detail-detailAddress').value.trim(),
            status: container.querySelector('#detail-status').value,
            sensorCount: parseInt(container.querySelector('#detail-sensorCount').value || '0', 10),
            buildingSize: container.querySelector('#detail-buildingSize').value.trim(),
            buildingYear: container.querySelector('#detail-buildingYear').value.trim(),
            notes: container.querySelector('#detail-notes').value.trim(),
            kpiTodayEvents: parseInt(container.querySelector('#detail-kpi-events').value || '0', 10),
            kpiTodayMaxMag: parseFloat(container.querySelector('#detail-kpi-maxmag').value || '0'),
            kpiTodayMaxDrift: parseFloat(container.querySelector('#detail-kpi-maxdrift').value || '0'),
            kpi30dAlerts: parseInt(container.querySelector('#detail-kpi-alerts').value || '0', 10)
          };
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            alert('현장 정보를 저장하는 중 오류가 발생했습니다.');
            return;
          }
          const data = await res.json();
          const updated = data && data.site ? data.site : null;
          if (updated) {
            const idx = sites.findIndex((s) => s.id === updated.id);
            if (idx !== -1) {
              sites[idx] = updated;
            }
            renderSites();
            renderSelectedSiteDetail();
            alert('저장되었습니다.');
          }
        } catch (err) {
          console.error(err);
          alert('서버 오류로 저장에 실패했습니다.');
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!window.confirm('정말 이 현장을 삭제하시겠습니까?\n연결된 고객 계정의 권한에서도 제거됩니다.')) {
          return;
        }
        try {
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            alert('현장을 삭제하는 중 오류가 발생했습니다.');
            return;
          }
          sites = sites.filter((s) => s.id !== site.id);
          selectedSiteId = null;
          renderSites();
          renderSelectedSiteDetail();
          alert('삭제되었습니다.');
        } catch (err) {
          console.error(err);
          alert('서버 오류로 삭제에 실패했습니다.');
        }
      });
    }
  }

  function renderMarkers(currentSites) {
    if (!map) return;
    markers.forEach((m) => map.removeLayer(m));
    markers = [];
    const bounds = [];
    currentSites.forEach((s) => {
      if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
        const marker = L.marker([s.latitude, s.longitude]).addTo(map);
        marker.bindPopup(`<strong>${s.name}</strong><br>${[[s.address || '', s.detailAddress || ''].filter(Boolean).join(' '), s.detailAddress || ''].filter(Boolean).join(' ')}`);
        markers.push(marker);
        bounds.push([s.latitude, s.longitude]);
      }
    });
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  function renderSelectedSiteDetail() {
    const container = document.getElementById('selected-site-detail');
    if (!container) return;
    const site = sites.find((s) => s.id === selectedSiteId);
    if (!site) {
      container.innerHTML = '<p class="help-text">왼쪽 목록에서 현장을 선택하면 상세 정보와 계측값을 수정할 수 있습니다.</p>';
      return;
    }

    const fullAddress = [site.address || '', site.detailAddress || ''].filter(Boolean).join(' ').trim();
    const kpiTodayEvents = typeof site.kpiTodayEvents === 'number' ? site.kpiTodayEvents : 0;
    const kpiTodayMaxMag = typeof site.kpiTodayMaxMag === 'number' ? site.kpiTodayMaxMag : 0;
    const kpiTodayMaxDrift = typeof site.kpiTodayMaxDrift === 'number' ? site.kpiTodayMaxDrift : 0;
    const kpi30dAlerts = typeof site.kpi30dAlerts === 'number' ? site.kpi30dAlerts : 0;
    const status = site.status || 'SAFE';

    container.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">기본 정보</div>
        <div class="form-row">
          <label>현장명</label>
          <div class="text-xs text-slate-200">${site.name}</div>
        </div>
        <div class="form-row">
          <label>주소</label>
          <div class="text-xs text-slate-200">${fullAddress || '-'}</div>
        </div>
        <div class="form-row">
          <label for="detail-detailAddress">상세주소</label>
          <input type="text" id="detail-detailAddress" value="${site.detailAddress || ''}" placeholder="예: 10층 1001호" />
        </div>
        <div class="form-row">
          <label for="detail-status">상태</label>
          <select id="detail-status">
            <option value="SAFE"${status === 'SAFE' ? ' selected' : ''}>안전</option>
            <option value="CAUTION"${status === 'CAUTION' ? ' selected' : ''}>주의</option>
            <option value="ALERT"${status === 'ALERT' ? ' selected' : ''}>경고</option>
          </select>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">센서 및 건물 정보</div>
        <div class="form-row">
          <label for="detail-sensorCount">센서 설치 개수</label>
          <input type="number" id="detail-sensorCount" value="${typeof site.sensorCount === 'number' ? site.sensorCount : 0}" min="0" />
        </div>
        <div class="form-row">
          <label for="detail-buildingSize">건물 규모</label>
          <input type="text" id="detail-buildingSize" value="${site.buildingSize || ''}" placeholder="예: 지상 20F, 연면적 12,000㎡" />
        </div>
        <div class="form-row">
          <label for="detail-buildingYear">준공 연도</label>
          <input type="text" id="detail-buildingYear" value="${site.buildingYear || ''}" placeholder="예: 2005" />
        </div>
        <div class="form-row">
          <label for="detail-notes">비고 (분류용)</label>
          <textarea id="detail-notes" rows="2" placeholder="예: 병원동, 내진설계 적용, B동만 계측 등">${site.notes || ''}</textarea>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">계측값 (고객 페이지에 표시)</div>
        <div class="form-row">
          <label for="detail-kpi-events">오늘 이벤트 수</label>
          <input type="number" id="detail-kpi-events" min="0" value="${kpiTodayEvents}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxmag">오늘 최대 진동 (g)</label>
          <input type="number" id="detail-kpi-maxmag" step="0.01" min="0" value="${kpiTodayMaxMag}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxdrift">오늘 최대 변위 (mm)</label>
          <input type="number" id="detail-kpi-maxdrift" step="0.01" min="0" value="${kpiTodayMaxDrift}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-alerts">최근 30일 경고 횟수</label>
          <input type="number" id="detail-kpi-alerts" min="0" value="${kpi30dAlerts}" />
        </div>
      </div>

      <div class="detail-section">
        <button type="button" id="detail-save" class="btn btn-primary">변경 사항 저장</button>
        <button type="button" id="detail-delete" class="btn btn-danger" style="margin-left:0.5rem;">현장 삭제</button>
      </div>
    `;

    const saveBtn = container.querySelector('#detail-save');
    const deleteBtn = container.querySelector('#detail-delete');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const body = {
            detailAddress: container.querySelector('#detail-detailAddress').value.trim(),
            status: container.querySelector('#detail-status').value,
            sensorCount: parseInt(container.querySelector('#detail-sensorCount').value || '0', 10),
            buildingSize: container.querySelector('#detail-buildingSize').value.trim(),
            buildingYear: container.querySelector('#detail-buildingYear').value.trim(),
            notes: container.querySelector('#detail-notes').value.trim(),
            kpiTodayEvents: parseInt(container.querySelector('#detail-kpi-events').value || '0', 10),
            kpiTodayMaxMag: parseFloat(container.querySelector('#detail-kpi-maxmag').value || '0'),
            kpiTodayMaxDrift: parseFloat(container.querySelector('#detail-kpi-maxdrift').value || '0'),
            kpi30dAlerts: parseInt(container.querySelector('#detail-kpi-alerts').value || '0', 10)
          };
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            alert('현장 정보를 저장하는 중 오류가 발생했습니다.');
            return;
          }
          const data = await res.json();
          const updated = data && data.site ? data.site : null;
          if (updated) {
            const idx = sites.findIndex((s) => s.id === updated.id);
            if (idx !== -1) {
              sites[idx] = updated;
            }
            renderSites();
            renderSelectedSiteDetail();
            alert('저장되었습니다.');
          }
        } catch (err) {
          console.error(err);
          alert('서버 오류로 저장에 실패했습니다.');
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!window.confirm('정말 이 현장을 삭제하시겠습니까?\n연결된 고객 계정의 권한에서도 제거됩니다.')) {
          return;
        }
        try {
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            alert('현장을 삭제하는 중 오류가 발생했습니다.');
            return;
          }
          sites = sites.filter((s) => s.id !== site.id);
          selectedSiteId = null;
          renderSites();
          renderSelectedSiteDetail();
          alert('삭제되었습니다.');
        } catch (err) {
          console.error(err);
          alert('서버 오류로 삭제에 실패했습니다.');
        }
      });
    }
  }

  function focusOnSite(site) {
    if (!map || typeof site.latitude !== 'number' || typeof site.longitude !== 'number') return;
    map.setView([site.latitude, site.longitude], 15);
  }

  function renderSelectedSiteDetail() {
    const container = document.getElementById('selected-site-detail');
    if (!container) return;
    const site = sites.find((s) => s.id === selectedSiteId);
    if (!site) {
      container.innerHTML = '<p class="help-text">왼쪽 목록에서 현장을 선택하면 상세 정보와 계측값을 수정할 수 있습니다.</p>';
      return;
    }

    const fullAddress = [site.address || '', site.detailAddress || ''].filter(Boolean).join(' ').trim();
    const kpiTodayEvents = typeof site.kpiTodayEvents === 'number' ? site.kpiTodayEvents : 0;
    const kpiTodayMaxMag = typeof site.kpiTodayMaxMag === 'number' ? site.kpiTodayMaxMag : 0;
    const kpiTodayMaxDrift = typeof site.kpiTodayMaxDrift === 'number' ? site.kpiTodayMaxDrift : 0;
    const kpi30dAlerts = typeof site.kpi30dAlerts === 'number' ? site.kpi30dAlerts : 0;
    const status = site.status || 'SAFE';

    container.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">기본 정보</div>
        <div class="form-row">
          <label>현장명</label>
          <div class="text-xs text-slate-200">${site.name}</div>
        </div>
        <div class="form-row">
          <label>주소</label>
          <div class="text-xs text-slate-200">${fullAddress || '-'}</div>
        </div>
        <div class="form-row">
          <label for="detail-detailAddress">상세주소</label>
          <input type="text" id="detail-detailAddress" value="${site.detailAddress || ''}" placeholder="예: 10층 1001호" />
        </div>
        <div class="form-row">
          <label for="detail-status">상태</label>
          <select id="detail-status">
            <option value="SAFE"${status === 'SAFE' ? ' selected' : ''}>안전</option>
            <option value="CAUTION"${status === 'CAUTION' ? ' selected' : ''}>주의</option>
            <option value="ALERT"${status === 'ALERT' ? ' selected' : ''}>경고</option>
          </select>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">센서 및 건물 정보</div>
        <div class="form-row">
          <label for="detail-sensorCount">센서 설치 개수</label>
          <input type="number" id="detail-sensorCount" value="${typeof site.sensorCount === 'number' ? site.sensorCount : 0}" min="0" />
        </div>
        <div class="form-row">
          <label for="detail-buildingSize">건물 규모</label>
          <input type="text" id="detail-buildingSize" value="${site.buildingSize || ''}" placeholder="예: 지상 20F, 연면적 12,000㎡" />
        </div>
        <div class="form-row">
          <label for="detail-buildingYear">준공 연도</label>
          <input type="text" id="detail-buildingYear" value="${site.buildingYear || ''}" placeholder="예: 2005" />
        </div>
        <div class="form-row">
          <label for="detail-notes">비고 (분류용)</label>
          <textarea id="detail-notes" rows="2" placeholder="예: 병원동, 내진설계 적용, B동만 계측 등">${site.notes || ''}</textarea>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">계측값 (고객 페이지에 표시)</div>
        <div class="form-row">
          <label for="detail-kpi-events">오늘 이벤트 수</label>
          <input type="number" id="detail-kpi-events" min="0" value="${kpiTodayEvents}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxmag">오늘 최대 진동 (g)</label>
          <input type="number" id="detail-kpi-maxmag" step="0.01" min="0" value="${kpiTodayMaxMag}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-maxdrift">오늘 최대 변위 (mm)</label>
          <input type="number" id="detail-kpi-maxdrift" step="0.01" min="0" value="${kpiTodayMaxDrift}" />
        </div>
        <div class="form-row">
          <label for="detail-kpi-alerts">최근 30일 경고 횟수</label>
          <input type="number" id="detail-kpi-alerts" min="0" value="${kpi30dAlerts}" />
        </div>
      </div>

      <div class="detail-section">
        <button type="button" id="detail-save" class="btn btn-primary">변경 사항 저장</button>
        <button type="button" id="detail-delete" class="btn btn-danger" style="margin-left:0.5rem;">현장 삭제</button>
      </div>
    `;

    const saveBtn = container.querySelector('#detail-save');
    const deleteBtn = container.querySelector('#detail-delete');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const body = {
            detailAddress: container.querySelector('#detail-detailAddress').value.trim(),
            status: container.querySelector('#detail-status').value,
            sensorCount: parseInt(container.querySelector('#detail-sensorCount').value || '0', 10),
            buildingSize: container.querySelector('#detail-buildingSize').value.trim(),
            buildingYear: container.querySelector('#detail-buildingYear').value.trim(),
            notes: container.querySelector('#detail-notes').value.trim(),
            kpiTodayEvents: parseInt(container.querySelector('#detail-kpi-events').value || '0', 10),
            kpiTodayMaxMag: parseFloat(container.querySelector('#detail-kpi-maxmag').value || '0'),
            kpiTodayMaxDrift: parseFloat(container.querySelector('#detail-kpi-maxdrift').value || '0'),
            kpi30dAlerts: parseInt(container.querySelector('#detail-kpi-alerts').value || '0', 10)
          };
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            alert('현장 정보를 저장하는 중 오류가 발생했습니다.');
            return;
          }
          const data = await res.json();
          const updated = data && data.site ? data.site : null;
          if (updated) {
            const idx = sites.findIndex((s) => s.id === updated.id);
            if (idx !== -1) {
              sites[idx] = updated;
            }
            renderSites();
            renderSelectedSiteDetail();
            alert('저장되었습니다.');
          }
        } catch (err) {
          console.error(err);
          alert('서버 오류로 저장에 실패했습니다.');
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!window.confirm('정말 이 현장을 삭제하시겠습니까?\n연결된 고객 계정의 권한에서도 제거됩니다.')) {
          return;
        }
        try {
          const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            alert('현장을 삭제하는 중 오류가 발생했습니다.');
            return;
          }
          sites = sites.filter((s) => s.id !== site.id);
          selectedSiteId = null;
          renderSites();
          renderSelectedSiteDetail();
          alert('삭제되었습니다.');
        } catch (err) {
          console.error(err);
          alert('서버 오류로 삭제에 실패했습니다.');
        }
      });
    }
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
      addrSpan.textContent = [s.address || '', s.detailAddress || ''].filter(Boolean).join(' ');

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
        renderSelectedSiteDetail();
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
  const detailAddrInput = document.getElementById('detailAddress');
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
        detailAddress: detailAddrInput ? detailAddrInput.value.trim() : '',
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
