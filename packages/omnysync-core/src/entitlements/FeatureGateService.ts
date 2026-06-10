/**
 * Feature Flags & Entitlements - Feature Gate Service
 * Omnysync - 2026
 *
 * This is the CENTRAL SERVICE - the ONLY source of truth for entitlements.
 * No endpoint should have any plan-checking logic (no if(plan === "PRO")).
 * All access control goes through this service.
 *
 * Methods:
 * - hasFeature(orgId, featureKey) → Promise<boolean>
 * - getLimit(orgId, limitKey) → Promise<number | null>
 * - assertFeature(orgId, featureKey) → Promise<void> // throws 403
 * - canConsume(orgId, featureKey, n?) → Promise<boolean>
 * - consume(orgId, featureKey, n?) → Promise<ConsumeResult>
 * - getAllEntitlements(orgId) → Promise<EntitlementsResponse>
 * - getDebugTrace(orgId, featureKey) → Promise<DebugTrace>
 * - invalidateCache(orgId) → Promise<void>
 */

import type {
  EntitlementMap,
  EntitlementsResponse,
  DebugTrace,
  ConsumeResult,
  ResolveSource,
  FeatureType,
  UsageInfo,
  Json,
} from "./types";
import type { ExperimentService } from "./ExperimentService";
import { getEntitlementRepository } from "./EntitlementRepository";
import type {
  IEntitlementRepository,
  OverrideData,
} from "./EntitlementRepository";
import { getCacheService } from "./CacheService";
import type { CacheService } from "./CacheService";
import {
  FeatureNotAvailableError,
  LimitReachedError,
  InvalidFeatureError,
} from "./errors";

// ============================================================================
// SERVICE CONFIG
// ============================================================================

export interface FeatureGateConfig {
  repository?: IEntitlementRepository;
  cacheService?: CacheService;
  experimentService?: ExperimentService;
}

export class FeatureGateService {
  private repo: IEntitlementRepository;
  private cache: CacheService;

  constructor(config: FeatureGateConfig = {}) {
    this.repo = config.repository ?? getEntitlementRepository();
    this.cache = config.cacheService ?? getCacheService();
  }

  // ============================================================================
  // hasFeature - Check if a feature is enabled for an org
  // ============================================================================

  async hasFeature(orgId: string, featureKey: string): Promise<boolean> {
    // Validate feature exists
    const feature = await this.repo.getFeature(featureKey);
    if (!feature) {
      console.warn(`[FeatureGate] Feature not found: ${featureKey}`);
      return false;
    }

    // Resolution order: user override → org override → plan → fallback
    const resolved = await this.resolveFeatureValue(
      orgId,
      featureKey,
      feature.type,
    );

    return resolved.value as boolean;
  }

  // ============================================================================
  // getLimit - Get the numeric limit for a limit-type feature
  // ============================================================================

  async getLimit(orgId: string, limitKey: string): Promise<number | null> {
    // Validate feature exists
    const feature = await this.repo.getFeature(limitKey);
    if (!feature || feature.type !== "LIMIT") {
      // For features that don't exist in DB, check default plan config
      // This is a fallback for migration
      return null;
    }

    const resolved = await this.resolveFeatureValue(orgId, limitKey, "LIMIT");
    return resolved.value as number | null;
  }

  // ============================================================================
  // assertFeature - Throws 403 if feature is not available
  // ============================================================================

  async assertFeature(orgId: string, featureKey: string): Promise<void> {
    const hasIt = await this.hasFeature(orgId, featureKey);

    if (!hasIt) {
      const planKey = await this.repo.getPlanKey(orgId);
      const feature = await this.repo.getFeature(featureKey);

      throw new FeatureNotAvailableError(
        featureKey,
        planKey,
        feature?.type === "LIMIT" ? "Pro" : undefined,
      );
    }
  }

  // ============================================================================
  // canConsume - Check if org can consume n units (default 1)
  // ============================================================================

