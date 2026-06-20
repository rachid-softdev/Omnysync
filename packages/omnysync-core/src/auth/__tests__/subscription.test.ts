/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Subscription Service Tests
 *
 * Tests for:
 * - getCurrentMonth: YYYY-MM formatting
 * - getUserPlan: plan resolution from subscription
 * - getPlanLimits: limit values per plan
 * - getQuotaUsage: usage aggregation with percent
 * - checkAndIncrementQuota: atomic quota enforcement
 * - decrementQuotaOnFailure: rollback on failure
 * - checkConnectorLimit: connector cap checking
 * - checkDocumentLimit: document cap checking
 * - getPlanFromPriceId: Stripe price → plan mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// MOCKS
// ============================================================================

const mockPrismaClient = vi.hoisted(() => ({
  userOrganization: {
    findFirst: vi.fn(),
  },
  quotaUsage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  connector: {
    count: vi.fn(),
  },
  document: {
    count: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({
  getPrisma: vi.fn(() => mockPrismaClient),
}));

import {
  getCurrentMonth,
  getUserPlan,
  getPlanLimits,
  getQuotaUsage,
  checkAndIncrementQuota,
  decrementQuotaOnFailure,
  checkConnectorLimit,
  checkDocumentLimit,
  getPlanFromPriceId,
} from "../subscription";

// ============================================================================
// HELPERS
// ============================================================================

function mockOrgMembership(
  planKey: string | null,
  status = "ACTIVE",
  organizationId = "org-1",
) {
  const subscriptions = planKey !== null ? [{ status, planKey }] : [];

  mockPrismaClient.userOrganization.findFirst.mockResolvedValue({
    userId: "user-1",
    organizationId,
    organization: { subscriptions },
  });
}

function mockNoMembership() {
  mockPrismaClient.userOrganization.findFirst.mockResolvedValue(null);
}

// ============================================================================
// getCurrentMonth
// ============================================================================

describe("getCurrentMonth", () => {
  it("should return the current month in YYYY-MM format", () => {
    const result = getCurrentMonth();

    expect(result).toMatch(/^\d{4}-\d{2}$/);

    const [year, month] = result.split("-").map(Number);
    expect(year).toBeGreaterThan(2000);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});

// ============================================================================
// getUserPlan
// ============================================================================

describe("getUserPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the planKey when an ACTIVE subscription exists", async () => {
    mockOrgMembership("pro");

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("pro");
  });

  it("should return 'free' when planKey is empty/null (truthy check fallback)", async () => {
    mockPrismaClient.userOrganization.findFirst.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      organization: { subscriptions: [{ status: "ACTIVE", planKey: "" }] },
    });

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("free");
  });

  it("should return 'free' when the subscription is not ACTIVE", async () => {
    mockOrgMembership("pro", "CANCELED");

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("free");
  });

  it("should return 'free' when no subscription exists", async () => {
    mockOrgMembership(null);

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("free");
  });

  it("should return 'free' when no membership is found", async () => {
    mockNoMembership();

    const plan = await getUserPlan("user-unknown");

    expect(plan).toBe("free");
  });

  it("should return 'free' when subscription exists but planKey is null (covers line 72 || fallback)", async () => {
    mockPrismaClient.userOrganization.findFirst.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      organization: {
        subscriptions: [{ status: "ACTIVE", planKey: null }],
      },
    });

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("free");
  });

  it("should return the planKey as-is when subscription has a custom planKey (covers line 72 truthy path)", async () => {
    mockPrismaClient.userOrganization.findFirst.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      organization: {
        subscriptions: [{ status: "ACTIVE", planKey: "enterprise" }],
      },
    });

    const plan = await getUserPlan("user-1");

    expect(plan).toBe("enterprise");
  });
});

// ============================================================================
// getPlanLimits
// ============================================================================

