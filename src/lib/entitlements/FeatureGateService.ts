/**
 * Feature Flags & Entitlements - Feature Gate Service
 * The ONLY source of truth for entitlements.
 */

import { EntitlementMap, DebugTrace, ConsumeResult, ResolveSource, FeatureType, UsageInfo, OverrideData } from "./types"
import { prisma } from "@/lib/prisma"

const DEFAULT_PLAN = "free"
const ACTIVE_STATUSES = ["ACTIVE", "TRIALING"]

export class FeatureGateService {
  // hasFeature - Check if a feature is enabled for an org
  async hasFeature(orgId: string, featureKey: string): Promise<boolean> {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } })
    if (!feature) return false

    const resolved = await this.resolveFeatureValue(orgId, featureKey, feature.type as FeatureType)
    return resolved.value as boolean
  }

  // getLimit - Get the numeric limit for a limit-type feature
  async getLimit(orgId: string, limitKey: string): Promise<number | null> {
    const feature = await prisma.feature.findUnique({ where: { key: limitKey } })
    if (!feature || feature.type !== "LIMIT") return null

    const resolved = await this.resolveFeatureValue(orgId, limitKey, "LIMIT")
    return resolved.value as number | null
  }

  // assertFeature - Throws if feature is not available
  async assertFeature(orgId: string, featureKey: string): Promise<void> {
    const hasIt = await this.hasFeature(orgId, featureKey)
    if (!hasIt) {
      const planKey = await this.getPlanKey(orgId)
      throw { code: "FEATURE_NOT_AVAILABLE", statusCode: 403, message: `Feature '${featureKey}' not available on ${planKey} plan` }
    }
  }

  // canConsume - Check if org can consume n units
  async canConsume(orgId: string, featureKey: string, amount: number = 1): Promise<boolean> {
    const limit = await this.getLimit(orgId, featureKey)
    if (limit === null) return true

    const usage = await this.getUsage(orgId, featureKey)
    return usage.remaining === null || usage.remaining >= amount
  }

  // consume - Atomically consume n units
  async consume(orgId: string, featureKey: string, amount: number = 1): Promise<ConsumeResult> {
    await this.assertFeature(orgId, featureKey)

    const limit = await this.getLimit(orgId, featureKey)

    if (limit === null) {
      await this.incrementUsage(orgId, featureKey, amount)
      const usage = await this.getUsage(orgId, featureKey)
      return { success: true, feature: featureKey, used: usage.used, limit: null, remaining: null, resetAt: usage.resetAt }
    }

    const canDo = await this.canConsume(orgId, featureKey, amount)
    if (!canDo) {
      const usage = await this.getUsage(orgId, featureKey)
      throw { code: "LIMIT_REACHED", statusCode: 402, message: `Limit reached for '${featureKey}'`, limit, used: usage.used }
    }

    await this.incrementUsage(orgId, featureKey, amount)
    const usage = await this.getUsage(orgId, featureKey)

    return { success: true, feature: featureKey, used: usage.used, limit, remaining: usage.remaining, resetAt: usage.resetAt }
  }

  // getAllEntitlements - Get full entitlement map (cached)
  async getAllEntitlements(orgId: string): Promise<EntitlementMap> {
    const planKey = await this.getPlanKey(orgId)
    const planFeatures = await prisma.planFeature.findMany({
      where: { plan: { key: planKey } },
      include: { feature: true }
    })

    const features: Record<string, boolean> = {}
    const limits: Record<string, number | null> = {}
    const experiments: Record<string, { percentage: number; seed: string; enabled: boolean }> = {}

    for (const pf of planFeatures) {
      features[pf.feature.key] = pf.enabled
      if (pf.enabled) {
        if (pf.configJson && "percentage" in pf.configJson) {
          experiments[pf.feature.key] = { percentage: (pf.configJson.percentage as number) || 0, seed: (pf.configJson.seed as string) || pf.feature.key, enabled: false }
        } else if (pf.limitValue !== null) {
          limits[pf.feature.key] = pf.limitValue === -1 ? null : pf.limitValue
        }
      }
    }

    return { planKey, features, limits, experiments }
  }

  // getDebugTrace - Detailed trace of how a feature was resolved
  async getDebugTrace(orgId: string, featureKey: string): Promise<DebugTrace> {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } })
    if (!feature) throw { code: "INVALID_FEATURE", statusCode: 400, message: `Feature '${featureKey}' not found` }

    const resolved = await this.resolveFeatureValue(orgId, featureKey, feature.type as FeatureType)
    const subscription = await this.getActiveSubscription(orgId)

    return { resolvedVia: resolved.source, value: resolved.value, featureKey, featureType: feature.type as FeatureType, planKey: resolved.planKey, orgId, subscriptionStatus: subscription?.status }
  }

  // invalidateCache - Manually invalidate cache (placeholder - implement with CacheService)
  async invalidateCache(orgId: string): Promise<void> {
    console.log(`[FeatureGate] Cache invalidated for org: ${orgId}`)
  }

  // Private methods
  private async getActiveSubscription(orgId: string) {
    return prisma.subscription.findUnique({ where: { organizationId: orgId } })
  }

  private async getPlanKey(orgId: string): Promise<string> {
    const sub = await this.getActiveSubscription(orgId)
    return sub?.planKey ?? DEFAULT_PLAN
  }

  private async resolveFeatureValue(orgId: string, featureKey: string, featureType: FeatureType) {
    const subscription = await this.getActiveSubscription(orgId)
    if (!subscription) return { value: featureType === "LIMIT" ? 0 : false, source: "fallback" as ResolveSource }

    const planKey = subscription.planKey
    const planFeatures = await prisma.planFeature.findMany({
      where: { plan: { key: planKey }, feature: { key: featureKey } },
      include: { feature: true }
    })

    const featureConfig = planFeatures[0]
    const planEnabled = featureConfig?.enabled ?? false
    const planLimit = featureConfig?.limitValue

    // Check org override
    const orgOverride = await prisma.entitlementOverride.findFirst({
      where: { scope: "ORG", scopeId: orgId, featureKey, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
    })

    if (orgOverride) {
      return { value: orgOverride.enabled, source: "org_override" as ResolveSource, override: orgOverride, planKey, limitValue: orgOverride.limitValue }
    }

    if (featureType === "LIMIT") {
      const limitValue = planLimit === -1 ? null : planLimit
      return { value: planEnabled ? (limitValue ?? 0) : 0, source: planEnabled ? "plan" as ResolveSource : "fallback" as ResolveSource, planKey, limitValue }
    }

    return { value: planEnabled, source: planEnabled ? "plan" as ResolveSource : "fallback" as ResolveSource, planKey, limitValue: planLimit }
  }

  private async getUsage(orgId: string, featureKey: string): Promise<UsageInfo> {
    const limit = await this.getLimit(orgId, featureKey)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const usage = await prisma.usageTracking.findUnique({
      where: { organizationId_featureKey_periodStart: { organizationId: orgId, featureKey, periodStart: startOfMonth } }
    })

    const used = usage?.usageCount ?? 0
    let remaining: number | null = limit === null ? null : Math.max(0, limit - used)

    return { used, limit, resetAt: endOfMonth, remaining }
  }

  private async incrementUsage(orgId: string, featureKey: string, amount: number) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    await prisma.usageTracking.upsert({
      where: { organizationId_featureKey_periodStart: { organizationId: orgId, featureKey, periodStart: startOfMonth } },
      create: { organizationId: orgId, featureKey, usageCount: amount, periodStart: startOfMonth, periodEnd: endOfMonth },
      update: { usageCount: { increment: amount } }
    })
  }
}

// Singleton
let instance: FeatureGateService | null = null
export function getFeatureGateService(): FeatureGateService {
  if (!instance) instance = new FeatureGateService()
  return instance
}