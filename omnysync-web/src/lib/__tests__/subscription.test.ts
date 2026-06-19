/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PLAN_LIMITS,
  getCurrentMonth,
  getUserPlan,
  getPlanLimits,
  getQuotaUsage,
  checkAndIncrementQuota,
  decrementQuotaOnFailure,
  checkConnectorLimit,
  checkDocumentLimit,
  getPlanFromPriceId,
} from '../auth/subscription'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    quotaUsage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    connector: {
      count: vi.fn(),
    },
    document: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({ json: () => data, status: options?.status || 200 })),
  },
}))

import { prisma } from '@/lib/prisma'

// Helper to build mock userOrg lookup response
function mockUserOrgLookup(planKey: string | null, status: string | null) {
  return planKey
    ? {
        organization: {
          subscriptions: [
            {
              planKey,
              status: status || 'ACTIVE',
            },
          ],
        },
      }
    : null
}

describe('Subscription Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PLAN_LIMITS', () => {
    it('should define correct limits for free plan', () => {
      const limits = PLAN_LIMITS.free
      expect(limits.syncsPerMonth).toBe(5)
      expect(limits.connectors).toBe(2)
      expect(limits.documents).toBe(50)
      expect(limits.aiFeatures).toBe(false)
      expect(limits.bidirectionalSync).toBe(false)
    })

    it('should define correct limits for pro plan', () => {
      const limits = PLAN_LIMITS.pro
      expect(limits.syncsPerMonth).toBe(100)
      expect(limits.connectors).toBe(10)
      expect(limits.documents).toBe(500)
      expect(limits.aiFeatures).toBe(true)
      expect(limits.scheduledSync).toBe(true)
    })

    it('should define infinite limits for business plan', () => {
      const limits = PLAN_LIMITS.business
      expect(limits.syncsPerMonth).toBe(Infinity)
      expect(limits.connectors).toBe(Infinity)
      expect(limits.documents).toBe(Infinity)
    })
  })

  describe('getCurrentMonth', () => {
    it('should return correct month format', () => {
      const result = getCurrentMonth()
      // Should be in format YYYY-MM
      expect(result).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  describe('getUserPlan', () => {
    it('should return free when no org membership', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

      const plan = await getUserPlan('user-123')
      expect(plan).toBe('free')
    })

    it('should return free when no subscription', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organization: { subscriptions: [] },
      } as any)

      const plan = await getUserPlan('user-123')
      expect(plan).toBe('free')
    })

    it('should return free when subscription is not active', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'CANCELED') as any
      )

      const plan = await getUserPlan('user-123')
      expect(plan).toBe('free')
    })

    it('should return the plan when subscription is active', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'ACTIVE') as any
      )

      const plan = await getUserPlan('user-123')
      expect(plan).toBe('pro')
    })

    it('should return business for business plan', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('business', 'ACTIVE') as any
      )

      const plan = await getUserPlan('user-123')
      expect(plan).toBe('business')
    })
  })

  describe('getPlanLimits', () => {
    it('should return correct limits for free plan', () => {
      const limits = getPlanLimits('free')
      expect(limits.syncsPerMonth).toBe(5)
    })

    it('should return correct limits for pro plan', () => {
      const limits = getPlanLimits('pro')
      expect(limits.syncsPerMonth).toBe(100)
    })

    it('should return correct limits for business plan', () => {
      const limits = getPlanLimits('business')
      expect(limits.syncsPerMonth).toBe(Infinity)
    })
  })

  describe('getQuotaUsage', () => {
    it('should return quota for free user', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.connector.count).mockResolvedValue(1)
      vi.mocked(prisma.document.count).mockResolvedValue(10)

      const result = await getQuotaUsage('user-123')

      expect(result.syncCount).toBe(0)
      expect(result.syncLimit).toBe(5)
      expect(result.connectorCount).toBe(1)
      expect(result.connectorLimit).toBe(2)
      expect(result.documentCount).toBe(10)
    })

    it('should calculate percent for free plan', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue({
        userId: 'user-123',
        month: '2024-01',
        syncCount: 2,
      } as any)
      vi.mocked(prisma.connector.count).mockResolvedValue(1)
      vi.mocked(prisma.document.count).mockResolvedValue(10)

      const result = await getQuotaUsage('user-123')

      // 2/5 = 40%
      expect(result.percentUsed).toBe(40)
    })

    it('should return 0 percent for paid plans', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'ACTIVE') as any
      )
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.connector.count).mockResolvedValue(1)
      vi.mocked(prisma.document.count).mockResolvedValue(10)

      const result = await getQuotaUsage('user-123')

      expect(result.percentUsed).toBe(0)
    })
  })

  describe('checkAndIncrementQuota', () => {
    it('should allow sync for business plan', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('business', 'ACTIVE') as any
      )

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })

    it('should allow sync when quota available', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: true, sync_count: 3 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2) // 5 - 3 = 2
    })

    it('should deny sync when quota exceeded', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: false, sync_count: 0 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.upgradeUrl).toBe('/pricing')
    })
  })

  describe('decrementQuotaOnFailure', () => {
    it('should decrement quota on failure', async () => {
      vi.mocked(prisma.quotaUsage.updateMany).mockResolvedValue({ count: 1 } as any)

      await decrementQuotaOnFailure('user-123')

      expect(prisma.quotaUsage.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', month: expect.any(String) },
        data: { syncCount: { decrement: 1 } },
      })
    })

    it('should not throw on error', async () => {
      vi.mocked(prisma.quotaUsage.updateMany).mockRejectedValue(new Error('DB error'))

      // Should not throw
      await expect(decrementQuotaOnFailure('user-123')).resolves.not.toThrow()
    })
  })

  describe('checkConnectorLimit', () => {
    it('should allow connector when under limit', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.connector.count).mockResolvedValue(1)

      const result = await checkConnectorLimit('user-123')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(1)
      expect(result.limit).toBe(2)
    })

    it('should deny connector when at limit', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.connector.count).mockResolvedValue(2)

      const result = await checkConnectorLimit('user-123')

      expect(result.allowed).toBe(false)
      expect(result.upgradeUrl).toBe('/pricing')
    })
  })

  describe('checkDocumentLimit', () => {
    it('should allow document when under limit', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.document.count).mockResolvedValue(49)

      const result = await checkDocumentLimit('user-123')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(49)
      expect(result.limit).toBe(50)
    })

    it('should deny document when at limit', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.document.count).mockResolvedValue(50)

      const result = await checkDocumentLimit('user-123')

      expect(result.allowed).toBe(false)
      expect(result.upgradeUrl).toBe('/pricing')
    })
  })

  describe('checkAndIncrementQuota — edge cases', () => {
    it('should allow sync for pro plan when syncCount=99 (under limit 100)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'ACTIVE') as any
      )
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: true, sync_count: 100 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0) // 100 - 100 = 0, limite atteinte après incrément
    })

    it('should deny sync for pro plan when syncCount=100 (limit reached)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'ACTIVE') as any
      )
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: false, sync_count: 0 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.upgradeUrl).toBe('/pricing')
    })

    it('should allow sync for pro plan when syncCount=0', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('pro', 'ACTIVE') as any
      )
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: true, sync_count: 1 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(99) // 100 - 1 = 99
    })

    it('should handle race condition: $queryRaw returns allowed=false (already at limit)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('free', null) as any
      )
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ allowed: false, sync_count: 0 }])

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('getQuotaUsage — edge cases', () => {
    it('should return syncCount=0 and percent=0 for free plan when quotaUsage is null', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue(null) // no quota record
      vi.mocked(prisma.connector.count).mockResolvedValue(0)
      vi.mocked(prisma.document.count).mockResolvedValue(0)

      const result = await getQuotaUsage('user-123')

      expect(result.syncCount).toBe(0)
      expect(result.syncLimit).toBe(5)
      expect(result.percentUsed).toBe(0) // Math.round(0/5*100) = 0
    })

    it('should return percent=100 for free plan at limit (syncCount=5, limit=5)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue({
        userId: 'user-123',
        month: '2024-01',
        syncCount: 5,
      } as any)
      vi.mocked(prisma.connector.count).mockResolvedValue(0)
      vi.mocked(prisma.document.count).mockResolvedValue(0)

      const result = await getQuotaUsage('user-123')

      expect(result.syncCount).toBe(5)
      expect(result.percentUsed).toBe(100) // Math.round(5/5*100) = 100
    })

    it('should return percent=0 for business plan regardless of sync count', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('business', 'ACTIVE') as any
      )
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue({
        userId: 'user-123',
        month: '2024-01',
        syncCount: 999,
      } as any)
      vi.mocked(prisma.connector.count).mockResolvedValue(10)
      vi.mocked(prisma.document.count).mockResolvedValue(100)

      const result = await getQuotaUsage('user-123')

      expect(result.syncCount).toBe(999)
      expect(result.percentUsed).toBe(0) // plan !== 'free' → always 0
      expect(result.syncLimit).toBe(Infinity)
    })

    it('should return free plan when user has no subscription', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organization: { subscriptions: [] },
      } as any)
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.connector.count).mockResolvedValue(0)
      vi.mocked(prisma.document.count).mockResolvedValue(0)

      const result = await getQuotaUsage('user-123')

      expect(result.syncLimit).toBe(5) // limits du plan free
      expect(result.connectorLimit).toBe(2)
      expect(result.documentLimit).toBe(50)
    })
  })

  describe('decrementQuotaOnFailure — edge cases', () => {
    it('should call updateMany when quotaUsage exists', async () => {
      vi.mocked(prisma.quotaUsage.updateMany).mockResolvedValue({ count: 1 } as any)

      await decrementQuotaOnFailure('user-123')

      expect(prisma.quotaUsage.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', month: expect.any(String) },
        data: { syncCount: { decrement: 1 } },
      })
    })

    it('should not throw when no quotaUsage exists (updateMany returns count=0)', async () => {
      vi.mocked(prisma.quotaUsage.updateMany).mockResolvedValue({ count: 0 } as any)

      await expect(decrementQuotaOnFailure('user-123')).resolves.not.toThrow()
    })
  })

  describe('checkConnectorLimit / checkDocumentLimit — edge cases', () => {
    it('should deny connector for free plan when connectorCount=2 (at limit)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free
      vi.mocked(prisma.connector.count).mockResolvedValue(2)

      const result = await checkConnectorLimit('user-123')

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(2)
      expect(result.limit).toBe(2)
      expect(result.upgradeUrl).toBe('/pricing')
    })

    it('should allow connector for business plan even with connectorCount=999', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('business', 'ACTIVE') as any
      )
      vi.mocked(prisma.connector.count).mockResolvedValue(999)

      const result = await checkConnectorLimit('user-123')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(999)
      expect(result.limit).toBe(Infinity)
      expect(result.upgradeUrl).toBeUndefined()
    })

    it('should allow document for business plan even with documentCount=999', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('business', 'ACTIVE') as any
      )
      vi.mocked(prisma.document.count).mockResolvedValue(999)

      const result = await checkDocumentLimit('user-123')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(999)
      expect(result.limit).toBe(Infinity)
      expect(result.upgradeUrl).toBeUndefined()
    })

    it('should throw for unknown plan (PLAN_LIMITS[unknown] is undefined)', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(
        mockUserOrgLookup('unknown_plan' as any, 'ACTIVE') as any
      )
      vi.mocked(prisma.connector.count).mockResolvedValue(1)

      // plan 'unknown_plan' n'existe pas dans PLAN_LIMITS → crash à l'accès
      await expect(checkConnectorLimit('user-123')).rejects.toThrow()
    })
  })

  describe('getPlanFromPriceId', () => {
    beforeEach(() => {
      vi.stubEnv('STRIPE_PRICE_PRO_MONTHLY', 'price_pro_monthly')
      vi.stubEnv('STRIPE_PRICE_BUSINESS_MONTHLY', 'price_business_monthly')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return pro for pro price id', () => {
      const plan = getPlanFromPriceId('price_pro_monthly')
      expect(plan).toBe('pro')
    })

    it('should return business for business price id', () => {
      const plan = getPlanFromPriceId('price_business_monthly')
      expect(plan).toBe('business')
    })

    it('should return free for unknown price id', () => {
      const plan = getPlanFromPriceId('price_unknown')
      expect(plan).toBe('free')
    })
  })
})