describe("getPlanLimits", () => {
  it("should return correct limits for the free plan", () => {
    const limits = getPlanLimits("free");

    expect(limits).toEqual({
      syncsPerMonth: 10,
      connectors: 2,
      documents: 100,
      aiFeatures: false,
      bidirectionalSync: false,
      multiUser: false,
      apiAccess: false,
      scheduledSync: false,
    });
  });

  it("should return correct limits for the pro plan", () => {
    const limits = getPlanLimits("pro");

    expect(limits).toEqual({
      syncsPerMonth: 100,
      connectors: 10,
      documents: Infinity,
      aiFeatures: true,
      bidirectionalSync: false,
      multiUser: false,
      apiAccess: true,
      scheduledSync: true,
    });
  });

  it("should return correct limits for the business plan (unlimited)", () => {
    const limits = getPlanLimits("business");

    expect(limits).toEqual({
      syncsPerMonth: Infinity,
      connectors: Infinity,
      documents: Infinity,
      aiFeatures: true,
      bidirectionalSync: true,
      multiUser: true,
      apiAccess: true,
      scheduledSync: true,
    });
  });
});

// ============================================================================
// getQuotaUsage
// ============================================================================

describe("getQuotaUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return quota usage with correct percent when quotaUsage exists (free plan)", async () => {
    mockOrgMembership("free");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 3,
    });
    mockPrismaClient.connector.count.mockResolvedValue(1);
    mockPrismaClient.document.count.mockResolvedValue(10);

    const result = await getQuotaUsage("user-1");

    expect(result).toEqual({
      syncCount: 3,
      syncLimit: 10,
      connectorCount: 1,
      connectorLimit: 2,
      documentCount: 10,
      documentLimit: 100,
      percentUsed: 30,
    });
  });

  it("should default syncCount to 0 and percent to 0 when no quotaUsage record exists", async () => {
    mockOrgMembership("free");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue(null);
    mockPrismaClient.connector.count.mockResolvedValue(0);
    mockPrismaClient.document.count.mockResolvedValue(0);

    const result = await getQuotaUsage("user-1");

    expect(result.syncCount).toBe(0);
    expect(result.percentUsed).toBe(0);
  });

  it("should return percentUsed 0 for non-free plans (pro)", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 50,
    });
    mockPrismaClient.connector.count.mockResolvedValue(5);
    mockPrismaClient.document.count.mockResolvedValue(20);

    const result = await getQuotaUsage("user-1");

    // Pro plan: percentUsed is always 0 (only free plan calculates percentage)
    expect(result.percentUsed).toBe(0);
    expect(result.syncCount).toBe(50);
    expect(result.syncLimit).toBe(100);
  });
});

// ============================================================================
// checkAndIncrementQuota
// ============================================================================

describe("checkAndIncrementQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return allowed true with infinite remaining for business plan (unlimited)", async () => {
    mockOrgMembership("business");

    const result = await checkAndIncrementQuota("user-1");

    expect(result).toEqual({ allowed: true, remaining: Infinity });
    // No quotaUsage calls for unlimited plans
    expect(mockPrismaClient.quotaUsage.upsert).not.toHaveBeenCalled();
    expect(mockPrismaClient.quotaUsage.updateMany).not.toHaveBeenCalled();
  });

  it("should return allowed true with remaining count when under the limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.upsert.mockResolvedValue({} as never);
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 5,
    });

    const result = await checkAndIncrementQuota("user-1");

    expect(result).toEqual({ allowed: true, remaining: 95 });
  });

  it("should return allowed false when the limit is reached", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.upsert.mockResolvedValue({} as never);
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 0,
    } as never);

    const result = await checkAndIncrementQuota("user-1");

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      upgradeUrl: "/pricing",
    });
  });

  it("should return remaining = limits.syncsPerMonth when updated record is null", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.upsert.mockResolvedValue({} as never);
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    // findUnique returns null after increment
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue(null);

    const result = await checkAndIncrementQuota("user-1");

    // When updated is null, syncCount defaults to 0 => remaining = 100 - 0 = 100
    expect(result).toEqual({ allowed: true, remaining: 100 });
  });
});

