import { Redis } from "@upstash/redis";

export interface RedisRestConfig {
  url: string;
  token: string;
}

/**
 * Resolve Upstash Redis REST credentials.
 *
 * QStash and Redis are separate Upstash products with separate REST endpoints
 * and tokens. Never reuse QSTASH_URL/QSTASH_TOKEN here: doing so points the
 * Redis client at the QStash API and makes cache/idempotency calls fail.
 */
export function getRedisRestConfig(
  env: NodeJS.ProcessEnv = process.env,
): RedisRestConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return null;

  return { url, token };
}

/**
 * Create a Redis client only when dedicated Redis credentials are present.
 * Returns null so callers can fall back to their in-memory implementation.
 */
export function createRedisClient(
  env: NodeJS.ProcessEnv = process.env,
): Redis | null {
  const config = getRedisRestConfig(env);
  if (!config) return null;

  try {
    return new Redis(config);
  } catch {
    return null;
  }
}
