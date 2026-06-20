/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  connector: { count: vi.fn() },
  document: { count: vi.fn() },
  syncLog: { count: vi.fn() },
  userOrganization: { count: vi.fn() },
  quotaUsage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/audit', () => ({
  auditBilling: {
    planUpgraded: vi.fn(),
    planDowngraded: vi.fn(),
    subscriptionCancelled: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { auditBilling } from '@/lib/audit'

describe('plans definition', () => {
  it('has all required plans', async () => {
    const { plans } = await import('../features')
    expect(plans).toHaveProperty('free')
    expect(plans).toHaveProperty('pro')
    expect(plans).toHaveProperty('business')
    expect(plans).toHaveProperty('enterprise')
  })

  it('free plan has correct limits', async () => {
    const { plans } = await import('../features')
    const free = plans.free

    expect(free.price).toBe(0)
    expect(free.maxConnectors).toBe(2)
    expect(free.maxDocuments).toBe(100)
    expect(free.maxSyncsPerMonth).toBe(10)
    expect(free.maxTeamMembers).toBe(1)
    expect(free.aiSEO).toBe(false)
    expect(free.aiImages).toBe(false)
    expect(free.aiInterlinking).toBe(false)
    expect(free.twoWaySync).toBe(false)
    expect(free.approvalPortal).toBe(false)
    expect(free.customDomain).toBe(false)
    expect(free.apiAccess).toBe(false)
    expect(free.prioritySupport).toBe(false)
    expect(free.analyticsExport).toBe(false)
  })

  it('pro plan has correct limits', async () => {
    const { plans } = await import('../features')
    const pro = plans.pro

    expect(pro.price).toBe(29)
    expect(pro.maxConnectors).toBe(10)
    expect(pro.maxDocuments).toBe(-1) // Unlimited
    expect(pro.maxSyncsPerMonth).toBe(100)
    expect(pro.maxTeamMembers).toBe(5)
    expect(pro.aiSEO).toBe(true)
    expect(pro.aiImages).toBe(true)
    expect(pro.aiInterlinking).toBe(true)
    expect(pro.apiAccess).toBe(true)
    expect(pro.analyticsExport).toBe(true)
    expect(pro.twoWaySync).toBe(false)
    expect(pro.approvalPortal).toBe(false)
    expect(pro.customDomain).toBe(false)
  })

  it('business plan has unlimited features', async () => {
    const { plans } = await import('../features')
    const business = plans.business

    expect(business.price).toBe(99)
    expect(business.maxConnectors).toBe(-1)
    expect(business.maxDocuments).toBe(-1)
    expect(business.maxSyncsPerMonth).toBe(-1)
    expect(business.maxTeamMembers).toBe(-1)
    expect(business.twoWaySync).toBe(true)
    expect(business.approvalPortal).toBe(true)
    expect(business.customDomain).toBe(true)
    expect(business.prioritySupport).toBe(true)
  })

  it('enterprise plan has all features', async () => {
    const { plans } = await import('../features')
    const enterprise = plans.enterprise

    expect(enterprise.price).toBe(-1) // Custom pricing
    expect(enterprise.currency).toBe('EUR')
    expect(enterprise.interval).toBe('month')
    expect(enterprise.maxConnectors).toBe(-1)
    expect(enterprise.maxDocuments).toBe(-1)
    expect(enterprise.maxSyncsPerMonth).toBe(-1)
    expect(enterprise.maxTeamMembers).toBe(-1)
    expect(enterprise.aiSEO).toBe(true)
    expect(enterprise.aiImages).toBe(true)
    expect(enterprise.twoWaySync).toBe(true)
    expect(enterprise.prioritySupport).toBe(true)
  })
})

describe('checkQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns not allowed when organization not found', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('nonexistent-org', 'maxConnectors')

    expect(result.allowed).toBe(false)
    expect(result.message).toBe('Organization not found')
  })

  it('returns not allowed when plan is invalid', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: { plan: 'nonexistent' } } }],
    } as any)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxConnectors')

    expect(result.allowed).toBe(false)
    expect(result.message).toBe('Invalid plan')
  })

  it('checks boolean feature (aiSEO)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'aiSEO')

    expect(result.allowed).toBe(false) // free plan has aiSEO: false
  })

  it('allows boolean feature when enabled on plan', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: { plan: 'pro' } } }],
    } as any)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'aiSEO')

    expect(result.allowed).toBe(true)
  })

  it('allows unlimited connector limit (-1)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: { plan: 'business' } } }],
    } as any)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxConnectors')

    expect(result.allowed).toBe(true)
  })

  it('checks connector count against limit', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.connector.count.mockResolvedValue(2)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxConnectors')

    expect(result.allowed).toBe(false) // free: limit 2, count 2
    expect(result.current).toBe(2)
    expect(result.limit).toBe(2)
    expect(result.message).toContain('connecteurs')
  })

  it('allows connector when under limit', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.connector.count.mockResolvedValue(1)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxConnectors')

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(1)
    expect(result.limit).toBe(2)
  })

  it('checks document count against limit', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.document.count.mockResolvedValue(100)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxDocuments')

    expect(result.allowed).toBe(false) // free: limit 100, count 100
    expect(result.current).toBe(100)
    expect(result.limit).toBe(100)
  })

  it('checks sync count against monthly limit', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.syncLog.count.mockResolvedValue(10)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxSyncsPerMonth')

    expect(result.allowed).toBe(false) // free: limit 10, count 10
    expect(result.current).toBe(10)
    expect(result.limit).toBe(10)
  })

  it('filters sync count by current month and SUCCESS status', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.syncLog.count.mockResolvedValue(3)

    const { checkQuota } = await import('../features')
    await checkQuota('org-1', 'maxSyncsPerMonth')

    expect(mockPrisma.syncLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SUCCESS' }),
      })
    )
  })

  it('checks team member count', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.userOrganization.count.mockResolvedValue(0)

    const { checkQuota } = await import('../features')
    const result = await checkQuota('org-1', 'maxTeamMembers')

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(0)
    expect(result.limit).toBe(1) // free: 1 member
  })

  it('default case returns allowed true for unknown numeric feature', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)

    const { checkQuota } = await import('../features')
    // Cast bypasses TypeScript type safety to test the runtime default branch
    const result = await checkQuota('org-1', 'price' as keyof PlanFeatures)

    expect(result.allowed).toBe(true)
    expect(result.message).toBeUndefined()
  })
})

