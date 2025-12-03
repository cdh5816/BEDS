// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Utility: load & save sites
async function loadSites() {
  try {
    const raw = await fs.readFile(SITES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('Error loading sites:', err);
    return [];
  }
}

async function saveSites(sites) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SITES_FILE, JSON.stringify(sites, null, 2), 'utf-8');
}

// ----- GEOCODING (server-side via Nominatim) -----
app.get('/api/geocode', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ message: 'Missing query.' });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
    query
  )}`;

  https
    .get(
      url,
      {
        headers: {
          'User-Agent': 'AIRX-BEDS/1.0 (contact: airx)',
          Accept: 'application/json'
        }
      },
      (resp) => {
        let data = '';
        resp.on('data', (chunk) => (data += chunk));
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            res.json(parsed);
          } catch (err) {
            console.error('Geocode parse error:', err);
            res.status(500).json({ message: 'Failed to parse geocoding response.' });
          }
        });
      }
    )
    .on('error', (err) => {
      console.error('Geocode request error:', err);
      res.status(500).json({ message: 'Geocoding request failed.' });
    });
});

// ----- SITE CRUD & METRICS -----

// API: Get all sites
app.get('/api/sites', async (req, res) => {
  const sites = await loadSites();
  res.json(sites);
});

// API: Create new site
app.post('/api/sites', async (req, res) => {
  try {
    const {
      name,
      address,
      latitude,
      longitude,
      sensorCount,
      buildingSize,
      buildingYear,
      notes
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: 'Site name and address are required.' });
    }

    const sites = await loadSites();
    const now = new Date().toISOString();

    const newSite = {
      id: Date.now().toString(),
      name,
      address,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      sensorCount: Number.isFinite(Number(sensorCount)) ? Number(sensorCount) : 0,
      buildingSize: buildingSize || '',
      buildingYear: buildingYear || '',
      notes: notes || '',
      status: 'SAFE', // SAFE | CAUTION | ALERT
      createdAt: now,
      updatedAt: now,
      measurements: [] // 관리자 수기 입력 데이터
    };

    sites.push(newSite);
    await saveSites(sites);

    res.status(201).json(newSite);
  } catch (err) {
    console.error('Error creating site:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// API: Update status only
app.patch('/api/sites/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['SAFE', 'CAUTION', 'ALERT'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const sites = await loadSites();
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Site not found.' });
    }

    sites[idx].status = status;
    sites[idx].updatedAt = new Date().toISOString();
    await saveSites(sites);

    res.json(sites[idx]);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// API: Add manual measurement for a site (관리자 수기 업로드용)
app.post('/api/sites/:id/measurements', async (req, res) => {
  try {
    const { id } = req.params;
    const { shakes, maxDrift, maxMagnitude, note } = req.body;

    const sites = await loadSites();
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Site not found.' });
    }

    const now = new Date();
    const measurement = {
      id: now.getTime().toString(),
      timestamp: now.toISOString(),
      shakes: Number.isFinite(Number(shakes)) ? Number(shakes) : 0,
      maxDrift: Number.isFinite(Number(maxDrift)) ? Number(maxDrift) : 0,
      maxMagnitude: Number.isFinite(Number(maxMagnitude)) ? Number(maxMagnitude) : 0,
      note: note || ''
    };

    if (!Array.isArray(sites[idx].measurements)) {
      sites[idx].measurements = [];
    }
    sites[idx].measurements.push(measurement);
    sites[idx].updatedAt = now.toISOString();

    await saveSites(sites);

    res.status(201).json(measurement);
  } catch (err) {
    console.error('Error adding measurement:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// API: 고객용 메트릭 조회
app.get('/api/sites/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const sites = await loadSites();
    const site = sites.find((s) => s.id === id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found.' });
    }

    const measurements = Array.isArray(site.measurements) ? site.measurements : [];

    // 측정치가 있으면 실제 데이터 기반
    if (measurements.length > 0) {
      const byDay = new Map();

      for (const m of measurements) {
        const ts = m.timestamp ? new Date(m.timestamp) : new Date();
        const dayKey = ts.toISOString().slice(0, 10); // YYYY-MM-DD

        if (!byDay.has(dayKey)) {
          byDay.set(dayKey, {
            shakes: 0,
            maxDrift: 0,
            maxMagnitude: 0
          });
        }

        const bucket = byDay.get(dayKey);
        bucket.shakes += Number.isFinite(m.shakes) ? m.shakes : 0;
        bucket.maxDrift = Math.max(bucket.maxDrift, Number.isFinite(m.maxDrift) ? m.maxDrift : 0);
        bucket.maxMagnitude = Math.max(
          bucket.maxMagnitude,
          Number.isFinite(m.maxMagnitude) ? m.maxMagnitude : 0
        );
      }

      const sortedDays = Array.from(byDay.keys()).sort();
      const last7 = sortedDays.slice(-7);
      const labels = last7.map((d, idx) => (idx === last7.length - 1 ? '오늘' : d.slice(5)));
      const shakesArr = last7.map((d) => byDay.get(d).shakes);
      const driftArr = last7.map((d) => Number(byDay.get(d).maxDrift.toFixed(2)));

      const todayKey = sortedDays[sortedDays.length - 1];
      const todayBucket = byDay.get(todayKey);

      const alertThreshold = 5;
      const alertCount7d = shakesArr.filter((v) => v >= alertThreshold).length;
      const alertCount30d = alertCount7d * 2;

      const metrics = {
        siteId: site.id,
        name: site.name,
        status: site.status || 'SAFE',
        last24h: {
          eventCount: todayBucket.shakes,
          maxMagnitude: Number(todayBucket.maxMagnitude.toFixed(3)),
          maxDrift: Number(todayBucket.maxDrift.toFixed(2)),
          alertCount: todayBucket.shakes >= alertThreshold ? 1 : 0
        },
        last7d: {
          labels,
          shakes: shakesArr,
          drift: driftArr,
          alertCount: alertCount7d
        },
        last30d: {
          alertCount: alertCount30d
        },
        updatedAt: new Date().toISOString()
      };

      return res.json(metrics);
    }

    // --- 데모 데이터 (측정치 없을 때) ---
    const status = site.status || 'SAFE';
    let minShakes, maxShakes, maxDrift, maxMag, alertThreshold;

    if (status === 'SAFE') {
      minShakes = 0;
      maxShakes = 4;
      maxDrift = 0.5;
      maxMag = 0.08;
      alertThreshold = 4;
    } else if (status === 'CAUTION') {
      minShakes = 2;
      maxShakes = 10;
      maxDrift = 1.5;
      maxMag = 0.18;
      alertThreshold = 7;
    } else {
      minShakes = 5;
      maxShakes = 18;
      maxDrift = 3.0;
      maxMag = 0.25;
      alertThreshold = 8;
    }

    function randBetween(a, b) {
      return a + Math.random() * (b - a);
    }

    const dailyShakes = Array.from({ length: 7 }).map(() =>
      Math.round(randBetween(minShakes, maxShakes))
    );
    const todayShakes = dailyShakes[dailyShakes.length - 1];

    const dailyDrift = Array.from({ length: 7 }).map(() =>
      Number(randBetween(maxDrift * 0.2, maxDrift).toFixed(2))
    );

    const eventCount = todayShakes;
    const maxMagnitude = Number(randBetween(maxMag * 0.3, maxMag).toFixed(3));
    const maxDriftVal = Math.max(...dailyDrift);
    const alertCount7d = dailyShakes.filter((v) => v >= alertThreshold).length;
    const alertCount30d = alertCount7d * 3;

    const metrics = {
      siteId: site.id,
      name: site.name,
      status,
      last24h: {
        eventCount,
        maxMagnitude,
        maxDrift: Number(maxDriftVal.toFixed(2)),
        alertCount: eventCount >= alertThreshold ? 1 : 0
      },
      last7d: {
        labels: ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Today'],
        shakes: dailyShakes,
        drift: dailyDrift,
        alertCount: alertCount7d
      },
      last30d: {
        alertCount: alertCount30d
      },
      updatedAt: new Date().toISOString()
    };

    res.json(metrics);
  } catch (err) {
    console.error('Error in /api/sites/:id/metrics:', err);
    res.status(500).json({ message: 'Error loading metrics.' });
  }
});

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Fallback: serve landing page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BEDS_v3 server running on port ${PORT}`);
});
