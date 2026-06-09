/* eslint-disable @typescript-eslint/no-explicit-any */

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
      vi.mocked(prisma.quotaUsage.upsert).mockResolvedValue({} as any)
      vi.mocked(prisma.quotaUsage.updateMany).mockResolvedValue({ count: 1 } as any)
      vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue({
        id: 'quota-1',
        userId: 'user-123',
        month: '2024-01',
        syncCount: 3,
      } as any)

      const result = await checkAndIncrementQuota('user-123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2) // 5 - 3 = 2
    })

    it('should deny sync when quota exceeded', async () => {
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null) // free plan
      vi.mocked(prisma.quotaUsage.upsert).mockResolvedValue({} as any)
      vi.mocked(prisma.quotaUsage.updateMany).mockResolvedValue({ count: 0 } as any)

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