describe('withQuotaCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes action when quota check passes', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: { plan: 'business' } } }],
    } as any)

    const { withQuotaCheck } = await import('../features')
    const action = vi.fn().mockResolvedValue('done')

    const result = await withQuotaCheck('org-1', 'maxConnectors', action)

    expect(result).toBe('done')
    expect(action).toHaveBeenCalled()
  })

  it('throws error when quota check fails', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ user: { subscription: null } }],
    } as any)
    mockPrisma.connector.count.mockResolvedValue(2)

    const { withQuotaCheck } = await import('../features')
    const action = vi.fn()

    await expect(withQuotaCheck('org-1', 'maxConnectors', action)).rejects.toThrow(
      'Limite de 2 connecteurs atteinte'
    )
    expect(action).not.toHaveBeenCalled()
  })
})

describe('recordUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records sync usage', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ userId: 'user-1', role: 'OWNER' }],
    } as any)
    mockPrisma.quotaUsage.upsert.mockResolvedValue({} as any)

    const { recordUsage } = await import('../features')
    await recordUsage('org-1', 'sync')

    expect(mockPrisma.quotaUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ syncCount: 1 }),
        update: expect.objectContaining({ syncCount: { increment: 1 } }),
      })
    )
  })

  it('records non-sync usage with syncCount 0', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ userId: 'user-1', role: 'OWNER' }],
    } as any)
    mockPrisma.quotaUsage.upsert.mockResolvedValue({} as any)

    const { recordUsage } = await import('../features')
    await recordUsage('org-1', 'document')

    expect(mockPrisma.quotaUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ syncCount: 0 }),
        update: expect.objectContaining({ syncCount: undefined }),
      })
    )
  })

  it('does nothing when org has no owner', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [],
    } as any)

    const { recordUsage } = await import('../features')
    await recordUsage('org-1', 'sync')

    expect(mockPrisma.quotaUsage.upsert).not.toHaveBeenCalled()
  })

  it('does nothing when org not found', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null)

    const { recordUsage } = await import('../features')
    await recordUsage('org-1', 'sync')

    expect(mockPrisma.quotaUsage.upsert).not.toHaveBeenCalled()
  })
})