// ============================================================================
// decrementQuotaOnFailure
// ============================================================================

describe("decrementQuotaOnFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call quotaUsage.updateMany with decrement", async () => {
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 1,
    } as never);

    await decrementQuotaOnFailure("user-1");

    expect(mockPrismaClient.quotaUsage.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", month: expect.any(String) },
      data: { syncCount: { decrement: 1 } },
    });
  });

  it("should catch errors silently without throwing", async () => {
    mockPrismaClient.quotaUsage.updateMany.mockRejectedValue(
      new Error("DB error"),
    );

    await expect(decrementQuotaOnFailure("user-1")).resolves.toBeUndefined();
  });
});

// ============================================================================
// checkConnectorLimit
// ============================================================================

describe("checkConnectorLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return allowed true when under the connector limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.connector.count.mockResolvedValue(1);

    const result = await checkConnectorLimit("user-1");

    expect(result).toEqual({
      allowed: true,
      current: 1,
      limit: 10,
      upgradeUrl: undefined,
    });
  });

  it("should return allowed false when at the connector limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.connector.count.mockResolvedValue(10);

    const result = await checkConnectorLimit("user-1");

    expect(result).toEqual({
      allowed: false,
      current: 10,
      limit: 10,
      upgradeUrl: "/pricing",
    });
  });
});

// ============================================================================
// checkDocumentLimit
// ============================================================================

describe("checkDocumentLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return allowed true when under the document limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.document.count.mockResolvedValue(100);

    const result = await checkDocumentLimit("user-1");

    expect(result).toEqual({
      allowed: true,
      current: 100,
      limit: Infinity,
      upgradeUrl: undefined,
    });
  });

  it("should return allowed true (unlimited) for pro plan", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.document.count.mockResolvedValue(500);

    const result = await checkDocumentLimit("user-1");

    expect(result).toEqual({
      allowed: true,
      current: 500,
      limit: Infinity,
      upgradeUrl: undefined,
    });
  });

  it("should return allowed false with upgradeUrl when document limit exceeded", async () => {
    mockOrgMembership("free");
    mockPrismaClient.document.count.mockResolvedValue(100); // free plan limit is 100, not less than 100

    const result = await checkDocumentLimit("user-1");

    expect(result).toEqual({
      allowed: false,
      current: 100,
      limit: 100,
      upgradeUrl: "/pricing",
    });
  });
});

// ============================================================================
// getPlanFromPriceId
// ============================================================================

describe("getPlanFromPriceId", () => {
  const PRO_PRICE_ID = "price_pro_monthly_123";
  const BUSINESS_PRICE_ID = "price_business_monthly_456";

  beforeEach(() => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", PRO_PRICE_ID);
    vi.stubEnv("STRIPE_PRICE_BUSINESS_MONTHLY", BUSINESS_PRICE_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return 'pro' when priceId matches STRIPE_PRICE_PRO_MONTHLY", () => {
    const plan = getPlanFromPriceId(PRO_PRICE_ID);

    expect(plan).toBe("pro");
  });

  it("should return 'business' when priceId matches STRIPE_PRICE_BUSINESS_MONTHLY", () => {
    const plan = getPlanFromPriceId(BUSINESS_PRICE_ID);

    expect(plan).toBe("business");
  });

  it("should return 'free' when priceId does not match any known price", () => {
    const plan = getPlanFromPriceId("price_unknown_999");

    expect(plan).toBe("free");
  });

  it("should return 'free' when env vars are not defined", () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "");
    vi.stubEnv("STRIPE_PRICE_BUSINESS_MONTHLY", "");

    const plan = getPlanFromPriceId("any_price_id");

    expect(plan).toBe("free");
  });

  it("should return 'free' when priceId is empty string", () => {
    const plan = getPlanFromPriceId("");

    expect(plan).toBe("free");
  });
});

