/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Sync API Tests
 *
 * Tests the sync API route handlers end-to-end:
 * - POST /api/sync avec body valide → 200
 * - POST /api/sync avec body invalide → 400
 * - GET /api/sync → liste paginée
 * - GET /api/sync/[id] → detail
 * - PATCH /api/sync/[id] (action=retry) → reset sync
 * - PATCH /api/sync/[id] (action=retry sur SYNCED) → 400
 *
 * Pattern: mocks auth + prisma + external services at module level.
 * Complementary tests exist in integration-sync-workflow.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks (hoisted before module imports) ──────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    connector: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/auth/subscription', () => ({
  checkAndIncrementQuota: vi.fn(),
}))

vi.mock('@/lib/validations', () => ({
  createSyncSchema: {
    safeParse: vi.fn(),
  },
}))

vi.mock('@/lib/api-error', () => ({
  apiError: vi.fn((message: string, status: number, code?: string) => {
    return {
      status,
      json: () =>
        Promise.resolve({
          error: message,
          ...(code ? { code } : {}),
        }),
    } as any
  }),
}))

vi.mock('@omnysync/core/services/queue', () => ({
  enqueueSyncJob: vi.fn(),
  enqueueChangeDetection: vi.fn(),
}))

vi.mock('@omnysync/core/services/scheduler', () => ({
  handleScheduledSyncRun: vi.fn(),
  scheduleSync: vi.fn(),
  disableScheduledSync: vi.fn(),
}))

vi.mock('@omnysync/core/services/sync', () => ({
  performSync: vi.fn(),
  checkRemoteChanges: vi.fn(),
}))

// ── Types ──────────────────────────────────────────────────────────────────

interface MockUser {
  id: string
  email: string
  role: string
  name?: string | null
}

