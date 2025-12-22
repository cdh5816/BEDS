// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Deb's (Detection Earthquake Building System) project.

const express = require('express');
const path = require('path');
const { createStorage, normalizeConstructionState } = require('./storage');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let storage;

// ✅ 응답 호환: constructionStatus / construction_state도 같이 내보내기
function toSiteResponse(site) {
  const s = { ...site };
  const c = normalizeConstructionState(s.constructionState);
  s.constructionState = c;
  s.constructionStatus = c; // legacy
  s.construction_state = c; // legacy
  return s;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage: storage?.kind || 'unknown' });
});

// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'ID와 비밀번호를 입력해 주세요.' });
    }
    const user = await storage.findUserByCredentials(username, password);
    if (!user) {
      return res.status(401).json({ ok: false, message: 'ID 또는 비밀번호가 올바르지 않습니다.' });
    }
    return res.json({
      ok: true,
      username: user.username,
      role: user.role,
      siteIds: Array.isArray(user.siteIds) ? user.siteIds : []
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// =============================================
// Sites API
// =============================================

app.get('/api/sites', async (req, res) => {
  try {
    const sites = await storage.getSites();
    res.json({ sites: sites.map(toSiteResponse) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

app.post('/api/sites', async (req, res) => {
  try {
    const body = req.body || {};
    const { name, address } = body;
    if (!name || !address) {
      return res.status(400).json({ ok: false, message: 'name과 address는 필수입니다.' });
    }
    const site = await storage.addSite(body);
    return res.status(201).json({ ok: true, site: toSiteResponse(site) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// 현장 수정
app.put('/api/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const site = await storage.updateSite(id, req.body || {});
    if (!site) {
      return res.status(404).json({ ok: false, message: '해당 현장을 찾을 수 없습니다.' });
    }
    return res.json({ ok: true, site: toSiteResponse(site) });
  } catch (e) {
    if (e && e.code === 'VALIDATION') {
      return res.status(400).json({ ok: false, message: e.message || '입력값 오류' });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// 현장 삭제
app.delete('/api/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await storage.deleteSite(id);
    if (!ok) {
      return res.status(404).json({ ok: false, message: '해당 현장을 찾을 수 없습니다.' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// =============================================
// Users API (고객 계정 관리)
// =============================================

app.get('/api/users', async (req, res) => {
  try {
    const users = await storage.getUsers();
    return res.json({ users });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, siteIds } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'username과 password는 필수입니다.' });
    }
    const r = await storage.createUser({ username, password, role, siteIds });
    return res.status(201).json({ ok: true, userId: r.id });
  } catch (e) {
    if (e && e.code === 'DUP') {
      return res.status(409).json({ ok: false, message: e.message || '이미 존재하는 ID입니다.' });
    }
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await storage.deleteUser(id);
    if (!r.ok && r.reason === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: '해당 계정을 찾을 수 없습니다.' });
    }
    if (!r.ok && r.reason === 'IS_ADMIN') {
      return res.status(400).json({ ok: false, message: '관리자 계정은 삭제할 수 없습니다.' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

app.put('/api/users/:id/sites', async (req, res) => {
  try {
    const { id } = req.params;
    const { siteIds } = req.body || {};
    const next = await storage.updateUserSites(id, siteIds);
    if (!next) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }
    return res.json({ ok: true, siteIds: next });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

async function main() {
  storage = await createStorage();
  await storage.init();
  app.listen(PORT, () => {
    console.log(`Deb's server running on port ${PORT} (storage=${storage.kind})`);
  });
}

main().catch((e) => {
  console.error('Fatal boot error:', e);
  process.exit(1);
});
