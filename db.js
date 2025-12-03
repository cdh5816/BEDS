
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
  users: [],     // { id, email, name, passwordHash, role: 'ADMIN' | 'CUSTOMER' }
  sites: [],     // { id, name, address, lat, lng, ownerUserId }
  sensors: [],   // { id, siteId, code, installedAt, lastSeenAt }
  measurements: [], // { id, sensorId, createdAt, metrics: { shake, bending, raw } }
  alerts: []     // { id, siteId, sensorId, createdAt, type, message, level }
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
      createdAt: new Date().toISOString()
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

function addSite({ name, address, lat, lng, ownerUserId }) {
  const site = {
    id: uuidv4(),
    name,
    address,
    lat,
    lng,
    ownerUserId: ownerUserId || null,
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

  // Update lastSeenAt
  const sensor = db.sensors.find(s => s.id === sensorId);
  if (sensor) {
    sensor.lastSeenAt = measurement.createdAt;
  }

  // Keep only last 5000 measurements
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

module.exports = {
  findUserByEmail,
  getSitesForUser,
  getSiteById,
  addSite,
  registerOrGetSensorByCode,
  addMeasurement,
  getLatestMeasurementsForSite,
  getSensorsWithStatusForSite,
  _rawDb: () => db
};
