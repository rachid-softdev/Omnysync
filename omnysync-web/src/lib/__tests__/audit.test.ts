/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  auditLog,
  withAudit,
  getAuditLogs,
  getAuditLogsForResource,
  cleanupOldAuditLogs,
} from '../audit'
import type { AuditAction, AuditTargetType } from '../audit'

// Mock prisma
const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
  },
  user: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockHeadersGet = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
}))

function setDefaultHeadersMock() {
  mockHeadersGet.mockImplementation((key: string) => {
    if (key === 'x-forwarded-for') return '192.168.1.42'
    if (key === 'user-agent') return 'test-agent/1.0'
    return null
  })
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com' },
  }),
}))

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultHeadersMock()
  })

  it('creates audit log entry with user session', async () => {
    await auditLog('org-1', 'sync.started', 'sync', 'sync-1', { sourceType: 'GOOGLE_DOCS' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-123',
        action: 'sync.started',
        targetType: 'sync',
        targetId: 'sync-1',
        details: { sourceType: 'GOOGLE_DOCS' },
        ipAddress: '192.168.1.42',
        userAgent: 'test-agent/1.0',
      },
    })
  })

  it('uses "system" when no user in session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)

    await auditLog('org-1', 'org.created', 'org')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'system' }),
      })
    )
  })

  it('handles all action types without error', async () => {
    const actions: AuditAction[] = [
      'org.created',
      'org.updated',
      'org.deleted',
      'org.settings.updated',
      'member.invited',
      'member.joined',
      'member.role.updated',
      'member.removed',
      'connector.created',
      'connector.updated',
      'connector.deleted',
      'connector.test',
      'connector.disconnected',
      'connector.reconnected',
      'document.created',
      'document.updated',
      'document.deleted',
      'document.archived',
      'document.restored',
      'sync.started',
      'sync.completed',
      'sync.failed',
      'sync.scheduled',
      'sync.cancelled',
      'sync.changes.detected',
      'sync.conflict.resolved',
      'approval.requested',
      'approval.approved',
      'approval.rejected',
      'approval.expired',
      'billing.plan.upgraded',
      'billing.plan.downgraded',
      'billing.subscription.cancelled',
      'billing.payment.failed',
    ]

    for (const action of actions) {
      await auditLog('org-1', action, 'org')
      expect(mockPrisma.auditLog.create).toHaveBeenCalled()
      vi.clearAllMocks()
    }
  })

  it('handles all target types', async () => {
    const targetTypes: AuditTargetType[] = [
      'org',
      'member',
      'connector',
      'document',
      'sync',
      'approval',
      'billing',
    ]

    for (const tt of targetTypes) {
      await auditLog('org-1', 'org.created', tt, 'target-1')
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ targetType: tt }),
        })
      )
      vi.clearAllMocks()
    }
  })

  it('does not throw when prisma fails (swallows error)', async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('DB connection failed'))

    await expect(auditLog('org-1', 'sync.started', 'sync')).resolves.not.toThrow()
  })

  it('handles undefined targetId gracefully', async () => {
    await auditLog('org-1', 'org.created', 'org', undefined, { key: 'value' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetId: undefined,
          details: { key: 'value' },
        }),
      })
    )
  })

  it('handles empty details object', async () => {
    await auditLog('org-1', 'org.created', 'org')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ details: {} }),
      })
    )
  })

  it('handles payload with large details object', async () => {
    const largeDetails = Array.from({ length: 100 }, (_, i) => ({
      [`key${i}`]: `value${i}`,
    })).reduce((acc, cur) => ({ ...acc, ...cur }), {})

    await auditLog('org-1', 'sync.completed', 'sync', 'sync-1', largeDetails)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ key0: 'value0', key99: 'value99' }),
        }),
      })
    )
  })

  it('falls back to unknown ip/user-agent when headers are missing', async () => {
    const { headers: mockHeadersFn } = await import('next/headers')
    const mockHeadersInstance = await mockHeadersFn()
    mockHeadersInstance.get.mockReturnValue(null)

    await auditLog('org-1', 'org.created', 'org')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: 'unknown',
          userAgent: 'unknown',
        }),
      })
    )
  })

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    const { headers: mockHeadersFn } = await import('next/headers')
    const mockHeadersInstance = await mockHeadersFn()
    mockHeadersInstance.get.mockImplementation((key: string) => {
      if (key === 'x-real-ip') return '10.0.0.1'
      if (key === 'user-agent') return 'test-agent/1.0'
      return null
    })

    await auditLog('org-1', 'org.created', 'org')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'test-agent/1.0',
        }),
      })
    )
  })
})

