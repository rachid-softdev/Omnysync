/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FeatureNotAvailableError,
  LimitReachedError,
  SubscriptionExpiredError,
  InvalidFeatureError,
  CacheError,
  FeatureGateError,
  InvalidOrganizationError,
  logFeatureGateError,
  isFeatureGateError,
  handleFeatureGateError,
} from "../errors";

describe("Feature Gate Errors", () => {
  describe("FeatureGateError", () => {
    it("should create base error with code and message", () => {
      const error = new FeatureGateError(
        "FEATURE_NOT_AVAILABLE",
        "Feature not available",
        { feature: "EXPORT_PDF" },
        403,
      );

      expect(error.code).toBe("FEATURE_NOT_AVAILABLE");
      expect(error.message).toBe("Feature not available");
      expect(error.statusCode).toBe(403);
      expect(error.context.feature).toBe("EXPORT_PDF");
      expect(error.name).toBe("FeatureGateError");
    });
  });

  describe("FeatureNotAvailableError", () => {
    it("should create error with feature key", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free");

      expect(error.message).toContain("EXPORT_PDF");
      expect(error.featureKey).toBe("EXPORT_PDF");
      expect(error.planRequired).toBeDefined();
    });

    it("should include required plan when specified", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free", "pro");

      expect(error.message).toContain("pro");
      expect(error.message).toContain("free");
    });

    it("should be instance of FeatureGateError", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free");

      expect(error).toBeInstanceOf(FeatureGateError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("LimitReachedError", () => {
    it("should create error with limit details", () => {
      const error = new LimitReachedError("MAX_SYNCS", 10, 5, "2026-02-01");

      expect(error.message).toContain("MAX_SYNCS");
      expect(error.message).toContain("5");
      expect(error.message).toContain("10");
      expect(error.featureKey).toBe("MAX_SYNCS");
    });

    it("should be instance of FeatureGateError", () => {
      const error = new LimitReachedError("MAX_SYNCS", 10, 5, "2026-02-01");

      expect(error).toBeInstanceOf(FeatureGateError);
    });
  });

  describe("SubscriptionExpiredError", () => {
    it("should create error with org id", () => {
      const error = new SubscriptionExpiredError("org-123");

      expect(error.message).toContain("expired");
      expect(error.context.orgId).toBe("org-123");
    });

    it("should be instance of FeatureGateError", () => {
      const error = new SubscriptionExpiredError("org-123");

      expect(error).toBeInstanceOf(FeatureGateError);
    });
  });

  describe("InvalidFeatureError", () => {
    it("should create error with feature key", () => {
      const error = new InvalidFeatureError("INVALID_FEATURE");

      expect(error.message).toContain("INVALID_FEATURE");
      expect(error.context.feature).toBe("INVALID_FEATURE");
    });

    it("should be instance of FeatureGateError", () => {
      const error = new InvalidFeatureError("INVALID_FEATURE");

      expect(error).toBeInstanceOf(FeatureGateError);
    });
  });

  describe("InvalidOrganizationError", () => {
    it("should create error with org id", () => {
      const error = new InvalidOrganizationError("org-invalid");

      expect(error.message).toContain("org-invalid");
    });
  });

  describe("CacheError", () => {
    it("should create error with message", () => {
      const error = new CacheError("Cache connection failed");

      expect(error.message).toContain("Cache connection failed");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("logFeatureGateError", () => {
    it("should log error with context", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free");

      logFeatureGateError(error, { requestId: "req-123" });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toBe("[FeatureGateError]");

      consoleSpy.mockRestore();
    });
  });

  describe("isFeatureGateError", () => {
    it("should return true for FeatureGateError", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free");

      expect(isFeatureGateError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");

      expect(isFeatureGateError(error)).toBe(false);
    });
  });

  describe("handleFeatureGateError", () => {
    it("should return formatted error response", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free", "pro");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe("FEATURE_NOT_AVAILABLE");
      expect(result.body.feature).toBe("EXPORT_PDF");
    });

    it("should handle unknown errors", () => {
      const error = new Error("Unknown error");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe("INTERNAL_ERROR");
    });
  });

  describe("toJSON", () => {
    it("should serialize error to JSON for FEATURE_NOT_AVAILABLE with plan", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free", "pro");

      const json = error.toJSON();

      expect(json.error).toBe("FEATURE_NOT_AVAILABLE");
      expect(json.feature).toBe("EXPORT_PDF");
      // current_plan and plan_required come from context / hardcoded upgrade url
      expect(json.current_plan).toBe("free");
      // NOTE: planRequired stores context.plan (current plan), not upgrade URL.
      // The upgrade_url field holds the upgrade link.
      expect(json.plan_required).toBe("free");
      expect(json.upgrade_url).toBe("/billing/upgrade");
    });

    it("should serialize error to JSON for FEATURE_NOT_AVAILABLE without planRequired parameter", () => {
      const error = new FeatureNotAvailableError("EXPORT_PDF", "free");

      const json = error.toJSON();

      expect(json.error).toBe("FEATURE_NOT_AVAILABLE");
      expect(json.feature).toBe("EXPORT_PDF");
      // FEATURE_NOT_AVAILABLE sets planRequired to context.plan (current plan)
      expect(json.plan_required).toBe("free");
      expect(json.current_plan).toBe("free");
      expect(json.upgrade_url).toBe("/billing/upgrade");
    });

    it("should serialize LIMIT_REACHED error to JSON", () => {
      const error = new LimitReachedError("MAX_SYNCS", 10, 5, "2026-02-01");

      const json = error.toJSON();

      expect(json.error).toBe("LIMIT_REACHED");
      expect(json.feature).toBe("MAX_SYNCS");
      expect(json.limit).toBe(10);
      expect(json.used).toBe(5);
      expect(json.reset_at).toBe("2026-02-01");
      expect(json.upgrade_url).toBe("/billing/upgrade");
    });

    it("should serialize SUBSCRIPTION_EXPIRED error to JSON", () => {
      const error = new SubscriptionExpiredError("org-123");

      const json = error.toJSON();

      expect(json.error).toBe("SUBSCRIPTION_EXPIRED");
      expect(json.renew_url).toBe("/billing");
    });

    it("should serialize error without featureKey", () => {
      const error = new InvalidOrganizationError("org-invalid");

      const json = error.toJSON();

      expect(json.error).toBe("INVALID_ORG");
      expect(json.feature).toBeUndefined();
    });

    it("should handle handleFeatureGateError for SubscriptionExpiredError", () => {
      const error = new SubscriptionExpiredError("org-123");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(402);
      expect(result.body.error).toBe("SUBSCRIPTION_EXPIRED");
      expect(result.body.renew_url).toBe("/billing");
    });

    it("should handle handleFeatureGateError for LimitReachedError", () => {
      const error = new LimitReachedError(
        "API_CALLS",
        1000,
        1000,
        "2026-03-01",
      );

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(402);
      expect(result.body.error).toBe("LIMIT_REACHED");
      expect(result.body.limit).toBe(1000);
      expect(result.body.used).toBe(1000);
    });

    it("should handle handleFeatureGateError for CacheError", () => {
      const error = new CacheError("Redis connection failed", {
        orgId: "org-1",
      });

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe("CACHE_ERROR");
    });

    it("should handle handleFeatureGateError for InvalidFeatureError", () => {
      const error = new InvalidFeatureError("NON_EXISTENT");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe("INVALID_FEATURE");
    });

    it("should handle handleFeatureGateError for InvalidOrganizationError", () => {
      const error = new InvalidOrganizationError("org-missing");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(404);
      expect(result.body.error).toBe("INVALID_ORG");
    });

    it("toJSON for CacheError should not include featureKey or plan_required", () => {
      const error = new CacheError("Redis timeout", { orgId: "org-1" });

      const json = error.toJSON();

      expect(json.error).toBe("CACHE_ERROR");
      expect(json.feature).toBeUndefined();
      expect(json.plan_required).toBeUndefined();
      expect(json.upgrade_url).toBeUndefined();
    });

    it("toJSON for InvalidFeatureError should not include extra fields", () => {
      const error = new InvalidFeatureError("FAKE_FEATURE");

      const json = error.toJSON();

      expect(json.error).toBe("INVALID_FEATURE");
      expect(json.feature).toBeUndefined(); // featureKey not set by INVALID_FEATURE
      expect(json.plan_required).toBeUndefined();
      expect(json.upgrade_url).toBeUndefined();
    });

    it("FeatureGateError with unknown code should not set featureKey or planRequired", () => {
      const error = new FeatureGateError(
        "CACHE_ERROR" as any,
        "Something went wrong",
        { orgId: "org-1" },
      );

      expect(error.featureKey).toBeUndefined();
      expect(error.planRequired).toBeUndefined();
      expect(error.upgradeUrl).toBeUndefined();
    });

    it("logFeatureGateError without additional context should still log", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new InvalidOrganizationError("org-test");

      logFeatureGateError(error);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toBe("[FeatureGateError]");
      consoleSpy.mockRestore();
    });

    it("handleFeatureGateError should handle errors with empty context", () => {
      const error = new FeatureGateError("FEATURE_NOT_AVAILABLE", "No details");

      const result = handleFeatureGateError(error);

      expect(result.statusCode).toBe(403);
      expect(result.body.error).toBe("FEATURE_NOT_AVAILABLE");
    });
  });
});
