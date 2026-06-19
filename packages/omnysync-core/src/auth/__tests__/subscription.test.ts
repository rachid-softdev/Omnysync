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
});

// ============================================================================
// getPlanLimits
// ============================================================================

describe("getPlanLimits", () => {
  it("should return correct limits for the free plan", () => {
    const limits = getPlanLimits("free");

    expect(limits).toEqual({
      syncsPerMonth: 5,
      connectors: 2,
      documents: 50,
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
      documents: 500,
      aiFeatures: true,
      bidirectionalSync: false,
      multiUser: false,
      apiAccess: false,
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
      syncLimit: 5,
      connectorCount: 1,
      connectorLimit: 2,
      documentCount: 10,
      documentLimit: 50,
      percentUsed: 60,
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
      limit: 500,
      upgradeUrl: undefined,
    });
  });

  it("should return allowed false when at the document limit", async () => {
    mockOrgMembership("pro");
    mockPrismaClient.document.count.mockResolvedValue(500);

    const result = await checkDocumentLimit("user-1");

    expect(result).toEqual({
      allowed: false,
      current: 500,
      limit: 500,
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
});
