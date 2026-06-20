/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Sync Workflow Tests
 *
 * Tests the complete sync workflow via API route handlers:
 * - POST /api/sync — create a document with valid source + dest connectors
 * - GET  /api/sync — list documents for the authenticated user
 * - POST /api/sync/[id]/check — trigger change detection
 * - GET  /api/sync/[id] — fetch single document with logs
 * - GET  /api/sync/[id]/preview — return document preview
 * - DELETE /api/sync/[id] — delete a document
 * - PATCH /api/sync/[id] — retry failed sync / schedule / disable schedule
 * - POST /api/sync/[id]/run — execute scheduled sync via scheduler
 * - POST /api/sync/check-remote — check remote content
 *
 * Error paths:
 * - Unauthenticated requests → 401
 * - Document not found / wrong owner → 404
 * - Validation errors → 400
 * - Quota exceeded → 429 / 403
 * - Invalid actions / frequencies → 400
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
import { enqueueSyncJob, enqueueChangeDetection } from '@omnysync/core/services/queue'
import {
  handleScheduledSyncRun,
  scheduleSync,
  disableScheduledSync,
} from '@omnysync/core/services/scheduler'
import { performSync, checkRemoteChanges } from '@omnysync/core/services/sync'

// ============================================================================
// SUITE
// ============================================================================

