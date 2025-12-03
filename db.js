// © AIRX (individual business) - All rights reserved.
// BEDS (Building Earthquake Detection System) - simple JSON file database.

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
  buildings: []
};

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse db.json, starting with empty DB:', err);
      db = { users: [], buildings: [] };
    }
  }
}

function ensureDefaults() {
  // Default admin user
  if (!db.users || !Array.isArray(db.users)) {
    db.users = [];
  }

  const hasAdmin = db.users.some(u => u.role === 'SUPER_ADMIN');
  if (!hasAdmin) {
    const password = 'bedsadmin123!';
    const passwordHash = bcrypt.hashSync(password, 10);
    const adminUser = {
      id: uuidv4(),
      email: 'admin@beds.local',
      passwordHash,
      name: 'Default Admin',
      role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString()
    };
    db.users.push(adminUser);
    console.log('Default admin created:');
    console.log('  email: admin@beds.local');
    console.log('  password: bedsadmin123!');
  }

  // Example building
  if (!db.buildings || !Array.isArray(db.buildings)) {
    db.buildings = [];
  }
  if (db.buildings.length === 0) {
    db.buildings.push({
      id: uuidv4(),
      name: '예시 건물 - 서울 본사',
      address: '서울특별시 중구 세종대로',
      lat: 37.5665,
      lng: 126.9780,
      createdAt: new Date().toISOString()
    });
  }

  saveDb();
}

loadDb();
ensureDefaults();

function getUserByEmail(email) {
  return db.users.find(u => u.email === email);
}

function getBuildings() {
  return db.buildings;
}

function addBuilding({ name, address, lat, lng }) {
  const building = {
    id: uuidv4(),
    name,
    address,
    lat,
    lng,
    createdAt: new Date().toISOString()
  };
  db.buildings.push(building);
  saveDb();
  return building;
}

module.exports = {
  getUserByEmail,
  getBuildings,
  addBuilding
};