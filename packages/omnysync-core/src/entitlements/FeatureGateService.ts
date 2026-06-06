/**
 * Feature Flags & Entitlements - Feature Gate Service
 * Omnysync - 2026
 *
 * Resolves feature access by checking: plan entitlements → org overrides → user overrides
 * Handles quota consumption with race-condition-safe increments.
 */

import type {
  EntitlementMap,
  DebugTrace,
  ConsumeResult,
  EntitlementsResponse,
} from "./types";
import type { IEntitlementRepository } from "./EntitlementRepository";
import type { CacheService } from "./CacheService";
import type { ExperimentService } from "./ExperimentService";

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureGateConfig {
  repository: IEntitlementRepository;
  cacheService: CacheService;
  experimentService: ExperimentService;
}

// ============================================================================
// FEATURE GATE SERVICE
// ============================================================================

export class FeatureGateService {
  private repository: IEntitlementRepository;
  private cacheService: CacheService;
  private experimentService: ExperimentService;

  constructor(config: FeatureGateConfig) {
    this.repository = config.repository;
    this.cacheService = config.cacheService;
    this.experimentService = config.experimentService;
  }

  /**
   * Check if an organization has a feature enabled
   * Resolution order: user override → org override → plan → fallback
   */
  async hasFeature(orgId: string, featureKey: string): Promise<boolean> {
    const entitlements = await this.getAllEntitlements(orgId);
    return entitlements.features[featureKey] ?? false;
  }

  /**
   * Check if an organization can consume units of a limit feature
   */
  async canConsume(
    orgId: string,
    featureKey: string,
    amount: number,
  ): Promise<boolean> {
    const entitlements = await this.getAllEntitlements(orgId);
    const limit = entitlements.limits[featureKey];
    const used = entitlements.usage[featureKey] ?? 0;

    if (limit === null || limit === undefined) return true; // Unlimited
    return used + amount <= limit;
  }

  /**
   * Atomically consume units of a limit feature
   */
  async consume(
    orgId: string,
    featureKey: string,
    amount: number,
  ): Promise<ConsumeResult> {
    const repo = this.repository;
    const result = await repo.consumeUsage(orgId, featureKey, amount);

    // Invalidate cache after consumption
    await this.invalidateCache(orgId);

    const entitlements = await this.getAllEntitlements(orgId);
    const limit = entitlements.limits[featureKey] ?? null;

    return {
      success: result.success,
      feature: featureKey,
      used: result.newUsageCount,
      limit,
      remaining:
        limit !== null ? Math.max(0, limit - result.newUsageCount) : null,
      resetAt: new Date(),
    };
  }

  /**
   * Get all entitlements for an organization (cached)
   */
  async getAllEntitlements(orgId: string): Promise<EntitlementsResponse> {
    // Try cache first
    const cached = await this.cacheService.get(orgId);
    if (cached) {
      return this.toEntitlementsResponse(cached, {});
    }

    // Fetch from repository
    const planKey = await this.repository.getPlanKey(orgId);
    const features = await this.repository.getAllFeatures();
    const planFeatures = await this.repository.getPlanFeatures(planKey);
    const orgOverride = await this.repository.getAllOverridesForOrg(orgId);
    const subscription = await this.repository.getActiveSubscription(orgId);

    // Build entitlement map
    const entitlementMap: EntitlementMap = {
      planKey,
      features: {},
      limits: {},
      experiments: {},
    };

    for (const pf of planFeatures) {
      entitlementMap.features[pf.featureKey] = pf.enabled;
      if (pf.limitValue !== null) {
        entitlementMap.limits[pf.featureKey] = pf.limitValue;
      }
    }

    // Apply org overrides
    for (const ov of orgOverride) {
      if (ov.expiresAt && new Date(ov.expiresAt) < new Date()) continue;
      if (ov.enabled === false && entitlementMap.features[ov.featureKey]) {
        entitlementMap.features[ov.featureKey] = false;
      }
      if (ov.enabled === true) {
        entitlementMap.features[ov.featureKey] = true;
      }
      if (ov.limitValue !== null && ov.limitValue !== undefined) {
        entitlementMap.limits[ov.featureKey] = ov.limitValue;
      }
    }

    // Handle subscription status
    if (
      subscription &&
      (subscription.status === "CANCELED" ||
        subscription.status === "INCOMPLETE")
    ) {
      if (
        subscription.currentPeriodEnd &&
        new Date(subscription.currentPeriodEnd) < new Date()
      ) {
        // Subscription expired - disable features
        for (const key of Object.keys(entitlementMap.features)) {
          entitlementMap.features[key] = false;
        }
      }
    }

    // Cache the result
    await this.cacheService.set(orgId, entitlementMap);

    const usage: Record<string, number> = {};
    for (const feature of features) {
      const usageData = await this.repository.getUsageTracking(
        orgId,
        feature.key,
      );
      if (usageData) {
        usage[feature.key] = usageData.usageCount;
      }
    }

    return this.toEntitlementsResponse(entitlementMap, usage);
  }

  /**
   * Invalidate cache for an organization
   */
  async invalidateCache(orgId: string): Promise<void> {
    await this.cacheService.delete(orgId);
  }

  /**
   * Get debug trace for feature resolution
   */
  async getDebugTrace(orgId: string, featureKey: string): Promise<DebugTrace> {
    const planKey = await this.repository.getPlanKey(orgId);
    const orgOverride = await this.repository.getOrgOverride(orgId, featureKey);

    const trace: DebugTrace = {
      resolvedVia: "plan",
      value: false,
      featureKey,
      featureType: "BOOLEAN",
      planKey,
      orgId,
    };

    if (
      orgOverride &&
      (!orgOverride.expiresAt || new Date(orgOverride.expiresAt) > new Date())
    ) {
      trace.resolvedVia = "org_override";
      trace.value = orgOverride.enabled;
      trace.overrideId = orgOverride.id;
      trace.overrideScope = orgOverride.scope || "ORG";
      if (orgOverride.expiresAt)
        trace.overrideExpiresAt = orgOverride.expiresAt;
    } else {
      const planFeatures = await this.repository.getPlanFeatures(planKey);
      const pf = planFeatures.find((f) => f.featureKey === featureKey);
      if (pf) {
        trace.value = pf.enabled;
        trace.planLimit = pf.limitValue;
      }
    }

    return trace;
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

let featureGateServiceInstance: FeatureGateService | null = null;

export function getFeatureGateService(): FeatureGateService {
  if (!featureGateServiceInstance) {
    throw new Error(
      "FeatureGateService not initialized. Call setFeatureGateService(config) first.",
    );
  }
  return featureGateServiceInstance;
}

export function setFeatureGateService(service: FeatureGateService): void {
  featureGateServiceInstance = service;
}

export function resetFeatureGateService(): void {
  featureGateServiceInstance = null;
}

/**
 * Convenience function to check feature access
 */
export function featureGate(): FeatureGateService {
  return getFeatureGateService();
}
