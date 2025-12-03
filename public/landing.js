// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const loginToggleBtn = document.getElementById('login-toggle');
const loginPanel = document.getElementById('login-panel');
const loginForm = document.getElementById('login-form');
const loginIdEl = document.getElementById('login-id');
const loginPasswordEl = document.getElementById('login-password');
const loginErrorEl = document.getElementById('login-error');

const DEMO_ID = 'operator';
const DEMO_PASSWORD = 'beds2025!';

function toggleLoginPanel() {
  if (!loginPanel) return;
  const isVisible = loginPanel.style.display === 'block';
  loginPanel.style.display = isVisible ? 'none' : 'block';
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const id = (loginIdEl.value || '').trim();
  const pw = (loginPasswordEl.value || '').trim();

  if (!id || !pw) {
    loginErrorEl.textContent = 'Please enter both ID and password.';
    return;
  }

  if (id === DEMO_ID && pw === DEMO_PASSWORD) {
    localStorage.setItem('beds_logged_in', '1');
    window.location.href = 'client.html';
  } else {
    loginErrorEl.textContent = 'Invalid credentials. Demo: operator / beds2025!';
  }
}

function initLandingMap() {
  const mapEl = document.getElementById('landing-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('landing-map', {
    zoomControl: false
  }).setView([37.5665, 126.9780], 12); // Seoul

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ''
  }).addTo(map);

  const marker = L.marker([37.5665, 126.9780]).addTo(map);
  marker.bindPopup('Sample monitoring asset').openPopup();
}

document.addEventListener('DOMContentLoaded', () => {
  if (loginToggleBtn) {
    loginToggleBtn.addEventListener('click', toggleLoginPanel);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  initLandingMap();
});
