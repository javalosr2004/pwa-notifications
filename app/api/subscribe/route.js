import { setUser } from '@/lib/store';

export const runtime = 'nodejs';

// One-time setup: bind a username/password to this device's push subscription.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { username, password, subscription } = body || {};
  if (!username || !password || !subscription) {
    return Response.json(
      { error: 'username, password and subscription are required' },
      { status: 400 }
    );
  }

  await setUser(username, {
    password,
    subscription,
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
