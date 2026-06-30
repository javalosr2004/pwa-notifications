const express = require('express');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

// --- VAPID keys (generated once, persisted) ---
let vapid;
if (fs.existsSync(VAPID_FILE)) {
  vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
} else {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid, null, 2));
}
webpush.setVapidDetails(
  process.env.VAPID_CONTACT || 'mailto:admin@example.com',
  vapid.publicKey,
  vapid.privateKey
);

// --- Credential + subscription store ---
// Shape: { [username]: { password, subscription, updatedAt } }
function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { return {}; }
}
function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

generateIconsIfMissing();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

// Hand the browser the public key it needs to create a push subscription.
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapid.publicKey });
});

// One-time setup: bind a username/password to this device's push subscription.
app.post('/api/subscribe', (req, res) => {
  const { username, password, subscription } = req.body || {};
  if (!username || !password || !subscription) {
    return res.status(400).json({ error: 'username, password and subscription are required' });
  }
  const store = loadStore();
  store[username] = { password, subscription, updatedAt: new Date().toISOString() };
  saveStore(store);
  res.json({ ok: true });
});

// The endpoint you hit to deliver a notification. Auth via JSON body or Basic auth.
app.post('/api/notify', async (req, res) => {
  let { username, password, title, body } = req.body || {};

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    username = username || decoded.slice(0, idx);
    password = password || decoded.slice(idx + 1);
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const store = loadStore();
  const record = store[username];
  if (!record || record.password !== password) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const payload = JSON.stringify({
    title: title || 'Notification',
    body: body || '',
  });

  try {
    await webpush.sendNotification(record.subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    // Subscription is dead — drop it so the user knows to re-subscribe.
    if (err.statusCode === 404 || err.statusCode === 410) {
      delete store[username];
      saveStore(store);
      return res.status(410).json({ error: 'subscription expired — re-subscribe in the app' });
    }
    res.status(500).json({ error: 'failed to send notification', detail: err.body || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`PWA notifications running on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Minimal PNG app-icon generator (zero dependencies). iOS home-screen icons
// must be real PNGs; this draws a bell on an indigo background so the install
// has a recognizable icon without shipping binary assets in the repo.
// ---------------------------------------------------------------------------
function generateIconsIfMissing() {
  for (const size of [192, 512]) {
    const file = path.join(ICONS_DIR, `icon-${size}.png`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, makeBellPNG(size));
  }
}

function makeBellPNG(size) {
  const bg = [99, 102, 241];   // indigo-500
  const fg = [255, 255, 255];  // white bell
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const top = size * 0.26, rim = size * 0.62;
  const hwTop = size * 0.05, hwRim = size * 0.23;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // no per-row filter
    for (let x = 0; x < size; x++) {
      let c = bg;
      if (isBell(x, y)) c = fg;
      const i = rowStart + 1 + x * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255;
    }
  }

  function isBell(x, y) {
    const dxAbs = Math.abs(x - cx);
    // Bell body: widens from the top down to the rim.
    if (y >= top && y <= rim) {
      const t = (y - top) / (rim - top);
      const hw = hwTop + (hwRim - hwTop) * Math.sqrt(t);
      if (dxAbs <= hw) return true;
    }
    // Rim bar.
    if (y > rim && y <= rim + size * 0.05 && dxAbs <= size * 0.27) return true;
    // Top knob.
    if (dist(x, y, cx, top) <= size * 0.045) return true;
    // Clapper.
    if (dist(x, y, cx, rim + size * 0.1) <= size * 0.05) return true;
    return false;
  }
  function dist(x, y, ax, ay) { return Math.hypot(x - ax, y - ay); }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  if (!crc32.table) {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
