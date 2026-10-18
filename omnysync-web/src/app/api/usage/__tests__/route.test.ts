/**
 * Tests for GET /api/usage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    quotaUsage: { findUnique: vi.fn() },
    document: { count: vi.fn(), findMany: vi.fn() },
    connector: { count: vi.fn() },
    userOrganization: { count: vi.fn() },
    syncLog: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/auth/subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/subscription')>()
  return {
    ...actual,
    getUserPlan: vi.fn(),
    getPlanLimits: vi.fn(),
  }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { getPlanLimits, getUserPlan } from '@/lib/auth/subscription'

describe('GET /api/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(getUserPlan).mockResolvedValue('pro')
    vi.mocked(getPlanLimits).mockReturnValue({
      syncsPerMonth: 100,
      connectors: 10,
      documents: 500,
      teamMembers: 10,
      aiFeatures: true,
      bidirectionalSync: false,
      multiUser: false,
      apiAccess: false,
      scheduledSync: true,
    })

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.quotaUsage.findUnique).mockResolvedValue({
      syncCount: 12,
    } as any)
    vi.mocked(prisma.document.count).mockResolvedValue(3)
    vi.mocked(prisma.connector.count).mockResolvedValue(2)
    vi.mocked(prisma.userOrganization.count).mockResolvedValue(4)
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.document.findMany).mockResolvedValue([])
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/usage/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('should return usage, plan limits and a 6-month history', async () => {
    const now = new Date()
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([
      { action: 'sync_started', createdAt: now },
      { action: 'sync_started', createdAt: now },
      { action: 'ai_seo_completed', createdAt: now },
      { action: 'ai_image_generated', createdAt: now },
      { action: 'ai_interlinking_found', createdAt: now },
    ] as any)
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { createdAt: now },
      { createdAt: now },
    ] as any)

    const { GET } = await import('@/app/api/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.currentPlan).toBe('Pro')
    expect(data.syncUsed).toBe(12)
    expect(data.syncLimit).toBe(100)
    expect(data.documentsUsed).toBe(3)
    expect(data.documentsLimit).toBe(500)
    expect(data.connectorsUsed).toBe(2)
    expect(data.connectorsLimit).toBe(10)
    expect(data.teamUsed).toBe(4)
    expect(data.teamLimit).toBe(10)
    expect(data.aiSEO).toBe(1)
    expect(data.aiImages).toBe(1)
    expect(data.aiInterlinking).toBe(1)
    expect(data.history).toHaveLength(6)
    expect(data.history[5].month).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    )
    expect(data.history[5].syncs).toBe(2)
    expect(data.history[5].documents).toBe(2)
    expect(data.history[5].aiCalls).toBe(3)

    // Org-scoped counts only
    expect(prisma.document.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
    expect(prisma.connector.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
    expect(prisma.userOrganization.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    })
  })

  it('should use the subscription billing period when available', async () => {
    const start = new Date('2026-09-15T00:00:00Z')
    const end = new Date('2026-10-15T00:00:00Z')
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      currentPeriodStart: start,
      currentPeriodEnd: end,
    } as any)

    const { GET } = await import('@/app/api/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.billingCycle).toEqual({
      start: start.toISOString(),
      end: end.toISOString(),
    })
  })

  it('should serialize Infinity limits as -1 (unlimited)', async () => {
    vi.mocked(getPlanLimits).mockReturnValue({
      syncsPerMonth: Infinity,
      connectors: Infinity,
      documents: Infinity,
      teamMembers: Infinity,
      aiFeatures: true,
      bidirectionalSync: true,
      multiUser: true,
      apiAccess: true,
      scheduledSync: true,
    })

    const { GET } = await import('@/app/api/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.syncLimit).toBe(-1)
    expect(data.documentsLimit).toBe(-1)
    expect(data.connectorsLimit).toBe(-1)
    expect(data.teamLimit).toBe(-1)
  })

  it('should only count AI usage inside the billing period', async () => {
    const start = new Date('2026-09-15T00:00:00Z')
    const end = new Date('2026-10-15T00:00:00Z')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      currentPeriodStart: start,
      currentPeriodEnd: end,
    } as any)
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([
      { action: 'ai_seo_completed', createdAt: new Date('2026-09-20T00:00:00Z') },
      { action: 'ai_seo_completed', createdAt: new Date('2026-08-01T00:00:00Z') },
    ] as any)

    const { GET } = await import('@/app/api/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.aiSEO).toBe(1)

    vi.useRealTimers()
  })
})
