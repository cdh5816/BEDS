// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.

function normalizeSitesResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.sites)) return data.sites;
  return [];
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ✅ 현장조건(status) 라벨 통일
function statusKo(v) {
  if (v === 'SAFE') return '납품현장';
  if (v === 'CAUTION') return '공사중 현장';
  if (v === 'ALERT') return '영업중 현장';
  return '납품현장';
}

function constructionKo(v) {
  if (v === 'DONE') return '공사 완료';
  return '공사 진행 중';
}

function getConstructionState(site) {
  return site?.constructionState ?? site?.constructionStatus ?? site?.construction_state ?? null;
}

function badgeClass(status) {
  if (status === 'ALERT') return 'badge badge-alert';
  if (status === 'CAUTION') return 'badge badge-caution';
  return 'badge badge-safe';
}

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('sites-list');
  const summaryEl = document.getElementById('sites-summary');
  const detailEl = document.getElementById('site-detail');
  const fConst = document.getElementById('filter-construction');
  const fStatus = document.getElementById('filter-status');

  let sites = [];
  let selectedId = null;

  function renderDetail(site) {
    if (!detailEl) return;
    if (!site) {
      detailEl.innerHTML = '왼쪽 목록에서 현장을 선택하세요.';
      return;
    }

    const c = getConstructionState(site);
    const st = site.status || 'SAFE';

    detailEl.innerHTML = `
      <div class="grid gap-2">
        <div class="text-lg font-semibold text-slate-100">${escapeHtml(site.name || '-')}</div>
        <div class="text-xs text-slate-400">${escapeHtml(site.address || '-')}</div>

        <div class="grid grid-cols-2 gap-2 text-xs mt-2">
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div class="text-slate-400">공사 상태</div>
            <div class="mt-1 font-semibold">${escapeHtml(constructionKo(c))}</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div class="text-slate-400">현장조건</div>
            <div class="mt-1 font-semibold">${escapeHtml(statusKo(st))} (${escapeHtml(st)})</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div class="text-slate-400">공사일정</div>
            <div class="mt-1 font-semibold">${escapeHtml(String(site.sensorCount ?? 0))}</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div class="text-slate-400">실정보고 진행 상황</div>
            <div class="mt-1 font-semibold">${escapeHtml(site.buildingYear || '-')}</div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
          <div class="text-slate-400">건물 규모</div>
          <div class="mt-1">${escapeHtml(site.buildingSize || '-')}</div>
          <div class="text-slate-400 mt-2">메모</div>
          <div class="mt-1 text-slate-300">${escapeHtml(site.notes || '-')}</div>
        </div>

        <div class="flex gap-2 mt-2">
          <a class="btn btn-secondary text-xs" href="admin.html">관리자에서 수정</a>
        </div>
      </div>
    `;
  }

  function applyFilters(all) {
    const vConst = fConst ? fConst.value : 'ALL';
    const vStatus = fStatus ? fStatus.value : 'ALL';

    return all.filter((s) => {
      const c = getConstructionState(s) || 'IN_PROGRESS';
      const st = s.status || 'SAFE';

      if (vConst !== 'ALL' && String(c) !== String(vConst)) return false;
      if (vStatus !== 'ALL' && String(st) !== String(vStatus)) return false;
      return true;
    });
  }

  function render() {
    if (!listEl) return;

    const filtered = applyFilters(sites);

    if (summaryEl) summaryEl.textContent = `총 ${sites.length}개 / 필터 ${filtered.length}개`;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="text-xs text-slate-400">해당 조건의 현장이 없습니다.</div>`;
      renderDetail(null);
      return;
    }

    listEl.innerHTML = filtered.map((s) => {
      const st = s.status || 'SAFE';
      const c = getConstructionState(s) || 'IN_PROGRESS';
      const active = String(selectedId) === String(s.id) ? ' ring-2 ring-slate-700 ' : '';
      return `
        <button type="button"
                data-site-id="${escapeHtml(s.id)}"
                class="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/60 p-3 hover:bg-slate-900/40 transition ${active}">
          <div class="flex items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-100">${escapeHtml(s.name || '-')}</div>
            <span class="${badgeClass(st)}" title="${escapeHtml(st)}">${escapeHtml(statusKo(st))}</span>
          </div>
          <div class="mt-1 text-xs text-slate-400">${escapeHtml(s.address || '-')}</div>
          <div class="mt-2 text-[11px] text-slate-400">
            공사: ${escapeHtml(constructionKo(c))} · 공사일정: ${escapeHtml(String(s.sensorCount ?? 0))}
          </div>
        </button>
      `;
    }).join('');

    if (!listEl.__bound) {
      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-site-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-site-id');
        const site = sites.find((x) => String(x.id) === String(id));
        selectedId = id;
        render();
        renderDetail(site);
      });
      listEl.__bound = true;
    }

    // 기본 상세
    if (!selectedId) {
      selectedId = filtered[0].id;
      renderDetail(filtered[0]);
      render();
    } else {
      const current = sites.find((x) => String(x.id) === String(selectedId));
      renderDetail(current || filtered[0]);
    }
  }

  async function load() {
    const res = await fetch('/api/sites');
    const data = await res.json().catch(() => null);
    sites = normalizeSitesResponse(data);
    render();
  }

  if (fConst) fConst.addEventListener('change', () => { selectedId = null; render(); });
  if (fStatus) fStatus.addEventListener('change', () => { selectedId = null; render(); });

  load().catch((e) => {
    console.error(e);
    if (listEl) listEl.innerHTML = `<div class="text-xs text-slate-400">현장 목록을 불러오지 못했습니다.</div>`;
  });
});
