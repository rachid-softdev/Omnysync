/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PrismaEntitlementRepository Tests
 *
 * Tests the Prisma-backed entitlement repository implementation.
 * Mocks the prisma client to verify query logic, serialization,
 * error handling, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// PRISMA MOCK — hoisted so vitest can hoist the vi.mock call
// ============================================================================

const mockPrisma = vi.hoisted(() => {
  // Shared "transaction" context that methods like $transaction pass through
  const tx = {
    usageTracking: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    entitlementOverride: {
      delete: vi.fn(),
    },
  };

  const prisma = {
    organization: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    feature: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    planFeature: {
      upsert: vi.fn(),
    },
    entitlementOverride: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    usageTracking: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(async (fn: any, _options?: any) => {
      // Reset tx mocks between calls (but keep the mock references alive)
      tx.usageTracking.findUnique = prisma.usageTracking.findUnique;
      tx.usageTracking.upsert = prisma.usageTracking.upsert;
      tx.usageTracking.update = prisma.usageTracking.update;
      tx.entitlementOverride.delete = prisma.entitlementOverride.delete;
      return fn(tx);
    }),
  };

  return prisma;
});

vi.mock("../../prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  PrismaEntitlementRepository,
  resetEntitlementRepository,
  setEntitlementRepository,
  getEntitlementRepository,
} from "../EntitlementRepository";
import type { OverrideInput } from "../types";

// ============================================================================
// HELPERS
// ============================================================================

