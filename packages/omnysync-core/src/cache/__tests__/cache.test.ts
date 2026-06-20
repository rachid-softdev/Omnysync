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

    it("getOrSet() uses default TTL when not specified", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("value");
      await cache.getOrSet("mykey", fn);
      expect(mockRedisSet).toHaveBeenCalledWith(
        "omnysync:mykey",
        JSON.stringify("value"),
        { ex: 60 },
      );
    });

    it("getOrSet() returns function result even when Redis set fails", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockRejectedValue(new Error("Set failed"));
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("computed-value");
      const result = await cache.getOrSet("mykey", fn);
      expect(result).toBe("computed-value");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache set error:",
        expect.any(Error),
      );
    });

    it("get() returns null when Redis returns undefined", async () => {
      mockRedisGet.mockResolvedValue(undefined);
      const cache = await getCache();
      const result = await cache.get<string>("mykey");
      expect(result).toBeNull();
    });

    it("get() returns 0 when Redis returns 0 (falsy but valid)", async () => {
      mockRedisGet.mockResolvedValue(0);
      const cache = await getCache();
      const result = await cache.get<number>("zero-key");
      expect(result).toBe(0);
    });

    it("get() returns false when Redis returns false (falsy but valid)", async () => {
      mockRedisGet.mockResolvedValue(false);
      const cache = await getCache();
      const result = await cache.get<boolean>("false-key");
      expect(result).toBe(false);
    });

    it("get() returns empty string when Redis returns empty string (falsy but valid)", async () => {
      mockRedisGet.mockResolvedValue("");
      const cache = await getCache();
      const result = await cache.get<string>("empty-key");
      expect(result).toBe("");
    });

    it("invalidatePrefix() returns false when keys found but del errors", async () => {
      mockRedisKeys.mockResolvedValue(["omnysync:test:key1"]);
      mockRedisDel.mockRejectedValue(new Error("Del failed"));
      const cache = await getCache();
      const result = await cache.invalidatePrefix("test");
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cache invalidate error:",
        expect.any(Error),
      );
    });

    it("set() with null value is serialized correctly", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const result = await cache.set("nullkey", null);
      expect(result).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith("omnysync:nullkey", "null", {
        ex: 60,
      });
    });

    it("set() with 0 TTL (edge case)", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const result = await cache.set("zerottl", "value", { ttl: 0 });
      expect(result).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith(
        "omnysync:zerottl",
        JSON.stringify("value"),
        { ex: 0 },
      );
    });

    it("set() with undefined options uses defaults", async () => {
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const result = await cache.set("undefinedOpts", "value", undefined);
      expect(result).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith(
        "omnysync:undefinedOpts",
        JSON.stringify("value"),
        { ex: 60 },
      );
    });

    it("del() with empty string key", async () => {
      mockRedisDel.mockResolvedValue(1);
      const cache = await getCache();
      const result = await cache.del("");
      expect(result).toBe(true);
      expect(mockRedisDel).toHaveBeenCalledWith("omnysync:");
    });

    it("getOrSet() with zero TTL", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue("no-ttl-result");
      const result = await cache.getOrSet("no-ttl-key", fn, 0);
      expect(result).toBe("no-ttl-result");
      expect(mockRedisSet).toHaveBeenCalledWith(
        "omnysync:no-ttl-key",
        JSON.stringify("no-ttl-result"),
        { ex: 0 },
      );
    });

    it("getOrSet() propagates error when fn throws", async () => {
      mockRedisGet.mockResolvedValue(null);
      const cache = await getCache();
      const fn = vi.fn().mockRejectedValue(new Error("Computation failed"));

      await expect(cache.getOrSet("fail-key", fn, 60)).rejects.toThrow(
        "Computation failed",
      );
      expect(fn).toHaveBeenCalledTimes(1);
      // set should NOT be called when fn throws
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it("getOrSet() with fn returning a number (0) is cached correctly", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue(0);

      const result = await cache.getOrSet("zero-val", fn, 60);
      expect(result).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call: cached value 0 should be returned (0 !== null)
      mockRedisGet.mockResolvedValue(0);
      const result2 = await cache.getOrSet("zero-val", fn, 60);
      expect(result2).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1); // not called again
    });

    it("getOrSet() with fn returning false is cached correctly", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockResolvedValue("OK");
      const cache = await getCache();
      const fn = vi.fn().mockResolvedValue(false);

      const result = await cache.getOrSet("false-val", fn, 60);
      expect(result).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call: cached value false should be returned
      mockRedisGet.mockResolvedValue(false);
      const result2 = await cache.getOrSet("false-val", fn, 60);
      expect(result2).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1); // not called again
    });

    it("del() with undefined prefix uses default prefix", async () => {
      mockRedisDel.mockResolvedValue(1);
      const cache = await getCache();
      const result = await cache.del("key", undefined);
      expect(result).toBe(true);
      expect(mockRedisDel).toHaveBeenCalledWith("omnysync:key");
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

    it("uses default ttl and prefix when options omitted", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null);
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue("result");
      const cachedFn = mod.withCache(fn);

      await cachedFn("arg");

      // Default prefix "fn", key = `fn:${JSON.stringify(["arg"])}`
      expect(mockRedisSet).toHaveBeenCalledWith(
        'fn:["arg"]',
        JSON.stringify("result"),
        { ex: 60 },
      );
    });

    it("still works when Redis is unavailable (no caching)", async () => {
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue("computed");
      const cachedFn = mod.withCache(fn, { ttl: 30, prefix: "test" });

      const r1 = await cachedFn("x");
      expect(r1).toBe("computed");
      expect(fn).toHaveBeenCalledTimes(1);

      const r2 = await cachedFn("x");
      expect(r2).toBe("computed");
      // Without Redis, get() always returns null, so fn is called every time
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("handles different arguments as different cache keys", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null); // miss for "a"
      mockRedisSet.mockResolvedValueOnce("OK");
      mockRedisGet.mockResolvedValueOnce(null); // miss for "b"
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue("result");
      const cachedFn = mod.withCache(fn, { prefix: "diff" });

      await cachedFn("a");
      await cachedFn("b");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("propagates error when wrapped function throws", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null); // miss
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockRejectedValue(new Error("Function failed"));
      const cachedFn = mod.withCache(fn, { ttl: 30, prefix: "fail" });

      await expect(cachedFn("bad-input")).rejects.toThrow("Function failed");
      expect(fn).toHaveBeenCalledTimes(1);
      // set should NOT be called when fn throws
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it("handles cached result being null (falsy but valid cache value)", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null); // first call: miss
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue(null);
      const cachedFn = mod.withCache(fn, { prefix: "null-test" });

      const result = await cachedFn("x");
      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledTimes(1);

      // second call: get returns null again (since null is stored, get returns null)
      mockRedisGet.mockResolvedValueOnce(null);
      const result2 = await cachedFn("x");
      expect(result2).toBeNull();
      // fn should be called again because null is treated as "not cached"
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("handles cached result being 0 (falsy but valid)", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null); // miss
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue(0);
      const cachedFn = mod.withCache(fn, { prefix: "zero-test" });

      const result = await cachedFn("a");
      expect(result).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // second call: 0 is !== null, so should be cache hit
      mockRedisGet.mockResolvedValueOnce(0);
      const result2 = await cachedFn("a");
      expect(result2).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1); // cached, not called again
    });

    it("handles cached result being false (falsy but valid)", async () => {
      process.env.QSTASH_TOKEN = "test-token";
      mockRedisGet.mockResolvedValueOnce(null);
      mockRedisSet.mockResolvedValueOnce("OK");
      const mod = await getCache().then(() => import("../index"));
      const fn = vi.fn().mockResolvedValue(false);
      const cachedFn = mod.withCache(fn, { prefix: "false-test" });

      const result = await cachedFn("b");
      expect(result).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);

      mockRedisGet.mockResolvedValueOnce(false);
      const result2 = await cachedFn("b");
      expect(result2).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1); // cached hit
    });
  });

  // ---- CACHE_KEYS ----
  describe("CACHE_KEYS", () => {
    it("generates correct key strings", async () => {
      const mod = await import("../index");
      expect(mod.CACHE_KEYS.USER_STATS("u1")).toBe("user:u1:stats");
      expect(mod.CACHE_KEYS.USER_QUOTA("u1")).toBe("user:u1:quota");
      expect(mod.CACHE_KEYS.ORG_STATS("org1")).toBe("org:org1:stats");
      expect(mod.CACHE_KEYS.ORG_DOCUMENTS("org1", 2)).toBe("org:org1:docs:2");
      expect(mod.CACHE_KEYS.ORG_CONNECTORS("org1")).toBe("org:org1:connectors");
      expect(mod.CACHE_KEYS.SYNC_LOGS("org1", 3)).toBe("org:org1:logs:3");
      expect(mod.CACHE_KEYS.BLOG_POSTS).toBe("public:blog:posts");
      expect(mod.CACHE_KEYS.PRICING_PLANS).toBe("public:pricing");
    });
  });

  // ---- useCachedFetch ----
  describe("useCachedFetch", () => {
    it("returns the expected interface shape", async () => {
      const mod = await import("../index");
      const fetchFn = vi.fn().mockResolvedValue("data");
      const result = mod.useCachedFetch("mykey", fetchFn);

      expect(result).toHaveProperty("data", null);
      expect(result).toHaveProperty("loading", false);
      expect(result).toHaveProperty("error", null);
      expect(result).toHaveProperty("refetch");
      expect(typeof result.refetch).toBe("function");
    });

    it("refetch() calls the provided fetchFn", async () => {
      const mod = await import("../index");
      const fetchFn = vi.fn().mockResolvedValue("data");
      const result = mod.useCachedFetch("mykey", fetchFn);

      const data = await result.refetch();
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(data).toBe("data");
    });

    it("accepts options parameter", async () => {
      const mod = await import("../index");
      const fetchFn = vi.fn().mockResolvedValue("data");
      const result = mod.useCachedFetch("mykey", fetchFn, { ttl: 120 });
      expect(result.data).toBeNull();
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });

    it("refetch() returns fetchFn result for various data types", async () => {
      const mod = await import("../index");
      const fetchFn = vi.fn().mockResolvedValue({ nested: { value: 42 } });
      const result = mod.useCachedFetch("complex", fetchFn);

      const data = await result.refetch();
      expect(data).toEqual({ nested: { value: 42 } });
    });
  });
});
