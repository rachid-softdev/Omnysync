/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncLog: { findMany: vi.fn() },
    document: { count: vi.fn(), findMany: vi.fn() },
    connector: { count: vi.fn() },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

import { GET } from '../route'

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/analytics')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns analytics data with default period', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([
      { id: 'log-1', action: 'sync_doc', status: 'SUCCESS', createdAt: new Date('2026-06-19') },
      { id: 'log-2', action: 'sync_doc', status: 'ERROR', createdAt: new Date('2026-06-18') },
    ] as any)
    vi.mocked(prisma.document.count).mockResolvedValue(15)
    vi.mocked(prisma.connector.count).mockResolvedValue(3)
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        sourceConnector: { type: 'google_docs' },
        destConnector: { type: 'wordpress' },
      },
      {
        id: 'doc-2',
        sourceConnector: { type: 'notion' },
        destConnector: { type: 'ghost' },
      },
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/analytics')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalSyncs).toBe(2)
    expect(data.successRate).toBe(50) // 1/2 success
    expect(data.failedSyncs).toBe(1)
    expect(data.totalDocuments).toBe(15)
    expect(data.activeConnectors).toBe(3)
    expect(data.recentActivity).toHaveLength(2)
    expect(data.syncByDay).toBeDefined()
    expect(data.connectorsUsage).toBeDefined()
  })

  it('returns zero success rate when no syncs', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.syncLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.document.count).mockResolvedValue(0)
    vi.mocked(prisma.connector.count).mockResolvedValue(0)
    vi.mocked(prisma.document.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/analytics')
    const response = await GET(request)
    const data = await response.json()

    expect(data.totalSyncs).toBe(0)
    expect(data.successRate).toBe(0)
    expect(data.failedSyncs).toBe(0)
  })

  it('throws when prisma fails (no try/catch in route)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.syncLog.findMany).mockRejectedValue(new Error('DB error'))

    const request = new NextRequest('http://localhost:3000/api/analytics')
    await expect(GET(request)).rejects.toThrow('DB error')
  })
})