describe('withAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultHeadersMock()
  })

  it('logs success and returns function result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success-result')

    const result = await withAudit(
      'org-1',
      'sync.completed',
      'sync',
      'sync-1',
      { tokensUsed: 500 },
      fn
    )

    expect(result).toBe('success-result')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.completed',
          details: expect.objectContaining({ success: true, tokensUsed: 500 }),
        }),
      })
    )
  })

  it('logs failure and re-throws error', async () => {
    const error = new Error('Sync failed unexpectedly')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(
      withAudit('org-1', 'sync.failed', 'sync', 'sync-1', undefined, fn)
    ).rejects.toThrow('Sync failed unexpectedly')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.failed',
          details: expect.objectContaining({
            success: false,
            errorMessage: 'Sync failed unexpectedly',
          }),
        }),
      })
    )
  })

  it('still re-throws original error when catch-block auditLog fails', async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('audit db down'))
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('audit db down'))

    const fn = vi.fn().mockRejectedValue(new Error('original error'))

    await expect(
      withAudit('org-1', 'sync.failed', 'sync', 'sync-1', undefined, fn)
    ).rejects.toThrow('original error')
  })
})

describe('getAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultHeadersMock()
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'log-1', action: 'sync.started', createdAt: new Date() },
      { id: 'log-2', action: 'sync.completed', createdAt: new Date() },
    ])
    mockPrisma.auditLog.count.mockResolvedValue(2)
  })

  it('returns paginated logs for an organization', async () => {
    const result = await getAuditLogs('org-1')

    expect(result.logs).toHaveLength(2)
    expect(result.pagination).toEqual({
      limit: 50,
      offset: 0,
      total: 2,
      hasMore: false,
    })
  })

  it('filters by action type', async () => {
    await getAuditLogs('org-1', { action: 'sync.started' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'sync.started' }),
      })
    )
  })

  it('filters by target type', async () => {
    await getAuditLogs('org-1', { targetType: 'document' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetType: 'document' }),
      })
    )
  })

  it('filters by date range', async () => {
    const startDate = new Date('2026-01-01')
    const endDate = new Date('2026-06-20')

    await getAuditLogs('org-1', { startDate, endDate })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      })
    )
  })

  it('filters by startDate only', async () => {
    const startDate = new Date('2026-01-01')

    await getAuditLogs('org-1', { startDate })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: startDate },
        }),
      })
    )
  })

  it('filters by endDate only', async () => {
    const endDate = new Date('2026-06-20')

    await getAuditLogs('org-1', { endDate })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lte: endDate },
        }),
      })
    )
  })

  it('filters by userId', async () => {
    await getAuditLogs('org-1', { userId: 'user-123' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-123' }),
      })
    )
  })

  it('filters by targetId', async () => {
    await getAuditLogs('org-1', { targetId: 'doc-1' })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetId: 'doc-1' }),
      })
    )
  })

  it('respects custom limit and offset', async () => {
    await getAuditLogs('org-1', { limit: 10, offset: 20 })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    )
  })

  it('returns hasMore true when there are more results', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(60)
    mockPrisma.auditLog.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: `log-${i}`,
        action: 'sync.started',
        createdAt: new Date(),
      }))
    )

    const result = await getAuditLogs('org-1', { limit: 50 })

    expect(result.pagination.hasMore).toBe(true)
  })

  it('returns hasMore false when all results are fetched', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(50)
    mockPrisma.auditLog.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: `log-${i}`,
        action: 'sync.started' as const,
        createdAt: new Date(),
      }))
    )

    const result = await getAuditLogs('org-1', { limit: 50 })

    expect(result.pagination.hasMore).toBe(false)
  })

  it('includes user data in results', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'sync.started' as const,
        createdAt: new Date(),
        user: { id: 'user-123', name: 'Test User', email: 'test@example.com', image: null },
      },
    ]
    mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs)

    const result = await getAuditLogs('org-1')

    expect(result.logs[0]).toHaveProperty('user')
    expect(result.logs[0].user).toEqual({
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
    })
  })
})

describe('getAuditLogsForResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultHeadersMock()
  })

  it('returns logs for a specific resource', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'log-1', action: 'document.created', createdAt: new Date() },
    ])

    const result = await getAuditLogsForResource('org-1', 'document', 'doc-1')

    expect(result).toHaveLength(1)
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', targetType: 'document', targetId: 'doc-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })
  })

  it('respects custom limit', async () => {
    await getAuditLogsForResource('org-1', 'connector', 'conn-1', 5)

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })
})

