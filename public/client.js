// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const API_BASE = ''; // same origin

const clientSiteSelectEl = document.getElementById('client-site-select');
const clientStatusBadgeEl = document.getElementById('client-status-badge');
const kpiTodayEventsEl = document.getElementById('kpi-today-events');
const kpiTodayMaxMagEl = document.getElementById('kpi-today-maxmag');
const kpiTodayMaxDriftEl = document.getElementById('kpi-today-maxdrift');
const kpi30dAlertsEl = document.getElementById('kpi-30d-alerts');
const miniChartBarsEl = document.getElementById('mini-chart-bars');
const miniChartLabelsEl = document.getElementById('mini-chart-labels');

let clientSites = [];
let map;
let mapMarker;

function ensureLoggedIn() {
  const loggedIn = localStorage.getItem('beds_logged_in') === '1';
  if (!loggedIn) {
    window.location.href = 'index.html';
  }
}

async function loadClientSites() {
  const res = await fetch(`${API_BASE}/api/sites`);
  clientSites = await res.json();

  clientSiteSelectEl.innerHTML = '';

  if (!clientSites.length) {
    const opt = document.createElement('option');
    opt.textContent = 'No sites registered.';
    opt.disabled = true;
    opt.selected = true;
    clientSiteSelectEl.appendChild(opt);
    return;
  }

  clientSites.forEach((site) => {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.name;
    clientSiteSelectEl.appendChild(opt);
  });

  loadMetricsForSelected();
}

function renderClientStatus(site, metrics) {
  clientStatusBadgeEl.innerHTML = '';

  if (!site) return;

  const wrap = document.createElement('div');
  let statusClass = 'client-status-safe';
  let mainLabel = 'SAFE';
  let subLabel = 'Structure status is within normal range.';

  if (site.status === 'CAUTION') {
    statusClass = 'client-status-caution';
    mainLabel = 'CAUTION';
    subLabel = 'Monitoring recommended for this site.';
  } else if (site.status === 'ALERT') {
    statusClass = 'client-status-alert';
    mainLabel = 'ALERT';
    subLabel = 'Immediate inspection recommended.';
  }

  wrap.className = `client-status-badge-inner ${statusClass}`;

  const dot = document.createElement('span');
  dot.className = 'client-status-dot';

  const mainSpan = document.createElement('span');
  mainSpan.className = 'client-status-label-main';
  mainSpan.textContent = mainLabel;

  const subSpan = document.createElement('span');
  subSpan.className = 'client-status-label-sub';
  subSpan.textContent = subLabel;

  wrap.appendChild(dot);
  wrap.appendChild(mainSpan);
  wrap.appendChild(subSpan);

  clientStatusBadgeEl.appendChild(wrap);
}

function renderKpis(metrics) {
  if (!metrics) {
    kpiTodayEventsEl.textContent = '-';
    kpiTodayMaxMagEl.textContent = '-';
    kpiTodayMaxDriftEl.textContent = '-';
    kpi30dAlertsEl.textContent = '-';
    return;
  }

  kpiTodayEventsEl.textContent = metrics.last24h.eventCount;
  kpiTodayMaxMagEl.textContent = metrics.last24h.maxMagnitude;
  kpiTodayMaxDriftEl.textContent = metrics.last24h.maxDrift + ' mm';
  kpi30dAlertsEl.textContent = metrics.last30d.alertCount;
}

function renderMiniChart(metrics) {
  miniChartBarsEl.innerHTML = '';
  miniChartLabelsEl.innerHTML = '';

  if (!metrics || !metrics.last7d || !metrics.last7d.shakes) return;

  const shakes = metrics.last7d.shakes;
  const labels = metrics.last7d.labels || [];
  const max = Math.max(...shakes, 1);

  shakes.forEach((value, idx) => {
    const bar = document.createElement('div');
    bar.className = 'mini-chart-bar';

    const fill = document.createElement('div');
    fill.className = 'mini-chart-bar-fill';
    const heightPct = (value / max) * 100;
    fill.style.height = `${heightPct}%`;

    bar.appendChild(fill);
    miniChartBarsEl.appendChild(bar);

    const label = document.createElement('div');
    label.textContent = labels[idx] || '';
    miniChartLabelsEl.appendChild(label);
  });
}

function initMap() {
  const mapEl = document.getElementById('site-map');
  if (!mapEl) return;

  map = L.map('site-map', {
    zoomControl: false
  }).setView([37.5665, 126.9780], 12); // default: Seoul

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ''
  }).addTo(map);
}

function updateMapForSite(site) {
  if (!map) return;
  if (!site || !site.latitude || !site.longitude) {
    map.setView([37.5665, 126.9780], 12);
    if (mapMarker) {
      map.removeLayer(mapMarker);
      mapMarker = null;
    }
    return;
  }

  const lat = Number(site.latitude);
  const lon = Number(site.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    map.setView([37.5665, 126.9780], 12);
    if (mapMarker) {
      map.removeLayer(mapMarker);
      mapMarker = null;
    }
    return;
  }

  map.setView([lat, lon], 16);

  if (!mapMarker) {
    mapMarker = L.marker([lat, lon]).addTo(map);
  } else {
    mapMarker.setLatLng([lat, lon]);
  }
}

async function loadMetricsForSelected() {
  const id = clientSiteSelectEl.value;
  if (!id) return;

  const site = clientSites.find((s) => s.id === id);

  try {
    const res = await fetch(`${API_BASE}/api/sites/${id}/metrics`);
    if (!res.ok) {
      renderClientStatus(site, null);
      renderKpis(null);
      renderMiniChart(null);
      updateMapForSite(site);
      return;
    }

    const metrics = await res.json();
    renderClientStatus(site, metrics);
    renderKpis(metrics);
    renderMiniChart(metrics);
    updateMapForSite(site);
  } catch (err) {
    console.error(err);
    renderClientStatus(site, null);
    renderKpis(null);
    renderMiniChart(null);
    updateMapForSite(site);
  }
}

function initClient() {
  ensureLoggedIn();
  initMap();
  loadClientSites();
  clientSiteSelectEl.addEventListener('change', loadMetricsForSelected);
}

document.addEventListener('DOMContentLoaded', initClient);