  async canConsume(
    orgId: string,
    featureKey: string,
    amount: number = 1,
  ): Promise<boolean> {
    // Get the limit for this feature
    const limit = await this.getLimit(orgId, featureKey);

    // null = unlimited
    if (limit === null) {
      return true;
    }

    // Get current usage
    const usage = await this.getUsage(orgId, featureKey);

    return usage.remaining === null || usage.remaining >= amount;
  }

  // ============================================================================
  // consume - Atomically consume n units (default 1)
  // ============================================================================

  async consume(
    orgId: string,
    featureKey: string,
    amount: number = 1,
  ): Promise<ConsumeResult> {
    // Check feature is enabled first
    await this.assertFeature(orgId, featureKey);

    // Get limit
    const limit = await this.getLimit(orgId, featureKey);

    // Atomically consume with limit check
    const result = await this.repo.consumeUsage(
      orgId,
      featureKey,
      amount,
      limit,
    );

    if (!result.success) {
      const usage = await this.getUsage(orgId, featureKey);
      throw new LimitReachedError(
        featureKey,
        limit ?? 0,
        usage.used,
        usage.resetAt.toISOString(),
      );
    }

    // Invalidate cache after consumption
    await this.invalidateCache(orgId);

    return {
      success: true,
      feature: featureKey,
      used: result.newUsageCount,
      limit,
      remaining:
        limit !== null ? Math.max(0, limit - result.newUsageCount) : null,
      resetAt: this.getNextResetDate(),
    };
  }

  // ============================================================================
  // getAllEntitlements - Get full entitlement map (cached)
  // ============================================================================

  async getAllEntitlements(orgId: string): Promise<EntitlementsResponse> {
    // Try cache first
    const cached = await this.cache.get(orgId);

    if (cached) {
      return this.toEntitlementsResponse(cached, {});
    }

    // Fetch from DB via repository
    const entitlements = await this.repo.getEntitlementMap(orgId);

    // Fetch usage for limit features
    const usage: Record<string, number> = {};
    for (const featureKey of Object.keys(entitlements.features)) {
      const usageData = await this.repo.getUsageTracking(orgId, featureKey);
      if (usageData) {
        usage[featureKey] = usageData.usageCount;
      }
    }

    // Cache & return
    await this.cache.set(orgId, entitlements);

    return this.toEntitlementsResponse(entitlements, usage);
  }

  // ============================================================================
  // getDebugTrace - Detailed trace of how a feature was resolved
  // ============================================================================

  async getDebugTrace(orgId: string, featureKey: string): Promise<DebugTrace> {
    const feature = await this.repo.getFeature(featureKey);

    if (!feature) {
      throw new InvalidFeatureError(featureKey);
    }

    const resolved = await this.resolveFeatureValue(
      orgId,
      featureKey,
      feature.type,
    );

    const subscription = await this.repo.getActiveSubscription(orgId);

    return {
      resolvedVia: resolved.source,
      value: resolved.value,
      featureKey,
      featureType: feature.type,
      overrideId: resolved.override?.id,
      overrideScope: resolved.override?.scope,
      overrideExpiresAt: resolved.override?.expiresAt ?? undefined,
      planKey: resolved.planKey,
      planLimit: resolved.limitValue ?? undefined,
      defaultConfig: (feature.defaultConfig ?? undefined) as Json | undefined,
      subscriptionStatus: subscription?.status,
      orgId,
    };
  }

  // ============================================================================
  // invalidateCache - Manually invalidate cache for an org
  // ============================================================================

  async invalidateCache(orgId: string): Promise<void> {
    await this.cache.delete(orgId);
    console.log(`[FeatureGate] Cache invalidated for org: ${orgId}`);
  }

  // ============================================================================
  // PRIVATE: RESOLUTION LOGIC
  // ============================================================================

