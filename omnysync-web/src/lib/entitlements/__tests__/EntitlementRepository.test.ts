/**
 * EntitlementRepository test
 *
 * Tests that the re-exported EntitlementRepository from @omnysync/core/entitlements/EntitlementRepository
 * is correctly forwarded through the web wrapper.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getEntitlementRepository,
  setEntitlementRepository,
  resetEntitlementRepository,
  PrismaEntitlementRepository,
} from '../EntitlementRepository'

describe('EntitlementRepository (web re-export)', () => {
  beforeEach(() => {
    resetEntitlementRepository()
  })

  afterEach(() => {
    resetEntitlementRepository()
  })

  it('should export PrismaEntitlementRepository class', () => {
    expect(typeof PrismaEntitlementRepository).toBe('function')
  })

  it('should export IEntitlementRepository interface', () => {
    // Interface exports at runtime should not throw
    expect(getEntitlementRepository).toBeDefined()
  })

  describe('singleton pattern', () => {
    it('should return an IEntitlementRepository from getEntitlementRepository', () => {
      const repo = getEntitlementRepository()
      expect(repo).toBeDefined()
      expect(typeof repo).toBe('object')
    })

    it('should return same instance on multiple calls', () => {
      const repo1 = getEntitlementRepository()
      const repo2 = getEntitlementRepository()
      expect(repo1).toBe(repo2)
    })

    it('should allow overriding with setEntitlementRepository', () => {
      const customRepo = {
        getActiveSubscription: async () => null,
        getPlanKey: async () => 'free',
        getFeature: async () => null,
        getAllFeatures: async () => [],
        getPlanFeatures: async () => [],
        getEntitlementMap: async () => ({
          planKey: 'free',
          features: {},
          limits: {},
          experiments: {},
        }),
        getUserOverride: async () => null,
        getOrgOverride: async () => null,
        getAllOverridesForOrg: async () => [],
        createOverride: async () => ({
          id: '',
          scope: 'ORG' as const,
          scopeId: '',
          featureKey: '',
          enabled: false,
          limitValue: null,
          expiresAt: null,
          reason: '',
        }),
        deleteOverride: async () => {},
        getUsageTracking: async () => null,
        consumeUsage: async () => ({
          success: true,
          newUsageCount: 0,
          limitReached: false,
        }),
        getDowngradePreview: async () => ({
          features: [],
          recommendedStrategy: 'GRACEFUL' as const,
        }),
        getOrganizationStripeCustomerId: async () => null,
        getPlanWithFeatures: async () => null,
        getAllPlansWithFeatures: async () => [],
        getFeatureWithPlans: async () => null,
        getAllFeaturesWithPlans: async () => [],
        updatePlanFeature: async () => ({
          featureKey: '',
          featureName: '',
          enabled: false,
          limitValue: null,
          configJson: null,
          downgradeStrategy: 'GRACEFUL' as const,
        }),
        createFeature: async () => ({
          id: '',
          key: '',
          name: '',
          description: null,
          type: 'BOOLEAN' as const,
          defaultConfig: null,
        }),
        updateFeature: async () => ({
          id: '',
          key: '',
          name: '',
          description: null,
          type: 'BOOLEAN' as const,
          defaultConfig: null,
        }),
        isWebhookEventProcessed: async () => false,
        markWebhookEventProcessed: async () => {},
      }

      setEntitlementRepository(customRepo)
      expect(getEntitlementRepository()).toBe(customRepo)
    })

    it('should create new instance after reset', () => {
      const repo1 = getEntitlementRepository()
      resetEntitlementRepository()
      const repo2 = getEntitlementRepository()
      expect(repo2).not.toBe(repo1)
    })
  })
})
