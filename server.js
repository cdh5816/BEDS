
// © AIRX (individual business) - All rights reserved.
// BEDS v2 - Building Earthquake Detection System backend.

const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  findUserByEmail,
  getSitesForUser,
  getSiteById,
  addSite,
  registerOrGetSensorByCode,
  addMeasurement,
  getLatestMeasurementsForSite,
  getSensorsWithStatusForSite
} = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'beds-v2-dev-secret';
const SENSOR_INGEST_KEY = process.env.SENSOR_INGEST_KEY || 'beds-ingest-key';

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

function authToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ message: '토큰이 필요합니다.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: '토큰이 유효하지 않습니다.' });
    req.user = user;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    next();
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BEDS v2' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
    }
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ message: '로그인 중 오류가 발생했습니다.' });
  }
});

app.get('/api/public/sites', (req, res) => {
  const sites = getSitesForUser({ role: 'ADMIN', id: null }).map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng
  }));
  res.json({ sites });
});

app.get('/api/admin/sites', authToken, requireRole('ADMIN'), (req, res) => {
  const sites = getSitesForUser(req.user);
  res.json({ sites });
});

app.post('/api/admin/sites', authToken, requireRole('ADMIN'), (req, res) => {
  try {
    const { name, address, lat, lng, ownerUserId } = req.body;
    if (!name || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'name, address, lat, lng가 필요합니다.' });
    }
    const site = addSite({ name, address, lat, lng, ownerUserId });
    res.status(201).json({ site });
  } catch (err) {
    console.error('add site error', err);
    res.status(500).json({ message: '현장 등록 중 오류가 발생했습니다.' });
  }
});

app.get('/api/customer/sites', authToken, requireRole('CUSTOMER'), (req, res) => {
  const sites = getSitesForUser(req.user);
  res.json({ sites });
});

app.get('/api/customer/sites/:siteId/status', authToken, requireRole('CUSTOMER'), (req, res) => {
  try {
    const siteId = req.params.siteId;
    const sites = getSitesForUser(req.user);
    const site = sites.find(s => s.id === siteId);
    if (!site) {
      return res.status(404).json({ message: '현장을 찾을 수 없습니다.' });
    }

    const sensors = getSensorsWithStatusForSite(siteId);
    const measurements = getLatestMeasurementsForSite(siteId, 50);

    let latest = null;
    if (measurements.length > 0) {
      latest = measurements[measurements.length - 1];
    }

    const anyOffline = sensors.some(s => s.offline);

    res.json({
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
        lat: site.lat,
        lng: site.lng
      },
      sensors,
      latestMeasurement: latest,
      measurements,
      connectionLost: anyOffline
    });
  } catch (err) {
    console.error('site status error', err);
    res.status(500).json({ message: '현장 상태 조회 중 오류가 발생했습니다.' });
  }
});

app.post('/api/sensors/ingest', (req, res) => {
  try {
    const key = req.headers['x-ingest-key'];
    if (!key || key !== SENSOR_INGEST_KEY) {
      return res.status(401).json({ message: 'ingest key가 유효하지 않습니다.' });
    }
    const { siteId, sensorCode, shake, bending, raw } = req.body;
    if (!siteId || !sensorCode) {
      return res.status(400).json({ message: 'siteId, sensorCode가 필요합니다.' });
    }
    const site = getSiteById(siteId);
    if (!site) {
      return res.status(404).json({ message: '현장을 찾을 수 없습니다.' });
    }
    const sensor = registerOrGetSensorByCode(siteId, sensorCode);
    const metrics = {
      shake: typeof shake === 'number' ? shake : null,
      bending: typeof bending === 'number' ? bending : null,
      raw: raw || null
    };
    const measurement = addMeasurement({ sensorId: sensor.id, metrics });
    res.status(201).json({ ok: true, measurement });
  } catch (err) {
    console.error('sensor ingest error', err);
    res.status(500).json({ message: '센서 데이터 수신 중 오류가 발생했습니다.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BEDS v2 server listening on http://localhost:${PORT}`);
});
