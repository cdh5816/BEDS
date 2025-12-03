// © AIRX (individual business) - All rights reserved.
// BEDS (Building Earthquake Detection System) - main server entry.

const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getUserByEmail, getBuildings, addBuilding } = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'beds-dev-secret';

app.use(express.json());
app.use(cors());

// --- Auth middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: '토큰이 유효하지 않습니다.' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
}

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BEDS' });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
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
});

// Public buildings for map (no auth)
app.get('/api/public/buildings', (req, res) => {
  const buildings = getBuildings().map(b => ({
    id: b.id,
    name: b.name,
    address: b.address,
    lat: b.lat,
    lng: b.lng
  }));
  res.json({ buildings });
});

// Admin: list buildings
app.get('/api/buildings', authenticateToken, requireAdmin, (req, res) => {
  const buildings = getBuildings();
  res.json({ buildings });
});

// Admin: add building
app.post('/api/buildings', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, address, lat, lng } = req.body;
    if (!name || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'name, address, lat, lng가 필요합니다.' });
    }
    const building = addBuilding({ name, address, lat, lng });
    res.status(201).json({ building });
  } catch (err) {
    console.error('Error adding building:', err);
    res.status(500).json({ message: '건물 등록 중 오류가 발생했습니다.' });
  }
});

// --- Static frontend ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Fallback to index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BEDS server running on http://localhost:${PORT}`);
});