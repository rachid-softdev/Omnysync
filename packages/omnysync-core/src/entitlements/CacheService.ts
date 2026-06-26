/**
 * Feature Flags & Entitlements - Cache Service
 * Omnysync - 2026
 *
 * Two-level cache:
 * - Level 1: Redis (5 min TTL)
 * - Level 2: Memory LRU (30s TTL) - fallback if Redis unavailable
 *
 * Pub/sub for multi-instance cache invalidation (fan-out pattern)
 */

import { Redis } from "@upstash/redis";
import { CACHE_CONFIG, DEFAULT_PLAN } from "./constants";
import type { EntitlementMap } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export interface CacheOptions {
  ttl?: number; // Override default TTL
}

export interface InvalidationMessage {
  type: "invalidate";
  orgId: string;
  timestamp: number;
}

// ============================================================================
// LRU CACHE (Memory - Level 2)
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 30 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: LRUCache<EntitlementMap>;
  private subscriber: Redis | null = null;
  private subscribed = false;

  constructor() {
    // Initialize memory cache (30s TTL, 1000 entries max)
    this.memoryCache = new LRUCache<EntitlementMap>(
      1000,
      CACHE_CONFIG.MEMORY_TTL * 1000,
    );

    // Initialize Redis if available
    this.initRedis();

    // Start periodic cleanup for memory cache
    this.startCleanupInterval();
  }

  private initRedis(): void {
    if (process.env.QSTASH_TOKEN && process.env.QSTASH_URL) {
      try {
        this.redis = new Redis({
          url: process.env.QSTASH_URL,
          token: process.env.QSTASH_TOKEN,
        });

        // Test connection
        this.redis.ping().catch((err) => {
          console.warn("[CacheService] Redis connection failed:", err);
          this.redis = null;
        });
      } catch (err) {
        console.warn("[CacheService] Failed to initialize Redis:", err);
        this.redis = null;
      }
    } else {
      console.warn(
        "[CacheService] Redis not configured, using memory cache only",
      );
    }
  }

  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  private startCleanupInterval(): void {
    // Clean up expired entries every 10 seconds
    this.cleanupIntervalId = setInterval(() => {
      const cleaned = this.memoryCache.cleanup();
      if (cleaned > 0) {
        // console.debug(`[CacheService] Cleaned ${cleaned} expired entries`)
      }
    }, 10000);
  }

  /**
   * Destroy the service — clears cleanup interval and releases resources.
   * Call this when replacing the singleton to prevent memory leaks.
   */
  destroy(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.memoryCache.clear();
    this.subscribed = false;
  }

  // Build cache key
  private getCacheKey(orgId: string): string {
    return `${CACHE_CONFIG.KEY_PREFIX}${orgId}`;
  }

  // ============================================================================
  // GET
  // ============================================================================

  async get(orgId: string): Promise<EntitlementMap | null> {
    const key = this.getCacheKey(orgId);

    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get<EntitlementMap>(key);
        if (cached) {
          // Also update memory cache
          this.memoryCache.set(key, cached, CACHE_CONFIG.REDIS_TTL * 1000);
          return cached;
        }
      } catch (err) {
        console.warn("[CacheService] Redis get failed:", err);
      }
    }

    // Fallback to memory cache
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      // console.debug(`[CacheService] Memory cache hit for org: ${orgId}`)
      return memoryCached;
    }

    return null;
  }

  // ============================================================================
  // SET
  // ============================================================================

  async set(
    orgId: string,
    data: EntitlementMap,
    options: CacheOptions = {},
  ): Promise<void> {
    const key = this.getCacheKey(orgId);
    const ttl = options.ttl ?? CACHE_CONFIG.REDIS_TTL;

    // Set in memory cache
    this.memoryCache.set(key, data, ttl * 1000);

    // Set in Redis if available
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(data), { ex: ttl });
      } catch (err) {
        console.warn("[CacheService] Redis set failed:", err);
      }
    }
  }

  // ============================================================================
  // DELETE (Invalidation)
  // ============================================================================

  async delete(orgId: string): Promise<void> {
    const key = this.getCacheKey(orgId);

    // Delete from memory
    this.memoryCache.delete(key);

    // Delete from Redis
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn("[CacheService] Redis delete failed:", err);
      }
    }

    // Publish invalidation to other instances
    await this.publishInvalidation(orgId);
  }

  // ============================================================================
  // PUB/SUB FOR MULTI-INSTANCE INVALIDATION
  // ============================================================================

  private async publishInvalidation(orgId: string): Promise<void> {
    if (!this.redis) return;

    const message: InvalidationMessage = {
      type: "invalidate",
      orgId,
      timestamp: Date.now(),
    };

    try {
      await this.redis.publish(
        CACHE_CONFIG.INVALIDATION_CHANNEL,
        JSON.stringify(message),
      );
    } catch (err) {
      console.warn("[CacheService] Failed to publish invalidation:", err);
    }
  }

  async subscribeToInvalidations(
    callback: (orgId: string) => void,
  ): Promise<void> {
    if (!this.redis || this.subscribed) return;

    try {
      // NOTE: Upstash Redis (HTTP-based) ne supporte pas Pub/Sub natif.
      // Utilisation de `as any` car le type @upstash/redis n'expose pas .duplicate() / .on().
      // En production, utiliser un client ioredis dédié pour le pub/sub si nécessaire.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.subscriber = (this.redis as any).duplicate();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.subscriber as any).subscribe(
        CACHE_CONFIG.INVALIDATION_CHANNEL,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.subscriber as any).on(
        "message",
        (_channel: string, message: string) => {
          try {
            const data = JSON.parse(message) as InvalidationMessage;
            if (data.type === "invalidate") {
              // console.debug(`[CacheService] Received invalidation for org: ${data.orgId}`)
              this.memoryCache.delete(this.getCacheKey(data.orgId));
              callback(data.orgId);
            }
          } catch (err) {
            console.warn(
              "[CacheService] Failed to parse invalidation message:",
              err,
            );
          }
        },
      );

      this.subscribed = true;
    } catch (err) {
      console.warn("[CacheService] Failed to subscribe to invalidations:", err);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  isRedisAvailable(): boolean {
    return this.redis !== null;
  }

  getMemoryCacheSize(): number {
    return this.memoryCache.size();
  }

  async clearAll(): Promise<void> {
    this.memoryCache.clear();

    if (this.redis) {
      try {
        // Use SCAN instead of KEYS for production safety
        let cursor = 0;
        const pattern = `${CACHE_CONFIG.KEY_PREFIX}*`;
        do {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [cursorStr, keys] = await (this.redis.scan as any)(cursor, {
            match: pattern,
            count: 100,
          });
          cursor = parseInt(cursorStr as string, 10);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== 0);
      } catch (err) {
        console.warn("[CacheService] Failed to clear Redis:", err);
      }
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

export function setCacheService(service: CacheService): void {
  // Destroy the old instance to prevent memory leaks
  if (cacheServiceInstance) {
    cacheServiceInstance.destroy();
  }
  cacheServiceInstance = service;
}

// For testing
export function resetCacheService(): void {
  cacheServiceInstance = null;
}

// Export the cache instance for direct use
export const entitlementCache = getCacheService();
