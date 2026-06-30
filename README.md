# Push Notifications PWA

A tiny installable web app (PWA) for **iOS web push**, built with **Next.js**. Add it to your home screen, subscribe to notifications, then trigger them from anywhere with a simple HTTP endpoint.

- **Framework:** Next.js (App Router), API routes on the Node.js runtime so `web-push` works unchanged.
- **Storage:** [Upstash Redis](https://upstash.com) — durable, free-tier KV (falls back to an in-memory store in local dev).
- **Deploy target:** Vercel.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

It runs out of the box: with no env vars it uses an in-memory store and ephemeral VAPID keys (fine for clicking through the UI locally). For real push you need stable VAPID keys and Upstash — see below.

## Configuration

Copy `.env.example` to `.env.local` and fill it in:

```bash
npm run gen:vapid   # prints a VAPID key pair to paste in
```

| Var | What |
|-----|------|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push identity. **Must stay stable** — changing them invalidates every subscription. |
| `VAPID_CONTACT` | A `mailto:` the push service can reach you at. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | From your Upstash database's **REST API** section. On Vercel, the native Upstash integration injects these for you — no manual setup. |

> **Why Redis here?** Upstash Redis is a *durable* managed Redis — every write persists to disk-backed storage and nothing is evicted without a TTL. Our data is a tiny `username → {password, subscription}` KV map, so it's a clean fit. The store lives in `lib/store.js` (3 functions) — swap it for Postgres later if you outgrow KV.

## Deploy to Vercel

1. Import the repo in Vercel.
2. Add an **Upstash Redis** database via the project's **Storage** tab (native integration) — it injects `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` automatically.
3. Run `npm run gen:vapid` and add the three `VAPID_*` vars to the project's Environment Variables (Production + Preview).
4. Deploy. Vercel serves over HTTPS, which iOS requires.

## iOS requirements (important)

iOS only delivers web push to a PWA that has been **added to the home screen** and opened from there (iOS **16.4+**), over **HTTPS**. Open the deployed URL in Safari → Share → **Add to Home Screen** → open the app → **Enable notifications**.

(To test against `localhost` from a real iPhone, expose it over HTTPS with `ngrok http 3000` or `npx cloudflared tunnel --url http://localhost:3000`.)

## How it works

1. The app registers a service worker (`public/sw.js`) and creates a push subscription.
2. You set a **username / password** (saved on the device; reveal with the 👁️ icon at any time). They're bound to your subscription in the store.
3. Hitting `POST /api/notify` with those credentials delivers a notification to your device.

## Endpoint

`POST /api/notify`

```json
{ "username": "you", "password": "secret", "title": "Hello", "body": "World" }
```

Credentials may also be passed via HTTP Basic auth. The app's UI shows ready-to-paste `curl` / Python / Node snippets prefilled with your credentials.

## Project layout

```
app/
  page.js                       UI (client component)
  layout.js                     PWA metadata
  api/vapid-public-key/route.js
  api/subscribe/route.js
  api/notify/route.js
lib/
  vapid.js                      web-push config + public key
  store.js                      Upstash KV (with in-memory dev fallback)
public/
  sw.js  manifest.json  icons/
scripts/
  generate-vapid.js  generate-icons.js
```

## Note on the password

It's stored as-is and acts as the API key for sending notifications — appropriate for this single-purpose personal tool, but not credential hygiene you'd want in a multi-user service.