// ============================================================================
// getQuotaUsage — edge cases
// ============================================================================

describe("getQuotaUsage edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 100% percentUsed when syncCount equals free plan limit", async () => {
    mockOrgMembership("free");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 10,
    });
    mockPrismaClient.connector.count.mockResolvedValue(2);
    mockPrismaClient.document.count.mockResolvedValue(50);

    const { getQuotaUsage } = await import("../subscription");
    const result = await getQuotaUsage("user-1");

    expect(result.percentUsed).toBe(100);
    expect(result.syncCount).toBe(10);
    expect(result.syncLimit).toBe(10);
  });

  it("should return 0% percentUsed when syncCount is 0 on free plan (covers line 108 ternary)", async () => {
    mockOrgMembership("free");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 0,
    });
    mockPrismaClient.connector.count.mockResolvedValue(1);
    mockPrismaClient.document.count.mockResolvedValue(5);

    const { getQuotaUsage } = await import("../subscription");
    const result = await getQuotaUsage("user-1");

    expect(result.percentUsed).toBe(0);
    expect(result.syncCount).toBe(0);
    expect(result.syncLimit).toBe(10);
  });

  it("should return >100% percentUsed when syncCount exceeds free plan limit", async () => {
    mockOrgMembership("free");
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 15,
    });
    mockPrismaClient.connector.count.mockResolvedValue(2);
    mockPrismaClient.document.count.mockResolvedValue(50);

    const { getQuotaUsage } = await import("../subscription");
    const result = await getQuotaUsage("user-1");

    expect(result.percentUsed).toBe(150);
    expect(result.syncCount).toBe(15);
  });
});

// ============================================================================
// checkAndIncrementQuota — edge cases
// ============================================================================

describe("checkAndIncrementQuota edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return remaining = 0 when syncCount reaches the limit exactly (covers line 171 Math.max)", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.upsert.mockResolvedValue({} as never);
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    // syncCount = 100, limit = 100 → remaining = 0
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 100,
    });

    const { checkAndIncrementQuota } = await import("../subscription");
    const result = await checkAndIncrementQuota("user-1");

    expect(result).toEqual({ allowed: true, remaining: 0 });
  });

  it("should return correct remaining when syncCount is just under limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.quotaUsage.upsert.mockResolvedValue({} as never);
    mockPrismaClient.quotaUsage.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    // syncCount = 99, limit = 100 → remaining = 1
    mockPrismaClient.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 99,
    });

    const { checkAndIncrementQuota } = await import("../subscription");
    const result = await checkAndIncrementQuota("user-1");

    expect(result).toEqual({ allowed: true, remaining: 1 });
  });
});

// ============================================================================
// checkConnectorLimit — edge cases
// ============================================================================

describe("checkConnectorLimit edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return allowed false with upgradeUrl when exactly at limit", async () => {
    mockOrgMembership("free");
    mockPrismaClient.connector.count.mockResolvedValue(2); // free limit is 2

    const { checkConnectorLimit } = await import("../subscription");
    const result = await checkConnectorLimit("user-1");

    expect(result).toEqual({
      allowed: false,
      current: 2,
      limit: 2,
      upgradeUrl: "/pricing",
    });
  });
});

// ============================================================================
// checkDocumentLimit — edge cases
// ============================================================================

describe("checkDocumentLimit edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return allowed false with upgradeUrl when exactly at free plan limit (100 docs)", async () => {
    mockOrgMembership("free");
    mockPrismaClient.document.count.mockResolvedValue(100);

    const { checkDocumentLimit } = await import("../subscription");
    const result = await checkDocumentLimit("user-1");

    expect(result).toEqual({
      allowed: false,
      current: 100,
      limit: 100,
      upgradeUrl: "/pricing",
    });
  });
});
