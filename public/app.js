// Front-end logic: install detection, push subscription, credential persistence,
// and the live code snippets.

const $ = (id) => document.getElementById(id);
const origin = window.location.origin;

const usernameEl = $('username');
const passwordEl = $('password');
const subMsg = $('subMsg');
const subStatus = $('subStatus');
const subscribeBtn = $('subscribeBtn');
const testBtn = $('testBtn');

// --- Credentials persist in localStorage so "reveal" works at all times. ---
const LS = 'pwa-notify-creds';
function loadCreds() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; }
}
function saveCreds(username, password) {
  localStorage.setItem(LS, JSON.stringify({ username, password }));
}
function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 16);
}

(function initCreds() {
  const { username, password } = loadCreds();
  usernameEl.value = username || '';
  passwordEl.value = password || randomPassword();
  renderSnippet();
})();

// Reveal password — available at all times.
$('toggleEye').addEventListener('click', () => {
  passwordEl.type = passwordEl.type === 'password' ? 'text' : 'password';
});

[usernameEl, passwordEl].forEach((el) => el.addEventListener('input', renderSnippet));

// --- Hide install instructions when already running as an installed app. ---
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) $('installCard').classList.add('hidden');

// --- Subscription status pill ---
function setStatus(on) {
  if (on) {
    subStatus.classList.add('on');
    subStatus.innerHTML = '<span class="dot"></span>Subscribed';
    testBtn.classList.remove('hidden');
  } else {
    subStatus.classList.remove('on');
    subStatus.innerHTML = '<span class="dot"></span>Off';
  }
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// Reflect existing subscription state on load.
(async () => {
  if (await currentSubscription()) setStatus(true);
})();

function msg(text, kind) {
  subMsg.textContent = text;
  subMsg.className = 'status' + (kind ? ' ' + kind : '');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

subscribeBtn.addEventListener('click', async () => {
  const username = usernameEl.value.trim();
  const password = passwordEl.value.trim();
  if (!username || !password) return msg('Enter a username and password first.', 'bad');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return msg('Push is not supported here. On iOS, add the app to your home screen and open it from there.', 'bad');
  }

  subscribeBtn.disabled = true;
  msg('Requesting permission…');
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      msg('Notification permission was not granted.', 'bad');
      subscribeBtn.disabled = false;
      return;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const { publicKey } = await fetch('/api/vapid-public-key').then((r) => r.json());
    const subscription =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, subscription }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'subscribe failed');

    saveCreds(username, password);
    renderSnippet();
    setStatus(true);
    msg('Subscribed! Your credentials are saved.', 'good');
  } catch (err) {
    msg('Could not subscribe: ' + err.message, 'bad');
  } finally {
    subscribeBtn.disabled = false;
  }
});

testBtn.addEventListener('click', async () => {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: usernameEl.value.trim(),
      password: passwordEl.value.trim(),
      title: 'It works 🎉',
      body: 'This is a test notification.',
    }),
  });
  msg(res.ok ? 'Test notification sent.' : 'Test failed: ' + ((await res.json()).error || res.status), res.ok ? 'good' : 'bad');
});

// --- Code snippets ---
let lang = 'curl';
document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    lang = tab.dataset.lang;
    renderSnippet();
  })
);

function snippets(user, pass) {
  const url = `${origin}/api/notify`;
  return {
    curl: `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"${user}","password":"${pass}","title":"Hello","body":"World"}'`,
    python: `import requests

requests.post("${url}", json={
    "username": "${user}",
    "password": "${pass}",
    "title": "Hello",
    "body": "World",
})`,
    node: `await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "${user}",
    password: "${pass}",
    title: "Hello",
    body: "World",
  }),
});`,
  };
}

function renderSnippet() {
  const user = usernameEl.value.trim() || 'your-username';
  const pass = passwordEl.value.trim() || 'your-password';
  $('snippet').textContent = snippets(user, pass)[lang];
  $('endpointLabel').textContent = `POST ${origin}/api/notify`;
}

$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('snippet').textContent);
  $('copyBtn').textContent = 'Copied';
  setTimeout(() => ($('copyBtn').textContent = 'Copy'), 1200);
});