describe('cleanupOldAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes logs older than default 90 days', async () => {
    const count = await cleanupOldAuditLogs()

    expect(count).toBe(5)
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled()

    const call = mockPrisma.auditLog.deleteMany.mock.calls[0][0]
    expect(call.where.createdAt.lt).toBeInstanceOf(Date)
  })

  it('deletes logs older than custom duration', async () => {
    await cleanupOldAuditLogs(30)

    const call = mockPrisma.auditLog.deleteMany.mock.calls[0][0]
    const cutoff = call.where.createdAt.lt as Date
    const now = new Date()
    const diffDays = Math.round((now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(30)
  })

  it('returns 0 when no logs to clean', async () => {
    mockPrisma.auditLog.deleteMany.mockResolvedValueOnce({ count: 0 })

    const count = await cleanupOldAuditLogs()

    expect(count).toBe(0)
  })

  it('propagates error when deleteMany throws', async () => {
    mockPrisma.auditLog.deleteMany.mockRejectedValueOnce(new Error('DB unavailable'))

    await expect(cleanupOldAuditLogs()).rejects.toThrow('DB unavailable')
  })
})

describe('convenience audit functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auditOrg.created calls auditLog with correct params', async () => {
    const { auditOrg } = await import('../audit')
    await auditOrg.created('org-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'org.created', targetType: 'org' }),
      })
    )
  })

  it('auditMember.invited calls auditLog with invite details', async () => {
    const { auditMember } = await import('../audit')
    await auditMember.invited('org-1', 'invited@example.com', 'member')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'member.invited',
          details: expect.objectContaining({
            inviteEmail: 'invited@example.com',
            newRole: 'member',
          }),
        }),
      })
    )
  })

  it('auditConnector.created calls auditLog with connector details', async () => {
    const { auditConnector } = await import('../audit')
    await auditConnector.created('org-1', 'conn-1', 'Google Drive', 'GOOGLE_DOCS')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'connector.created',
          details: expect.objectContaining({
            connectorName: 'Google Drive',
            connectorType: 'GOOGLE_DOCS',
          }),
        }),
      })
    )
  })

  it('auditSync.failed calls auditLog with error message', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.failed('org-1', 'sync-1', 'Connection timeout')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.failed',
          details: expect.objectContaining({ errorMessage: 'Connection timeout' }),
        }),
      })
    )
  })

  it('auditBilling.planUpgraded calls auditLog with plan details', async () => {
    const { auditBilling } = await import('../audit')
    await auditBilling.planUpgraded('org-1', 'free', 'pro')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'billing.plan.upgraded',
          details: expect.objectContaining({ fromPlan: 'free', toPlan: 'pro' }),
        }),
      })
    )
  })

  it('auditBilling.paymentFailed calls auditLog with amount', async () => {
    const { auditBilling } = await import('../audit')
    await auditBilling.paymentFailed('org-1', 2999, 'EUR')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'billing.payment.failed',
          details: expect.objectContaining({ amount: 2999, currency: 'EUR' }),
        }),
      })
    )
  })

  // --- Remaining auditOrg convenience functions ---

  it('auditOrg.updated calls auditLog', async () => {
    const { auditOrg } = await import('../audit')
    await auditOrg.updated('org-1', { key: 'val' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'org.updated', details: { key: 'val' } }),
      })
    )
  })

  it('auditOrg.deleted calls auditLog', async () => {
    const { auditOrg } = await import('../audit')
    await auditOrg.deleted('org-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'org.deleted' }),
      })
    )
  })

  it('auditOrg.settingsUpdated calls auditLog', async () => {
    const { auditOrg } = await import('../audit')
    await auditOrg.settingsUpdated('org-1', { key: 'val' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'org.settings.updated', details: { key: 'val' } }),
      })
    )
  })

  // --- Remaining auditMember convenience functions ---

  it('auditMember.joined calls auditLog', async () => {
    const { auditMember } = await import('../audit')
    await auditMember.joined('org-1', 'user-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'member.joined', targetId: 'user-1' }),
      })
    )
  })

  it('auditMember.roleUpdated calls auditLog', async () => {
    const { auditMember } = await import('../audit')
    await auditMember.roleUpdated('org-1', 'user-1', 'member', 'admin')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'member.role.updated',
          targetId: 'user-1',
          details: { oldRole: 'member', newRole: 'admin' },
        }),
      })
    )
  })

  it('auditMember.removed calls auditLog', async () => {
    const { auditMember } = await import('../audit')
    await auditMember.removed('org-1', 'user-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'member.removed', targetId: 'user-1' }),
      })
    )
  })

  // --- Remaining auditConnector convenience functions ---

  it('auditConnector.updated calls auditLog', async () => {
    const { auditConnector } = await import('../audit')
    await auditConnector.updated('org-1', 'conn-1', { connectionStatus: 'active' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'connector.updated',
          targetId: 'conn-1',
          details: { connectionStatus: 'active' },
        }),
      })
    )
  })

  it('auditConnector.deleted calls auditLog', async () => {
    const { auditConnector } = await import('../audit')
    await auditConnector.deleted('org-1', 'conn-1', 'My Connector')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'connector.deleted',
          targetId: 'conn-1',
          details: { connectorName: 'My Connector' },
        }),
      })
    )
  })

  it('auditConnector.tested calls auditLog', async () => {
    const { auditConnector } = await import('../audit')
    await auditConnector.tested('org-1', 'conn-1', true)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'connector.test',
          targetId: 'conn-1',
          details: { success: true },
        }),
      })
    )
  })

  // --- auditDocument convenience functions ---

  it('auditDocument.created calls auditLog', async () => {
    const { auditDocument } = await import('../audit')
    await auditDocument.created('org-1', 'doc-1', 'My Doc')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document.created',
          targetId: 'doc-1',
          details: { documentTitle: 'My Doc' },
        }),
      })
    )
  })

  it('auditDocument.updated calls auditLog', async () => {
    const { auditDocument } = await import('../audit')
    await auditDocument.updated('org-1', 'doc-1', { wordCount: 500 })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document.updated',
          targetId: 'doc-1',
          details: { wordCount: 500 },
        }),
      })
    )
  })

  it('auditDocument.deleted calls auditLog', async () => {
    const { auditDocument } = await import('../audit')
    await auditDocument.deleted('org-1', 'doc-1', 'My Doc')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document.deleted',
          targetId: 'doc-1',
          details: { documentTitle: 'My Doc' },
        }),
      })
    )
  })

  it('auditDocument.archived calls auditLog', async () => {
    const { auditDocument } = await import('../audit')
    await auditDocument.archived('org-1', 'doc-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'document.archived', targetId: 'doc-1' }),
      })
    )
  })

  it('auditDocument.restored calls auditLog', async () => {
    const { auditDocument } = await import('../audit')
    await auditDocument.restored('org-1', 'doc-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'document.restored', targetId: 'doc-1' }),
      })
    )
  })

  // --- Remaining auditSync convenience functions ---

  it('auditSync.started calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.started('org-1', 'sync-1', { sourceType: 'NOTION' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.started',
          targetId: 'sync-1',
          details: { sourceType: 'NOTION' },
        }),
      })
    )
  })

  it('auditSync.completed calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.completed('org-1', 'sync-1', { syncDuration: 1500 })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.completed',
          targetId: 'sync-1',
          details: { syncDuration: 1500 },
        }),
      })
    )
  })

  it('auditSync.scheduled calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.scheduled('org-1', 'sync-1', 'daily')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.scheduled',
          targetId: 'sync-1',
          details: { syncFrequency: 'daily' },
        }),
      })
    )
  })

  it('auditSync.cancelled calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.cancelled('org-1', 'sync-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'sync.cancelled', targetId: 'sync-1' }),
      })
    )
  })

  it('auditSync.changesDetected calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.changesDetected('org-1', 'sync-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'sync.changes.detected', targetId: 'sync-1' }),
      })
    )
  })

  it('auditSync.conflictResolved calls auditLog', async () => {
    const { auditSync } = await import('../audit')
    await auditSync.conflictResolved('org-1', 'sync-1', 'keep-source')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sync.conflict.resolved',
          targetId: 'sync-1',
          details: { resolution: 'keep-source' },
        }),
      })
    )
  })

  // --- auditApproval convenience functions ---

  it('auditApproval.requested calls auditLog', async () => {
    const { auditApproval } = await import('../audit')
    await auditApproval.requested('org-1', 'app-1', 'doc-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'approval.requested',
          targetId: 'app-1',
          details: { documentId: 'doc-1' },
        }),
      })
    )
  })

  it('auditApproval.approved calls auditLog', async () => {
    const { auditApproval } = await import('../audit')
    await auditApproval.approved('org-1', 'app-1', 'user-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'approval.approved',
          targetId: 'app-1',
          details: { approvedBy: 'user-1' },
        }),
      })
    )
  })

  it('auditApproval.rejected calls auditLog', async () => {
    const { auditApproval } = await import('../audit')
    await auditApproval.rejected('org-1', 'app-1', 'user-1', 'Not ready')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'approval.rejected',
          targetId: 'app-1',
          details: { approvedBy: 'user-1', reason: 'Not ready' },
        }),
      })
    )
  })

  it('auditApproval.expired calls auditLog', async () => {
    const { auditApproval } = await import('../audit')
    await auditApproval.expired('org-1', 'app-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'approval.expired', targetId: 'app-1' }),
      })
    )
  })

  // --- Remaining auditBilling convenience functions ---

  it('auditBilling.planDowngraded calls auditLog', async () => {
    const { auditBilling } = await import('../audit')
    await auditBilling.planDowngraded('org-1', 'pro', 'free')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'billing.plan.downgraded',
          details: { fromPlan: 'pro', toPlan: 'free' },
        }),
      })
    )
  })

  it('auditBilling.subscriptionCancelled calls auditLog', async () => {
    const { auditBilling } = await import('../audit')
    await auditBilling.subscriptionCancelled('org-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'billing.subscription.cancelled' }),
      })
    )
  })
})
