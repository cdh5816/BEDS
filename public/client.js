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

async function loadClientSites() {
  const res = await fetch(`${API_BASE}/api/sites`);
  clientSites = await res.json();

  clientSiteSelectEl.innerHTML = '';

  if (!clientSites.length) {
    const opt = document.createElement('option');
    opt.textContent = '등록된 현장이 없습니다.';
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

  // 첫 번째 현장 로드
  loadMetricsForSelected();
}

function renderClientStatus(site, metrics) {
  clientStatusBadgeEl.innerHTML = '';

  if (!site) return;

  const wrap = document.createElement('div');
  let statusClass = 'client-status-safe';
  let mainLabel = '안전';
  let subLabel = '지진·진동 상태 양호';

  if (site.status === 'CAUTION') {
    statusClass = 'client-status-caution';
    mainLabel = '주의';
    subLabel = '진동 수준 모니터링 필요';
  } else if (site.status === 'ALERT') {
    statusClass = 'client-status-alert';
    mainLabel = '경고';
    subLabel = '즉각적인 점검 권장';
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
      return;
    }

    const metrics = await res.json();
    renderClientStatus(site, metrics);
    renderKpis(metrics);
    renderMiniChart(metrics);
  } catch (err) {
    console.error(err);
    renderClientStatus(site, null);
    renderKpis(null);
    renderMiniChart(null);
  }
}

function initClient() {
  loadClientSites();
  clientSiteSelectEl.addEventListener('change', loadMetricsForSelected);
}

document.addEventListener('DOMContentLoaded', initClient);
