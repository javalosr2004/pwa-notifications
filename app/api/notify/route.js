import { getUser, deleteUser } from '@/lib/store';
import { webpush } from '@/lib/vapid';

export const runtime = 'nodejs';

// The endpoint you hit to deliver a notification. Auth via JSON body or Basic auth.
export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    // No/!JSON body is fine when using Basic auth.
  }

  let { username, password, title, body: message } = body || {};

  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    username = username || decoded.slice(0, idx);
    password = password || decoded.slice(idx + 1);
  }

  if (!username || !password) {
    return Response.json({ error: 'username and password are required' }, { status: 400 });
  }

  const record = await getUser(username);
  if (!record || record.password !== password) {
    return Response.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const payload = JSON.stringify({
    title: title || 'Notification',
    body: message || '',
  });

  try {
    await webpush.sendNotification(record.subscription, payload);
    return Response.json({ ok: true });
  } catch (err) {
    // Subscription is dead — drop it so the user knows to re-subscribe.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await deleteUser(username);
      return Response.json(
        { error: 'subscription expired — re-subscribe in the app' },
        { status: 410 }
      );
    }
    return Response.json(
      { error: 'failed to send notification', detail: err.body || String(err) },
      { status: 500 }
    );
  }
}