describe('getUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when org not found', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null)

    const { getUsageStats } = await import('../features')
    const result = await getUsageStats('org-1')

    expect(result).toBeNull()
  })

  it('returns usage stats with plan limits', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ userId: 'user-1', role: 'OWNER' }],
    } as any)
    mockPrisma.quotaUsage.findUnique.mockResolvedValue(null)
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.connector.count.mockResolvedValue(1)
    mockPrisma.document.count.mockResolvedValue(10)
    mockPrisma.userOrganization.count.mockResolvedValue(1)

    const { getUsageStats } = await import('../features')
    const result = await getUsageStats('org-1')

    expect(result).toEqual({
      syncCount: 0,
      maxSyncs: 10, // free
      connectorCount: 1,
      maxConnectors: 2,
      documentCount: 10,
      maxDocuments: 100,
      memberCount: 1,
      maxMembers: 1,
    })
  })

  it('returns usage with subscription data', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      users: [{ userId: 'user-1', role: 'OWNER' }],
    } as any)
    mockPrisma.quotaUsage.findUnique.mockResolvedValue({
      syncCount: 25,
    } as any)
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'pro',
    } as any)
    mockPrisma.connector.count.mockResolvedValue(3)
    mockPrisma.document.count.mockResolvedValue(50)
    mockPrisma.userOrganization.count.mockResolvedValue(2)

    const { getUsageStats } = await import('../features')
    const result = await getUsageStats('org-1')

    expect(result).toEqual({
      syncCount: 25,
      maxSyncs: 100,
      connectorCount: 3,
      maxConnectors: 10,
      documentCount: 50,
      maxDocuments: -1,
      memberCount: 2,
      maxMembers: 5,
    })
  })
})

describe('updateUserPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates new subscription for user without one', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)

    const { updateUserPlan } = await import('../features')
    await updateUserPlan('user-1', 'pro', 'cus_123', 'sub_456')

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: expect.objectContaining({
        userId: 'user-1',
        plan: 'pro',
        status: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      }),
      update: expect.objectContaining({
        plan: 'pro',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      }),
    })
  })

  it('audits plan upgrade when moving to higher price', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'free',
      status: 'active',
    } as any)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: 'org-1',
    } as any)

    const { updateUserPlan } = await import('../features')
    await updateUserPlan('user-1', 'pro')

    expect(auditBilling.planUpgraded).toHaveBeenCalledWith('org-1', 'free', 'pro')
    expect(auditBilling.planDowngraded).not.toHaveBeenCalled()
  })

  it('audits plan downgrade when moving to lower price', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'pro',
      status: 'active',
    } as any)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: 'org-1',
    } as any)

    const { updateUserPlan } = await import('../features')
    await updateUserPlan('user-1', 'free')

    expect(auditBilling.planDowngraded).toHaveBeenCalledWith('org-1', 'pro', 'free')
    expect(auditBilling.planUpgraded).not.toHaveBeenCalled()
  })

  it('does not audit when plan unchanged', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'pro',
      status: 'active',
    } as any)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)

    const { updateUserPlan } = await import('../features')
    await updateUserPlan('user-1', 'pro')

    expect(auditBilling.planUpgraded).not.toHaveBeenCalled()
    expect(auditBilling.planDowngraded).not.toHaveBeenCalled()
  })

  it('handles missing org for audit gracefully', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'free',
    } as any)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue(null)

    const { updateUserPlan } = await import('../features')
    await updateUserPlan('user-1', 'pro')

    expect(auditBilling.planUpgraded).not.toHaveBeenCalled()
  })

  it('sets currentPeriodEnd to 30 days from now', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.subscription.upsert.mockResolvedValue({} as any)

    const { updateUserPlan } = await import('../features')
    const before = Date.now()
    await updateUserPlan('user-1', 'pro')
    const after = Date.now()

    const upsertCall = mockPrisma.subscription.upsert.mock.calls[0][0]
    const periodEnd = upsertCall.create.currentPeriodEnd.getTime()
    expect(periodEnd).toBeGreaterThanOrEqual(before + 29 * 24 * 60 * 60 * 1000)
    expect(periodEnd).toBeLessThanOrEqual(after + 30 * 24 * 60 * 60 * 1000)
  })
})

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets cancelAtPeriodEnd to true', async () => {
    mockPrisma.subscription.update.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue(null)

    const { cancelSubscription } = await import('../features')
    await cancelSubscription('user-1')

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { cancelAtPeriodEnd: true },
    })
  })

  it('audits subscription cancellation', async () => {
    mockPrisma.subscription.update.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: 'org-1',
    } as any)

    const { cancelSubscription } = await import('../features')
    await cancelSubscription('user-1')

    expect(auditBilling.subscriptionCancelled).toHaveBeenCalledWith('org-1')
  })

  it('handles missing org for audit', async () => {
    mockPrisma.subscription.update.mockResolvedValue({} as any)
    mockPrisma.organization.findFirst.mockResolvedValue(null)

    const { cancelSubscription } = await import('../features')
    await cancelSubscription('user-1')

    expect(auditBilling.subscriptionCancelled).not.toHaveBeenCalled()
  })
})