function resetAllMocks() {
  Object.values(mockPrisma).forEach((model: any) => {
    if (typeof model === "function" && vi.isMockFunction(model)) {
      model.mockReset();
    } else if (typeof model === "object" && model !== null) {
      Object.values(model).forEach((method: any) => {
        if (vi.isMockFunction(method)) {
          method.mockReset();
        }
      });
    }
  });
  // Special reset for $transaction
  mockPrisma.$transaction.mockReset();
  mockPrisma.$transaction.mockImplementation(
    async (fn: any, _options?: any) => {
      return fn({
        usageTracking: {
          findUnique: mockPrisma.usageTracking.findUnique,
          upsert: mockPrisma.usageTracking.upsert,
          update: mockPrisma.usageTracking.update,
        },
        entitlementOverride: {
          delete: mockPrisma.entitlementOverride.delete,
        },
      });
    },
  );
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("PrismaEntitlementRepository", () => {
  let repo: PrismaEntitlementRepository;

  beforeEach(() => {
    resetEntitlementRepository();
    resetAllMocks();
    repo = new PrismaEntitlementRepository();
  });

  afterEach(() => {
    resetEntitlementRepository();
  });

  // ==========================================================================
  // ORGANIZATION & SUBSCRIPTION
  // ==========================================================================

  describe("getOrganizationStripeCustomerId", () => {
    it("should return stripeCustomerId when org exists", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_abc123",
      });

      const result = await repo.getOrganizationStripeCustomerId("org-1");
      expect(result).toBe("cus_abc123");
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
        select: { stripeCustomerId: true },
      });
    });

    it("should return null when org not found", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await repo.getOrganizationStripeCustomerId("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getActiveSubscription", () => {
    const baseSubscription = {
      id: "sub-1",
      organizationId: "org-1",
      planKey: "pro",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-01-01"),
      currentPeriodEnd: new Date("2026-07-01"),
      cancelAtPeriodEnd: false,
      trialStart: null,
      trialEnd: null,
    };

    it("should return subscription data for active subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(baseSubscription);

      const result = await repo.getActiveSubscription("org-1");
      expect(result).not.toBeNull();
      expect(result?.planKey).toBe("pro");
      expect(result?.status).toBe("ACTIVE");
    });

    it("should return null when no subscription exists", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await repo.getActiveSubscription("nonexistent");
      expect(result).toBeNull();
    });

    it("should return null when subscription period has ended", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: "CANCELED",
        currentPeriodEnd: new Date("2025-01-01"), // Past
      });

      const result = await repo.getActiveSubscription("org-1");
      expect(result).toBeNull();
    });

    it("should return subscription for TRIALING status", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...baseSubscription,
        status: "TRIALING",
      });

      const result = await repo.getActiveSubscription("org-1");
      expect(result).not.toBeNull();
      expect(result?.status).toBe("TRIALING");
    });
  });

  describe("getPlanKey", () => {
    it("should return plan key from active subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
        planKey: "business",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      const result = await repo.getPlanKey("org-1");
      expect(result).toBe("business");
    });

    it("should return default plan (free) when no subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await repo.getPlanKey("nonexistent");
      expect(result).toBe("free");
    });
  });

  // ==========================================================================
  // FEATURES
  // ==========================================================================

  describe("getFeature", () => {
    it("should return feature data", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue({
        id: "feat-1",
        key: "EXPORT_PDF",
        name: "Export PDF",
        description: "Export documents as PDF",
        type: "BOOLEAN",
        defaultConfig: null,
      });

      const result = await repo.getFeature("EXPORT_PDF");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("EXPORT_PDF");
      expect(result?.type).toBe("BOOLEAN");
    });

    it("should return null for unknown feature", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue(null);

      const result = await repo.getFeature("NON_EXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("getAllFeatures", () => {
    it("should return all features ordered by key", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([
        {
          id: "1",
          key: "EXPORT_CSV",
          name: "Export CSV",
          description: null,
          type: "BOOLEAN",
          defaultConfig: null,
        },
        {
          id: "2",
          key: "EXPORT_PDF",
          name: "Export PDF",
          description: null,
          type: "BOOLEAN",
          defaultConfig: null,
        },
      ]);

      const result = await repo.getAllFeatures();
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("EXPORT_CSV");
      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        orderBy: { key: "asc" },
      });
    });

    it("should return empty array when no features", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([]);

      const result = await repo.getAllFeatures();
      expect(result).toEqual([]);
    });
  });

  describe("getPlanFeatures", () => {
    it("should return features for a plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: "plan-1",
        key: "pro",
        features: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
          {
            enabled: true,
            limitValue: 100,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "MAX_SYNCS", name: "Max Syncs" },
          },
        ],
      });

      const result = await repo.getPlanFeatures("pro");
      expect(result).toHaveLength(2);
      expect(result[0].featureKey).toBe("EXPORT_PDF");
      expect(result[1].limitValue).toBe(100);
    });

    it("should return empty array for unknown plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const result = await repo.getPlanFeatures("nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("getEntitlementMap", () => {
    it("should build entitlement map from plan features", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      mockPrisma.plan.findUnique.mockResolvedValue({
        id: "plan-1",
        key: "pro",
        features: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
          {
            enabled: true,
            limitValue: -1, // Unlimited
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "MAX_CONNECTORS", name: "Max Connectors" },
          },
          {
            enabled: false,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "DISABLED_FEATURE", name: "Disabled" },
          },
        ],
      });

      const result = await repo.getEntitlementMap("org-1");
      expect(result.planKey).toBe("pro");
      expect(result.features["EXPORT_PDF"]).toBe(true);
      // -1 should become null (unlimited)
      expect(result.limits["MAX_CONNECTORS"]).toBeNull();
      // Disabled feature should not be in limits
      expect(result.features["DISABLED_FEATURE"]).toBe(false);
    });
  });

  // ==========================================================================
  // OVERRIDES
  // ==========================================================================

  describe("getUserOverride", () => {
    it("should return override when found and not expired", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue({
        id: "ov-1",
        scope: "USER",
        scopeId: "user-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        limitValue: null,
        expiresAt: null,
        reason: "Test override",
        createdAt: new Date(),
      });

      const result = await repo.getUserOverride("user-1", "EXPORT_PDF");
      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
      expect(result?.scope).toBe("USER");
    });

    it("should return null when override is expired", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue({
        id: "ov-1",
        scope: "USER",
        scopeId: "user-1",
        featureKey: "EXPORT_PDF",
        enabled: false,
        limitValue: null,
        expiresAt: new Date("2025-01-01"), // Past date
        reason: "Expired",
        createdAt: new Date(),
      });

      const result = await repo.getUserOverride("user-1", "EXPORT_PDF");
      expect(result).toBeNull();
    });

    it("should return null when no override found", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue(null);

      const result = await repo.getUserOverride("user-1", "EXPORT_PDF");
      expect(result).toBeNull();
    });
  });

  describe("getOrgOverride", () => {
    it("should return org-level override", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue({
        id: "ov-1",
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        limitValue: null,
        expiresAt: null,
        reason: "Org override",
        createdAt: new Date(),
      });

      const result = await repo.getOrgOverride("org-1", "EXPORT_PDF");
      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
    });
  });

  describe("getAllOverridesForOrg", () => {
    it("should return all non-expired overrides for an org", async () => {
      mockPrisma.entitlementOverride.findMany.mockResolvedValue([
        {
          id: "ov-1",
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "EXPORT_PDF",
          enabled: true,
          limitValue: null,
          expiresAt: null,
          reason: "Override 1",
        },
        {
          id: "ov-2",
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "API_ACCESS",
          enabled: true,
          limitValue: null,
          expiresAt: null,
          reason: "Override 2",
        },
      ]);

      const result = await repo.getAllOverridesForOrg("org-1");
      expect(result).toHaveLength(2);
    });

    it("should filter out expired overrides", async () => {
      mockPrisma.entitlementOverride.findMany.mockResolvedValue([
        {
          id: "ov-expired",
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "EXPORT_PDF",
          enabled: true,
          limitValue: null,
          expiresAt: new Date("2025-01-01"), // Past
          reason: "Expired",
        },
      ]);

      const result = await repo.getAllOverridesForOrg("org-1");
      expect(result).toHaveLength(0);
    });
  });

  describe("createOverride", () => {
    it("should create and return an override", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });

      mockPrisma.entitlementOverride.create.mockResolvedValue({
        id: "ov-new",
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        limitValue: null,
        expiresAt: null,
        reason: "New override",
      });

      const input: OverrideInput = {
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        reason: "New override",
      };

      const result = await repo.createOverride({
        ...input,
        createdBy: "admin",
      });
      expect(result.id).toBe("ov-new");
      expect(result.scope).toBe("ORG");
    });
  });

  describe("deleteOverride", () => {
    it("should delete an override by id", async () => {
      mockPrisma.entitlementOverride.delete.mockResolvedValue({} as any);

      await repo.deleteOverride("ov-1");
      expect(mockPrisma.entitlementOverride.delete).toHaveBeenCalledWith({
        where: { id: "ov-1" },
      });
    });
  });

  // ==========================================================================
  // USAGE TRACKING
  // ==========================================================================

  describe("getUsageTracking", () => {
    it("should return usage data for current period", async () => {
      mockPrisma.usageTracking.findUnique.mockResolvedValue({
        id: "usage-1",
        organizationId: "org-1",
        featureKey: "MAX_SYNCS",
        usageCount: 5,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 86400000),
      });

      const result = await repo.getUsageTracking("org-1", "MAX_SYNCS");
      expect(result).not.toBeNull();
      expect(result?.usageCount).toBe(5);
    });

    it("should return null when usage period has ended", async () => {
      mockPrisma.usageTracking.findUnique.mockResolvedValue({
        id: "usage-1",
        organizationId: "org-1",
        featureKey: "MAX_SYNCS",
        usageCount: 5,
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-02-01"), // Past
      });

      const result = await repo.getUsageTracking("org-1", "MAX_SYNCS");
      expect(result).toBeNull();
    });
  });

  describe("consumeUsage", () => {
    it("should consume with unlimited limit (null)", async () => {
      mockPrisma.usageTracking.upsert.mockResolvedValue({
        id: "usage-1",
        organizationId: "org-1",
        featureKey: "MAX_SYNCS",
        usageCount: 1,
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      const result = await repo.consumeUsage("org-1", "MAX_SYNCS", 1, null);
      expect(result.success).toBe(true);
      expect(result.newUsageCount).toBe(1);
      expect(result.limitReached).toBe(false);
    });

    it("should consume with a limit and succeed when under limit", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          usageTracking: {
            upsert: vi.fn().mockResolvedValue({
              id: "usage-1",
              usageCount: 6,
            }),
            update: vi.fn(),
          },
          entitlementOverride: { delete: vi.fn() },
        });
      });

      const result = await repo.consumeUsage("org-1", "MAX_SYNCS", 1, 10);
      expect(result.success).toBe(true);
    });

    it("should reject consumption when over limit", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          usageTracking: {
            upsert: vi.fn().mockResolvedValue({
              id: "usage-1",
              usageCount: 11,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          entitlementOverride: { delete: vi.fn() },
        });
      });

      const result = await repo.consumeUsage("org-1", "MAX_SYNCS", 1, 10);
      expect(result.success).toBe(false);
      expect(result.limitReached).toBe(true);
    });
  });

  // ==========================================================================
  // ADMIN — PLANS & FEATURES
  // ==========================================================================

  describe("getPlanWithFeatures", () => {
    it("should return plan with its features", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: "plan-1",
        key: "pro",
        name: "Pro",
        priceMonthly: 29,
        priceYearly: 290,
        isActive: true,
        sortOrder: 2,
        features: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
        ],
      });

      const result = await repo.getPlanWithFeatures("pro");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("pro");
      expect(result?.features).toHaveLength(1);
      expect(result?.priceMonthly).toBe(29);
    });

    it("should return null for unknown plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);
      const result = await repo.getPlanWithFeatures("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getAllPlansWithFeatures", () => {
    it("should return all plans with features", async () => {
      mockPrisma.plan.findMany.mockResolvedValue([
        {
          id: "plan-1",
          key: "free",
          name: "Free",
          priceMonthly: 0,
          priceYearly: 0,
          isActive: true,
          sortOrder: 1,
          features: [],
        },
        {
          id: "plan-2",
          key: "pro",
          name: "Pro",
          priceMonthly: 29,
          priceYearly: 290,
          isActive: true,
          sortOrder: 2,
          features: [],
        },
      ]);

      const result = await repo.getAllPlansWithFeatures();
      expect(result).toHaveLength(2);
    });
  });

  describe("getFeatureWithPlans", () => {
    it("should return feature with its plans", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue({
        id: "feat-1",
        key: "EXPORT_PDF",
        name: "Export PDF",
        description: null,
        type: "BOOLEAN",
        defaultConfig: null,
        plans: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
          },
        ],
      });

      const result = await repo.getFeatureWithPlans("EXPORT_PDF");
      expect(result).not.toBeNull();
      expect(result?.key).toBe("EXPORT_PDF");
      expect(result?.plans).toHaveLength(1);
    });

    it("should return null for unknown feature", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue(null);
      const result = await repo.getFeatureWithPlans("NON_EXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("getAllFeaturesWithPlans", () => {
    it("should return all features with plans", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([
        {
          id: "feat-1",
          key: "EXPORT_PDF",
          name: "Export PDF",
          description: null,
          type: "BOOLEAN",
          defaultConfig: null,
          plans: [
            {
              enabled: true,
              limitValue: null,
              configJson: null,
              downgradeStrategy: "GRACEFUL",
            },
          ],
        },
      ]);

      const result = await repo.getAllFeaturesWithPlans();
      expect(result).toHaveLength(1);
    });
  });

  describe("updatePlanFeature", () => {
    it("should upsert plan-feature mapping", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-1" });
      mockPrisma.feature.findUnique.mockResolvedValue({ id: "feat-1" });
      mockPrisma.planFeature.upsert.mockResolvedValue({
        enabled: true,
        limitValue: 200,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
        feature: { key: "MAX_SYNCS", name: "Max Syncs" },
      });

      const result = await repo.updatePlanFeature("pro", "MAX_SYNCS", {
        limitValue: 200,
      });
      expect(result.featureKey).toBe("MAX_SYNCS");
      expect(result.limitValue).toBe(200);
    });

    it("should throw when plan or feature not found", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        repo.updatePlanFeature("nonexistent", "EXPORT_PDF", { enabled: true }),
      ).rejects.toThrow("Plan or Feature not found");
    });
  });

  describe("createFeature", () => {
    it("should create and return a new feature", async () => {
      mockPrisma.feature.create.mockResolvedValue({
        id: "feat-new",
        key: "NEW_FEATURE",
        name: "New Feature",
        description: "A brand new feature",
        type: "BOOLEAN",
        defaultConfig: null,
      });

      const result = await repo.createFeature({
        key: "NEW_FEATURE",
        name: "New Feature",
        description: "A brand new feature",
        type: "BOOLEAN",
      });

      expect(result.key).toBe("NEW_FEATURE");
    });
  });

  describe("updateFeature", () => {
    it("should update and return the feature", async () => {
      mockPrisma.feature.update.mockResolvedValue({
        id: "feat-1",
        key: "EXPORT_PDF",
        name: "Export PDF Updated",
        description: null,
        type: "BOOLEAN",
        defaultConfig: null,
      });

      const result = await repo.updateFeature("EXPORT_PDF", {
        name: "Export PDF Updated",
      });
      expect(result.name).toBe("Export PDF Updated");
    });
  });

  // ==========================================================================
  // DOWNGRADE PREVIEW
  // ==========================================================================

  describe("getDowngradePreview", () => {
    it("should compute downgrade preview between plans", async () => {
      // Set up active subscription
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      // Set up pro plan features (current)
      mockPrisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-pro",
        key: "pro",
        features: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
        ],
      });

      // Set up free plan features (target)
      mockPrisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-free",
        key: "free",
        features: [
          {
            enabled: false,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
        ],
      });

      // No usage tracking found
      mockPrisma.usageTracking.findUnique.mockResolvedValue(null);

      const result = await repo.getDowngradePreview("org-1", "free");
      expect(result.features).toHaveLength(1);
      expect(result.features[0].willBeAffected).toBe(true);
      expect(result.features[0].currentPlanValue).toBe(true);
      expect(result.features[0].targetPlanValue).toBe(false);
      expect(result.recommendedStrategy).toBe("IMMEDIATE"); // No active usage
    });

    it("should recommend GRACEFUL when there is active usage", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      mockPrisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-pro",
        key: "pro",
        features: [
          {
            enabled: true,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
        ],
      });

      mockPrisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-free",
        key: "free",
        features: [
          {
            enabled: false,
            limitValue: null,
            configJson: null,
            downgradeStrategy: "GRACEFUL",
            feature: { key: "EXPORT_PDF", name: "Export PDF" },
          },
        ],
      });

      // Active usage found
      mockPrisma.usageTracking.findUnique.mockResolvedValue({
        id: "usage-1",
        organizationId: "org-1",
        featureKey: "EXPORT_PDF",
        usageCount: 5,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 86400000),
      });

      const result = await repo.getDowngradePreview("org-1", "free");
      expect(result.recommendedStrategy).toBe("GRACEFUL");
      expect(result.features[0].hasActiveUsage).toBe(true);
    });
  });

  // ==========================================================================
  // WEBHOOKS
  // ==========================================================================

  describe("webhooks", () => {
    it("isWebhookEventProcessed should return false when event not found", async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

      const result = await repo.isWebhookEventProcessed("evt-1");
      expect(result).toBe(false);
    });

    it("isWebhookEventProcessed should return true when event exists", async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: "evt-1",
        eventType: "checkout.session.completed",
      });

      const result = await repo.isWebhookEventProcessed("evt-1");
      expect(result).toBe(true);
    });

    it("markWebhookEventProcessed should upsert event", async () => {
      mockPrisma.webhookEvent.upsert.mockResolvedValue({} as any);

      await repo.markWebhookEventProcessed(
        "evt-1",
        "checkout.session.completed",
      );
      expect(mockPrisma.webhookEvent.upsert).toHaveBeenCalledWith({
        where: { eventId: "evt-1" },
        create: { eventId: "evt-1", eventType: "checkout.session.completed" },
        update: { eventType: "checkout.session.completed" },
      });
    });
  });

  // ==========================================================================
  // FACTORY / SINGLETON
  // ==========================================================================

  describe("Factory & Singleton", () => {
    it("getEntitlementRepository should return same instance", () => {
      const repo1 = getEntitlementRepository();
      const repo2 = getEntitlementRepository();
      expect(repo1).toBe(repo2);
    });

    it("setEntitlementRepository should replace instance", () => {
      const replacement = new PrismaEntitlementRepository();
      setEntitlementRepository(replacement);
      expect(getEntitlementRepository()).toBe(replacement);
    });

    it("resetEntitlementRepository should clear instance", () => {
      const repo1 = getEntitlementRepository();
      resetEntitlementRepository();
      const repo2 = getEntitlementRepository();
      expect(repo2).not.toBe(repo1);
    });
  });
});
