/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());
const mockRedisDel = vi.hoisted(() => vi.fn());
const mockRedisKeys = vi.hoisted(() => vi.fn());
const MockRedis = vi.hoisted(
  () =>
    class MockRedis {
      get = mockRedisGet;
      set = mockRedisSet;
      del = mockRedisDel;
      keys = mockRedisKeys;
    },
);

vi.mock("@upstash/redis", () => ({ Redis: MockRedis }));

// Helper to re-import cache module with current env
async function getCache() {
  const mod = await import("../index");
  return mod.cache;
}

describe("Cache module", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    delete process.env.QSTASH_TOKEN;
  });

  // ---- Redis UNAVAILABLE ----
  describe("when QSTASH_TOKEN is not set (Redis unavailable)", () => {
    it("isAvailable() returns false", async () => {
      const cache = await getCache();
      expect(cache.isAvailable()).toBe(false);
    });

    it("get() returns null", async () => {
      const cache = await getCache();
      const result = await cache.get("anykey");
      expect(result).toBeNull();
    });

    it("set() returns false", async () => {
      const cache = await getCache();
      const result = await cache.set("anykey", "value");
      expect(result).toBe(false);
    });

    it("del() returns false", async () => {
      const cache = await getCache();
      const result = await cache.del("anykey");
      expect(result).toBe(false);
    });

    it("invalidatePrefix() returns false", async () => {
      const cache = await getCache();
      const result = await cache.invalidatePrefix("any");
      expect(result).toBe(false);
    });

    it("getOrSet() still calls fn and returns its result (no caching)", async () => {
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("computed");
      const result = await cache.getOrSet("k", fn, 60);
      expect(result).toBe("computed");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Redis AVAILABLE ----
  describe("when QSTASH_TOKEN is set (Redis available)", () => {
    beforeEach(() => {
      process.env.QSTASH_TOKEN = "test-token";
    });

    it("isAvailable() returns true", async () => {
      const cache = await getCache();
      expect(cache.isAvailable()).toBe(true);
    });

    it("get() returns value from Redis", async () => {
      mockRedisGet.mockResolvedValue("cached-value");
      const cache = await getCache();
      const result = await cache.get<string>("mykey");
      expect(result).toBe("cached-value");
    });

    it("get() returns null when Redis returns null", async () => {
      mockRedisGet.mockResolvedValue(null);
      const cache = await getCache();
      const result = await cache.get<string>("mykey");
      expect(result).toBeNull();
    });

    it("get() returns null on Redis error", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis down"));
      const cache = await getCache();
      const result = await cache.get<string>("mykey");
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache get error:",
        expect.any(Error),
      );
    });

    it("set() stores value with prefix and TTL", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const result = await cache.set(
        "mykey",
        { foo: "bar" },
        { ttl: 120, prefix: "test:" },
      );
      expect(result).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith(
        "test:mykey",
        JSON.stringify({ foo: "bar" }),
        { ex: 120 },
      );
    });

    it("set() uses default prefix and TTL when options omitted", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const result = await cache.set("mykey", "value");
      expect(result).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith(
        "omnysync:mykey",
        JSON.stringify("value"),
        { ex: 60 },
      );
    });

    it("set() returns false on Redis error", async () => {
      mockRedisSet.mockRejectedValue(new Error("Redis error"));
      const cache = await getCache();
      const result = await cache.set("mykey", "value");
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache set error:",
        expect.any(Error),
      );
    });

    it("del() deletes key with prefix", async () => {
      mockRedisDel.mockResolvedValue(1);
      const cache = await getCache();
      const result = await cache.del("mykey", "test:");
      expect(result).toBe(true);
      expect(mockRedisDel).toHaveBeenCalledWith("test:mykey");
    });

    it("del() uses default prefix", async () => {
      mockRedisDel.mockResolvedValue(1);
      const cache = await getCache();
      const result = await cache.del("mykey");
      expect(result).toBe(true);
      expect(mockRedisDel).toHaveBeenCalledWith("omnysync:mykey");
    });

    it("del() returns false on Redis error", async () => {
      mockRedisDel.mockRejectedValue(new Error("Redis error"));
      const cache = await getCache();
      const result = await cache.del("mykey");
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache delete error:",
        expect.any(Error),
      );
    });

    it("invalidatePrefix() deletes keys matching prefix", async () => {
      mockRedisKeys.mockResolvedValue([
        "omnysync:test:key1",
        "omnysync:test:key2",
      ]);
      mockRedisDel.mockResolvedValue(2);
      const cache = await getCache();
      const result = await cache.invalidatePrefix("test");
      expect(result).toBe(true);
      expect(mockRedisKeys).toHaveBeenCalledWith("omnysync:test:*");
      expect(mockRedisDel).toHaveBeenCalledWith(
        "omnysync:test:key1",
        "omnysync:test:key2",
      );
    });

    it("invalidatePrefix() returns true when no keys match", async () => {
      mockRedisKeys.mockResolvedValue([]);
      const cache = await getCache();
      const result = await cache.invalidatePrefix("test");
      expect(result).toBe(true);
      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it("invalidatePrefix() returns false on Redis error", async () => {
      mockRedisKeys.mockRejectedValue(new Error("Redis error"));
      const cache = await getCache();
      const result = await cache.invalidatePrefix("test");
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache invalidate error:",
        expect.any(Error),
      );
    });

    it("getOrSet() returns cached value when available", async () => {
      mockRedisGet.mockResolvedValue("cached-result");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("fresh-result");
      const result = await cache.getOrSet("test-key", fn, 30);
      expect(result).toBe("cached-result");
      expect(fn).not.toHaveBeenCalled();
    });

    it("getOrSet() calls fn and caches result when not cached", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("fresh-result");
      const result = await cache.getOrSet("test-key", fn, 30);
      expect(result).toBe("fresh-result");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockRedisSet).toHaveBeenCalled();
    });
  });

  // ---- withCache decorator ----
  describe("withCache()", () => {
    it("returns cached result on repeated calls", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null); // first call: miss
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue("expensive-result");
      const cachedFn = mod.withCache(fn, { ttl: 60, prefix: "test-fn" });

      const r1 = await cachedFn("arg1");
      expect(r1).toBe("expensive-result");
      expect(fn).toHaveBeenCalledTimes(1);

      mockRedisGet.mockResolvedValueOnce("expensive-result"); // second call: hit
      const r2 = await cachedFn("arg1");
      expect(r2).toBe("expensive-result");
      expect(fn).toHaveBeenCalledTimes(1); // not called again
    });
  });

  // ---- CACHE_KEYS ----
  describe("CACHE_KEYS", () => {
    it("generates correct key strings", async () => {
      const mod = await import("../index");
      expect(mod.CACHE_KEYS.USER_STATS("u1")).toBe("user:u1:stats");
      expect(mod.CACHE_KEYS.ORG_DOCUMENTS("org1", 2)).toBe("org:org1:docs:2");
      expect(mod.CACHE_KEYS.BLOG_POSTS).toBe("public:blog:posts");
    });
  });
});
