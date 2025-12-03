// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

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

// 주소 검색 (OpenStreetMap / Nominatim 사용, 카카오 X)
app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ message: '검색어(q)가 필요합니다.' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AIRX-BEDS/1.0 (contact: beds@airx.local)'
      }
    });

    if (!response.ok) {
      console.error('Geocode error status:', response.status);
      return res.status(502).json({ message: '주소 검색 서버 오류가 발생했습니다.' });
    }

    const data = await response.json();

    const results = data.map((item) => ({
      address: item.display_name,
      latitude: item.lat,
      longitude: item.lon
    }));

    res.json(results);
  } catch (err) {
    console.error('Error in /api/geocode:', err);
    res.status(500).json({ message: '주소 검색 처리 중 오류가 발생했습니다.' });
  }
});

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
      return res.status(400).json({ message: '현장 이름과 주소는 필수입니다.' });
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
      updatedAt: now
    };

    sites.push(newSite);
    await saveSites(sites);

    res.status(201).json(newSite);
  } catch (err) {
    console.error('Error creating site:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// API: Update status only
app.patch('/api/sites/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['SAFE', 'CAUTION', 'ALERT'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: '허용되지 않는 상태 값입니다.' });
    }

    const sites = await loadSites();
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: '현장을 찾을 수 없습니다.' });
    }

    sites[idx].status = status;
    sites[idx].updatedAt = new Date().toISOString();
    await saveSites(sites);

    res.json(sites[idx]);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// API: 고객용 지진·진동 메트릭 (현재는 데모 데이터 생성)
// TODO: 실제 센서 DB 연동 시 이 부분 교체
app.get('/api/sites/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const sites = await loadSites();
    const site = sites.find((s) => s.id === id);
    if (!site) {
      return res.status(404).json({ message: '현장을 찾을 수 없습니다.' });
    }

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
    const alertCount30d = alertCount7d * 3; // 단순 데모용 배율

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
        labels: ['-6일', '-5일', '-4일', '-3일', '-2일', '-1일', '오늘'],
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
    res.status(500).json({ message: '메트릭 조회 중 오류가 발생했습니다.' });
  }
});

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Fallback: serve index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BEDS_v3 server running on port ${PORT}`);
});
