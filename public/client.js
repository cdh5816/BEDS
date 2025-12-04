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

function ensureLoggedIn() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
  }
  return user;
}

document.addEventListener('DOMContentLoaded', () => {
  const user = ensureLoggedIn();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bedsUser');
      window.location.href = 'index.html';
    });
  }

  const navAdmin = document.getElementById('nav-admin');
  const navAccounts = document.getElementById('nav-accounts');
  if (user && user.role !== 'ADMIN') {
    if (navAdmin) navAdmin.style.display = 'none';
    if (navAccounts) navAccounts.style.display = 'none';
  }

  const siteSelect = document.getElementById('client-site-select');
  const statusBadge = document.getElementById('client-status-badge');
  const kpiTodayEvents = document.getElementById('kpi-today-events');
  const kpiTodayMaxMag = document.getElementById('kpi-today-maxmag');
  const kpiTodayMaxDrift = document.getElementById('kpi-today-maxdrift');
  const kpi30dAlerts = document.getElementById('kpi-30d-alerts');
  const barsEl = document.getElementById('mini-chart-bars');
  const labelsEl = document.getElementById('mini-chart-labels');

  let sites = [];
  let currentSiteId = null;
  let map = null;
  let markers = [];

  function initMap() {
    if (typeof L === 'undefined') return;
    const mapEl = document.getElementById('site-map');
    if (!mapEl) return;
    map = L.map('site-map').setView([37.5665, 126.9780], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }

  function renderForCurrentSite() {
    const site = sites.find((s) => s.id === currentSiteId);
    if (!site) return;

    if (statusBadge) {
      const status = site.status || 'SAFE';
      let badgeClass = 'badge badge-safe';
      let label = '안전';
      if (status === 'ALERT') {
        badgeClass = 'badge badge-alert';
        label = '경고';
      } else if (status === 'CAUTION') {
        badgeClass = 'badge badge-caution';
        label = '주의';
      }
      statusBadge.className = 'client-status-badge ' + badgeClass;
      statusBadge.textContent = label;
    }

    const seed = site.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    function rnd(mult, offset) {
      return (Math.sin(seed + offset) + 1) / 2 * mult;
    }
    const events = Math.round(rnd(15, 1) + 3);
    const maxMag = (rnd(0.5, 2) + 0.3).toFixed(2);
    const maxDrift = (rnd(0.8, 3) + 0.1).toFixed(2);
    const alerts = Math.round(rnd(4, 4));

    if (kpiTodayEvents) kpiTodayEvents.textContent = String(events);
    if (kpiTodayMaxMag) kpiTodayMaxMag.textContent = String(maxMag);
    if (kpiTodayMaxDrift) kpiTodayMaxDrift.textContent = maxDrift + ' mm';
    if (kpi30dAlerts) kpi30dAlerts.textContent = String(alerts);

    if (barsEl && labelsEl) {
      barsEl.innerHTML = '';
      labelsEl.innerHTML = '';
      const days = ['-6', '-5', '-4', '-3', '-2', '-1', '오늘'];
      for (let i = 0; i < 7; i++) {
        const v = Math.round(rnd(12, 10 + i) + 2);
        const bar = document.createElement('div');
        bar.className = 'mini-chart-bar';
        bar.style.height = (15 + v * 4) + 'px';
        barsEl.appendChild(bar);

        const label = document.createElement('div');
        label.textContent = days[i];
        labelsEl.appendChild(label);
      }
    }

    if (map && typeof site.latitude === 'number' && typeof site.longitude === 'number') {
      markers.forEach((m) => map.removeLayer(m));
      markers = [];
      const marker = L.marker([site.latitude, site.longitude]).addTo(map);
      marker.bindPopup(`<strong>${site.name}</strong><br>${site.address || ''}`);
      markers.push(marker);
      map.setView([site.latitude, site.longitude], 15);
    }
  }

  function renderSiteOptions() {
    if (!siteSelect) return;
    siteSelect.innerHTML = '';
    let allowedIds = null;
    if (user && user.role === 'CLIENT') {
      if (Array.isArray(user.siteIds)) {
        allowedIds = user.siteIds;
      } else if (typeof user.siteIds === 'string' && user.siteIds.trim()) {
        allowedIds = user.siteIds.split(',').map((s) => s.trim());
      }
    }
    const visibleSites = Array.isArray(allowedIds) && allowedIds.length
      ? sites.filter((s) => allowedIds.includes(s.id))
      : sites;

    if (!visibleSites.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '권한이 있는 현장이 없습니다.';
      siteSelect.appendChild(opt);
      return;
    }

    visibleSites.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      siteSelect.appendChild(opt);
    });

    if (!currentSiteId && visibleSites.length) {
      currentSiteId = visibleSites[0].id;
    }
    siteSelect.value = currentSiteId;
    renderForCurrentSite();
  }

  if (siteSelect) {
    siteSelect.addEventListener('change', () => {
      currentSiteId = siteSelect.value;
      renderForCurrentSite();
    });
  }

  async function loadSites() {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      sites = data && Array.isArray(data.sites) ? data.sites : [];
      renderSiteOptions();
    } catch (err) {
      console.error(err);
    }
  }

  initMap();
  loadSites();
});
