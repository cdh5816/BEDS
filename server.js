// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


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

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load', file, e);
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save', file, e);
  }
}

let sitesData = loadJson(sitesFile, { sites: [] });
let usersData = loadJson(usersFile, { users: [] });

if (!Array.isArray(sitesData.sites)) sitesData.sites = [];
if (!Array.isArray(usersData.users)) usersData.users = [];

// 기본 현장 예시 (처음 한 번만)
if (sitesData.sites.length === 0) {
  const sampleSite = {
    id: 'sample-seoul-tower-a',
    name: '서울역 타워 A동',
    address: '서울특별시 중구 세종대로 1XX',
    detailAddress: '',
    latitude: 37.5551,
    longitude: 126.9707,
    sensorCount: 3,
    buildingSize: '지상 20F, 연면적 12,000㎡',
    buildingYear: '2010',
    notes: '데모용 샘플 현장',
    status: 'SAFE',
    kpiTodayEvents: 0,
    kpiTodayMaxMag: 0,
    kpiTodayMaxDrift: 0,
    kpi30dAlerts: 0
  };
  sitesData.sites.push(sampleSite);
  saveJson(sitesFile, sitesData);
}

// 기본 관리자 계정 (operator / beds2025!)
if (!usersData.users.find((u) => u.username === 'operator')) {
  usersData.users.push({
    id: 'admin-operator',
    username: 'operator',
    password: 'beds2025!',
    role: 'ADMIN',
    siteIds: [] // 모든 현장 접근
  });
  saveJson(usersFile, usersData);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'ID와 비밀번호를 입력해 주세요.' });
  }
  const user = usersData.users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ ok: false, message: 'ID 또는 비밀번호가 올바르지 않습니다.' });
  }
  return res.json({
    ok: true,
    username: user.username,
    role: user.role,
    siteIds: user.siteIds || []
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
    detailAddress,
    latitude,
    longitude,
    sensorCount,
    buildingSize,
    buildingYear,
    notes,
    status,
    kpiTodayEvents,
    kpiTodayMaxMag,
    kpiTodayMaxDrift,
    kpi30dAlerts
  } = req.body || {};
  if (!name || !address) {
    return res.status(400).json({ ok: false, message: 'name과 address는 필수입니다.' });
  }
  const id = 'site-' + Date.now().toString(36);
  const siteStatus = status || 'SAFE';
  const site = {
    id,
    name,
    address,
    detailAddress: detailAddress || '',
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    sensorCount: typeof sensorCount === 'number' ? sensorCount : 0,
    buildingSize: buildingSize || '',
    buildingYear: buildingYear || '',
    notes: notes || '',
    status: siteStatus,
    kpiTodayEvents: typeof kpiTodayEvents === 'number' ? kpiTodayEvents : 0,
    kpiTodayMaxMag: typeof kpiTodayMaxMag === 'number' ? kpiTodayMaxMag : 0,
    kpiTodayMaxDrift: typeof kpiTodayMaxDrift === 'number' ? kpiTodayMaxDrift : 0,
    kpi30dAlerts: typeof kpi30dAlerts === 'number' ? kpi30dAlerts : 0
  };
  sitesData.sites.push(site);
  saveJson(sitesFile, sitesData);
  res.status(201).json({ ok: true, site });
});



// 사이트 단일 조회
app.get('/api/sites/:id', (req, res) => {
  const site = sitesData.sites.find((s) => s.id === req.params.id);
  if (!site) {
    return res.status(404).json({ ok: false, message: '사이트를 찾을 수 없습니다.' });
  }
  res.json({ ok: true, site });
});

// 사이트 수정
app.put('/api/sites/:id', (req, res) => {
  const idx = sitesData.sites.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, message: '사이트를 찾을 수 없습니다.' });
  }
  const current = sitesData.sites[idx];
  const body = req.body || {};
  const updated = {
    ...current,
    name: body.name !== undefined ? body.name : current.name,
    address: body.address !== undefined ? body.address : current.address,
    detailAddress: body.detailAddress !== undefined ? body.detailAddress : (current.detailAddress || ''),
    latitude: typeof body.latitude === 'number' ? body.latitude : current.latitude,
    longitude: typeof body.longitude === 'number' ? body.longitude : current.longitude,
    sensorCount: typeof body.sensorCount === 'number' ? body.sensorCount : current.sensorCount,
    buildingSize: body.buildingSize !== undefined ? body.buildingSize : current.buildingSize,
    buildingYear: body.buildingYear !== undefined ? body.buildingYear : current.buildingYear,
    notes: body.notes !== undefined ? body.notes : current.notes,
    status: body.status || current.status || 'SAFE',
    kpiTodayEvents: typeof body.kpiTodayEvents === 'number' ? body.kpiTodayEvents : (current.kpiTodayEvents || 0),
    kpiTodayMaxMag: typeof body.kpiTodayMaxMag === 'number' ? body.kpiTodayMaxMag : (current.kpiTodayMaxMag || 0),
    kpiTodayMaxDrift: typeof body.kpiTodayMaxDrift === 'number' ? body.kpiTodayMaxDrift : (current.kpiTodayMaxDrift || 0),
    kpi30dAlerts: typeof body.kpi30dAlerts === 'number' ? body.kpi30dAlerts : (current.kpi30dAlerts || 0)
  };
  sitesData.sites[idx] = updated;
  saveJson(sitesFile, sitesData);
  res.json({ ok: true, site: updated });
});

// 사이트 삭제
app.delete('/api/sites/:id', (req, res) => {
  const idx = sitesData.sites.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, message: '사이트를 찾을 수 없습니다.' });
  }
  const removed = sitesData.sites.splice(idx, 1)[0];
  // 삭제된 사이트를 참조하던 사용자들의 siteIds도 정리
  usersData.users = usersData.users.map((u) => ({
    ...u,
    siteIds: Array.isArray(u.siteIds) ? u.siteIds.filter((id) => id !== removed.id) : []
  }));
  saveJson(sitesFile, sitesData);
  saveJson(usersFile, usersData);
  res.json({ ok: true });
});

// Users API (고객 계정 관리)
app.get('/api/users', (req, res) => {
  res.json({
    users: usersData.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      siteIds: u.siteIds || []
    }))
  });
});

app.post('/api/users', (req, res) => {
  const { username, password, role, siteIds } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'username과 password는 필수입니다.' });
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
  res.status(201).json({ ok: true, userId: user.id });
});

app.listen(PORT, () => {
  console.log(`Deb's server running on port ${PORT}`);
});
