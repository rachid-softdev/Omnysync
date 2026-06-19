/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Entitlements Middleware Tests
 *
 * Tests the framework-agnostic middleware helpers:
 * - requireFeature / requireLimit / consumeFeature
 * - Higher-order wrappers: withFeature, withConsume, withLimit
 * - Utility: toExpress, createOrgIdResolver
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// MOCK FeatureGateService singleton
// ============================================================================

const mockHasFeature = vi.fn();
const mockCanConsume = vi.fn();
const mockConsume = vi.fn();

vi.mock("../FeatureGateService", () => ({
  getFeatureGateService: vi.fn(() => ({
    hasFeature: mockHasFeature,
    canConsume: mockCanConsume,
    consume: mockConsume,
  })),
  resetFeatureGateService: vi.fn(),
}));

// ============================================================================
// IMPORTS
// ============================================================================

import {
  requireFeature,
  requireLimit,
  consumeFeature,
  withFeature,
  withConsume,
  withLimit,
  toExpress,
  createOrgIdResolver,
} from "../middleware";

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Entitlements Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // requireFeature
  // ==========================================================================

  describe("requireFeature", () => {
    it("should resolve when feature is available", async () => {
      mockHasFeature.mockResolvedValue(true);

      await expect(
        requireFeature("org-1", "EXPORT_PDF"),
      ).resolves.toBeUndefined();
      expect(mockHasFeature).toHaveBeenCalledWith("org-1", "EXPORT_PDF");
    });

    it("should throw when feature is not available", async () => {
      mockHasFeature.mockResolvedValue(false);

      await expect(requireFeature("org-1", "EXPORT_PDF")).rejects.toThrow(
        'Feature "EXPORT_PDF" is not available on your current plan',
      );
    });

    it("should propagate errors from hasFeature", async () => {
      mockHasFeature.mockRejectedValue(new Error("DB connection failed"));

      await expect(requireFeature("org-1", "EXPORT_PDF")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  // ==========================================================================
  // requireLimit
  // ==========================================================================

  describe("requireLimit", () => {
    it("should resolve when consumption is within limit", async () => {
      mockCanConsume.mockResolvedValue(true);

      await expect(
        requireLimit("org-1", "MAX_SYNCS", 1),
      ).resolves.toBeUndefined();
      expect(mockCanConsume).toHaveBeenCalledWith("org-1", "MAX_SYNCS", 1);
    });

    it("should use default amount of 1", async () => {
      mockCanConsume.mockResolvedValue(true);

      await expect(requireLimit("org-1", "MAX_SYNCS")).resolves.toBeUndefined();
      expect(mockCanConsume).toHaveBeenCalledWith("org-1", "MAX_SYNCS", 1);
    });

    it("should throw when limit is reached", async () => {
      mockCanConsume.mockResolvedValue(false);

      await expect(requireLimit("org-1", "MAX_SYNCS", 5)).rejects.toThrow(
        'Limit reached for "MAX_SYNCS"',
      );
    });
  });

  // ==========================================================================
  // consumeFeature
  // ==========================================================================

  describe("consumeFeature", () => {
    it("should call service.consume with provided args", async () => {
      mockConsume.mockResolvedValue({
        success: true,
        feature: "MAX_SYNCS",
        used: 6,
        limit: 100,
        remaining: 94,
      });

      const result = await consumeFeature("org-1", "MAX_SYNCS", 1);
      expect(result).toEqual({
        success: true,
        feature: "MAX_SYNCS",
        used: 6,
        limit: 100,
        remaining: 94,
      });
      expect(mockConsume).toHaveBeenCalledWith("org-1", "MAX_SYNCS", 1);
    });

    it("should use default amount of 1", async () => {
      mockConsume.mockResolvedValue({
        success: true,
        feature: "FEATURE",
        used: 1,
        limit: null,
        remaining: null,
      });

      await consumeFeature("org-1", "FEATURE");
      expect(mockConsume).toHaveBeenCalledWith("org-1", "FEATURE", 1);
    });
  });

  // ==========================================================================
  // withFeature (HOF)
  // ==========================================================================

  describe("withFeature", () => {
    it("should call handler when feature is enabled", async () => {
      mockHasFeature.mockResolvedValue(true);
      const handler = vi.fn().mockResolvedValue(new Response("ok"));

      const wrapped = withFeature("EXPORT_PDF")(handler);
      const request = new Request("https://example.com/api/test");
      const response = await wrapped(request, "org-1");

      expect(response).toBeInstanceOf(Response);
      expect(handler).toHaveBeenCalledWith(request, "org-1");
    });

    it("should throw when feature is disabled", async () => {
      mockHasFeature.mockResolvedValue(false);
      const handler = vi.fn();

      const wrapped = withFeature("EXPORT_PDF")(handler);

      await expect(
        wrapped(new Request("https://example.com/api/test"), "org-1"),
      ).rejects.toThrow(
        'Feature "EXPORT_PDF" is not available on your current plan',
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // withConsume (HOF)
  // ==========================================================================

  describe("withConsume", () => {
    it("should call handler when consumption succeeds", async () => {
      mockConsume.mockResolvedValue({
        success: true,
        feature: "FEATURE",
        used: 1,
        limit: null,
        remaining: null,
      });
      const handler = vi.fn().mockResolvedValue(new Response("ok"));

      const wrapped = withConsume("MAX_SYNCS", 1)(handler);
      const request = new Request("https://example.com/api/test");
      const response = await wrapped(request, "org-1");

      expect(response).toBeInstanceOf(Response);
      expect(handler).toHaveBeenCalledWith(request, "org-1");
    });

    it("should return 403 when consumption fails", async () => {
      mockConsume.mockResolvedValue({ success: false });
      const handler = vi.fn();

      const wrapped = withConsume("MAX_SYNCS", 1)(handler);
      const request = new Request("https://example.com/api/test");
      const response = await wrapped(request, "org-1");

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Monthly limit reached");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // withLimit (HOF)
  // ==========================================================================

  describe("withLimit", () => {
    it("should call handler when both feature check and limit check pass", async () => {
      mockHasFeature.mockResolvedValue(true);
      mockCanConsume.mockResolvedValue(true);
      const handler = vi.fn().mockResolvedValue(new Response("ok"));

      const wrapped = withLimit("EXPORT_PDF", 1)(handler);
      const request = new Request("https://example.com/api/test");
      const response = await wrapped(request, "org-1");

      expect(response).toBeInstanceOf(Response);
      expect(handler).toHaveBeenCalled();
      expect(mockHasFeature).toHaveBeenCalled();
      expect(mockCanConsume).toHaveBeenCalled();
    });

    it("should throw when feature is not available (before checking limit)", async () => {
      mockHasFeature.mockResolvedValue(false);
      const handler = vi.fn();

      const wrapped = withLimit("EXPORT_PDF", 1)(handler);

      await expect(
        wrapped(new Request("https://example.com/api/test"), "org-1"),
      ).rejects.toThrow();

      expect(handler).not.toHaveBeenCalled();
      expect(mockCanConsume).not.toHaveBeenCalled(); // Should short-circuit
    });

    it("should throw when limit is reached", async () => {
      mockHasFeature.mockResolvedValue(true);
      mockCanConsume.mockResolvedValue(false);
      const handler = vi.fn();

      const wrapped = withLimit("EXPORT_PDF", 1)(handler);

      await expect(
        wrapped(new Request("https://example.com/api/test"), "org-1"),
      ).rejects.toThrow('Limit reached for "EXPORT_PDF"');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // toExpress
  // ==========================================================================

  describe("toExpress", () => {
    it("should convert a middleware to Express-style (next path)", async () => {
      mockHasFeature.mockResolvedValue(true);
      const handler = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 200 }));

      const middleware = withFeature("EXPORT_PDF")(handler);
      const expressMw = toExpress(middleware);

      const req = { orgId: "org-1" };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await expressMw(req, res, next);

      // When handler returns Response, it should call res.status().json()
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should call next() when middleware response is falsy", async () => {
      mockHasFeature.mockResolvedValue(true);
      const handler = vi.fn().mockResolvedValue(null);

      const middleware = withFeature("EXPORT_PDF")(handler);
      const expressMw = toExpress(middleware);

      const req = { orgId: "org-1" };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await expressMw(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should handle errors by returning 403", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new Error("Feature not available"));
      const middleware = () => handler(new Request(""), "org-1");
      const expressMw = toExpress(middleware);

      const req = { orgId: "org-1" };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      // Since middleware is async, the catch in toExpress handles it
      await expressMw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // createOrgIdResolver
  // ==========================================================================

  describe("createOrgIdResolver", () => {
    it("should return the resolver function unchanged", () => {
      const resolver = (req: Request) => {
        return req.headers.get("x-org-id") ?? "default-org";
      };

      const wrapped = createOrgIdResolver(resolver);
      expect(wrapped).toBe(resolver);
    });

    it("should work with async resolvers", async () => {
      const resolver = async (req: Request) => {
        return "async-org-id";
      };

      const wrapped = createOrgIdResolver(resolver);
      const result = await wrapped(new Request("https://example.com"));
      expect(result).toBe("async-org-id");
    });
  });
});
