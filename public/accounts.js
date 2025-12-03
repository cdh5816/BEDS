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

  const userForm = document.getElementById('user-form');
  const userSitesSelect = document.getElementById('user-sites');
  const userListEl = document.getElementById('user-list');
  const userFormMsg = document.getElementById('user-form-message');

  let sites = [];
  let users = [];

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

  async function loadUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      users = data && Array.isArray(data.users) ? data.users : [];
      renderUsers();
    } catch (err) {
      console.error(err);
    }
  }

  function renderSiteOptions() {
    if (!userSitesSelect) return;
    userSitesSelect.innerHTML = '';
    sites.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      userSitesSelect.appendChild(opt);
    });
  }

  function renderUsers() {
    if (!userListEl) return;
    userListEl.innerHTML = '';
    if (!users.length) {
      userListEl.innerHTML = '<p>등록된 고객 계정이 없습니다.</p>';
      return;
    }
    users.forEach((u) => {
      if (u.role === 'ADMIN') return;
      const card = document.createElement('div');
      card.className = 'user-card';

      const header = document.createElement('div');
      header.className = 'user-card-header';

      const idSpan = document.createElement('span');
      idSpan.className = 'user-card-id';
      idSpan.textContent = u.username;

      const roleSpan = document.createElement('span');
      roleSpan.className = 'user-card-role';
      roleSpan.textContent = u.role === 'CLIENT' ? '고객' : u.role;

      header.appendChild(idSpan);
      header.appendChild(roleSpan);

      const sitesSpan = document.createElement('div');
      sitesSpan.className = 'user-card-sites';
      const names = (u.siteIds || [])
        .map((id) => {
          const s = sites.find((x) => x.id === id);
          return s ? s.name : id;
        })
        .join(', ');
      sitesSpan.textContent = names ? `현장: ${names}` : '연결된 현장이 없습니다.';

      card.appendChild(header);
      card.appendChild(sitesSpan);
      userListEl.appendChild(card);
    });
  }

  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      userFormMsg.textContent = '';
      const usernameEl = document.getElementById('user-username');
      const passwordEl = document.getElementById('user-password');
      const username = usernameEl.value.trim();
      const password = passwordEl.value;

      if (!username || !password) {
        userFormMsg.textContent = 'ID와 비밀번호를 입력해 주세요.';
        return;
      }

      const selectedSiteIds = Array.from(userSitesSelect.selectedOptions).map(
        (opt) => opt.value
      );

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            role: 'CLIENT',
            siteIds: selectedSiteIds
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          userFormMsg.textContent = data.message || '계정 생성에 실패했습니다.';
          return;
        }
        userForm.reset();
        await loadUsers();
        userFormMsg.textContent = '계정이 생성되었습니다.';
      } catch (err) {
        console.error(err);
        userFormMsg.textContent = '서버 오류로 계정 생성에 실패했습니다.';
      }
    });
  }

  loadSites();
  loadUsers();
});