  private async resolveFeatureValue(
    orgId: string,
    featureKey: string,
    featureType: FeatureType,
  ): Promise<{
    value: boolean | number | null;
    source: ResolveSource;
    override?: OverrideData;
    planKey?: string;
    limitValue?: number | null;
  }> {
    // 1. Check subscription is active
    const subscription = await this.repo.getActiveSubscription(orgId);

    if (!subscription) {
      // No active subscription - use fallback
      return {
        value: featureType === "LIMIT" ? 0 : false,
        source: "fallback",
      };
    }

    const planKey = subscription.planKey;
    const planFeatures = await this.repo.getPlanFeatures(planKey);
    const featureConfig = planFeatures.find((f) => f.featureKey === featureKey);

    // 2. Check if feature is enabled at plan level
    const planEnabled = featureConfig?.enabled ?? false;
    const planLimit = featureConfig?.limitValue;

    // For experiments, return the config
    if (featureType === "EXPERIMENT" && planEnabled) {
      return {
        value: true, // Experiment is "enabled" at plan level
        source: "plan",
        planKey,
        limitValue: planLimit,
      };
    }

    // For boolean features
    if (featureType === "BOOLEAN") {
      // Check user override
      // Note: user override would need userId passed in - skipping for now
      // In a full implementation, we'd pass userId through the call chain

      // Check org override
      const orgOverride = await this.repo.getOrgOverride(orgId, featureKey);

      if (orgOverride) {
        return {
          value: orgOverride.enabled,
          source: "org_override",
          override: orgOverride,
          planKey,
          limitValue: planLimit,
        };
      }

      // Fall back to plan
      return {
        value: planEnabled,
        source: planEnabled ? "plan" : "fallback",
        planKey,
        limitValue: planLimit,
      };
    }

    // For limit features
    if (featureType === "LIMIT") {
      // Check org override for limit
      const orgOverride = await this.repo.getOrgOverride(orgId, featureKey);

      if (orgOverride && orgOverride.limitValue !== null) {
        return {
          value: orgOverride.limitValue,
          source: "org_override",
          override: orgOverride,
          planKey,
          limitValue: orgOverride.limitValue,
        };
      }

      // Fall back to plan limit
      // -1 means unlimited (convert to null for external API)
      const limitValue = planLimit === -1 ? null : planLimit;

      return {
        value: planEnabled ? (limitValue ?? 0) : 0,
        source: planEnabled ? "plan" : "fallback",
        planKey,
        limitValue,
      };
    }

    // Fallback (dead code: all FeatureType values are handled above)
    return {
      value: false,
      source: "fallback",
    };
  }

  // ============================================================================
  // PRIVATE: USAGE HELPERS
  // ============================================================================

  private async getUsage(
    orgId: string,
    featureKey: string,
  ): Promise<UsageInfo> {
    const limit = await this.getLimit(orgId, featureKey);
    const usage = await this.repo.getUsageTracking(orgId, featureKey);

    const used = usage?.usageCount ?? 0;

    let remaining: number | null;
    if (limit === null) {
      remaining = null; // Unlimited
    } else {
      remaining = Math.max(0, limit - used);
    }

    return {
      used,
      limit,
      resetAt: this.getNextResetDate(),
      remaining,
    };
  }

  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  private toEntitlementsResponse(
    map: EntitlementMap,
    usage: Record<string, number>,
  ): EntitlementsResponse {
    return {
      plan: map.planKey,
      features: map.features,
      limits: map.limits,
      usage,
      resetAt: {},
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let featureGateInstance: FeatureGateService | null = null;

export function getFeatureGateService(
  config?: FeatureGateConfig,
): FeatureGateService {
  if (!featureGateInstance) {
    featureGateInstance = new FeatureGateService(config);
  }
  return featureGateInstance;
}

export function setFeatureGateService(service: FeatureGateService): void {
  featureGateInstance = service;
}

// For testing
export function resetFeatureGateService(): void {
  featureGateInstance = null;
}

// Lazy Proxy for backward compatibility
export const featureGate = new Proxy<FeatureGateService>(
  {} as FeatureGateService,
  {
    get(_, prop) {
      return getFeatureGateService()[prop as keyof FeatureGateService];
    },
  },
);
