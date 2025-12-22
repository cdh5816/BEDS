// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Deb's (Detection Earthquake Building System) project.

/**
 * Storage adapter
 * - If DATABASE_URL is set: use PostgreSQL (recommended for Render)
 * - Else: fall back to local JSON files (OK for local dev, NOT OK on Render because files reset)
 */

const fs = require('fs');
const path = require('path');

const HAS_PG = !!process.env.DATABASE_URL;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function normalizeConstructionState(v) {
  if (!v) return 'IN_PROGRESS';
  const s = String(v).toUpperCase();
  if (s === 'DONE') return 'DONE';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'IN_PROGRESS';
}

function normalizeStatus(v) {
  if (!v) return 'SAFE';
  const s = String(v).toUpperCase();
  if (s === 'ALERT') return 'ALERT';
  if (s === 'CAUTION') return 'CAUTION';
  return 'SAFE';
}

// -----------------------------
// PostgreSQL
// -----------------------------
async function createPgAdapter() {
  const { Pool } = require('pg');

  // Render Postgres uses SSL in many setups.
  // This option is safe for Render; for strict environments, set PGSSLMODE/SSL config as needed.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude DOUBLE PRECISION NULL,
        longitude DOUBLE PRECISION NULL,
        sensor_count INTEGER NOT NULL DEFAULT 0,
        building_size TEXT NOT NULL DEFAULT '',
        building_year TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'SAFE',
        construction_state TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CLIENT',
        site_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default admin if missing
    const admin = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', ['operator']);
    if (admin.rowCount === 0) {
      await pool.query(
        'INSERT INTO users (id, username, password, role, site_ids) VALUES ($1, $2, $3, $4, $5)',
        ['admin-operator', 'operator', 'beds2025!', 'ADMIN', JSON.stringify([])]
      );
    }

    // Seed sample site if empty
    const count = await pool.query('SELECT COUNT(*)::int AS c FROM sites');
    if ((count.rows[0]?.c ?? 0) === 0) {
      await pool.query(
        `INSERT INTO sites (id, name, address, latitude, longitude, sensor_count, building_size, building_year, notes, status, construction_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          'site-sample',
          '샘플 현장',
          '서울특별시 중구 세종대로 110',
          37.5665,
          126.978,
          3,
          '지상 20F, 연면적 12,000㎡',
          '2010',
          '데모용 샘플 현장',
          'SAFE',
          'IN_PROGRESS'
        ]
      );
    }
  }

  function rowToSite(r) {
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      latitude: r.latitude === null ? null : Number(r.latitude),
      longitude: r.longitude === null ? null : Number(r.longitude),
      sensorCount: Number(r.sensor_count ?? 0),
      buildingSize: r.building_size ?? '',
      buildingYear: r.building_year ?? '',
      notes: r.notes ?? '',
      status: normalizeStatus(r.status),
      constructionState: normalizeConstructionState(r.construction_state)
    };
  }

  return {
    kind: 'postgres',
    init,
    async getSites() {
      const q = await pool.query('SELECT * FROM sites ORDER BY created_at ASC');
      return q.rows.map(rowToSite);
    },
    async addSite(payload) {
      const id = 'site-' + Date.now().toString(36);
      const site = {
        id,
        name: payload.name,
        address: payload.address,
        latitude: isFiniteNumber(payload.latitude) ? payload.latitude : null,
        longitude: isFiniteNumber(payload.longitude) ? payload.longitude : null,
        sensorCount: typeof payload.sensorCount === 'number' ? payload.sensorCount : Number(payload.sensorCount) || 0,
        buildingSize: payload.buildingSize || '',
        buildingYear: payload.buildingYear || '',
        notes: payload.notes || '',
        status: 'SAFE',
        constructionState: normalizeConstructionState(payload.constructionState)
      };
      await pool.query(
        `INSERT INTO sites (id, name, address, latitude, longitude, sensor_count, building_size, building_year, notes, status, construction_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          site.id,
          site.name,
          site.address,
          site.latitude,
          site.longitude,
          site.sensorCount,
          site.buildingSize,
          site.buildingYear,
          site.notes,
          site.status,
          site.constructionState
        ]
      );
      return site;
    },
    async updateSite(id, body) {
      const curQ = await pool.query('SELECT * FROM sites WHERE id=$1', [id]);
      if (curQ.rowCount === 0) return null;
      const cur = rowToSite(curQ.rows[0]);

      const next = { ...cur };
      if (typeof body.name === 'string') next.name = body.name.trim();
      if (typeof body.address === 'string') next.address = body.address.trim();

      if (body.latitude === null) next.latitude = null;
      else if (isFiniteNumber(body.latitude)) next.latitude = body.latitude;

      if (body.longitude === null) next.longitude = null;
      else if (isFiniteNumber(body.longitude)) next.longitude = body.longitude;

      if (body.sensorCount != null) {
        const n = Number(body.sensorCount);
        if (Number.isFinite(n)) next.sensorCount = n;
      }

      if (typeof body.buildingSize === 'string') next.buildingSize = body.buildingSize;
      if (typeof body.buildingYear === 'string') next.buildingYear = body.buildingYear;
      if (typeof body.notes === 'string') next.notes = body.notes;
      if (body.status != null) next.status = normalizeStatus(body.status);

      const c = body.constructionState ?? body.constructionStatus ?? body.construction_state ?? null;
      if (c != null) next.constructionState = normalizeConstructionState(c);

      if (!next.name || !next.address) {
        const err = new Error('name과 address는 필수입니다.');
        err.code = 'VALIDATION';
        throw err;
      }

      await pool.query(
        `UPDATE sites
           SET name=$2, address=$3, latitude=$4, longitude=$5, sensor_count=$6,
               building_size=$7, building_year=$8, notes=$9, status=$10, construction_state=$11
         WHERE id=$1`,
        [
          id,
          next.name,
          next.address,
          next.latitude,
          next.longitude,
          next.sensorCount,
          next.buildingSize,
          next.buildingYear,
          next.notes,
          next.status,
          next.constructionState
        ]
      );
      return next;
    },
    async deleteSite(id) {
      const del = await pool.query('DELETE FROM sites WHERE id=$1', [id]);
      if (del.rowCount === 0) return false;
      // remove site id from all users
      await pool.query(
        `UPDATE users
            SET site_ids = (
              SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
              FROM jsonb_array_elements_text(site_ids) AS x
              WHERE x <> $1
            )`,
        [id]
      );
      return true;
    },
    async getUsers() {
      const q = await pool.query('SELECT id, username, role, site_ids FROM users ORDER BY created_at ASC');
      return q.rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        siteIds: Array.isArray(r.site_ids) ? r.site_ids : (r.site_ids ?? [])
      }));
    },
    async findUserByCredentials(username, password) {
      const q = await pool.query('SELECT id, username, role, site_ids FROM users WHERE username=$1 AND password=$2 LIMIT 1', [username, password]);
      if (q.rowCount === 0) return null;
      const r = q.rows[0];
      return {
        id: r.id,
        username: r.username,
        role: r.role,
        siteIds: Array.isArray(r.site_ids) ? r.site_ids : (r.site_ids ?? [])
      };
    },
    async createUser({ username, password, role, siteIds }) {
      const exists = await pool.query('SELECT 1 FROM users WHERE username=$1', [username]);
      if (exists.rowCount > 0) {
        const err = new Error('이미 존재하는 ID입니다.');
        err.code = 'DUP';
        throw err;
      }
      const id = 'user-' + Date.now().toString(36);
      await pool.query(
        'INSERT INTO users (id, username, password, role, site_ids) VALUES ($1,$2,$3,$4,$5)',
        [id, username, password, role || 'CLIENT', JSON.stringify(Array.isArray(siteIds) ? siteIds : [])]
      );
      return { id };
    },
    async deleteUser(id) {
      const q = await pool.query('SELECT role FROM users WHERE id=$1', [id]);
      if (q.rowCount === 0) return { ok: false, reason: 'NOT_FOUND' };
      if (q.rows[0].role === 'ADMIN') return { ok: false, reason: 'IS_ADMIN' };
      await pool.query('DELETE FROM users WHERE id=$1', [id]);
      return { ok: true };
    },
    async updateUserSites(id, siteIds) {
      const q = await pool.query('UPDATE users SET site_ids=$2 WHERE id=$1', [id, JSON.stringify(Array.isArray(siteIds) ? siteIds : [])]);
      if (q.rowCount === 0) return null;
      return Array.isArray(siteIds) ? siteIds : [];
    }
  };
}

