import webpush from 'web-push';

// VAPID keys identify this server to the push services. They MUST be stable in
// production — losing them invalidates every existing subscription. Set them as
// env vars (generate a pair with `npm run gen:vapid`). In local dev with no env
// vars we generate an ephemeral pair so the app runs out of the box.
let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  const keys = webpush.generateVAPIDKeys();
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
  console.warn(
    '[vapid] No VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars — generated ephemeral ' +
      'keys for local dev. Set them in production (npm run gen:vapid).'
  );
}

webpush.setVapidDetails(
  process.env.VAPID_CONTACT || 'mailto:admin@example.com',
  publicKey,
  privateKey
);

export { webpush, publicKey };
