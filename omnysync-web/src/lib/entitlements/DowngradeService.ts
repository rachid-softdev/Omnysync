/**
 * Feature Flags & Entitlements - Downgrade Service
 * Omnysync - 2026
 *
 * Handles subscription downgrades with configurable strategies:
 * - graceful: Keep access until period end, then cut (sends email at J-7)
 * - immediate: Cut access immediately when downgrade is triggered
 * - freeze: Block new actions, keep existing data
 *
 * Simplified implementation: graceful by default (per user request)
 */

import type { DowngradePreview, DowngradeStrategy } from './types'
import { getEntitlementRepository } from './EntitlementRepository'
import { getFeatureGateService } from './FeatureGateService'

export class DowngradeService {
  /**
   * Get preview of what features will be affected by a downgrade
   * Used for admin UI to show impact before making changes
   */
  async getDowngradePreview(orgId: string, targetPlanKey: string): Promise<DowngradePreview> {
    const repo = getEntitlementRepository()
    return repo.getDowngradePreview(orgId, targetPlanKey)
  }

  /**
   * Calculate the effective downgrade strategy for a feature
   * Uses the plan's configured strategy, but considers usage
   */
  calculateEffectiveStrategy(feature: DowngradePreview['features'][0]): DowngradeStrategy {
    if (!feature.willBeAffected) {
      return 'GRACEFUL' // Not affected, no action needed
    }

    const strategy = feature.downgradeStrategy

    // If there are active users, default to graceful to avoid disrupting them
    if (strategy === 'IMMEDIATE' && feature.hasActiveUsage) {
      return 'GRACEFUL'
    }

    return strategy
  }

  /**
   * Check if the organization can proceed with a downgrade
   * Returns warnings about features that will be affected
   */
  async validateDowngrade(
    orgId: string,
    targetPlanKey: string
  ): Promise<{
    canProceed: boolean
    warnings: string[]
    affectedFeatures: number
  }> {
    const preview = await this.getDowngradePreview(orgId, targetPlanKey)

    const affectedFeatures = preview.features.filter((f) => f.willBeAffected)
    const warnings: string[] = []

    for (const feature of affectedFeatures) {
      const strategy = this.calculateEffectiveStrategy(feature)

      if (strategy === 'IMMEDIATE') {
        warnings.push(`${feature.featureName}: Access will be cut immediately`)
      } else if (strategy === 'GRACEFUL') {
        if (feature.hasActiveUsage) {
          warnings.push(`${feature.featureName}: Users will lose access at period end`)
        }
      } else if (strategy === 'FREEZE') {
        warnings.push(`${feature.featureName}: New actions will be blocked, data preserved`)
      }
    }

    // Always allow downgrade (warnings are for informational purposes)
    return {
      canProceed: true,
      warnings,
      affectedFeatures: affectedFeatures.length,
    }
  }

  /**
   * Apply the downgrade - invalidate cache and optionally send notifications
   * The actual feature cutting is handled by FeatureGateService
   * which checks subscription status and period end dates
   */
  async applyDowngrade(
    orgId: string,
    targetPlanKey: string,
    notifyUsers: boolean = false
  ): Promise<{
    success: boolean
    featuresAffected: number
    notificationsSent?: number
  }> {
    const preview = await this.getDowngradePreview(orgId, targetPlanKey)
    const affectedCount = preview.features.filter((f) => f.willBeAffected).length

    // Invalidate cache so FeatureGateService picks up new plan
    const featureGate = getFeatureGateService()
    await featureGate.invalidateCache(orgId)

    // If we need to notify users (scheduled for later)
    let notificationsSent = 0
    if (notifyUsers) {
      // TODO: Implement email notification
      // This would send a batch email to all org users
      // warning them about the upcoming feature changes
      notificationsSent = 0 // Placeholder
    }

    console.log(
      `[DowngradeService] Applied downgrade for org ${orgId} to ${targetPlanKey}. ` +
        `Affected ${affectedCount} features.`
    )

    return {
      success: true,
      featuresAffected: affectedCount,
      notificationsSent: notifyUsers ? notificationsSent : undefined,
    }
  }

  /**
   * Check if an organization has "grace period" access
   * (i.e., was downgraded but still has access until period end)
   */
  async hasGracePeriodAccess(orgId: string): Promise<boolean> {
    const repo = getEntitlementRepository()
    const subscription = await repo.getActiveSubscription(orgId)

    if (!subscription) return false

    // If subscription is active, no grace period needed
    if (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') {
      return false
    }

    // Check if period has ended
    if (subscription.currentPeriodEnd) {
      return new Date(subscription.currentPeriodEnd) > new Date()
    }

    return false
  }

  /**
   * Get list of features that are in grace period (plan downgraded but still accessible)
   */
  async getGracePeriodFeatures(orgId: string): Promise<string[]> {
    const hasGrace = await this.hasGracePeriodAccess(orgId)

    if (!hasGrace) return []

    const preview = await this.getDowngradePreview(orgId, 'free')

    // Return features that were affected but might still be accessible
    return preview.features
      .filter((f) => f.willBeAffected && f.downgradeStrategy === 'GRACEFUL')
      .map((f) => f.featureKey)
  }

  /**
   * Determine if feature access should be granted based on downgrade strategy
   * This is called by FeatureGateService when checking access
   */
  shouldGrantAccess(
    isCurrentlyEnabled: boolean,
    newPlanEnabled: boolean,
    strategy: DowngradeStrategy,
    subscriptionEndDate?: Date | null
  ): boolean {
    // If going from disabled to disabled, no change
    if (!isCurrentlyEnabled && !newPlanEnabled) {
      return false
    }

    // If going from disabled to enabled, always allow
    if (!isCurrentlyEnabled && newPlanEnabled) {
      return true
    }

    // If going from enabled to disabled
    if (isCurrentlyEnabled && !newPlanEnabled) {
      switch (strategy) {
        case 'GRACEFUL':
          // Check if we're still in the billing period
          if (subscriptionEndDate && new Date(subscriptionEndDate) > new Date()) {
            return true // Keep access until period end
          }
          return false // Period ended, cut access

        case 'IMMEDIATE':
          return false // Cut immediately

        case 'FREEZE':
          return true // Keep access but block new actions (handled elsewhere)

        default:
          return false
      }
    }

    // Otherwise maintain current state
    return isCurrentlyEnabled
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let downgradeServiceInstance: DowngradeService | null = null

export function getDowngradeService(): DowngradeService {
  if (!downgradeServiceInstance) {
    downgradeServiceInstance = new DowngradeService()
  }
  return downgradeServiceInstance
}

export function setDowngradeService(service: DowngradeService): void {
  downgradeServiceInstance = service
}

export function resetDowngradeService(): void {
  downgradeServiceInstance = null
}
