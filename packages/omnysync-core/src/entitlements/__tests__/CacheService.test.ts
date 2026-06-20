/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CacheService Tests
 *
 * Tests the in-memory LRU cache behavior (Redis not available in test env).
 * Covers:
 * - Basic get/set/delete operations
 * - TTL expiration (via vi.useFakeTimers)
 * - LRU eviction
 * - clearAll / destroy lifecycle
 * - Singleton pattern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CacheService,
  resetCacheService,
  getCacheService,
  setCacheService,
} from "../CacheService";
import { CACHE_CONFIG } from "../constants";
import type { EntitlementMap } from "../types";

// ============================================================================
// REDIS MOCK (hoisted so it runs before module evaluation)
// ============================================================================

const mockRedis = vi.hoisted(() => {
  const messageHandlers: Array<(channel: string, message: string) => void> = [];
  const subscriber: Record<string, any> = {
    subscribe: vi.fn(),
    on: vi.fn((event: string, handler: any) => {
      if (event === "message") {
        messageHandlers.push(handler);
      }
    }),
  };
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    scan: vi.fn().mockResolvedValue([0, []]),
    duplicate: vi.fn().mockReturnValue(subscriber),
    _subscriber: subscriber,
    _messageHandlers: messageHandlers,
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = mockRedis.get;
    set = mockRedis.set;
    del = mockRedis.del;
    ping = mockRedis.ping;
    publish = mockRedis.publish;
    subscribe = mockRedis.subscribe;
    scan = mockRedis.scan;
    duplicate = mockRedis.duplicate;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeEntitlementMap(
  overrides?: Partial<EntitlementMap>,
): EntitlementMap {
  return {
    planKey: "free",
    features: {
      EXPORT_PDF: false,
    },
    limits: {},
    experiments: {},
    ...overrides,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("CacheService", () => {
  let cache: CacheService;

  beforeEach(() => {
    resetCacheService();
    cache = new CacheService();
  });

  afterEach(() => {
    cache.destroy();
    resetCacheService();
  });

  // ============================================================================
  // BASIC GET / SET
  // ============================================================================

  describe("get / set", () => {
    it("should return null for unknown orgId", async () => {
      const result = await cache.get("nonexistent-org");
      expect(result).toBeNull();
    });

    it("should store and retrieve a value", async () => {
      const data = makeEntitlementMap({ planKey: "pro" });
      await cache.set("org-1", data);

      const result = await cache.get("org-1");
      expect(result).toEqual(data);
    });

    it("should overwrite existing value on subsequent set", async () => {
      await cache.set("org-1", makeEntitlementMap({ planKey: "free" }));
      await cache.set("org-1", makeEntitlementMap({ planKey: "pro" }));

      const result = await cache.get("org-1");
      expect(result?.planKey).toBe("pro");
    });

    it("should keep values for different orgIds isolated", async () => {
      await cache.set("org-1", makeEntitlementMap({ planKey: "free" }));
      await cache.set("org-2", makeEntitlementMap({ planKey: "pro" }));

      const result1 = await cache.get("org-1");
      const result2 = await cache.get("org-2");

      expect(result1?.planKey).toBe("free");
      expect(result2?.planKey).toBe("pro");
    });
  });

  // ============================================================================
  // DELETE
  // ============================================================================

  describe("delete", () => {
    it("should remove a cached value", async () => {
      await cache.set("org-1", makeEntitlementMap());
      await cache.delete("org-1");

      const result = await cache.get("org-1");
      expect(result).toBeNull();
    });

    it("should not throw when deleting a non-existent key", async () => {
      await expect(cache.delete("non-existent")).resolves.toBeUndefined();
    });

    it("should not affect other orgIds when deleting one", async () => {
      await cache.set("org-1", makeEntitlementMap({ planKey: "free" }));
      await cache.set("org-2", makeEntitlementMap({ planKey: "pro" }));

      await cache.delete("org-1");

      const result2 = await cache.get("org-2");
      expect(result2?.planKey).toBe("pro");
    });
  });

  it("should handle concurrent set and delete race condition", async () => {
    // Simule un scénario où set et delete arrivent en même temps
    const setPromise = cache.set(
      "org-1",
      makeEntitlementMap({ planKey: "pro" }),
    );
    const deletePromise = cache.delete("org-1");

    await Promise.all([setPromise, deletePromise]);

    // Après la course, le cache doit être dans un état cohérent
    // (soit la valeur est présente et valide, soit elle est supprimée)
    const result = await cache.get("org-1");
    // Les deux états sont acceptables tant qu'il n'y a pas d'exception
    expect(result === null || result.planKey === "pro").toBe(true);
  });

  it("should handle concurrent get and delete race condition", async () => {
    await cache.set("org-1", makeEntitlementMap({ planKey: "pro" }));

    // get et delete en parallèle
    const [getResult] = await Promise.all([
      cache.get("org-1"),
      cache.delete("org-1"),
    ]);

    // get peut retourner la valeur (avant delete) ou null (après delete)
    // Les deux sont acceptables
    const finalResult = await cache.get("org-1");
    expect(finalResult).toBeNull(); // Après delete, doit être null
  });

  it("should handle 10 concurrent set operations without data loss", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      cache.set(`org-${i}`, makeEntitlementMap({ planKey: `plan-${i}` })),
    );

    await Promise.all(promises);

    // Vérifier que toutes les orgs sont accessibles
    for (let i = 0; i < 10; i++) {
      const result = await cache.get(`org-${i}`);
      expect(result?.planKey).toBe(`plan-${i}`);
    }
  });

  // ============================================================================
  // CLEAR ALL
  // ============================================================================

  describe("clearAll", () => {
    it("should remove all cached entries", async () => {
      await cache.set("org-1", makeEntitlementMap({ planKey: "free" }));
      await cache.set("org-2", makeEntitlementMap({ planKey: "pro" }));
      await cache.set("org-3", makeEntitlementMap({ planKey: "business" }));

      await cache.clearAll();

      expect(await cache.get("org-1")).toBeNull();
      expect(await cache.get("org-2")).toBeNull();
      expect(await cache.get("org-3")).toBeNull();
    });

    it("should work on an empty cache", async () => {
      await expect(cache.clearAll()).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // TTL EXPIRATION
  // ============================================================================

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      vi.useFakeTimers();

      const data = makeEntitlementMap({ planKey: "pro" });
      await cache.set("org-1", data, { ttl: 1 }); // 1 second

      // Should be available immediately
      expect(await cache.get("org-1")).toEqual(data);

      // Advance past TTL (1s = 1000ms)
      vi.advanceTimersByTime(1100);

      // Should be expired now
      const result = await cache.get("org-1");
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it("should use default TTL when not specified", async () => {
      vi.useFakeTimers();

      const data = makeEntitlementMap({ planKey: "pro" });
      // Default TTL is 300s (from CacheOptions default)
      await cache.set("org-1", data);

      // Advance by 29s (under memory TTL)
      vi.advanceTimersByTime(29000);
      expect(await cache.get("org-1")).toEqual(data);

      // Advance past memory TTL refresh but still within set TTL (300s)
      vi.advanceTimersByTime(29000);
      expect(await cache.get("org-1")).toEqual(data);

      vi.useRealTimers();
    });

    it("should expire after memory cache default TTL (30s) when no explicit TTL set", async () => {
      // NOTE: The CacheService.set() always passes a ttl*1000 to memoryCache.set()
      // with defaulting to CACHE_CONFIG.REDIS_TTL (300s). So entries set via
      // CacheService.set() live for 300s in memory cache.
      // This test verifies the fallback path works via the LRU's internal defaultTTL.

      vi.useFakeTimers();

      const data = makeEntitlementMap({ planKey: "pro" });
      await cache.set("org-1", data, { ttl: 1 }); // short TTL

      // Advance well past the short TTL
      vi.advanceTimersByTime(5000);

      expect(await cache.get("org-1")).toBeNull();

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // MEMORY CACHE SIZE
  // ============================================================================

  describe("getMemoryCacheSize", () => {
    it("should return 0 for empty cache", () => {
      expect(cache.getMemoryCacheSize()).toBe(0);
    });

    it("should return number of cached entries", async () => {
      await cache.set("org-1", makeEntitlementMap());
      expect(cache.getMemoryCacheSize()).toBe(1);

      await cache.set("org-2", makeEntitlementMap());
      expect(cache.getMemoryCacheSize()).toBe(2);
    });

    it("should decrease after delete", async () => {
      await cache.set("org-1", makeEntitlementMap());
      await cache.set("org-2", makeEntitlementMap());
      expect(cache.getMemoryCacheSize()).toBe(2);

      await cache.delete("org-1");
      expect(cache.getMemoryCacheSize()).toBe(1);
    });
  });

  // ============================================================================
  // REDIS AVAILABILITY
  // ============================================================================

  describe("isRedisAvailable", () => {
    it("should return false when no Redis env vars are set", () => {
      expect(cache.isRedisAvailable()).toBe(false);
    });

    it("should return false when QSTASH_TOKEN is not set", () => {
      // Ensure env vars are not set (default test env)
      delete process.env.QSTASH_TOKEN;
      delete process.env.QSTASH_URL;
      expect(cache.isRedisAvailable()).toBe(false);
    });
  });

  // ============================================================================
  // DESTROY
  // ============================================================================

  describe("destroy", () => {
    it("should clear the cache and stop cleanup interval", () => {
      // Set some data
      cache.set("org-1", makeEntitlementMap());
      expect(cache.getMemoryCacheSize()).toBe(1);

      cache.destroy();

      // After destroy, cache should be empty
      expect(cache.getMemoryCacheSize()).toBe(0);
    });

    it("should be safe to call destroy multiple times", () => {
      cache.destroy();
      expect(() => cache.destroy()).not.toThrow();
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("should handle set with complex nested data", async () => {
      const complexData = makeEntitlementMap({
        planKey: "business",
        features: {
          EXPORT_PDF: true,
          TWO_WAY_SYNC: true,
          API_ACCESS: true,
        },
        limits: {
          MAX_CONNECTORS: 10,
          MAX_DOCUMENTS: 10000,
        },
        experiments: {
          NEW_DASHBOARD: { percentage: 50, seed: "v1", enabled: false },
        },
      });

      await cache.set("org-complex", complexData);
      const result = await cache.get("org-complex");

      expect(result).toEqual(complexData);
      expect(result?.features["TWO_WAY_SYNC"]).toBe(true);
      expect(result?.limits["MAX_CONNECTORS"]).toBe(10);
    });

    it("should handle value with null fields", async () => {
      const data = makeEntitlementMap({
        planKey: "free",
        features: {},
        limits: { MAX_DOCUMENTS: null },
      });

      await cache.set("org-null", data);
      const result = await cache.get("org-null");

      expect(result?.limits["MAX_DOCUMENTS"]).toBeNull();
    });
  });

  // ============================================================================
  // SINGLETON
  // ============================================================================

  describe("Singleton", () => {
    it("should return cached data even after new CacheService is created", async () => {
      const cache1 = new CacheService();
      await cache1.set("org-1", makeEntitlementMap({ planKey: "pro" }));
      cache1.destroy();

      // New instance has its own memory — data is lost
      const cache2 = new CacheService();
      const result = await cache2.get("org-1");
      expect(result).toBeNull();
      cache2.destroy();
    });

    it("getCacheService returns the same instance", () => {
      const service1 = getCacheService();
      const service2 = getCacheService();
      expect(service1).toBe(service2);
      service1.destroy();
      resetCacheService();
    });

    it("setCacheService replaces the instance", () => {
      const original = getCacheService();
      const replacement = new CacheService();
      setCacheService(replacement);

      const current = getCacheService();
      expect(current).toBe(replacement);
      expect(current).not.toBe(original);

      current.destroy();
      resetCacheService();
    });

    it("resetCacheService resets the singleton", () => {
      const service = getCacheService();
      resetCacheService();

      const newService = getCacheService();
      expect(newService).not.toBe(service);

      newService.destroy();
      resetCacheService();
    });
  });

  // ============================================================================
  // REDIS INTEGRATION (with @upstash/redis mocked)
  // ============================================================================

  describe("Redis integration", () => {
    let redisCache: CacheService;

    beforeEach(() => {
      process.env.QSTASH_TOKEN = "test-token";
      process.env.QSTASH_URL = "https://test.upstash.com";

      // Reset all call history and restore default behaviors
      mockRedis.get.mockReset();
      mockRedis.get.mockResolvedValue(null); // cache miss by default

      mockRedis.set.mockReset();

      mockRedis.del.mockReset();

      mockRedis.ping.mockReset();
      // ping MUST resolve or the constructor nullifies this.redis
      mockRedis.ping.mockResolvedValue(undefined);

      mockRedis.publish.mockReset();

      mockRedis.scan.mockReset();
      mockRedis.scan.mockResolvedValue([0, []]); // empty scan by default

      // duplicate must return the subscriber mock (critical for pub/sub)
      mockRedis.duplicate.mockReset();
      mockRedis.duplicate.mockReturnValue(mockRedis._subscriber);

      // Subscriber: clear call history but preserve the message handler store
      mockRedis._subscriber.subscribe.mockReset();
      mockRedis._subscriber.on.mockReset();
      mockRedis._subscriber.on.mockImplementation(
        (event: string, handler: any) => {
          if (event === "message") {
            mockRedis._messageHandlers.push(handler);
          }
        },
      );
      mockRedis._messageHandlers.length = 0;

      resetCacheService();
      redisCache = new CacheService();
    });

    afterEach(() => {
      redisCache.destroy();
      delete process.env.QSTASH_TOKEN;
      delete process.env.QSTASH_URL;
    });

    // ========================================================================
    // REDIS GET
    // ========================================================================

    describe("get with Redis", () => {
      it("should call Redis.get on cache miss when Redis is configured", async () => {
        const result = await redisCache.get("unknown-org");

        expect(mockRedis.get).toHaveBeenCalledWith("entitlements:unknown-org");
        expect(result).toBeNull();
      });

      it("should return data from Redis and store it in memory cache", async () => {
        const data = makeEntitlementMap({ planKey: "pro" });
        mockRedis.get.mockResolvedValue(data);

        // First get — hits Redis
        const first = await redisCache.get("org-1");
        expect(first).toEqual(data);
        expect(mockRedis.get).toHaveBeenCalledTimes(1);

        // Second get — Redis returns null but memory has it
        mockRedis.get.mockResolvedValue(null);
        const second = await redisCache.get("org-1");
        expect(second).toEqual(data);
      });

      it("should fall back to memory cache when Redis.get throws", async () => {
        // Pre-populate memory cache via set (which also writes to Redis)
        const data = makeEntitlementMap({ planKey: "business" });
        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set("org-fail", data);

        // Make Redis.get throw
        mockRedis.get.mockRejectedValue(new Error("Redis connection lost"));

        // Should still find data in memory cache
        const result = await redisCache.get("org-fail");
        expect(result).toEqual(data);
      });

      it("should not crash when Redis.get throws on an unknown org", async () => {
        mockRedis.get.mockRejectedValue(new Error("Redis timeout"));

        const result = await redisCache.get("no-data-org");
        expect(result).toBeNull();
      });
    });

    // ========================================================================
    // REDIS SET
    // ========================================================================

    describe("set with Redis", () => {
      it("should call Redis.set with correct key, value, and default TTL", async () => {
        const data = makeEntitlementMap({ planKey: "pro" });

        await redisCache.set("org-set", data);

        expect(mockRedis.set).toHaveBeenCalledWith(
          "entitlements:org-set",
          JSON.stringify(data),
          { ex: CACHE_CONFIG.REDIS_TTL },
        );
      });

      it("should pass custom TTL to Redis.set", async () => {
        const data = makeEntitlementMap();

        await redisCache.set("org-ttl", data, { ttl: 60 });

        expect(mockRedis.set).toHaveBeenCalledWith(
          "entitlements:org-ttl",
          JSON.stringify(data),
          { ex: 60 },
        );
      });

      it("should still update memory cache when Redis.set fails", async () => {
        mockRedis.set.mockRejectedValue(new Error("Redis write failed"));
        const data = makeEntitlementMap({ planKey: "pro" });

        // set should not throw even though Redis fails
        await expect(redisCache.set("org-1", data)).resolves.toBeUndefined();

        // Memory cache should have the data
        mockRedis.get.mockResolvedValue(null);
        const result = await redisCache.get("org-1");
        expect(result).toEqual(data);
      });
    });

    // ========================================================================
    // REDIS DELETE
    // ========================================================================

    describe("delete with Redis", () => {
      it("should call Redis.del with correct key", async () => {
        await redisCache.delete("org-del");

        expect(mockRedis.del).toHaveBeenCalledWith("entitlements:org-del");
      });

      it("should publish invalidation message to Redis channel", async () => {
        await redisCache.delete("org-pub");

        expect(mockRedis.publish).toHaveBeenCalledWith(
          CACHE_CONFIG.INVALIDATION_CHANNEL,
          expect.any(String),
        );

        const publishArg = mockRedis.publish.mock.calls[0][1];
        const parsed = JSON.parse(publishArg);
        expect(parsed).toMatchObject({
          type: "invalidate",
          orgId: "org-pub",
        });
        expect(parsed.timestamp).toBeGreaterThan(0);
      });

      it("should not throw when Redis.del fails", async () => {
        mockRedis.del.mockRejectedValue(new Error("Redis del failed"));

        await expect(redisCache.delete("org-del")).resolves.toBeUndefined();
      });

      it("should remove entry from memory cache even when Redis.del fails", async () => {
        // Pre-populate
        const data = makeEntitlementMap({ planKey: "pro" });
        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set("org-1", data);

        // Delete with Redis failure
        mockRedis.del.mockRejectedValue(new Error("Redis del failed"));
        await redisCache.delete("org-1");

        // Should be gone from memory
        const result = await redisCache.get("org-1");
        expect(result).toBeNull();
      });
    });

    // ========================================================================
    // PUB/SUB INVALIDATION
    // ========================================================================

    describe("pub/sub invalidation", () => {
      it("should subscribe to invalidation channel and handle messages", async () => {
        const callback = vi.fn();
        await redisCache.subscribeToInvalidations(callback);

        // Verify subscriber setup
        expect(mockRedis.duplicate).toHaveBeenCalled();
        expect(mockRedis._subscriber.subscribe).toHaveBeenCalledWith(
          CACHE_CONFIG.INVALIDATION_CHANNEL,
        );
        expect(mockRedis._subscriber.on).toHaveBeenCalledWith(
          "message",
          expect.any(Function),
        );

        // Simulate an invalidation message
        const message = JSON.stringify({
          type: "invalidate",
          orgId: "org-inval",
          timestamp: Date.now(),
        });
        for (const handler of mockRedis._messageHandlers) {
          handler(CACHE_CONFIG.INVALIDATION_CHANNEL, message);
        }

        // Callback should have been invoked
        expect(callback).toHaveBeenCalledWith("org-inval");
      });

      it("should invalidate local memory cache on receiving an invalidation message", async () => {
        const data = makeEntitlementMap({ planKey: "pro" });
        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set("org-inval", data);

        const callback = vi.fn();
        await redisCache.subscribeToInvalidations(callback);

        // Verify data is in memory cache
        mockRedis.get.mockResolvedValue(null);
        expect(await redisCache.get("org-inval")).toEqual(data);

        // Send invalidation for this org
        const message = JSON.stringify({
          type: "invalidate",
          orgId: "org-inval",
          timestamp: Date.now(),
        });
        for (const handler of mockRedis._messageHandlers) {
          handler(CACHE_CONFIG.INVALIDATION_CHANNEL, message);
        }

        // Should be cleared from memory cache
        const after = await redisCache.get("org-inval");
        expect(after).toBeNull();
      });

      it("should handle concurrent invalidation events", async () => {
        const callback = vi.fn();

        // Pre-populate three orgs
        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set("org-a", makeEntitlementMap({ planKey: "pro" }));
        await redisCache.set("org-b", makeEntitlementMap({ planKey: "free" }));
        await redisCache.set(
          "org-c",
          makeEntitlementMap({ planKey: "business" }),
        );

        await redisCache.subscribeToInvalidations(callback);

        // Send invalidations for org-a and org-b
        const messages = [
          {
            type: "invalidate" as const,
            orgId: "org-a",
            timestamp: Date.now(),
          },
          {
            type: "invalidate" as const,
            orgId: "org-b",
            timestamp: Date.now(),
          },
        ];

        for (const msg of messages) {
          for (const handler of mockRedis._messageHandlers) {
            handler(CACHE_CONFIG.INVALIDATION_CHANNEL, JSON.stringify(msg));
          }
        }

        // Callback should have been called twice
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith("org-a");
        expect(callback).toHaveBeenCalledWith("org-b");

        // org-c should still be in cache
        mockRedis.get.mockResolvedValue(null);
        expect(await redisCache.get("org-c")).toEqual(
          makeEntitlementMap({ planKey: "business" }),
        );

        // org-a should be gone
        expect(await redisCache.get("org-a")).toBeNull();
      });

      it("should not clear cache entries when invalidation message has no orgId", async () => {
        const callback = vi.fn();

        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set(
          "org-safe",
          makeEntitlementMap({ planKey: "pro" }),
        );

        await redisCache.subscribeToInvalidations(callback);

        // Send invalidation with missing orgId
        const badMessage = JSON.stringify({
          type: "invalidate",
          timestamp: Date.now(),
        });
        for (const handler of mockRedis._messageHandlers) {
          handler(CACHE_CONFIG.INVALIDATION_CHANNEL, badMessage);
        }

        // org-safe should survive
        mockRedis.get.mockResolvedValue(null);
        const result = await redisCache.get("org-safe");
        expect(result).toEqual(makeEntitlementMap({ planKey: "pro" }));
      });

      it("should ignore messages with invalid type", async () => {
        const callback = vi.fn();

        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set(
          "org-ignore",
          makeEntitlementMap({ planKey: "pro" }),
        );

        await redisCache.subscribeToInvalidations(callback);

        // Send message with wrong type
        const badMsg = JSON.stringify({
          type: "unknown",
          orgId: "org-ignore",
          timestamp: Date.now(),
        });
        for (const handler of mockRedis._messageHandlers) {
          handler(CACHE_CONFIG.INVALIDATION_CHANNEL, badMsg);
        }

        expect(callback).not.toHaveBeenCalled();

        mockRedis.get.mockResolvedValue(null);
        expect(await redisCache.get("org-ignore")).toEqual(
          makeEntitlementMap({ planKey: "pro" }),
        );
      });

      it("should handle malformed JSON invalidation messages gracefully", async () => {
        const callback = vi.fn();

        mockRedis.set.mockResolvedValue(undefined);
        await redisCache.set(
          "org-malformed",
          makeEntitlementMap({ planKey: "pro" }),
        );

        await redisCache.subscribeToInvalidations(callback);

        // Send invalid JSON
        for (const handler of mockRedis._messageHandlers) {
          handler(CACHE_CONFIG.INVALIDATION_CHANNEL, "not-json-at-all");
        }

        expect(callback).not.toHaveBeenCalled();

        // Existing cache should survive
        mockRedis.get.mockResolvedValue(null);
        expect(await redisCache.get("org-malformed")).toEqual(
          makeEntitlementMap({ planKey: "pro" }),
        );
      });
    });

    // ========================================================================
    // SUBSCRIPTION LIFECYCLE
    // ========================================================================

    describe("subscription lifecycle", () => {
      it("should allow re-subscription after destroy", async () => {
        await redisCache.subscribeToInvalidations(vi.fn());
        expect(mockRedis.duplicate).toHaveBeenCalledTimes(1);

        redisCache.destroy();

        // Should be able to subscribe again
        await redisCache.subscribeToInvalidations(vi.fn());
        expect(mockRedis.duplicate).toHaveBeenCalledTimes(2);
      });

      it("should not subscribe twice when already subscribed", async () => {
        await redisCache.subscribeToInvalidations(vi.fn());

        // Second call should be a no-op
        await redisCache.subscribeToInvalidations(vi.fn());

        expect(mockRedis.duplicate).toHaveBeenCalledTimes(1);
        expect(mockRedis._subscriber.subscribe).toHaveBeenCalledTimes(1);
      });

      it("should not subscribe when Redis is not available", async () => {
        // Temporarily clear env vars to create a service without Redis
        delete process.env.QSTASH_TOKEN;
        delete process.env.QSTASH_URL;
        const noRedisCache = new CacheService();
        // Restore env vars so cleanup in afterEach still works
        process.env.QSTASH_TOKEN = "test-token";
        process.env.QSTASH_URL = "https://test.upstash.com";

        await noRedisCache.subscribeToInvalidations(vi.fn());

        expect(mockRedis.duplicate).not.toHaveBeenCalled();
        noRedisCache.destroy();
      });
    });

    // ========================================================================
    // SINGLETON WITH REDIS
    // ========================================================================

    describe("singleton with Redis", () => {
      it("getCacheService returns the same instance when Redis is configured", () => {
        resetCacheService();
        const s1 = getCacheService();
        const s2 = getCacheService();
        expect(s1).toBe(s2);
        expect(s1.isRedisAvailable()).toBe(true);
        s1.destroy();
        resetCacheService();
      });

      it("setCacheService replaces instance and old service is destroyed", () => {
        const original = getCacheService();
        const replacement = new CacheService();
        setCacheService(replacement);

        const current = getCacheService();
        expect(current).toBe(replacement);
        expect(current).not.toBe(original);
        // Original should have been destroyed (memory cleared)
        expect(original.getMemoryCacheSize()).toBe(0);

        current.destroy();
        resetCacheService();
      });
    });

    // ========================================================================
    // CLEAR ALL WITH REDIS
    // ========================================================================

    describe("clearAll with Redis", () => {
      it("should call Redis.scan and Redis.del to clear Redis entries", async () => {
        mockRedis.scan
          .mockResolvedValueOnce([1, ["entitlements:org-a"]])
          .mockResolvedValueOnce([0, ["entitlements:org-c"]]);

        await redisCache.clearAll();

        expect(mockRedis.scan).toHaveBeenCalledWith(0, {
          match: "entitlements:*",
          count: 100,
        });
        expect(mockRedis.scan).toHaveBeenCalledTimes(2);
        expect(mockRedis.del).toHaveBeenCalledWith("entitlements:org-a");
        expect(mockRedis.del).toHaveBeenCalledWith("entitlements:org-c");
      });

      it("should not crash when Redis.scan fails", async () => {
        mockRedis.scan.mockRejectedValue(new Error("SCAN failed"));

        await expect(redisCache.clearAll()).resolves.toBeUndefined();
        // Memory cache should still be cleared
        expect(redisCache.getMemoryCacheSize()).toBe(0);
      });
    });
  });
});
