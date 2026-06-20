/**
 * Constants test
 *
 * Tests that the re-exported constants from @omnysync/core/entitlements/constants
 * are correctly forwarded through the web wrapper.
 */
import { describe, it, expect } from 'vitest'
import {
  PLAN_KEYS,
  FEATURE_KEYS,
  DEFAULT_PLAN,
  DEFAULT_PLAN_FEATURES,
  CACHE_CONFIG,
  ACTIVE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUSES,
  ERROR_MESSAGES,
  EXPERIMENT_DEFAULTS,
  PAGINATION_DEFAULTS,
  DEFAULT_DOWNGRADE_STRATEGY,
  STRIPE_PRICE_IDS,
} from '../constants'

describe('entitlements constants (web re-export)', () => {
  describe('PLAN_KEYS', () => {
    it('should export all plan keys', () => {
      expect(PLAN_KEYS).toEqual({
        FREE: 'free',
        PRO: 'pro',
        BUSINESS: 'business',
        ENTERPRISE: 'enterprise',
      })
    })

    it('should have DEFAULT_PLAN matching FREE', () => {
      expect(DEFAULT_PLAN).toBe(PLAN_KEYS.FREE)
    })
  })

  describe('FEATURE_KEYS', () => {
    it('should export feature key constants', () => {
      expect(FEATURE_KEYS.EXPORT_PDF).toBe('EXPORT_PDF')
      expect(FEATURE_KEYS.AI_SUMMARY).toBe('AI_SUMMARY')
      expect(FEATURE_KEYS.MAX_CONNECTORS).toBe('MAX_CONNECTORS')
      expect(FEATURE_KEYS.NEW_DASHBOARD).toBe('NEW_DASHBOARD')
    })

    it('should include all feature categories', () => {
      // Boolean features
      expect(FEATURE_KEYS.TWO_WAY_SYNC).toBeDefined()
      expect(FEATURE_KEYS.API_ACCESS).toBeDefined()

      // Limit features
      expect(FEATURE_KEYS.MAX_DOCUMENTS).toBeDefined()
      expect(FEATURE_KEYS.MAX_TEAM_MEMBERS).toBeDefined()

      // Experiment features
      expect(FEATURE_KEYS.AI_V2).toBeDefined()
      expect(FEATURE_KEYS.NEW_EXPORT_UI).toBeDefined()
    })
  })

  describe('DEFAULT_PLAN_FEATURES', () => {
    it('should define features for all plan tiers', () => {
      expect(DEFAULT_PLAN_FEATURES).toHaveProperty('free')
      expect(DEFAULT_PLAN_FEATURES).toHaveProperty('pro')
      expect(DEFAULT_PLAN_FEATURES).toHaveProperty('business')
      expect(DEFAULT_PLAN_FEATURES).toHaveProperty('enterprise')
    })

    it('should have specific values for free plan', () => {
      const free = DEFAULT_PLAN_FEATURES.free
      expect(free[FEATURE_KEYS.EXPORT_PDF]).toBe(false)
      expect(free[FEATURE_KEYS.MAX_CONNECTORS]).toBe(2)
      expect(free[FEATURE_KEYS.MAX_DOCUMENTS]).toBe(100)
    })

    it('should have specific values for pro plan', () => {
      const pro = DEFAULT_PLAN_FEATURES.pro
      expect(pro[FEATURE_KEYS.EXPORT_PDF]).toBe(true)
      expect(pro[FEATURE_KEYS.AI_SUMMARY]).toBe(true)
      expect(pro[FEATURE_KEYS.MAX_SYNCS_PER_MONTH]).toBe(100)
    })
  })

  describe('CACHE_CONFIG', () => {
    it('should export cache configuration', () => {
      expect(CACHE_CONFIG.REDIS_TTL).toBe(300)
      expect(CACHE_CONFIG.MEMORY_TTL).toBe(30)
      expect(CACHE_CONFIG.KEY_PREFIX).toBe('entitlements:')
      expect(CACHE_CONFIG.INVALIDATION_CHANNEL).toBe('entitlements:invalidate')
    })
  })

  describe('SUBSCRIPTION_STATUSES', () => {
    it('should export all subscription statuses', () => {
      expect(SUBSCRIPTION_STATUSES.ACTIVE).toBe('ACTIVE')
      expect(SUBSCRIPTION_STATUSES.TRIALING).toBe('TRIALING')
      expect(SUBSCRIPTION_STATUSES.CANCELED).toBe('CANCELED')
    })

    it('should have ACTIVE_SUBSCRIPTION_STATUSES array', () => {
      expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain('ACTIVE')
      expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain('TRIALING')
    })
  })

  describe('ERROR_MESSAGES', () => {
    it('should export error messages', () => {
      expect(ERROR_MESSAGES.FEATURE_NOT_AVAILABLE).toBe(
        'This feature is not available on your current plan'
      )
      expect(ERROR_MESSAGES.UPGRADE_URL).toBe('/billing/upgrade')
    })
  })

  describe('DEFAULT_DOWNGRADE_STRATEGY', () => {
    it('should default to GRACEFUL', () => {
      expect(DEFAULT_DOWNGRADE_STRATEGY).toBe('GRACEFUL')
    })
  })

  describe('STRIPE_PRICE_IDS', () => {
    it('should export Stripe price IDs', () => {
      expect(STRIPE_PRICE_IDS.FREE).toBe('price_free')
      expect(STRIPE_PRICE_IDS.PRO_MONTHLY).toBe('price_pro_monthly')
    })
  })

  describe('PAGINATION_DEFAULTS', () => {
    it('should export pagination defaults', () => {
      expect(PAGINATION_DEFAULTS.DEFAULT_PAGE).toBe(1)
      expect(PAGINATION_DEFAULTS.DEFAULT_LIMIT).toBe(20)
      expect(PAGINATION_DEFAULTS.MAX_LIMIT).toBe(100)
    })
  })

  describe('EXPERIMENT_DEFAULTS', () => {
    it('should export experiment defaults', () => {
      expect(EXPERIMENT_DEFAULTS.DEFAULT_PERCENTAGE).toBe(0)
      expect(EXPERIMENT_DEFAULTS.SEED_PREFIX).toBe('omnysync:experiment:')
    })
  })
})
