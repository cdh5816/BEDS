
// © AIRX (individual business) - All rights reserved.
// BEDS v2 - simple JSON file "DB" for demo.
// In real production, replace this with PostgreSQL or another proper DB.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = {
  users: [],
  sites: [],
  sensors: [],
  measurements: [],
  alerts: []
};

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse db.json, starting with empty DB:', err);
    }
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Seed default admin + example customer + example site/sensor for demo
function ensureDefaults() {
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.sites)) db.sites = [];
  if (!Array.isArray(db.sensors)) db.sensors = [];
  if (!Array.isArray(db.measurements)) db.measurements = [];
  if (!Array.isArray(db.alerts)) db.alerts = [];

  let changed = false;

  // Admin user
  const adminEmail = 'admin@beds.local';
  let admin = db.users.find(u => u.email === adminEmail);
  if (!admin) {
    const passwordHash = bcrypt.hashSync('bedsadmin123!', 10);
    admin = {
      id: uuidv4(),
      email: adminEmail,
      name: 'BEDS Admin',
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date().toISOString()
    };
    db.users.push(admin);
    changed = true;
    console.log('Seeded admin user: admin@beds.local / bedsadmin123!');
  }

  // Example customer
  const custEmail = 'customer@beds.local';
  let customer = db.users.find(u => u.email === custEmail);
  if (!customer) {
    const passwordHash = bcrypt.hashSync('bedscustomer123!', 10);
    customer = {
      id: uuidv4(),
      email: custEmail,
      name: 'Demo Customer',
      passwordHash,
      role: 'CUSTOMER',
      createdAt: new Date().toISOString()
    };
    db.users.push(customer);
    changed = true;
    console.log('Seeded customer user: customer@beds.local / bedscustomer123!');
  }

  // Example site
  if (!db.sites.some(s => s.name === '샘플 건물 - 서울 HQ')) {
    const site = {
      id: uuidv4(),
      name: '샘플 건물 - 서울 HQ',
      address: '서울특별시 중구 세종대로',
      lat: 37.5665,
      lng: 126.9780,
      ownerUserId: customer.id,
      sensorCountPlanned: 4,
      buildingSize: '지상 15층 / 8,000㎡',
      buildYear: 2010,
      notes: '데모용 샘플 건물'
    };
    db.sites.push(site);
    changed = true;

    // Example sensor
    const sensor = {
      id: uuidv4(),
      siteId: site.id,
      code: 'DEMO-SENSOR-001',
      installedAt: new Date().toISOString(),
      lastSeenAt: null
    };
    db.sensors.push(sensor);
    changed = true;
  }

  if (changed) saveDb();
}

loadDb();
ensureDefaults();

// --- helpers ---

function findUserByEmail(email) {
  return db.users.find(u => u.email === email);
}

function getSiteById(id) {
  return db.sites.find(s => s.id === id);
}

function getSitesForUser(user) {
  if (user.role === 'ADMIN') {
    return db.sites;
  }
  return db.sites.filter(s => s.ownerUserId === user.id);
}

function addSite({ name, address, lat, lng, ownerUserId, sensorCountPlanned, buildingSize, buildYear, notes }) {
  const site = {
    id: uuidv4(),
    name,
    address,
    lat,
    lng,
    ownerUserId: ownerUserId || null,
    sensorCountPlanned: typeof sensorCountPlanned === 'number' ? sensorCountPlanned : null,
    buildingSize: buildingSize || '',
    buildYear: typeof buildYear === 'number' ? buildYear : null,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  db.sites.push(site);
  saveDb();
  return site;
}

function getSensorsForSite(siteId) {
  return db.sensors.filter(s => s.siteId === siteId);
}

function registerOrGetSensorByCode(siteId, code) {
  let sensor = db.sensors.find(s => s.code === code);
  if (!sensor) {
    sensor = {
      id: uuidv4(),
      siteId,
      code,
      installedAt: new Date().toISOString(),
      lastSeenAt: null
    };
    db.sensors.push(sensor);
  }
  saveDb();
  return sensor;
}

function addMeasurement({ sensorId, metrics }) {
  const measurement = {
    id: uuidv4(),
    sensorId,
    createdAt: new Date().toISOString(),
    metrics
  };
  db.measurements.push(measurement);

  const sensor = db.sensors.find(s => s.id === sensorId);
  if (sensor) {
    sensor.lastSeenAt = measurement.createdAt;
  }

  if (db.measurements.length > 5000) {
    db.measurements = db.measurements.slice(-4000);
  }

  saveDb();
  return measurement;
}

function getLatestMeasurementsForSite(siteId, limit = 50) {
  const sensors = getSensorsForSite(siteId).map(s => s.id);
  const list = db.measurements
    .filter(m => sensors.includes(m.sensorId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
  return list.reverse();
}

function getSensorsWithStatusForSite(siteId, offlineThresholdSeconds = 60) {
  const sensors = getSensorsForSite(siteId);
  const now = Date.now();
  return sensors.map(sensor => {
    const last = sensor.lastSeenAt ? new Date(sensor.lastSeenAt).getTime() : null;
    const lastDiffSec = last ? (now - last) / 1000 : null;
    const isOffline = lastDiffSec === null || lastDiffSec > offlineThresholdSeconds;
    return {
      id: sensor.id,
      code: sensor.code,
      siteId: sensor.siteId,
      installedAt: sensor.installedAt,
      lastSeenAt: sensor.lastSeenAt,
      offline: isOffline,
      lastDiffSec
    };
  });
}

function computeSiteStatus(siteId) {
  const sensorsStatus = getSensorsWithStatusForSite(siteId);
  const latestList = getLatestMeasurementsForSite(siteId, 1);
  const latest = latestList.length ? latestList[0] : null;

  if (!sensorsStatus.length) {
    return {
      level: 'EMPTY',
      label: '센서 미설치',
      reason: '등록된 센서가 없습니다.'
    };
  }

  const allOffline = sensorsStatus.every(s => s.offline);
  const anyOffline = sensorsStatus.some(s => s.offline);

  let shake = null;
  let bending = null;
  if (latest && latest.metrics) {
    if (typeof latest.metrics.shake === 'number') shake = latest.metrics.shake;
    if (typeof latest.metrics.bending === 'number') bending = latest.metrics.bending;
  }

  const high = 0.3;
  const mid = 0.1;

  if (allOffline) {
    return {
      level: 'OFFLINE',
      label: '신호 끊김',
      reason: '모든 센서에서 데이터가 수신되지 않습니다.'
    };
  }

  if ((shake !== null && shake >= high) || (bending !== null && bending >= high)) {
    return {
      level: 'DANGER',
      label: '경고',
      reason: '최근 측정값이 설정 임계치 이상입니다.'
    };
  }

  if ((shake !== null && shake >= mid) || (bending !== null && bending >= mid) || anyOffline) {
    return {
      level: 'WARN',
      label: '주의',
      reason: '일부 값이 약간 높거나 일부 센서가 오프라인입니다.'
    };
  }

  return {
    level: 'SAFE',
    label: '안전',
    reason: '최근 데이터 기준으로 안정적인 상태입니다.'
  };
}

module.exports = {
  findUserByEmail,
  getSitesForUser,
  getSiteById,
  addSite,
  registerOrGetSensorByCode,
  addMeasurement,
  getLatestMeasurementsForSite,
  getSensorsWithStatusForSite,
  computeSiteStatus,
  _rawDb: () => db
};
