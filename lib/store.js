import { Redis } from '@upstash/redis';

// Durable KV store for credentials + push subscriptions, keyed by username.
// Uses Upstash Redis in production. Redis.fromEnv() reads UPSTASH_REDIS_REST_URL
// or KV_REST_API_URL (and the matching token) — Vercel's native Upstash
// integration injects the KV_* names, so this works on Vercel untouched. With no
// Upstash env vars we fall back to an in-memory map so the app runs locally
// without a cloud account — NOT durable, dev only. The guard below must check
// the same names fromEnv() does, or production would silently use the fallback.
// Swapping this module for Postgres later only touches 3 functions.
const hasUpstash =
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);

const redis = hasUpstash ? Redis.fromEnv() : null;
const memory = new Map();

if (!hasUpstash) {
  console.warn(
    '[store] No Upstash env vars (UPSTASH_REDIS_REST_* / KV_REST_API_*) — using ' +
      'an in-memory store (dev only, not durable across restarts).'
  );
}

const key = (username) => `user:${username}`;

export async function getUser(username) {
  if (redis) return redis.get(key(username));
  return memory.get(key(username)) ?? null;
}

export async function setUser(username, data) {
  if (redis) return redis.set(key(username), data);
  memory.set(key(username), data);
}

export async function deleteUser(username) {
  if (redis) return redis.del(key(username));
  memory.delete(key(username));
}
