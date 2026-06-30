// Generate a VAPID key pair to paste into your env vars (Vercel / .env.local).
// Run: npm run gen:vapid
const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Add these to your environment (Vercel project settings or .env.local):\n');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_CONTACT=mailto:you@example.com');
console.log('\nKeep the private key secret. Changing these invalidates existing subscriptions.');
