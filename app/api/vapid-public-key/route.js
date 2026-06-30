import { publicKey } from '@/lib/vapid';

export const runtime = 'nodejs';

// Hand the browser the public key it needs to create a push subscription.
export async function GET() {
  return Response.json({ publicKey });
}
