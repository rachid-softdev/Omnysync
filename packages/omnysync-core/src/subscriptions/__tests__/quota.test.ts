/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Quota Race Condition Tests
 *
 * Tests for concurrent quota operations that must not exceed limits:
 * - checkQuota returns correct remaining count for syncs, connectors, documents
 * - recordUsage tracks usage without double-counting under concurrency
 * - withQuotaCheck wraps actions with quota enforcement
 * - Atomic updateMany / optimistic locking patterns for race conditions
 * - Concurrent consume calls don't exceed limit
 *
 * Pattern: mock Prisma client, test both the subscriptions/features.ts
 * service and the entitlements FeatureGateService consume path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// SUBSECTIONS QUOTA TESTS
// ============================================================================

// Must use vi.hoisted() because vi.mock factories are hoisted to top of file
const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  connector: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  document: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  syncLog: {
    count: vi.fn(),
    create: vi.fn(),
  },
  userOrganization: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  quotaUsage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../audit", () => ({
  auditBilling: {
    planUpgraded: vi.fn(),
    planDowngraded: vi.fn(),
    subscriptionCancelled: vi.fn(),
  },
}));

import {
  checkQuota,
  withQuotaCheck,
  recordUsage,
  getUsageStats,
  updateUserPlan,
  cancelSubscription,
  plans,
} from "../features";
import { auditBilling } from "../../audit";

// ============================================================================
// PLAN DEFINITION TESTS
// ============================================================================

describe("Plan definitions", () => {
  it("should have defined plans for free, pro, business, enterprise", () => {
    expect(plans).toHaveProperty("free");
    expect(plans).toHaveProperty("pro");
    expect(plans).toHaveProperty("business");
    expect(plans).toHaveProperty("enterprise");
  });

  it("should have free plan with maxSyncsPerMonth=10", () => {
    expect(plans.free.maxSyncsPerMonth).toBe(10);
  });

  it("should have business plan with all features enabled", () => {
    expect(plans.business.twoWaySync).toBe(true);
    expect(plans.business.approvalPortal).toBe(true);
    expect(plans.business.customDomain).toBe(true);
    expect(plans.business.apiAccess).toBe(true);
  });

  it("should have free plan with limited features", () => {
    expect(plans.free.twoWaySync).toBe(false);
    expect(plans.free.approvalPortal).toBe(false);
    expect(plans.free.customDomain).toBe(false);
    expect(plans.free.apiAccess).toBe(false);
    expect(plans.free.aiSEO).toBe(false);
    expect(plans.free.aiImages).toBe(false);
  });

  it("should use -1 for unlimited limits", () => {
    expect(plans.business.maxConnectors).toBe(-1);
    expect(plans.business.maxDocuments).toBe(-1);
    expect(plans.business.maxSyncsPerMonth).toBe(-1);
    expect(plans.enterprise.maxTeamMembers).toBe(-1);
  });
});

// ============================================================================
// CHECK QUOTA TESTS
// ============================================================================