describe('Integration Sync Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue(mockSession())
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: quota OK
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true })
  })

  // ==========================================================================
  // POST /api/sync — Create sync document
  // ==========================================================================

  describe('POST /api/sync — create document', () => {
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

    it('should create a sync document and enqueue job', async () => {
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
      vi.mocked(enqueueSyncJob).mockResolvedValue(undefined as any)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('doc-1')
      expect(data.status).toBe('DRAFT')
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceConnectorId: 'connector-1',
            destConnectorId: 'connector-2',
          }),
        })
      )
      expect(enqueueSyncJob).toHaveBeenCalledWith(
        'doc-1',
        'connector-1',
        'connector-2',
        'test-user-1'
      )
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))

      expect(response.status).toBe(401)
    })

    it('should return 400 when validation fails', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: false,
        error: { issues: [{ message: 'Invalid source connector' }] },
      } as any)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest({}))

      expect(response.status).toBe(400)
    })

    it('should return 400 when connectors are not found', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: true,
        data: validBody,
      } as any)
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))

      expect(response.status).toBe(400)
    })

    it('should return 429 when quota exceeded with upgrade URL', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: true,
        data: validBody,
      } as any)
      vi.mocked(checkAndIncrementQuota).mockResolvedValue({
        allowed: false,
        upgradeUrl: 'https://omnysync.com/pricing',
      })

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))

      expect(response.status).toBe(429)
    })
  })

  // ==========================================================================
  // GET /api/sync — List documents
  // ==========================================================================

  describe('GET /api/sync — list documents', () => {
    it('should return documents for authenticated user', async () => {
      const docs = [
        {
          id: 'doc-1',
          title: 'Doc 1',
          syncStatus: 'SYNCED',
          sourceConnector: {},
          destConnector: {},
          syncLogs: [],
        },
        {
          id: 'doc-2',
          title: 'Doc 2',
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
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        })
      )
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/route')
      const response = await GET()

      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // GET /api/sync/[id] — Fetch single document
  // ==========================================================================

  describe('GET /api/sync/[id] — fetch document', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = () => new NextRequest('http://localhost:3000/api/sync/doc-1')

    it('should return document with logs for the owner', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        title: 'Test Doc',
        syncStatus: 'SYNCED',
        content: 'Hello',
        lastSyncedAt: new Date('2026-06-01'),
        autoSyncEnabled: true,
        syncFrequency: 'DAILY',
        nextSyncAt: new Date('2026-06-02'),
        lastSyncError: null,
        userId: 'test-user-1',
        syncLogs: [{ status: 'SUCCESS', message: 'Sync completed', createdAt: new Date() }],
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('doc-1')
      expect(data.title).toBe('Test Doc')
      expect(data.syncStatus).toBe('SYNCED')
      expect(data.logs).toHaveLength(1)
    })

    it('should return 404 when document belongs to another user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'other-user',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/route')
      const response = await GET(makeRequest(), makeContext())

      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // DELETE /api/sync/[id] — Delete document
  // ==========================================================================

  describe('DELETE /api/sync/[id] — delete document', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = () =>
      new NextRequest('http://localhost:3000/api/sync/doc-1', { method: 'DELETE' })

    it('should delete document and disable schedule', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(prisma.document.delete).mockResolvedValue({} as any)
      vi.mocked(disableScheduledSync).mockResolvedValue(true)

      const { DELETE } = await import('@/app/api/sync/[id]/route')
      const response = await DELETE(makeRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(disableScheduledSync).toHaveBeenCalledWith('doc-1')
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/sync/[id]/route')
      const response = await DELETE(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })
  })

  // ==========================================================================
  // PATCH /api/sync/[id] — Retry / Schedule / Disable schedule
  // ==========================================================================

  describe('PATCH /api/sync/[id] — retry & schedule', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = (body: any) =>
      new NextRequest('http://localhost:3000/api/sync/doc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    it('should retry a failed sync', async () => {
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
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ syncStatus: 'NOT_SYNCED', lastSyncError: null }),
        })
      )
      expect(performSync).toHaveBeenCalledWith('doc-1', 'sc-1', 'dc-1', 'test-user-1')
    })

    it('should return 400 when retrying a non-failed sync', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'SYNCED',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())

      expect(response.status).toBe(400)
    })

    it('should return 403 when quota exceeded on retry', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
        syncStatus: 'FAILED',
      } as any)
      vi.mocked(checkAndIncrementQuota).mockResolvedValue({
        allowed: false,
        upgradeUrl: 'https://omnysync.com/pricing',
      })

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'retry' }), makeContext())

      expect(response.status).toBe(403)
    })

    it('should schedule a sync with DAILY frequency', async () => {
      const nextSyncAt = new Date('2026-06-21T09:00:00Z')
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(scheduleSync).mockResolvedValue({
        success: true,
        nextSyncAt,
      })

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(
        makeRequest({ action: 'schedule', frequency: 'DAILY' }),
        makeContext()
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.autoSyncEnabled).toBe(true)
      expect(data.syncFrequency).toBe('DAILY')
      expect(scheduleSync).toHaveBeenCalledWith('doc-1', 'DAILY')
    })

    it('should return 400 for invalid schedule frequency', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(
        makeRequest({ action: 'schedule', frequency: 'BIWEEKLY' }),
        makeContext()
      )

      expect(response.status).toBe(400)
    })

    it('should disable scheduled sync', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(disableScheduledSync).mockResolvedValue(true)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'disable_schedule' }), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.autoSyncEnabled).toBe(false)
      expect(disableScheduledSync).toHaveBeenCalledWith('doc-1')
    })

    it('should return 400 for unknown action', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)

      const { PATCH } = await import('@/app/api/sync/[id]/route')
      const response = await PATCH(makeRequest({ action: 'unknown' }), makeContext())

      expect(response.status).toBe(400)
    })
  })

  // ==========================================================================
  // POST /api/sync/[id]/run — Execute scheduled sync
  // ==========================================================================

  describe('POST /api/sync/[id]/run — execute scheduled sync', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })

    it('should call handleScheduledSyncRun with document id', async () => {
      vi.mocked(handleScheduledSyncRun).mockResolvedValue({
        success: true,
        documentId: 'doc-1',
      } as any)

      const { POST } = await import('@/app/api/sync/[id]/run/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/run', { method: 'POST' })

      const response = await POST(req, makeContext())

      expect(handleScheduledSyncRun).toHaveBeenCalledWith('doc-1')
    })

    it('should return 401 when CRON_SECRET does not match in production', async () => {
      const origEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      process.env.CRON_SECRET = 'secret-123'

      const { POST } = await import('@/app/api/sync/[id]/run/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/run', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret' },
      })

      const response = await POST(req, makeContext())
      expect(response.status).toBe(401)

      process.env.NODE_ENV = origEnv
      delete process.env.CRON_SECRET
    })
  })

  // ==========================================================================
  // POST /api/sync/[id]/check — Trigger change detection
  // ==========================================================================

  describe('POST /api/sync/[id]/check — change detection', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = () =>
      new NextRequest('http://localhost:3000/api/sync/doc-1/check', { method: 'POST' })

    it('should queue change detection for the document owner', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(enqueueChangeDetection).mockResolvedValue(undefined as any)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const response = await POST(makeRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(enqueueChangeDetection).toHaveBeenCalledWith('doc-1', 'test-user-1')
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const response = await POST(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })

    it('should return 404 when document belongs to another user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'other-user',
      } as any)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const response = await POST(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })
  })

  // ==========================================================================
  // GET /api/sync/[id]/preview — Document preview
  // ==========================================================================

  describe('GET /api/sync/[id]/preview — document preview', () => {
    const makeContext = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })
    const makeRequest = () => new NextRequest('http://localhost:3000/api/sync/doc-1/preview')

    it('should return full document preview for the owner', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        title: 'Test Document',
        htmlContent: '<p>Hello World</p>',
        excerpt: 'Hello World',
        seoTitle: 'Test Document | SEO',
        seoDescription: 'A test document',
        featuredImage: 'https://example.com/image.jpg',
        userId: 'test-user-1',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const response = await GET(makeRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.title).toBe('Test Document')
      expect(data.htmlContent).toBe('<p>Hello World</p>')
      expect(data.seoTitle).toBe('Test Document | SEO')
      expect(data.featuredImage).toBe('https://example.com/image.jpg')
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const response = await GET(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })

    it('should return 404 when document belongs to another user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'other-user',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const response = await GET(makeRequest(), makeContext())

      expect(response.status).toBe(404)
    })
  })

  // ==========================================================================
  // POST /api/sync/check-remote — Check remote content
  // ==========================================================================

  describe('POST /api/sync/check-remote — remote content check', () => {
    const makeRequest = (body: any) =>
      new NextRequest('http://localhost:3000/api/sync/check-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    it('should return remote content when found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(checkRemoteChanges).mockResolvedValue({
        title: 'Remote Post',
        content: '<p>Remote content</p>',
      })

      const { POST } = await import('@/app/api/sync/check-remote/route')
      const response = await POST(makeRequest({ documentId: 'doc-1' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.remoteData).toBeDefined()
      expect(data.remoteData.title).toBe('Remote Post')
      expect(checkRemoteChanges).toHaveBeenCalledWith('doc-1', 'test-user-1')
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/check-remote/route')
      const response = await POST(makeRequest({ documentId: 'doc-1' }))

      expect(response.status).toBe(404)
    })

    it('should return 500 when checkRemoteChanges throws', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(checkRemoteChanges).mockRejectedValue(new Error('API timeout'))

      const { POST } = await import('@/app/api/sync/check-remote/route')
      const response = await POST(makeRequest({ documentId: 'doc-1' }))

      expect(response.status).toBe(500)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/check-remote/route')
      const response = await POST(makeRequest({ documentId: 'doc-1' }))

      expect(response.status).toBe(401)
    })
  })
})
