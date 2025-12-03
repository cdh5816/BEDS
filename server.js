// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BEDS_v3 server running on port ${PORT}`);
});
