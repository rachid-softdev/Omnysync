/**
 * DowngradeService Tests
 *
 * Comprehensive tests covering:
 * - calculateEffectiveStrategy (all combinations)
 * - validateDowngrade (warnings for each strategy)
 * - applyDowngrade (success path, notifications)
 * - hasGracePeriodAccess (subscription states)
 * - getGracePeriodFeatures (active/inactive grace)
 * - shouldGrantAccess (all strategy & state combos)
 * - Singleton pattern
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// MOCKS for dependencies
// ============================================================================

const mockGetDowngradePreview = vi.fn()
const mockGetActiveSubscription = vi.fn()
const mockInvalidateCache = vi.fn()

vi.mock('../EntitlementRepository', () => ({
  getEntitlementRepository: vi.fn(() => ({
    getDowngradePreview: mockGetDowngradePreview,
    getActiveSubscription: mockGetActiveSubscription,
  })),
  setEntitlementRepository: vi.fn(),
  resetEntitlementRepository: vi.fn(),
}))

vi.mock('../FeatureGateService', () => ({
  getFeatureGateService: vi.fn(() => ({
    invalidateCache: mockInvalidateCache,
  })),
}))

// ============================================================================
// IMPORTS
// ============================================================================

import { DowngradeService, getDowngradeService, resetDowngradeService } from '../DowngradeService'
import type { DowngradePreview, DowngradeStrategy } from '../types'

// ============================================================================
// HELPERS
// ============================================================================

function makeFeature(
  overrides: Partial<DowngradePreview['features'][0]> = {}
): DowngradePreview['features'][0] {
  return {
    featureKey: 'EXPORT_PDF',
    featureName: 'Export PDF',
    currentPlanValue: true,
    targetPlanValue: false,
    currentLimit: null,
    targetLimit: null,
    downgradeStrategy: 'GRACEFUL' as DowngradeStrategy,
    willBeAffected: true,
    hasActiveUsage: false,
    ...overrides,
  }
}

function makePreview(features: DowngradePreview['features'][]): DowngradePreview {
  return {
    features: features.flat(),
    recommendedStrategy: 'GRACEFUL',
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('DowngradeService', () => {
  let service: DowngradeService

  beforeEach(() => {
    vi.clearAllMocks()
    resetDowngradeService()
    service = new DowngradeService()
  })

  afterEach(() => {
    resetDowngradeService()
  })

  // ==========================================================================
  // getDowngradePreview
  // ==========================================================================

  describe('getDowngradePreview', () => {
    it('should call repository.getDowngradePreview with correct args', async () => {
      const expected: DowngradePreview = {
        features: [makeFeature()],
        recommendedStrategy: 'GRACEFUL',
      }
      mockGetDowngradePreview.mockResolvedValue(expected)

      const result = await service.getDowngradePreview('org-1', 'free')
      expect(mockGetDowngradePreview).toHaveBeenCalledWith('org-1', 'free')
      expect(result).toEqual(expected)
    })

    it('should propagate repository errors', async () => {
      mockGetDowngradePreview.mockRejectedValue(new Error('DB error'))
      await expect(service.getDowngradePreview('org-1', 'free')).rejects.toThrow('DB error')
    })
  })

  // ==========================================================================
  // calculateEffectiveStrategy
  // ==========================================================================

  describe('calculateEffectiveStrategy', () => {
    it('should return GRACEFUL when feature is not affected', () => {
      const feature = makeFeature({ willBeAffected: false, downgradeStrategy: 'IMMEDIATE' })
      expect(service.calculateEffectiveStrategy(feature)).toBe('GRACEFUL')
    })

    it('should escalate IMMEDIATE to GRACEFUL when there is active usage', () => {
      const feature = makeFeature({
        willBeAffected: true,
        downgradeStrategy: 'IMMEDIATE',
        hasActiveUsage: true,
      })
      expect(service.calculateEffectiveStrategy(feature)).toBe('GRACEFUL')
    })

    it('should keep IMMEDIATE when no active usage', () => {
      const feature = makeFeature({
        willBeAffected: true,
        downgradeStrategy: 'IMMEDIATE',
        hasActiveUsage: false,
      })
      expect(service.calculateEffectiveStrategy(feature)).toBe('IMMEDIATE')
    })

    it('should keep GRACEFUL as GRACEFUL', () => {
      const feature = makeFeature({ willBeAffected: true, downgradeStrategy: 'GRACEFUL' })
      expect(service.calculateEffectiveStrategy(feature)).toBe('GRACEFUL')
    })

    it('should keep FREEZE as FREEZE', () => {
      const feature = makeFeature({ willBeAffected: true, downgradeStrategy: 'FREEZE' })
      expect(service.calculateEffectiveStrategy(feature)).toBe('FREEZE')
    })
  })

  // ==========================================================================
  // validateDowngrade
  // ==========================================================================

  describe('validateDowngrade', () => {
    it('should allow downgrade with no affected features', async () => {
      mockGetDowngradePreview.mockResolvedValue(makePreview([]))

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toEqual([])
      expect(result.affectedFeatures).toBe(0)
    })

    it('should warn for IMMEDIATE strategy features', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureName: 'AI Summary',
            downgradeStrategy: 'IMMEDIATE',
            hasActiveUsage: false,
          }),
        ])
      )

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toContain('AI Summary: Access will be cut immediately')
      expect(result.affectedFeatures).toBe(1)
    })

    it('should warn for GRACEFUL with active usage', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureName: 'AI Summary',
            downgradeStrategy: 'GRACEFUL',
            hasActiveUsage: true,
          }),
        ])
      )

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toContain('AI Summary: Users will lose access at period end')
      expect(result.affectedFeatures).toBe(1)
    })

    it('should NOT warn for GRACEFUL without active usage', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureName: 'Export CSV',
            downgradeStrategy: 'GRACEFUL',
            hasActiveUsage: false,
          }),
        ])
      )

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toEqual([])
      expect(result.affectedFeatures).toBe(1)
    })

    it('should warn for FREEZE strategy features', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureName: 'Two-Way Sync',
            downgradeStrategy: 'FREEZE',
          }),
        ])
      )

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toContain('Two-Way Sync: New actions will be blocked, data preserved')
      expect(result.affectedFeatures).toBe(1)
    })

    it('should handle multiple features with mixed strategies', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureKey: 'AI_SUMMARY',
            featureName: 'AI Summary',
            downgradeStrategy: 'IMMEDIATE',
            hasActiveUsage: false,
          }),
          makeFeature({
            featureKey: 'TWO_WAY_SYNC',
            featureName: 'Two-Way Sync',
            downgradeStrategy: 'GRACEFUL',
            hasActiveUsage: true,
          }),
          makeFeature({
            featureKey: 'API_ACCESS',
            featureName: 'API Access',
            willBeAffected: false, // Not affected — should be excluded
            downgradeStrategy: 'GRACEFUL',
          }),
        ])
      )

      const result = await service.validateDowngrade('org-1', 'free')
      expect(result.canProceed).toBe(true)
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings).toContain('AI Summary: Access will be cut immediately')
      expect(result.warnings).toContain('Two-Way Sync: Users will lose access at period end')
      expect(result.affectedFeatures).toBe(2)
    })
  })

  // ==========================================================================
  // applyDowngrade
  // ==========================================================================

  describe('applyDowngrade', () => {
    it('should apply downgrade and invalidate cache', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([makeFeature({ featureName: 'Export PDF' })])
      )
      mockInvalidateCache.mockResolvedValue(undefined)

      const result = await service.applyDowngrade('org-1', 'free')

      expect(mockInvalidateCache).toHaveBeenCalledWith('org-1')
      expect(result).toEqual({
        success: true,
        featuresAffected: 1,
        notificationsSent: undefined,
      })
    })

    it('should handle notifyUsers=true and return notificationsSent', async () => {
      mockGetDowngradePreview.mockResolvedValue(makePreview([]))
      mockInvalidateCache.mockResolvedValue(undefined)

      const result = await service.applyDowngrade('org-1', 'free', true)

      expect(result.success).toBe(true)
      expect(result.notificationsSent).toBe(0) // Placeholder
    })

    it('should handle notifyUsers=false (default)', async () => {
      mockGetDowngradePreview.mockResolvedValue(makePreview([]))
      mockInvalidateCache.mockResolvedValue(undefined)

      const result = await service.applyDowngrade('org-1', 'free')

      expect(result.notificationsSent).toBeUndefined()
    })

    it('should count 0 affected features when none are affected', async () => {
      mockGetDowngradePreview.mockResolvedValue(
        makePreview([makeFeature({ willBeAffected: false })])
      )
      mockInvalidateCache.mockResolvedValue(undefined)

      const result = await service.applyDowngrade('org-1', 'free')

      expect(result.featuresAffected).toBe(0)
    })
  })

  // ==========================================================================
  // hasGracePeriodAccess
  // ==========================================================================

  describe('hasGracePeriodAccess', () => {
    it('should return false when no subscription exists', async () => {
      mockGetActiveSubscription.mockResolvedValue(null)
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(false)
    })

    it('should return false when subscription is ACTIVE', async () => {
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      })
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(false)
    })

    it('should return false when subscription is TRIALING', async () => {
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'TRIALING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(false)
    })

    it('should return true when CANCELED with future period end', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'CANCELED',
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      })
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(true)
    })

    it('should return false when CANCELED with past period end', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'CANCELED',
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: pastDate,
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      })
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(false)
    })

    it('should return false when CANCELED with null period end', async () => {
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'CANCELED',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
      })
      const result = await service.hasGracePeriodAccess('org-1')
      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // getGracePeriodFeatures
  // ==========================================================================

  describe('getGracePeriodFeatures', () => {
    it('should return empty array when no grace period access', async () => {
      mockGetActiveSubscription.mockResolvedValue(null)
      const result = await service.getGracePeriodFeatures('org-1')
      expect(result).toEqual([])
    })

    it('should return filtered affected features with GRACEFUL strategy', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      mockGetActiveSubscription.mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        planKey: 'pro',
        status: 'CANCELED',
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: true,
        trialStart: null,
        trialEnd: null,
      })

      mockGetDowngradePreview.mockResolvedValue(
        makePreview([
          makeFeature({
            featureKey: 'EXPORT_PDF',
            featureName: 'Export PDF',
            downgradeStrategy: 'GRACEFUL',
            willBeAffected: true,
          }),
          makeFeature({
            featureKey: 'AI_SUMMARY',
            featureName: 'AI Summary',
            downgradeStrategy: 'IMMEDIATE',
            willBeAffected: true,
            hasActiveUsage: false,
          }),
          makeFeature({
            featureKey: 'EXPORT_CSV',
            featureName: 'Export CSV',
            downgradeStrategy: 'GRACEFUL',
            willBeAffected: false, // Not affected
          }),
        ])
      )

      const result = await service.getGracePeriodFeatures('org-1')
      expect(result).toEqual(['EXPORT_PDF'])
    })
  })

  // ==========================================================================
  // shouldGrantAccess
  // ==========================================================================

  describe('shouldGrantAccess', () => {
    // Disabled → Disabled
    it('should deny access when going from disabled to disabled', () => {
      expect(service.shouldGrantAccess(false, false, 'GRACEFUL')).toBe(false)
      expect(service.shouldGrantAccess(false, false, 'IMMEDIATE')).toBe(false)
      expect(service.shouldGrantAccess(false, false, 'FREEZE')).toBe(false)
    })

    // Disabled → Enabled (upgrade)
    it('should grant access when going from disabled to enabled (upgrade)', () => {
      expect(service.shouldGrantAccess(false, true, 'GRACEFUL')).toBe(true)
      expect(service.shouldGrantAccess(false, true, 'IMMEDIATE')).toBe(true)
      expect(service.shouldGrantAccess(false, true, 'FREEZE')).toBe(true)
    })

    // Enabled → Disabled with GRACEFUL
    it('should grant access with GRACEFUL when within billing period', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      expect(service.shouldGrantAccess(true, false, 'GRACEFUL', futureDate)).toBe(true)
    })

    it('should deny access with GRACEFUL when billing period has ended', () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      expect(service.shouldGrantAccess(true, false, 'GRACEFUL', pastDate)).toBe(false)
    })

    it('should deny access with GRACEFUL when no end date provided', () => {
      expect(service.shouldGrantAccess(true, false, 'GRACEFUL', null)).toBe(false)
      expect(service.shouldGrantAccess(true, false, 'GRACEFUL', undefined)).toBe(false)
    })

    // Enabled → Disabled with IMMEDIATE
    it('should always deny access with IMMEDIATE strategy', () => {
      expect(service.shouldGrantAccess(true, false, 'IMMEDIATE', new Date())).toBe(false)
      expect(service.shouldGrantAccess(true, false, 'IMMEDIATE', null)).toBe(false)
    })

    // Enabled → Disabled with FREEZE
    it('should grant access with FREEZE strategy (blocked actions elsewhere)', () => {
      expect(service.shouldGrantAccess(true, false, 'FREEZE')).toBe(true)
      expect(service.shouldGrantAccess(true, false, 'FREEZE', new Date())).toBe(true)
      expect(service.shouldGrantAccess(true, false, 'FREEZE', null)).toBe(true)
    })

    // Enabled → Enabled (maintain state)
    it('should maintain access when going from enabled to enabled', () => {
      expect(service.shouldGrantAccess(true, true, 'GRACEFUL')).toBe(true)
      expect(service.shouldGrantAccess(true, true, 'IMMEDIATE')).toBe(true)
      expect(service.shouldGrantAccess(true, true, 'FREEZE')).toBe(true)
    })

    // Default case (unknown strategy)
    it('should deny access for unknown strategy', () => {
      // This hits the default branch in the switch
      expect(service.shouldGrantAccess(true, false, 'UNKNOWN' as DowngradeStrategy)).toBe(false)
    })
  })

  // ==========================================================================
  // SINGLETON PATTERN
  // ==========================================================================

  describe('singleton pattern', () => {
    it('should return same instance on multiple getDowngradeService calls', () => {
      const instance1 = getDowngradeService()
      const instance2 = getDowngradeService()
      expect(instance1).toBe(instance2)
    })

    it('should create new instance after resetDowngradeService', () => {
      const instance1 = getDowngradeService()
      resetDowngradeService()
      const instance2 = getDowngradeService()
      expect(instance2).not.toBe(instance1)
    })
  })
})
