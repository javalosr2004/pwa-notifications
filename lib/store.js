import { Redis } from '@upstash/redis';

// Durable KV store for credentials + push subscriptions, keyed by username.
// Uses Upstash Redis in production. With no Upstash env vars it falls back to an
// in-memory map so the app runs locally without a cloud account — NOT durable,
// dev only. Swapping this whole module for Postgres later only touches 3 functions.
const hasUpstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;
const memory = new Map();

if (!hasUpstash) {
  console.warn(
    '[store] No UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — using an ' +
      'in-memory store (dev only, not durable across restarts).'
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
