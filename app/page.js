'use client';

import { useEffect, useState } from 'react';

const LS = 'pwa-notify-creds';

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 16);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [standalone, setStandalone] = useState(true);
  const [origin, setOrigin] = useState('');
  const [lang, setLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  // Load saved credentials, detect install state, reflect existing subscription.
  useEffect(() => {
    setOrigin(window.location.origin);

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(LS)) || {}; } catch {}
    setUsername(saved.username || '');
    setPassword(saved.password || randomPassword());

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setStandalone(isStandalone);

    (async () => {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) setSubscribed(true);
    })();
  }, []);

  async function subscribe() {
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) return setStatus({ text: 'Enter a username and password first.', kind: 'bad' });
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return setStatus({
        text: 'Push is not supported here. On iOS, add the app to your home screen and open it from there.',
        kind: 'bad',
      });
    }

    setBusy(true);
    setStatus({ text: 'Requesting permission…', kind: '' });
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus({ text: 'Notification permission was not granted.', kind: 'bad' });
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
        body: JSON.stringify({ username: u, password: p, subscription }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'subscribe failed');

      localStorage.setItem(LS, JSON.stringify({ username: u, password: p }));
      setSubscribed(true);
      setStatus({ text: 'Subscribed! Your credentials are saved.', kind: 'good' });
    } catch (err) {
      setStatus({ text: 'Could not subscribe: ' + err.message, kind: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
        title: 'It works 🎉',
        body: 'This is a test notification.',
      }),
    });
    if (res.ok) {
      setStatus({ text: 'Test notification sent.', kind: 'good' });
    } else {
      setStatus({ text: 'Test failed: ' + ((await res.json()).error || res.status), kind: 'bad' });
    }
  }

  const snippetUser = username.trim() || 'your-username';
  const snippetPass = password.trim() || 'your-password';
  const url = `${origin}/api/notify`;
  const snippets = {
    curl: `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"${snippetUser}","password":"${snippetPass}","title":"Hello","body":"World"}'`,
    python: `import requests

requests.post("${url}", json={
    "username": "${snippetUser}",
    "password": "${snippetPass}",
    "title": "Hello",
    "body": "World",
})`,
    node: `await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "${snippetUser}",
    password: "${snippetPass}",
    title: "Hello",
    body: "World",
  }),
});`,
  };

  async function copy() {
    await navigator.clipboard.writeText(snippets[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">🔔</div>
        <div>
          <h1>Push Notifications</h1>
        </div>
      </div>
      <p className="sub">
        Install this app, subscribe, and send yourself notifications from anywhere via a simple API.
      </p>

      {!standalone && (
        <div className="card">
          <div className="step">
            <div className="num">1</div>
            <div>
              <h2>Add to Home Screen</h2>
              <p>
                In Safari, tap the <span className="kbd">Share ⬆️</span> button, then choose{' '}
                <span className="kbd">Add to Home Screen</span>. Open the app from your home screen
                to continue. <em>(Required on iOS for push to work — iOS 16.4+.)</em>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <div className="step" style={{ flex: 1 }}>
            <div className="num">2</div>
            <div>
              <h2>Subscribe &amp; set credentials</h2>
              <p>Pick a username and password — you&apos;ll use them to send notifications.</p>
            </div>
          </div>
          <span className={'pill' + (subscribed ? ' on' : '')}>
            <span className="dot"></span>
            {subscribed ? 'Subscribed' : 'Off'}
          </span>
        </div>

        <label htmlFor="username">username</label>
        <div className="field">
          <input
            type="text"
            id="username"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="e.g. jesus"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <label htmlFor="password">password</label>
        <div className="field">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="eye"
            type="button"
            aria-label="Reveal password"
            title="Reveal password"
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <button className="btn btn-primary" onClick={subscribe} disabled={busy}>
          Enable notifications
        </button>
        <div className={'status' + (status.kind ? ' ' + status.kind : '')}>{status.text}</div>

        {subscribed && (
          <button className="btn btn-ghost" onClick={sendTest}>
            Send a test notification
          </button>
        )}
      </div>

      <div className="card">
        <div className="step" style={{ marginBottom: 12 }}>
          <div className="num">3</div>
          <div>
            <h2>Hit the endpoint</h2>
            <p>Run any of these to push a notification to your device.</p>
          </div>
        </div>

        <div className="tabs">
          {[
            ['curl', 'curl'],
            ['python', 'python'],
            ['node', 'node.js'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={'tab' + (lang === key ? ' active' : '')}
              onClick={() => setLang(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="code-head">
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>POST {url}</span>
          <button className="copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre>
          <code>{snippets[lang]}</code>
        </pre>
      </div>
    </div>
  );
}
