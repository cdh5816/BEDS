// © AIRX (individual business). All rights reserved.
// This codebase is owned by the user (AIRX) for the Building Earthquake Detection System project.


const loginForm = document.getElementById('login-form');
const loginIdEl = document.getElementById('login-id');
const loginPasswordEl = document.getElementById('login-password');
const loginErrorEl = document.getElementById('login-error');

// Demo credentials
const DEMO_ID = 'operator';
const DEMO_PASSWORD = 'beds2025!';

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
    loginErrorEl.textContent = 'Invalid credentials. (Demo: operator / beds2025!)';
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLoginSubmit);
}
