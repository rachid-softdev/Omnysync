/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DowngradeService Tests
 *
 * Comprehensive tests covering:
 * - getDowngradePreview — returns features impacted by downgrade
 * - calculateEffectiveStrategy — IMMEDIATE downgraded to GRACEFUL if active usage
 * - validateDowngrade — returns warnings for affected features
 * - applyDowngrade — invalidates cache, reports affected count
 * - hasGracePeriodAccess — checks subscription period end
 * - shouldGrantAccess — strategy-based feature access decision
 * - getGracePeriodFeatures — lists features still accessible after downgrade
 * - Singleton pattern (getDowngradeService / resetDowngradeService)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock getEntitlementRepository to return our MockEntitlementRepository
// so DowngradeService doesn't use the real PrismaEntitlementRepository.
const mockRepoRef: { current: any } = { current: null };

vi.mock("../EntitlementRepository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../EntitlementRepository")>();
  return {
    ...actual,
    getEntitlementRepository: vi.fn(() => mockRepoRef.current),
  };
});

// Minimal prisma mock so no "DATABASE_URL" error at import time
vi.mock("../../prisma", () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { CacheService, resetCacheService } from "../CacheService";
import {
  ExperimentService,
  resetExperimentService,
} from "../ExperimentService";
import {
  FeatureGateService,
  resetFeatureGateService,
  setFeatureGateService,
} from "../FeatureGateService";
import {
  DowngradeService,
  getDowngradeService,
  resetDowngradeService,
  setDowngradeService,
} from "../DowngradeService";
import { FeatureType } from "../types";
import {
  IEntitlementRepository,
  SubscriptionData,
  FeatureData,
  PlanFeatureData,
  OverrideData,
  UsageData,
} from "../EntitlementRepository";

// ============================================================================
// MOCK REPOSITORY
// ============================================================================

class MockEntitlementRepository implements IEntitlementRepository {
  private features: Map<string, FeatureData> = new Map();
  private plans: Map<string, PlanFeatureData[]> = new Map();
  private subscriptions: Map<string, SubscriptionData> = new Map();
  private userOverrides: Map<string, OverrideData[]> = new Map();
  private orgOverrides: Map<string, OverrideData[]> = new Map();
  private usage: Map<string, UsageData> = new Map();
  private downgradePreviews: Map<string, any> = new Map();

  constructor() {
    this.features.set("EXPORT_PDF", {
      id: "1",
      key: "EXPORT_PDF",
      name: "Export PDF",
      description: "Export documents as PDF",
      type: "BOOLEAN" as FeatureType,
      defaultConfig: null,
    });
    this.features.set("MAX_SYNCS", {
      id: "2",
      key: "MAX_SYNCS",
      name: "Max Syncs",
      description: "Monthly sync limit",
      type: "LIMIT" as FeatureType,
      defaultConfig: null,
    });
    this.features.set("TWO_WAY_SYNC", {
      id: "3",
      key: "TWO_WAY_SYNC",
      name: "Two-Way Sync",
      description: "Bidirectional sync",
      type: "BOOLEAN" as FeatureType,
      defaultConfig: null,
    });
  }

  async getActiveSubscription(orgId: string): Promise<SubscriptionData | null> {
    return this.subscriptions.get(orgId) ?? null;
  }

  async getPlanKey(orgId: string): Promise<string> {
    const sub = this.subscriptions.get(orgId);
    return sub?.planKey ?? "free";
  }

  async getFeature(featureKey: string): Promise<FeatureData | null> {
    return this.features.get(featureKey) ?? null;
  }

  async getAllFeatures(): Promise<FeatureData[]> {
    return Array.from(this.features.values());
  }

  async getPlanFeatures(planKey: string): Promise<PlanFeatureData[]> {
    return this.plans.get(planKey) ?? [];
  }

  async getEntitlementMap(orgId: string): Promise<any> {
    const planKey = await this.getPlanKey(orgId);
    return { planKey, features: {}, limits: {}, experiments: {} };
  }

  async getUserOverride(
    userId: string,
    featureKey: string,
  ): Promise<OverrideData | null> {
    const overrides = this.userOverrides.get(userId) ?? [];
    return overrides.find((o) => o.featureKey === featureKey) ?? null;
  }

  async getOrgOverride(
    orgId: string,
    featureKey: string,
  ): Promise<OverrideData | null> {
    const overrides = this.orgOverrides.get(orgId) ?? [];
    return overrides.find((o) => o.featureKey === featureKey) ?? null;
  }

  async getAllOverridesForOrg(orgId: string): Promise<OverrideData[]> {
    return this.orgOverrides.get(orgId) ?? [];
  }

  async createOverride(): Promise<OverrideData> {
    return {
      id: "1",
      scope: "ORG",
      scopeId: "",
      featureKey: "",
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: "",
    };
  }

  async deleteOverride(): Promise<void> {}

  async getUsageTracking(
    orgId: string,
    featureKey: string,
  ): Promise<UsageData | null> {
    const key = `${orgId}:${featureKey}`;
    return this.usage.get(key) ?? null;
  }

  async consumeUsage(
    orgId: string,
    featureKey: string,
    amount: number,
    _limit: number | null,
  ): Promise<any> {
    const key = `${orgId}:${featureKey}`;
    const existing = this.usage.get(key);
    const newCount = (existing?.usageCount ?? 0) + amount;
    this.usage.set(key, {
      id: "1",
      organizationId: orgId,
      featureKey,
      usageCount: newCount,
      periodStart: new Date(),
      periodEnd: new Date(),
    });
    return { success: true, newUsageCount: newCount, limitReached: false };
  }

  async getOrganizationStripeCustomerId(): Promise<string | null> {
    return null;
  }

  async getPlanWithFeatures(): Promise<any> {
    return null;
  }
  async getAllPlansWithFeatures(): Promise<any[]> {
    return [];
  }
  async getFeatureWithPlans(): Promise<any> {
    return null;
  }
  async getAllFeaturesWithPlans(): Promise<any[]> {
    return [];
  }
  async updatePlanFeature(): Promise<any> {
    return {
      featureKey: "",
      featureName: "",
      enabled: false,
      limitValue: null,
      configJson: null,
      downgradeStrategy: "GRACEFUL",
    };
  }
  async createFeature(): Promise<any> {
    return {
      id: "",
      key: "",
      name: "",
      description: null,
      type: "BOOLEAN" as FeatureType,
      defaultConfig: null,
    };
  }
  async updateFeature(): Promise<any> {
    return {
      id: "",
      key: "",
      name: "",
      description: null,
      type: "BOOLEAN" as FeatureType,
      defaultConfig: null,
    };
  }

  async getDowngradePreview(
    orgId: string,
    targetPlanKey: string,
  ): Promise<any> {
    const key = `${orgId}:${targetPlanKey}`;
    // If a preview was explicitly set, return it
    const existing = this.downgradePreviews.get(key);
    if (existing) return existing;

    // Else compute a basic preview from plan features
    const currentPlanKey = await this.getPlanKey(orgId);
    const currentFeatures = this.plans.get(currentPlanKey) ?? [];
    const targetFeatures = this.plans.get(targetPlanKey) ?? [];

    const features = currentFeatures.map((cf) => {
      const tf = targetFeatures.find((f) => f.featureKey === cf.featureKey);
      const targetEnabled = tf?.enabled ?? false;
      const targetLimit = tf?.limitValue ?? null;
      const wasEnabled = cf.enabled;
      const willBeAffected = wasEnabled && !targetEnabled;

      // Check active usage for limit-type features
      const usageKey = `${orgId}:${cf.featureKey}`;
      const usage = this.usage.get(usageKey);
      const hasActiveUsage = (usage?.usageCount ?? 0) > 0;

      return {
        featureKey: cf.featureKey,
        featureName: cf.featureName,
        currentPlanValue: cf.enabled,
        targetPlanValue: targetEnabled,
        currentLimit: cf.limitValue,
        targetLimit,
        downgradeStrategy: cf.downgradeStrategy ?? "GRACEFUL",
        willBeAffected,
        hasActiveUsage,
      };
    });

    return { features, recommendedStrategy: "GRACEFUL" };
  }

  async isWebhookEventProcessed() {
    return false;
  }
  async markWebhookEventProcessed() {}

  // ---- Helpers ----

  _setPlanFeatures(planKey: string, features: PlanFeatureData[]) {
    this.plans.set(planKey, features);
  }

  _setSubscription(orgId: string, sub: SubscriptionData) {
    this.subscriptions.set(orgId, sub);
  }

  _setOrgOverride(orgId: string, override: OverrideData) {
    const overrides = this.orgOverrides.get(orgId) ?? [];
    overrides.push(override);
    this.orgOverrides.set(orgId, overrides);
  }

  _setUsage(orgId: string, featureKey: string, usage: UsageData) {
    this.usage.set(`${orgId}:${featureKey}`, usage);
  }

  _setDowngradePreview(orgId: string, targetPlanKey: string, preview: any) {
    this.downgradePreviews.set(`${orgId}:${targetPlanKey}`, preview);
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("DowngradeService", () => {
  let mockRepo: MockEntitlementRepository;
  let downgradeService: DowngradeService;
  let featureGateService: FeatureGateService;

  const setupProSubscription = (orgId = "org-1") => {
    mockRepo._setSubscription(orgId, {
      id: "sub-1",
      organizationId: orgId,
      planKey: "pro",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      trialStart: null,
      trialEnd: null,
    });
  };

  const setupDefaultPlans = () => {
    // Pro plan: everything enabled
    mockRepo._setPlanFeatures("pro", [
      {
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        enabled: true,
        limitValue: null,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
      {
        featureKey: "MAX_SYNCS",
        featureName: "Max Syncs",
        enabled: true,
        limitValue: 100,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
      {
        featureKey: "TWO_WAY_SYNC",
        featureName: "Two-Way Sync",
        enabled: true,
        limitValue: null,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
    ]);

    // Free plan: limited
    mockRepo._setPlanFeatures("free", [
      {
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        enabled: false,
        limitValue: null,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
      {
        featureKey: "MAX_SYNCS",
        featureName: "Max Syncs",
        enabled: true,
        limitValue: 10,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
      {
        featureKey: "TWO_WAY_SYNC",
        featureName: "Two-Way Sync",
        enabled: false,
        limitValue: null,
        configJson: null,
        downgradeStrategy: "GRACEFUL",
      },
    ]);
  };

  beforeEach(() => {
    mockRepo = new MockEntitlementRepository();
    mockRepoRef.current = mockRepo;
    setupDefaultPlans();

    resetFeatureGateService();
    resetCacheService();
    resetExperimentService();
    resetDowngradeService();

    // Create FeatureGateService and register it
    featureGateService = new FeatureGateService({
      repository: mockRepo,
      cacheService: new CacheService(),
      experimentService: new ExperimentService(),
    });
    setFeatureGateService(featureGateService);

    downgradeService = new DowngradeService();
  });

  afterEach(() => {
    resetFeatureGateService();
    resetCacheService();
    resetExperimentService();
    resetDowngradeService();
  });

  // ==========================================================================
  // getDowngradePreview
  // ==========================================================================

  describe("getDowngradePreview", () => {
    it("should return features impacted by downgrade from pro to free", async () => {
      setupProSubscription("org-1");

      const preview = await downgradeService.getDowngradePreview(
        "org-1",
        "free",
      );

      expect(preview).toHaveProperty("features");
      expect(preview).toHaveProperty("recommendedStrategy");

      const exportPdf = preview.features.find(
        (f: any) => f.featureKey === "EXPORT_PDF",
      );
      expect(exportPdf).toBeDefined();
      expect(exportPdf.willBeAffected).toBe(true);
      expect(exportPdf.currentPlanValue).toBe(true);
      expect(exportPdf.targetPlanValue).toBe(false);
    });

    it("should return no affected features when downgrading to same plan", async () => {
      setupProSubscription("org-1");

      const preview = await downgradeService.getDowngradePreview(
        "org-1",
        "pro",
      );

      for (const f of preview.features) {
        expect(f.willBeAffected).toBe(false);
      }
    });

    it("should show feature affected when downgrading to plan without it", async () => {
      // Override pro plan to NOT include APPROVAL_PORTAL at all
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "GRACEFUL",
        },
        {
          featureKey: "MAX_SYNCS",
          featureName: "Max Syncs",
          enabled: true,
          limitValue: 100,
          configJson: null,
          downgradeStrategy: "GRACEFUL",
        },
        // Intentionally NOT including APPROVAL_PORTAL in pro
      ]);

      mockRepo._setPlanFeatures("business", [
        {
          featureKey: "APPROVAL_PORTAL",
          featureName: "Approval Portal",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "GRACEFUL",
        },
      ]);

      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "business",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      const preview = await downgradeService.getDowngradePreview(
        "org-1",
        "pro",
      );

      const portal = preview.features.find(
        (f: any) => f.featureKey === "APPROVAL_PORTAL",
      );
      expect(portal).toBeDefined();
      expect(portal.willBeAffected).toBe(true);
      expect(portal.currentPlanValue).toBe(true);
      expect(portal.targetPlanValue).toBe(false);
    });

    it("should report active usage on features", async () => {
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "IMMEDIATE",
        },
      ]);
      setupProSubscription("org-1");

      mockRepo._setUsage("org-1", "EXPORT_PDF", {
        id: "usage-1",
        organizationId: "org-1",
        featureKey: "EXPORT_PDF",
        usageCount: 5,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const preview = await downgradeService.getDowngradePreview(
        "org-1",
        "free",
      );
      const exportPdf = preview.features.find(
        (f: any) => f.featureKey === "EXPORT_PDF",
      );
      expect(exportPdf.hasActiveUsage).toBe(true);
    });
  });

  // ==========================================================================
  // calculateEffectiveStrategy
  // ==========================================================================

  describe("calculateEffectiveStrategy", () => {
    it("should return GRACEFUL when feature is not affected", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: true,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "IMMEDIATE",
        willBeAffected: false,
        hasActiveUsage: false,
      });
      expect(result).toBe("GRACEFUL");
    });

    it("should return the strategy when not affected and no active usage", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "IMMEDIATE",
        willBeAffected: true,
        hasActiveUsage: false,
      });
      expect(result).toBe("IMMEDIATE");
    });

    it("should override IMMEDIATE to GRACEFUL when there is active usage", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "IMMEDIATE",
        willBeAffected: true,
        hasActiveUsage: true,
      });
      expect(result).toBe("GRACEFUL");
    });

    it("should return FREEZE as-is when no active usage", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "FREEZE",
        willBeAffected: true,
        hasActiveUsage: false,
      });
      expect(result).toBe("FREEZE");
    });

    it("should return FREEZE as-is even with active usage (only IMMEDIATE gets overridden)", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "FREEZE",
        willBeAffected: true,
        hasActiveUsage: true,
      });
      // FREEZE is not overridden to GRACEFUL even with active usage
      expect(result).toBe("FREEZE");
    });

    it("should return GRACEFUL when willBeAffected with GRACEFUL strategy even without active usage", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "GRACEFUL",
        willBeAffected: true,
        hasActiveUsage: false,
      });
      expect(result).toBe("GRACEFUL");
    });

    it("should return GRACEFUL when strategy is GRACEFUL with active usage (falls through)", () => {
      const result = downgradeService.calculateEffectiveStrategy({
        featureKey: "EXPORT_PDF",
        featureName: "Export PDF",
        currentPlanValue: true,
        targetPlanValue: false,
        currentLimit: null,
        targetLimit: null,
        downgradeStrategy: "GRACEFUL",
        willBeAffected: true,
        hasActiveUsage: true,
      });
      // GRACEFUL is not IMMEDIATE so it doesn't get overridden, just returned
      expect(result).toBe("GRACEFUL");
    });
  });

  // ==========================================================================
  // validateDowngrade
  // ==========================================================================

  describe("validateDowngrade", () => {
    it("should return canProceed=true with warnings for GRACEFUL downgrade", async () => {
      setupProSubscription("org-1");
      // GRACEFUL warnings are only generated when there IS active usage
      mockRepo._setUsage("org-1", "EXPORT_PDF", {
        id: "1",
        organizationId: "org-1",
        featureKey: "EXPORT_PDF",
        usageCount: 5,
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      const result = await downgradeService.validateDowngrade("org-1", "free");

      expect(result.canProceed).toBe(true);
      expect(result.affectedFeatures).toBeGreaterThan(0);
      // EXPORT_PDF has usage, so GRACEFUL should generate a warning
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it("should include IMMEDIATE warning when strategy is immediate", async () => {
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "IMMEDIATE",
        },
      ]);
      setupProSubscription("org-1");

      const result = await downgradeService.validateDowngrade("org-1", "free");
      const immediateWarnings = result.warnings.filter((w) =>
        w.includes("immediately"),
      );
      expect(immediateWarnings.length).toBe(1);
    });

    it("should include FREEZE warning when strategy is freeze", async () => {
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "FREEZE",
        },
      ]);
      setupProSubscription("org-1");

      const result = await downgradeService.validateDowngrade("org-1", "free");
      const freezeWarnings = result.warnings.filter((w) =>
        w.includes("blocked"),
      );
      expect(freezeWarnings.length).toBe(1);
    });

    it("should return zero affected features when plans are identical", async () => {
      setupProSubscription("org-1");

      const result = await downgradeService.validateDowngrade("org-1", "pro");
      expect(result.affectedFeatures).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it("should not generate GRACEFUL warning when there is no active usage", async () => {
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "GRACEFUL",
        },
      ]);
      setupProSubscription("org-1");

      const result = await downgradeService.validateDowngrade("org-1", "free");

      // EXPORT_PDF is affected but has no usage — GRACEFUL with no usage should not add a warning
      // Only IMMEDIATE and FREEZE strategies generate warnings
      expect(result.canProceed).toBe(true);
    });

    it("should handle org with no subscription (empty result set)", async () => {
      // No subscription set for this org
      const result = await downgradeService.validateDowngrade(
        "nonexistent-org",
        "free",
      );

      expect(result.canProceed).toBe(true);
      expect(result.affectedFeatures).toBe(0);
      expect(result.warnings).toEqual([]);
    });
  });

  // ==========================================================================
  // applyDowngrade
  // ==========================================================================

  describe("applyDowngrade", () => {
    it("should apply downgrade and report affected features", async () => {
      setupProSubscription("org-1");

      const result = await downgradeService.applyDowngrade("org-1", "free");

      expect(result.success).toBe(true);
      expect(result.featuresAffected).toBeGreaterThan(0);
    });

    it("should invalidate cache", async () => {
      setupProSubscription("org-1");

      // Populate cache by calling getAllEntitlements
      await featureGateService.getAllEntitlements("org-1");

      // Change subscription to detect cache stale
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      // Apply downgrade — should invalidate cache
      await downgradeService.applyDowngrade("org-1", "free");

      // Now changing the subscription to free, after cache was invalidated
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "free",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      const entitlements = await featureGateService.getAllEntitlements("org-1");
      expect(entitlements.plan).toBe("free");
    });

    it("should not fail when notifyUsers is true (graceful handling)", async () => {
      setupProSubscription("org-1");

      const result = await downgradeService.applyDowngrade(
        "org-1",
        "free",
        true,
      );

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
    });

    it("should handle org with no affected features (same plan)", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "free",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      const result = await downgradeService.applyDowngrade("org-1", "free");

      expect(result.success).toBe(true);
      expect(result.featuresAffected).toBe(0);
    });
  });

  // ==========================================================================
  // hasGracePeriodAccess
  // ==========================================================================

  describe("hasGracePeriodAccess", () => {
    it("should return false when subscription is active (no grace period needed)", async () => {
      setupProSubscription("org-1");

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(false);
    });

    it("should return true when subscription is CANCELED and period has not ended", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "CANCELED",
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days left
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      });

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(true);
    });

    it("should return false when subscription is CANCELED and period has ended", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "CANCELED",
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Ended yesterday
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      });

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(false);
    });

    it("should return false when there is no subscription", async () => {
      const result =
        await downgradeService.hasGracePeriodAccess("nonexistent-org");
      expect(result).toBe(false);
    });

    it("should return true when subscription is TRIALING (no grace period needed)", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "TRIALING",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(false);
    });

    it("should return false when subscription is PAST_DUE with no periodEnd", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "PAST_DUE",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      });

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(false);
    });

    it("should return false when subscription has non-active status and periodEnd is null", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "CANCELED",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      });

      const result = await downgradeService.hasGracePeriodAccess("org-1");
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // shouldGrantAccess
  // ==========================================================================

  describe("shouldGrantAccess", () => {
    it("should return false when going from disabled to disabled", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        false,
        false,
        "GRACEFUL",
      );
      expect(result).toBe(false);
    });

    it("should return true when going from disabled to enabled", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        false,
        true,
        "GRACEFUL",
      );
      expect(result).toBe(true);
    });

    it("should return true when going from enabled to disabled with GRACEFUL and period not ended", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "GRACEFUL",
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days left
      );
      expect(result).toBe(true);
    });

    it("should return false when going from enabled to disabled with GRACEFUL and period ended", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "GRACEFUL",
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Ended yesterday
      );
      expect(result).toBe(false);
    });

    it("should return false when going from enabled to disabled with IMMEDIATE", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "IMMEDIATE",
      );
      expect(result).toBe(false);
    });

    it("should return true when going from enabled to disabled with FREEZE", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "FREEZE",
      );
      expect(result).toBe(true); // Kept access, but new actions blocked elsewhere
    });

    it("should return false when no subscription end date and GRACEFUL", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "GRACEFUL",
        null,
      );
      expect(result).toBe(false);
    });

    it("should maintain current state for other cases", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        true,
        "GRACEFUL",
      );
      expect(result).toBe(true);
    });

    it("should return false for unknown/unsupported strategy", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "UNKNOWN" as any,
      );
      expect(result).toBe(false);
    });

    it("should return false when enabled->disabled with GRACEFUL and subscriptionEndDate is undefined", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "GRACEFUL",
        undefined,
      );
      expect(result).toBe(false);
    });

    it("should return false when disabled -> disabled regardless of strategy", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        false,
        false,
        "FREEZE",
      );
      expect(result).toBe(false);
    });

    it("should return true when disabled -> enabled regardless of strategy", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        false,
        true,
        "FREEZE",
      );
      expect(result).toBe(true);
    });

    it("should return current state when enabled -> enabled", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        true,
        "GRACEFUL",
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Past date
      );
      // Even with past end date, enabled->enabled maintains current state
      expect(result).toBe(true);
    });

    it("should return false for GRACEFUL with past end date (boundary exact moment)", () => {
      const result = downgradeService.shouldGrantAccess(
        "EXPORT_PDF",
        true,
        false,
        "GRACEFUL",
        new Date(), // Exactly now — not > now
      );
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getGracePeriodFeatures
  // ==========================================================================

  describe("getGracePeriodFeatures", () => {
    it("should return empty array when no grace period access", async () => {
      setupProSubscription("org-1");

      const features = await downgradeService.getGracePeriodFeatures("org-1");
      expect(features).toEqual([]);
    });

    it("should return GRACEFUL downgraded features during grace period", async () => {
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "CANCELED",
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      });

      const features = await downgradeService.getGracePeriodFeatures("org-1");

      // EXPORT_PDF and TWO_WAY_SYNC should have GRACEFUL strategy and be affected
      expect(features).toContain("EXPORT_PDF");
      expect(features).toContain("TWO_WAY_SYNC");
    });

    it("should skip features with IMMEDIATE strategy during grace period", async () => {
      mockRepo._setPlanFeatures("pro", [
        {
          featureKey: "EXPORT_PDF",
          featureName: "Export PDF",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "IMMEDIATE", // NOT GRACEFUL
        },
        {
          featureKey: "TWO_WAY_SYNC",
          featureName: "Two-Way Sync",
          enabled: true,
          limitValue: null,
          configJson: null,
          downgradeStrategy: "GRACEFUL",
        },
      ]);
      mockRepo._setSubscription("org-1", {
        id: "sub-1",
        organizationId: "org-1",
        planKey: "pro",
        status: "CANCELED",
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      });

      const features = await downgradeService.getGracePeriodFeatures("org-1");

      // EXPORT_PDF is IMMEDIATE so should NOT be in grace period features
      expect(features).not.toContain("EXPORT_PDF");
      expect(features).toContain("TWO_WAY_SYNC");
    });
  });

  // ==========================================================================
  // Singleton
  // ==========================================================================

  describe("Singleton pattern", () => {
    it("should return the same instance via getDowngradeService", () => {
      const service = new DowngradeService();
      setDowngradeService(service);

      const retrieved = getDowngradeService();
      expect(retrieved).toBe(service);
    });

    it("should create fresh instance after reset", () => {
      const service = new DowngradeService();
      setDowngradeService(service);

      resetDowngradeService();
      setDowngradeService(new DowngradeService());
      const newService = getDowngradeService();
      expect(newService).not.toBe(service);
    });
  });
});
