/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Rate Limit module", () => {
  let rateLimit: (typeof import("../index"))["rateLimit"];
  let getClientIp: (typeof import("../index"))["getClientIp"];
  let pruneRateLimitEntries: (typeof import("../index"))["pruneRateLimitEntries"];
  let startRateLimitCleanup: (typeof import("../index"))["startRateLimitCleanup"];
  let stopRateLimitCleanup: (typeof import("../index"))["stopRateLimitCleanup"];
  let shutdownRateLimit: (typeof import("../index"))["shutdownRateLimit"];
  let RATE_LIMIT_WINDOW_MS: number;
  let RATE_LIMIT_MAX: number;
  let dateNowSpy: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../index");
    rateLimit = mod.rateLimit;
    getClientIp = mod.getClientIp;
    pruneRateLimitEntries = mod.pruneRateLimitEntries;
    startRateLimitCleanup = mod.startRateLimitCleanup;
    stopRateLimitCleanup = mod.stopRateLimitCleanup;
    shutdownRateLimit = mod.shutdownRateLimit;
    RATE_LIMIT_WINDOW_MS = mod.RATE_LIMIT_WINDOW_MS;
    RATE_LIMIT_MAX = mod.RATE_LIMIT_MAX;
  });

  afterEach(() => {
    stopRateLimitCleanup();
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
      dateNowSpy = null;
    }
  });

  describe("getClientIp", () => {
    it("returns single IP as-is", () => {
      expect(getClientIp("192.168.1.1")).toBe("192.168.1.1");
    });

    it("extracts first IP from proxy chain", () => {
      expect(getClientIp("192.168.1.1, 10.0.0.1, 172.16.0.1")).toBe(
        "192.168.1.1",
      );
    });

    it("trims whitespace from IP", () => {
      expect(getClientIp("  203.0.113.5  , 10.0.0.1")).toBe("203.0.113.5");
    });
  });

  describe("rateLimit", () => {
    it("allows first request", () => {
      const result = rateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it("blocks when exceeding max requests", () => {
      const ip = "10.0.0.1";
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        expect(rateLimit(ip).allowed).toBe(true);
      }
      const blocked = rateLimit(ip);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingTime).toBeGreaterThan(0);
      expect(blocked.remainingTime).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS);
    });

    it("treats different IPs independently", () => {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        expect(rateLimit("192.168.1.1").allowed).toBe(true);
      }
      expect(rateLimit("192.168.1.1").allowed).toBe(false);
      expect(rateLimit("10.0.0.2").allowed).toBe(true);
    });

    it("resets after window expires (via Date.now spy)", () => {
      const ip = "reset-test";
      const startTime = Date.now();

      // Fill up rate limit
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        rateLimit(ip);
      }
      expect(rateLimit(ip).allowed).toBe(false);

      // Advance time past the window
      dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(startTime + RATE_LIMIT_WINDOW_MS + 1000);

      // Should be allowed again (new window)
      const result = rateLimit(ip);
      expect(result.allowed).toBe(true);
    });
  });

  describe("pruneRateLimitEntries", () => {
    it("removes expired entries (via Date.now spy)", () => {
      const startTime = Date.now();

      // Create an entry
      rateLimit("expired-ip");
      rateLimit("keep-ip");

      // Advance time past window
      dateNowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(startTime + RATE_LIMIT_WINDOW_MS + 1000);

      const pruned = pruneRateLimitEntries();
      expect(pruned).toBe(2); // Both entries expired
    });

    it("returns 0 when no entries are expired", () => {
      rateLimit("fresh-ip");
      const pruned = pruneRateLimitEntries();
      expect(pruned).toBe(0);
    });
  });

  describe("startRateLimitCleanup / stopRateLimitCleanup", () => {
    it("is idempotent when called multiple times", () => {
      startRateLimitCleanup();
      startRateLimitCleanup();
    });

    it("stops cleanup without crashing", () => {
      startRateLimitCleanup();
      stopRateLimitCleanup();
      stopRateLimitCleanup();
    });
  });

  describe("shutdownRateLimit", () => {
    it("stops cleanup and clears all entries", () => {
      rateLimit("ip-1");
      rateLimit("ip-2");

      shutdownRateLimit();

      // After shutdown, fresh start
      startRateLimitCleanup();

      expect(rateLimit("ip-1").allowed).toBe(true);
      expect(rateLimit("ip-2").allowed).toBe(true);
    });
  });

  describe("rapid sequential requests", () => {
    it("handles rapid requests without error", () => {
      const results = Array.from({ length: 10 }, (_, i) =>
        rateLimit(`rapid-${i % 3}`),
      );
      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBe(10); // All within limit (10 < 30)
    });
  });
});
