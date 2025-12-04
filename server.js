// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Deb's (Detection Earthquake Building System) project.

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const sitesFile = path.join(dataDir, 'sites.json');
const usersFile = path.join(dataDir, 'users.json');

// ensure data dir
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load JSON from', file, e);
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save JSON to', file, e);
  }
}

let sitesData = loadJson(sitesFile, { sites: [] });
let usersData = loadJson(usersFile, { users: [] });

// 기본 샘플 현장
if (!Array.isArray(sitesData.sites)) {
  sitesData.sites = [];
}

if (sitesData.sites.length === 0) {
  const sampleSite = {
    id: 'site-sample',
    name: '샘플 현장',
    address: '서울특별시 중구 세종대로 110',
    latitude: 37.5665,
    longitude: 126.9780,
    sensorCount: 3,
    buildingSize: '지상 20F, 연면적 12,000㎡',
    buildingYear: '2010',
    notes: '데모용 샘플 현장',
    status: 'SAFE'
  };
  sitesData.sites.push(sampleSite);
  saveJson(sitesFile, sitesData);
}

// 기본 관리자 계정 (operator / beds2025!)
if (!Array.isArray(usersData.users)) {
  usersData.users = [];
}
if (!usersData.users.find((u) => u.username === 'operator')) {
  usersData.users.push({
    id: 'admin-operator',
    username: 'operator',
    password: 'beds2025!',
    role: 'ADMIN',
    siteIds: [] // ADMIN은 모든 현장 접근
  });
  saveJson(usersFile, usersData);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 로그인
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, message: 'ID와 비밀번호를 입력해 주세요.' });
  }
  const user = usersData.users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) {
    return res
      .status(401)
      .json({ ok: false, message: 'ID 또는 비밀번호가 올바르지 않습니다.' });
  }
  return res.json({
    ok: true,
    username: user.username,
    role: user.role,
    siteIds: Array.isArray(user.siteIds) ? user.siteIds : []
  });
});

// Sites API
app.get('/api/sites', (req, res) => {
  res.json({ sites: sitesData.sites });
});

app.post('/api/sites', (req, res) => {
  const {
    name,
    address,
    latitude,
    longitude,
    sensorCount,
    buildingSize,
    buildingYear,
    notes
  } = req.body || {};
  if (!name || !address) {
    return res
      .status(400)
      .json({ ok: false, message: 'name과 address는 필수입니다.' });
  }
  const id = 'site-' + Date.now().toString(36);
  const site = {
    id,
    name,
    address,
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    sensorCount: typeof sensorCount === 'number' ? sensorCount : 0,
    buildingSize: buildingSize || '',
    buildingYear: buildingYear || '',
    notes: notes || '',
    status: 'SAFE'
  };
  sitesData.sites.push(site);
  saveJson(sitesFile, sitesData);
  return res.status(201).json({ ok: true, site });
});

// 단일 현장 삭제
app.delete('/api/sites/:id', (req, res) => {
  const { id } = req.params;
  const beforeLen = sitesData.sites.length;
  sitesData.sites = sitesData.sites.filter((s) => s.id !== id);
  if (sitesData.sites.length === beforeLen) {
    return res.status(404).json({ ok: false, message: '해당 현장을 찾을 수 없습니다.' });
  }
  // 모든 유저의 siteIds에서도 제거
  usersData.users = usersData.users.map((u) => {
    if (Array.isArray(u.siteIds)) {
      u.siteIds = u.siteIds.filter((sid) => sid !== id);
    }
    return u;
  });
  saveJson(sitesFile, sitesData);
  saveJson(usersFile, usersData);
  return res.json({ ok: true });
});

// Users API (고객 계정 관리)
app.get('/api/users', (req, res) => {
  res.json({
    users: usersData.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      siteIds: Array.isArray(u.siteIds) ? u.siteIds : []
    }))
  });
});

app.post('/api/users', (req, res) => {
  const { username, password, role, siteIds } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, message: 'username과 password는 필수입니다.' });
  }
  if (usersData.users.find((u) => u.username === username)) {
    return res
      .status(409)
      .json({ ok: false, message: '이미 존재하는 ID입니다.' });
  }
  const user = {
    id: 'user-' + Date.now().toString(36),
    username,
    password,
    role: role || 'CLIENT',
    siteIds: Array.isArray(siteIds) ? siteIds : []
  };
  usersData.users.push(user);
  saveJson(usersFile, usersData);
  return res.status(201).json({ ok: true, userId: user.id });
});

// 고객 계정 삭제
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = usersData.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ ok: false, message: '해당 계정을 찾을 수 없습니다.' });
  }
  if (user.role === 'ADMIN') {
    return res
      .status(400)
      .json({ ok: false, message: '관리자 계정은 삭제할 수 없습니다.' });
  }
  usersData.users = usersData.users.filter((u) => u.id !== id);
  saveJson(usersFile, usersData);
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Deb's server running on port ${PORT}`);
});