interface MockSession {
  user: MockUser
  expires: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'test-user-1',
      email: 'test@omnysync.com',
      role: 'USER',
      name: 'Test User',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

// ── Imports ─────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkAndIncrementQuota } from '@/lib/auth/subscription'
import { createSyncSchema } from '@/lib/validations'
import { performSync } from '@omnysync/core/services/sync'

// ============================================================================
// SUITE
// ============================================================================

describe('Integration Sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue(mockSession())
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: quota OK
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true })
  })

  // ==========================================================================
  // POST /api/sync avec body valide → 200
  // ==========================================================================

  describe('POST /api/sync — create sync', () => {
    const validBody = {
      sourceConnectorId: 'connector-1',
      destConnectorId: 'connector-2',
      sourceDocumentId: 'doc-source-1',
      title: 'My Sync Document',
    }

    const makeRequest = (body: any) =>
      new NextRequest('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    it('should return 200 and create sync when body is valid', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: true,
        data: validBody,
      } as any)

      vi.mocked(prisma.connector.findUnique)
        .mockResolvedValueOnce({ id: 'connector-1', type: 'GOOGLE_DOCS' } as any)
        .mockResolvedValueOnce({ id: 'connector-2', type: 'WORDPRESS' } as any)

      const createdDoc = {
        id: 'doc-1',
        userId: 'test-user-1',
        organizationId: 'org-1',
        sourceConnectorId: 'connector-1',
        destConnectorId: 'connector-2',
        sourceId: 'doc-source-1',
        title: 'My Sync Document',
        status: 'DRAFT',
        syncStatus: 'NOT_SYNCED',
      }
      vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)

      const { enqueueSyncJob } = await import('@omnysync/core/services/queue')
      vi.mocked(enqueueSyncJob).mockResolvedValue(undefined as any)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('doc-1')
      expect(data.status).toBe('DRAFT')
      expect(enqueueSyncJob).toHaveBeenCalledWith(
        'doc-1',
        'connector-1',
        'connector-2',
        'test-user-1'
      )
    })

    // ========================================================================
    // POST /api/sync avec body invalide → 400
    // ========================================================================

    it('should return 400 when body is invalid', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: false,
        error: { issues: [{ message: 'Invalid source connector' }] },
      } as any)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest({}))

      expect(response.status).toBe(400)
    })

    it('should return 400 when connectors do not exist', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: true,
        data: validBody,
      } as any)
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))

      expect(response.status).toBe(400)
    })

    it('should return 400 when title is missing', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: false,
        error: { issues: [{ message: 'Title is required' }] },
      } as any)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(
        makeRequest({
          sourceConnectorId: 'connector-1',
          destConnectorId: 'connector-2',
          sourceDocumentId: 'doc-source-1',
        })
      )

      expect(response.status).toBe(400)
    })
  })

  // ==========================================================================
  // GET /api/sync → liste paginée
  // ==========================================================================

  describe('GET /api/sync — list documents', () => {
    it('should return paginated list of sync documents', async () => {
      const docs = [
        {
          id: 'doc-1',
          title: 'Document 1',
          syncStatus: 'SYNCED',
          sourceConnector: {},
          destConnector: {},
          syncLogs: [],
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          syncStatus: 'FAILED',
          sourceConnector: {},
          destConnector: {},
          syncLogs: [],
        },
      ]
      vi.mocked(prisma.document.findMany).mockResolvedValue(docs as any)

      const { GET } = await import('@/app/api/sync/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
      expect(data[0].id).toBe('doc-1')
      expect(data[1].syncStatus).toBe('FAILED')
      // Verify it filters by the user's org
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        })
      )
    })

    it('should return empty array when user has no documents', async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([])

      const { GET } = await import('@/app/api/sync/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/route')
      const response = await GET()

      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // GET /api/sync/[id] → detail
  // ==========================================================================

  describe('GET /api/sync/[id] — document detail', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = () => new NextRequest('http://localhost:3000/api/sync/doc-1')

    it('should return document detail with sync logs', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        title: 'Test Document',
        syncStatus: 'SYNCED',
        content: 'Document content preview...',
        lastSyncedAt: new Date('2026-06-01T12:00:00Z'),
        autoSyncEnabled: true,
        syncFrequency: 'WEEKLY',
        nextSyncAt: new Date('2026-06-08T12:00:00Z'),
        lastSyncError: null,
        userId: 'test-user-1',
        syncLogs: [
          {
            status: 'SUCCESS',
            message: 'Sync completed successfully',
            createdAt: new Date('2026-06-01T12:00:00Z'),
          },
          {
            status: 'INFO',
            message: 'Content fetched from source',
            createdAt: new Date('2026-06-01T11:59:00Z'),
          },
        ],
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext('doc-1'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('doc-1')
      expect(data.title).toBe('Test Document')
      expect(data.syncStatus).toBe('SYNCED')
      expect(data.autoSyncEnabled).toBe(true)
      expect(data.syncFrequency).toBe('WEEKLY')
      expect(data.logs).toHaveLength(2)
      expect(data.logs[0].status).toBe('SUCCESS')
      expect(data.logs[0].message).toBe('Sync completed successfully')
    })

    it('should return 404 when document is not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext('nonexistent'))

      expect(response.status).toBe(404)
    })

    it('should return 404 when document belongs to another user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-other',
        userId: 'other-user',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext('doc-other'))

      expect(response.status).toBe(404)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext('doc-1'))

      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // PATCH /api/sync/[id] (action=retry) → reset sync
  // ==========================================================================

  describe('PATCH /api/sync/[id] — retry sync', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = (body: any) =>
      new NextRequest('http://localhost:3000/api/sync/doc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    it('should retry a failed sync and call performSync', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'FAILED',
        sourceConnectorId: 'sc-1',
        destConnectorId: 'dc-1',
        sourceConnector: {} as any,
        destConnector: {} as any,
      } as any)
      vi.mocked(prisma.document.update).mockResolvedValue({} as any)
      vi.mocked(performSync).mockResolvedValue({
        success: true,
        documentId: 'doc-1',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Verify document was reset to NOT_SYNCED before retry
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            syncStatus: 'NOT_SYNCED',
            lastSyncError: null,
          }),
        })
      )
      // Verify performSync was called with correct args
      expect(performSync).toHaveBeenCalledWith('doc-1', 'sc-1', 'dc-1', 'test-user-1')
    })

    // ========================================================================
    // PATCH /api/sync/[id] (action=retry sur SYNCED) → 400
    // ========================================================================

    it('should return 400 when retrying a document that is already SYNCED', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'SYNCED',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())

      expect(response.status).toBe(400)
    })

    it('should return 400 when retrying a document that is already SYNCING', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'SYNCING',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())

      expect(response.status).toBe(400)
    })

    it('should return 400 when document has NOT_SYNCED status', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'NOT_SYNCED',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())

      expect(response.status).toBe(400)
    })
  })
})
