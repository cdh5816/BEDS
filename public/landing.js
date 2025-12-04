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

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem('bedsUser');
  } else {
    localStorage.setItem('bedsUser', JSON.stringify(user));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginToggle = document.getElementById('login-toggle');
  const loginPanel = document.getElementById('login-panel');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const dashboardBtn = document.getElementById('landing-dashboard');
  const logoutBtn = document.getElementById('landing-logout');

  function updateHeaderForUser() {
    const user = getCurrentUser();
    if (!user) {
      if (dashboardBtn) dashboardBtn.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      if (loginToggle) loginToggle.classList.remove('hidden');
      return;
    }
    if (loginToggle) loginToggle.classList.add('hidden');
    if (dashboardBtn) {
      dashboardBtn.classList.remove('hidden');
      dashboardBtn.textContent = user.role === 'ADMIN' ? '관리자 콘솔' : '모니터링';
    }
    if (logoutBtn) {
      logoutBtn.classList.remove('hidden');
    }
  }

  updateHeaderForUser();

  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) return;
      if (user.role === 'ADMIN') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'client.html';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUser(null);
      window.location.href = 'index.html';
    });
  }

  if (loginToggle && loginPanel) {
    loginToggle.addEventListener('click', () => {
      loginPanel.classList.toggle('open');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      const idEl = document.getElementById('login-id');
      const pwEl = document.getElementById('login-password');
      const username = idEl.value.trim();
      const password = pwEl.value;
      if (!username || !password) {
        loginError.textContent = 'ID와 비밀번호를 입력해 주세요.';
        return;
      }
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
          loginError.textContent = '로그인에 실패했습니다.';
          return;
        }
        const data = await res.json();
        if (!data || !data.ok) {
          loginError.textContent = data.message || 'ID 또는 비밀번호를 확인해 주세요.';
          return;
        }
        setCurrentUser({
          username: data.username,
          role: data.role,
          siteIds: data.siteIds || []
        });
        if (data.role === 'ADMIN') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'client.html';
        }
      } catch (err) {
        console.error(err);
        loginError.textContent = '서버와 통신 중 오류가 발생했습니다.';
      }
    });
  }

  // Landing map & site list
  const mapEl = document.getElementById('landing-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('landing-map').setView([37.5665, 126.9780], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const siteListEl = document.getElementById('landing-site-list');

  fetch('/api/sites')
    .then((res) => res.json())
    .then((data) => {
      const sites = data && Array.isArray(data.sites) ? data.sites : [];
      if (!sites.length) {
        if (siteListEl) {
          siteListEl.innerHTML = '<p>등록된 현장이 없습니다. 관리자 페이지에서 현장을 등록해 주세요.</p>';
        }
        return;
      }
      const bounds = [];
      sites.forEach((s) => {
        if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
          const marker = L.marker([s.latitude, s.longitude]).addTo(map);
          marker.bindPopup(`<strong>${s.name}</strong><br>${[[s.address || '', s.detailAddress || ''].filter(Boolean).join(' '), s.detailAddress || ''].filter(Boolean).join(' ')}`);
          bounds.push([s.latitude, s.longitude]);
        }
      });
      if (bounds.length) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      if (siteListEl) {
        siteListEl.innerHTML = sites
          .map((s) => {
            const status = s.status || 'SAFE';
            let badgeClass = 'badge badge-safe';
            if (status === 'ALERT') badgeClass = 'badge badge-alert';
            else if (status === 'CAUTION') badgeClass = 'badge badge-caution';
            return `
              <div class="site-item">
                <div class="site-item-main">
                  <span class="site-item-name">${s.name}</span>
                  <span class="site-item-address">${[[s.address || '', s.detailAddress || ''].filter(Boolean).join(' '), s.detailAddress || ''].filter(Boolean).join(' ')}</span>
                </div>
                <span class="${badgeClass}">${status}</span>
              </div>
            `;
          })
          .join('');
      }

      const first = sites[0];
      if (first) {
        const titleEl = document.getElementById('sample-title');
        const addrEl = document.getElementById('sample-address');
        if (titleEl) titleEl.textContent = first.name;
        if (addrEl) addrEl.textContent = first.address || '';
      }
    })
    .catch((err) => {
      console.error(err);
      if (siteListEl) {
        siteListEl.innerHTML = '<p>현장 정보를 불러오는 중 오류가 발생했습니다.</p>';
      }
    });
});