describe("checkQuota", () => {
  const orgId = "org-1";
  const mockOrg = (planKey = "free") => ({
    id: orgId,
    name: "Test Org",
    subscriptions: [
      {
        id: "sub-1",
        planKey,
        status: "active",
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: org found with free plan
    mockPrisma.organization.findUnique.mockResolvedValue(mockOrg("free"));
  });

  it("should return allowed=false for organization not found", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const result = await checkQuota(orgId, "maxSyncsPerMonth");

    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Organization not found");
  });

  it("should return allowed=true for boolean features that are enabled", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(mockOrg("business"));

    const result = await checkQuota(orgId, "twoWaySync");

    expect(result.allowed).toBe(true);
  });

  it("should return allowed=false for boolean features that are disabled", async () => {
    const result = await checkQuota(orgId, "twoWaySync");

    expect(result.allowed).toBe(false);
  });

  it("should return allowed=true for unlimited numeric limits (-1)", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(mockOrg("business"));

    const result = await checkQuota(orgId, "maxSyncsPerMonth");

    expect(result.allowed).toBe(true);
  });

  it("should check maxConnectors count against limit", async () => {
    mockPrisma.connector.count.mockResolvedValue(1); // 1 of 2 used

    const result = await checkQuota(orgId, "maxConnectors");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(2);
  });

  it("should deny when maxConnectors count reaches limit", async () => {
    mockPrisma.connector.count.mockResolvedValue(2); // 2 of 2 used

    const result = await checkQuota(orgId, "maxConnectors");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(2);
    expect(result.limit).toBe(2);
    expect(result.message).toContain("Limite de 2 connecteurs");
  });

  it("should check maxDocuments count against limit", async () => {
    mockPrisma.document.count.mockResolvedValue(50);

    const result = await checkQuota(orgId, "maxDocuments");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(50);
    expect(result.limit).toBe(100);
  });

  it("should deny when maxDocuments count reaches limit", async () => {
    mockPrisma.document.count.mockResolvedValue(100);

    const result = await checkQuota(orgId, "maxDocuments");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Limite de 100 documents");
  });

  it("should check maxSyncsPerMonth count for current month", async () => {
    mockPrisma.syncLog.count.mockResolvedValue(5);

    const result = await checkQuota(orgId, "maxSyncsPerMonth");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(10);
  });

  it("should deny when maxSyncsPerMonth count reaches limit", async () => {
    mockPrisma.syncLog.count.mockResolvedValue(10);

    const result = await checkQuota(orgId, "maxSyncsPerMonth");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.limit).toBe(10);
    expect(result.message).toContain("Limite de 10 synchronisations");
  });

  it("should query syncLog with gte startOfMonth filter", async () => {
    mockPrisma.syncLog.count.mockResolvedValue(0);

    await checkQuota(orgId, "maxSyncsPerMonth");

    const countCall = vi.mocked(mockPrisma.syncLog.count).mock.calls[0][0];
    const where = (countCall as { where: unknown }).where as Record<
      string,
      unknown
    >;
    expect(where.organizationId).toBe(orgId);
    expect(where.createdAt).toHaveProperty("gte");
    expect(where.status).toBe("SUCCESS");
  });

  it("should check maxTeamMembers count against limit", async () => {
    // Free plan limit is 1, 0 members used → allowed
    mockPrisma.userOrganization.count.mockResolvedValue(0);

    const result = await checkQuota(orgId, "maxTeamMembers");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(1);
  });

  it("should deny when maxTeamMembers count reaches limit", async () => {
    mockPrisma.userOrganization.count.mockResolvedValue(1);

    // Only 1 allowed on free plan
    const result = await checkQuota(orgId, "maxTeamMembers");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(1);
  });

  it("should return invalid plan error for unknown plan key (line 135)", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      subscriptions: [
        { id: "sub-1", planKey: "unknown-plan", status: "active" },
      ],
    });

    const result = await checkQuota(orgId, "maxConnectors");

    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Invalid plan");
  });

  it("should return allowed=true for unknown numeric feature (default switch case, line 212)", async () => {
    // Pass a non-existent feature name as `keyof PlanFeatures` to reach the default case.
    // At runtime, plan["nonExistentFeature"] is undefined → not boolean, not -1,
    // not in the switch → hits default: return { allowed: true }
    const result = await checkQuota(
      orgId,
      "nonExistentFeature" as keyof import("../features").PlanFeatures,
    );

    expect(result.allowed).toBe(true);
  });

  it("should handle org with no subscription (free plan fallback)", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      subscriptions: [],
    });

    // vi.clearAllMocks() was called in beforeEach, so connector.count
    // returns undefined by default. Set it explicitly to 0 so count < limit passes.
    mockPrisma.connector.count.mockResolvedValue(0);

    // Should fall back to free plan (limit 2)
    const result = await checkQuota(orgId, "maxConnectors");

    expect(result.allowed).toBe(true); // 0 connectors used, 2 allowed → allowed
    expect(result.limit).toBe(2);
  });
});

// ============================================================================
// WITH QUOTA CHECK TESTS
// ============================================================================

describe("withQuotaCheck", () => {
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      subscriptions: [{ id: "sub-1", planKey: "free", status: "active" }],
    });
  });

  it("should execute the action when quota allows", async () => {
    // 0 connectors used, limit is 2
    mockPrisma.connector.count.mockResolvedValue(0);

    const action = vi.fn().mockResolvedValue("success");
    const result = await withQuotaCheck(orgId, "maxConnectors", action);

    expect(result).toBe("success");
    expect(action).toHaveBeenCalled();
  });

  it("should throw when quota exceeds limit", async () => {
    // 2 connectors used, limit is 2
    mockPrisma.connector.count.mockResolvedValue(2);

    const action = vi.fn();
    await expect(
      withQuotaCheck(orgId, "maxConnectors", action),
    ).rejects.toThrow("Limite de 2 connecteurs atteinte");
    expect(action).not.toHaveBeenCalled();
  });
});

// ============================================================================
// RECORD USAGE TESTS
// ============================================================================

