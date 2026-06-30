# Push Notifications PWA

A tiny installable web app (PWA) for **iOS web push**. Add it to your home screen, subscribe to notifications, then trigger them from anywhere with a simple HTTP endpoint.

## Run

```bash
npm install
npm start
```

The server starts on `http://localhost:3000`. On first run it generates VAPID keys (`data/vapid.json`) and app icons automatically.

## iOS requirements (important)

iOS only delivers web push to a PWA that has been **added to the home screen** and opened from there (iOS **16.4+**). It also requires the page be served over **HTTPS** (localhost is exempt for desktop testing, but a real iPhone needs HTTPS).

For testing on a phone, expose the local server with a tunnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Open the HTTPS URL in Safari → Share → **Add to Home Screen** → open the app → **Enable notifications**.

## How it works

1. The app registers a service worker and creates a push subscription.
2. You set a **username / password** (saved on the device; reveal with the 👁️ icon at any time). These are bound to your subscription on the server.
3. Hitting `POST /api/notify` with those credentials delivers a notification to your device.

## Endpoint

`POST /api/notify`

```json
{ "username": "you", "password": "secret", "title": "Hello", "body": "World" }
```

Credentials may also be passed via HTTP Basic auth. The app shows ready-to-paste `curl` / Python / Node snippets prefilled with your credentials.

## Storage

Credentials and subscriptions live in `data/store.json` (gitignored). This is a single-purpose personal tool — the password acts as an API key for sending notifications.