// -----------------------------
// JSON fallback (local dev only)
// -----------------------------
function createJsonAdapter() {
  const dataDir = path.join(__dirname, 'data');
  const sitesFile = path.join(dataDir, 'sites.json');
  const usersFile = path.join(dataDir, 'users.json');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  function loadJson(file, fallback) {
    try {
      if (!fs.existsSync(file)) return fallback;
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  let sitesData = loadJson(sitesFile, { sites: [] });
  let usersData = loadJson(usersFile, { users: [] });
  if (!Array.isArray(sitesData.sites)) sitesData.sites = [];
  if (!Array.isArray(usersData.users)) usersData.users = [];

  // seed
  if (!usersData.users.find((u) => u.username === 'operator')) {
    usersData.users.push({
      id: 'admin-operator',
      username: 'operator',
      password: 'beds2025!',
      role: 'ADMIN',
      siteIds: []
    });
    saveJson(usersFile, usersData);
  }
  if (sitesData.sites.length === 0) {
    sitesData.sites.push({
      id: 'site-sample',
      name: '샘플 현장',
      address: '서울특별시 중구 세종대로 110',
      latitude: 37.5665,
      longitude: 126.978,
      sensorCount: 3,
      buildingSize: '지상 20F, 연면적 12,000㎡',
      buildingYear: '2010',
      notes: '데모용 샘플 현장',
      status: 'SAFE',
      constructionState: 'IN_PROGRESS'
    });
    saveJson(sitesFile, sitesData);
  }

  return {
    kind: 'json',
    async init() {},
    async getSites() {
      return sitesData.sites.map((s) => ({
        ...s,
        status: normalizeStatus(s.status),
        constructionState: normalizeConstructionState(s.constructionState)
      }));
    },
    async addSite(payload) {
      const id = 'site-' + Date.now().toString(36);
      const site = {
        id,
        name: payload.name,
        address: payload.address,
        latitude: isFiniteNumber(payload.latitude) ? payload.latitude : null,
        longitude: isFiniteNumber(payload.longitude) ? payload.longitude : null,
        sensorCount: typeof payload.sensorCount === 'number' ? payload.sensorCount : Number(payload.sensorCount) || 0,
        buildingSize: payload.buildingSize || '',
        buildingYear: payload.buildingYear || '',
        notes: payload.notes || '',
        status: 'SAFE',
        constructionState: normalizeConstructionState(payload.constructionState)
      };
      sitesData.sites.push(site);
      saveJson(sitesFile, sitesData);
      return site;
    },
    async updateSite(id, body) {
      const idx = sitesData.sites.findIndex((s) => s.id === id);
      if (idx < 0) return null;
      const cur = sitesData.sites[idx];
      const next = { ...cur };
      if (typeof body.name === 'string') next.name = body.name.trim();
      if (typeof body.address === 'string') next.address = body.address.trim();
      if (body.latitude === null) next.latitude = null;
      else if (isFiniteNumber(body.latitude)) next.latitude = body.latitude;
      if (body.longitude === null) next.longitude = null;
      else if (isFiniteNumber(body.longitude)) next.longitude = body.longitude;
      if (body.sensorCount != null) {
        const n = Number(body.sensorCount);
        if (Number.isFinite(n)) next.sensorCount = n;
      }
      if (typeof body.buildingSize === 'string') next.buildingSize = body.buildingSize;
      if (typeof body.buildingYear === 'string') next.buildingYear = body.buildingYear;
      if (typeof body.notes === 'string') next.notes = body.notes;
      if (body.status != null) next.status = normalizeStatus(body.status);
      const c = body.constructionState ?? body.constructionStatus ?? body.construction_state ?? null;
      if (c != null) next.constructionState = normalizeConstructionState(c);
      if (!next.name || !next.address) {
        const err = new Error('name과 address는 필수입니다.');
        err.code = 'VALIDATION';
        throw err;
      }
      sitesData.sites[idx] = next;
      saveJson(sitesFile, sitesData);
      return next;
    },
    async deleteSite(id) {
      const before = sitesData.sites.length;
      sitesData.sites = sitesData.sites.filter((s) => s.id !== id);
      if (sitesData.sites.length === before) return false;
      usersData.users = usersData.users.map((u) => {
        if (Array.isArray(u.siteIds)) u.siteIds = u.siteIds.filter((sid) => sid !== id);
        return u;
      });
      saveJson(sitesFile, sitesData);
      saveJson(usersFile, usersData);
      return true;
    },
    async getUsers() {
      return usersData.users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        siteIds: Array.isArray(u.siteIds) ? u.siteIds : []
      }));
    },
    async findUserByCredentials(username, password) {
      const u = usersData.users.find((x) => x.username === username && x.password === password);
      if (!u) return null;
      return { id: u.id, username: u.username, role: u.role, siteIds: Array.isArray(u.siteIds) ? u.siteIds : [] };
    },
    async createUser({ username, password, role, siteIds }) {
      if (usersData.users.find((u) => u.username === username)) {
        const err = new Error('이미 존재하는 ID입니다.');
        err.code = 'DUP';
        throw err;
      }
      const id = 'user-' + Date.now().toString(36);
      usersData.users.push({ id, username, password, role: role || 'CLIENT', siteIds: Array.isArray(siteIds) ? siteIds : [] });
      saveJson(usersFile, usersData);
      return { id };
    },
    async deleteUser(id) {
      const user = usersData.users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'NOT_FOUND' };
      if (user.role === 'ADMIN') return { ok: false, reason: 'IS_ADMIN' };
      usersData.users = usersData.users.filter((u) => u.id !== id);
      saveJson(usersFile, usersData);
      return { ok: true };
    },
    async updateUserSites(id, siteIds) {
      const user = usersData.users.find((u) => u.id === id);
      if (!user) return null;
      user.siteIds = Array.isArray(siteIds) ? siteIds : [];
      saveJson(usersFile, usersData);
      return user.siteIds;
    }
  };
}

async function createStorage() {
  if (HAS_PG) return createPgAdapter();
  return createJsonAdapter();
}

module.exports = {
  createStorage,
  normalizeConstructionState,
  normalizeStatus
};