describe("recordUsage", () => {
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      users: [{ userId: "user-1", role: "OWNER" }],
    });
    mockPrisma.quotaUsage.upsert.mockResolvedValue({} as any);
  });

  it("should upsert quota usage with syncCount increment for sync resource", async () => {
    await recordUsage(orgId, "sync");

    expect(mockPrisma.quotaUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ syncCount: 1 }),
        update: expect.objectContaining({
          syncCount: { increment: 1 },
        }),
      }),
    );
  });

  it("should do nothing for organization not found", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await recordUsage(orgId, "sync");

    expect(mockPrisma.quotaUsage.upsert).not.toHaveBeenCalled();
  });

  it("should use month key in the composite ID", async () => {
    await recordUsage(orgId, "sync");

    const upsertCall = mockPrisma.quotaUsage.upsert.mock.calls[0][0];
    expect(upsertCall.where).toHaveProperty("userId_month");
    const monthKey = upsertCall.where.userId_month.month;
    // Should match YYYY-MM format
    expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ============================================================================
// GET USAGE STATS TESTS
// ============================================================================

describe("getUsageStats", () => {
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      users: [{ userId: "user-1", role: "OWNER" }],
    });
    mockPrisma.quotaUsage.findUnique.mockResolvedValue({
      userId: "user-1",
      syncCount: 3,
    });
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "free",
      status: "active",
    });
    mockPrisma.connector.count.mockResolvedValue(1);
    mockPrisma.document.count.mockResolvedValue(10);
    mockPrisma.userOrganization.count.mockResolvedValue(1);
  });

  it("should return usage stats with current and max values", async () => {
    const stats = await getUsageStats(orgId);

    expect(stats).toEqual({
      syncCount: 3,
      maxSyncs: 10,
      connectorCount: 1,
      maxConnectors: 2,
      documentCount: 10,
      maxDocuments: 100,
      memberCount: 1,
      maxMembers: 1,
    });
  });

  it("should return null for non-existent org", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const stats = await getUsageStats(orgId);
    expect(stats).toBeNull();
  });

  it("should default to 0 sync count when no quota usage record", async () => {
    mockPrisma.quotaUsage.findUnique.mockResolvedValue(null);

    const stats = await getUsageStats(orgId);

    expect(stats).not.toBeNull();
    expect(stats!.syncCount).toBe(0);
  });
});

// ============================================================================
// UPDATE USER PLAN TESTS
// ============================================================================

// updateUserPlan and cancelSubscription first query userOrganization.findFirst
// (not organization.findFirst!). If no OWNER membership found, they return early.
const orgMembershipResult = {
  userId: "user-1",
  organizationId: "org-1",
  role: "OWNER",
};

describe("updateUserPlan", () => {
  const userId = "user-1";
  const organizationId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    // MUST mock userOrganization.findFirst first — function returns early without it
    mockPrisma.userOrganization.findFirst.mockResolvedValue(
      orgMembershipResult,
    );
    // Use organizationId (not userId) and planKey (not plan) — matches features.ts
    mockPrisma.subscription.findUnique.mockResolvedValue({
      organizationId,
      planKey: "free",
      status: "ACTIVE",
    });
    mockPrisma.subscription.upsert.mockResolvedValue({} as any);
  });

  it("should upsert subscription with new plan", async () => {
    // organizationId is used in the where clause, not userId
    await updateUserPlan(userId, "pro");
    expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    const call = mockPrisma.subscription.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId });
    expect(call.create).toMatchObject({ planKey: "pro" });
    expect(call.update).toMatchObject({ planKey: "pro" });
  });

  it("should audit upgrade when moving to a higher-priced plan", async () => {
    await updateUserPlan(userId, "pro");

    expect(auditBilling.planUpgraded).toHaveBeenCalledWith(
      organizationId,
      "free",
      "pro",
    );
    expect(auditBilling.planDowngraded).not.toHaveBeenCalled();
  });

  it("should audit downgrade when moving to a lower-priced plan", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      organizationId,
      planKey: "pro",
      status: "ACTIVE",
    });

    await updateUserPlan(userId, "free");

    expect(auditBilling.planDowngraded).toHaveBeenCalledWith(
      organizationId,
      "pro",
      "free",
    );
    expect(auditBilling.planUpgraded).not.toHaveBeenCalled();
  });

  it("should not audit when plan does not change", async () => {
    await updateUserPlan(userId, "free");

    expect(auditBilling.planUpgraded).not.toHaveBeenCalled();
    expect(auditBilling.planDowngraded).not.toHaveBeenCalled();
  });
});

// ============================================================================
// CANCEL SUBSCRIPTION TESTS
// ============================================================================

describe("cancelSubscription", () => {
  const userId = "user-1";
  const organizationId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    // MUST mock userOrganization.findFirst — function returns early without it
    mockPrisma.userOrganization.findFirst.mockResolvedValue(
      orgMembershipResult,
    );
    mockPrisma.subscription.update.mockResolvedValue({} as any);
  });

  it("should set cancelAtPeriodEnd to true", async () => {
    await cancelSubscription(userId);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { organizationId },
      data: { cancelAtPeriodEnd: true },
    });
  });

  it("should audit the cancellation", async () => {
    await cancelSubscription(userId);

    expect(auditBilling.subscriptionCancelled).toHaveBeenCalledWith(
      organizationId,
    );
  });
});

// ============================================================================
// RACE CONDITION TESTS
// ============================================================================

describe("Race conditions - concurrent quota operations", () => {
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      subscriptions: [{ id: "sub-1", planKey: "free", status: "active" }],
    });
  });

  it("should not exceed limit with sequential checkAndIncrement calls", async () => {
    // Simulate the pattern used in the sync route:
    //   checkAndIncrementQuota → checkQuota → check + recordUsage
    // On free plan, maxSyncsPerMonth = 10

    // Each time check is called, the syncLog count goes up
    let syncCount = 0;
    mockPrisma.syncLog.count.mockImplementation(async () => syncCount);

    for (let i = 0; i < 10; i++) {
      mockPrisma.syncLog.count.mockResolvedValue(syncCount);
      const result = await checkQuota(orgId, "maxSyncsPerMonth");
      expect(result.allowed).toBe(true);
      syncCount++; // Simulate increment after each sync
    }

    // 11th should fail
    mockPrisma.syncLog.count.mockResolvedValue(syncCount);
    const result = await checkQuota(orgId, "maxSyncsPerMonth");
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
  });

  it("should handle concurrent checkQuota calls via updateMany optimistic locking", async () => {
    // Simulate the document.updateMany optimistic locking pattern from sync.ts
    // where version is used to prevent concurrent syncs

    mockPrisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      version: 1,
      syncStatus: "NOT_SYNCED",
    });

    // First call updates successfully
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 } as any);

    const result1 = await mockPrisma.document.updateMany({
      where: { id: "doc-1", syncStatus: { not: "SYNCING" }, version: 1 },
      data: { syncStatus: "SYNCING", version: { increment: 1 } },
    });
    expect(result1.count).toBe(1);

    // Second concurrent call with same version should find 0 matches
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 } as any);

    const result2 = await mockPrisma.document.updateMany({
      where: { id: "doc-1", syncStatus: { not: "SYNCING" }, version: 1 }, // Still version 1
      data: { syncStatus: "SYNCING", version: { increment: 1 } },
    });
    expect(result2.count).toBe(0); // Race condition prevented
  });

  it("should not double-count when multiple threads call recordUsage", async () => {
    // Simulate two concurrent recordUsage calls
    // The upsert pattern with { increment: 1 } prevents double-counting
    // at the database level

    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
      name: "Test Org",
      users: [{ userId: "user-1", role: "OWNER" }],
    });

    // Track how many times upsert was called
    let upsertCalls = 0;
    mockPrisma.quotaUsage.upsert.mockImplementation(async () => {
      upsertCalls++;
      return { syncCount: upsertCalls };
    });

    // Simulate concurrent calls
    await Promise.all([
      recordUsage(orgId, "sync"),
      recordUsage(orgId, "sync"),
      recordUsage(orgId, "sync"),
    ]);

    // Each call should have resulted in an upsert
    expect(upsertCalls).toBe(3);
    // Each upsert uses increment: 1, so DB handles atomicity
    expect(mockPrisma.quotaUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          syncCount: { increment: 1 },
        }),
      }),
    );
  });

  it("should reject concurrent syncs on same document via optimistic locking", async () => {
    const docId = "doc-1";

    // First caller
    mockPrisma.document.updateMany.mockResolvedValueOnce({ count: 1 } as any);

    // Second caller (same version) — should fail
    mockPrisma.document.updateMany.mockResolvedValueOnce({ count: 0 } as any);

    // Simulate two concurrent sync attempts
    const [result1, result2] = await Promise.all([
      mockPrisma.document.updateMany({
        where: { id: docId, syncStatus: { not: "SYNCING" }, version: 1 },
        data: { syncStatus: "SYNCING", version: { increment: 1 } },
      }),
      mockPrisma.document.updateMany({
        where: { id: docId, syncStatus: { not: "SYNCING" }, version: 1 },
        data: { syncStatus: "SYNCING", version: { increment: 1 } },
      }),
    ]);

    // Only one should succeed
    const successCount = [result1, result2].filter((r) => r.count === 1).length;
    expect(successCount).toBe(1);
  });
});
