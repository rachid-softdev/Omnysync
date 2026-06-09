/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

/**
 * Sync Workflow Integration Tests
 *
 * Tests the sync API route handlers:
 * - POST /api/sync — creates a sync with valid source + dest connectors
 * - POST /api/sync/[id]/run — executes sync via scheduler
 * - GET /api/sync/[id]/preview — returns diff/preview
 * - POST /api/sync/[id]/check — checks remote content
 * - Error handling: invalid connectors, auth failures
 * - Authorization: non-org member cannot access org's syncs
 *
 * Pattern: mock auth + prisma + external services at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Types ────────────────────────────────────────────────────────────────────

interface MockUser {
  id: string
  email: string
  role: string
  name?: string | null
  has2FA?: boolean
  twoFactorVerified?: boolean
}

interface MockSession {
  user: MockUser
  expires: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'test-user-1',
      email: 'test@omnysync.com',
      role: 'USER',
      name: 'Test User',
      has2FA: false,
      twoFactorVerified: false,
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

// ── Mocks ────────────────────────────────────────────────────────────────────
// All mocks are hoisted before module imports

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
      updateMany: vi.fn(),
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
    // apiError returns a NextResponse-like object
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
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkAndIncrementQuota } from '@/lib/auth/subscription'
import { createSyncSchema } from '@/lib/validations'
import { enqueueSyncJob, enqueueChangeDetection } from '@omnysync/core/services/queue'
import { handleScheduledSyncRun } from '@omnysync/core/services/scheduler'

// ============================================================================
// SUITE
// ============================================================================

describe('Sync Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue(mockSession())
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: quota OK
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true })
  })

  // ==========================================================================
  // POST /api/sync — Create sync
  // ==========================================================================

  describe('POST /api/sync', () => {
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

    it('should create a sync and enqueue job when valid', async () => {
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

    it('should return 400 when connectors are invalid', async () => {
      vi.mocked(createSyncSchema.safeParse).mockReturnValue({
        success: true,
        data: validBody,
      } as any)

      vi.mocked(prisma.connector.findUnique).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/route')
      const response = await POST(makeRequest(validBody))

      expect(response.status).toBe(400)
    })

    it('should return 429 when quota exceeded', async () => {
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
  // POST /api/sync/[id]/run — Execute sync
  // ==========================================================================

  describe('POST /api/sync/[id]/run', () => {
    it('should execute the sync via scheduler', async () => {
      vi.mocked(handleScheduledSyncRun).mockResolvedValue({
        success: true,
        documentId: 'doc-1',
      } as any)

      const { POST } = await import('@/app/api/sync/[id]/run/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await POST(req, ctx)
      // Handler returns handleScheduledSyncRun result directly (not NextResponse)
      expect(handleScheduledSyncRun).toHaveBeenCalledWith('doc-1')
    })

    it('should return 401 when CRON_SECRET does not match in production', async () => {
      const origEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      process.env.CRON_SECRET = 'secret-123'

      const { POST } = await import('@/app/api/sync/[id]/run/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer wrong-secret',
        },
      })
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await POST(req, ctx)

      expect(response.status).toBe(401)

      // Restore
      process.env.NODE_ENV = origEnv
      delete process.env.CRON_SECRET
    })
  })

  // ==========================================================================
  // POST /api/sync/[id]/check — Check remote content
  // ==========================================================================

  describe('POST /api/sync/[id]/check', () => {
    it('should queue change detection for the document owner', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'test-user-1',
      } as any)
      vi.mocked(enqueueChangeDetection).mockResolvedValue(undefined as any)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/check', { method: 'POST' })
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await POST(req, ctx)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(enqueueChangeDetection).toHaveBeenCalledWith('doc-1', 'test-user-1')
    })

    it('should return 404 when document does not belong to user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'other-user',
      } as any)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/check', { method: 'POST' })
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await POST(req, ctx)
      expect(response.status).toBe(404)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { POST } = await import('@/app/api/sync/[id]/check/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/check', { method: 'POST' })
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await POST(req, ctx)
      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // GET /api/sync/[id]/preview — Preview
  // ==========================================================================

  describe('GET /api/sync/[id]/preview', () => {
    it('should return document preview for the owner', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        title: 'Test Document',
        htmlContent: '<p>Hello</p>',
        excerpt: 'Hello',
        seoTitle: 'Test Document | SEO',
        seoDescription: 'A test document',
        featuredImage: 'https://example.com/image.jpg',
        userId: 'test-user-1',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/preview')
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await GET(req, ctx)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('doc-1')
      expect(data.title).toBe('Test Document')
      expect(data.htmlContent).toBe('<p>Hello</p>')
      expect(data.seoTitle).toBe('Test Document | SEO')
    })

    it('should return 404 when document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/preview')
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await GET(req, ctx)
      expect(response.status).toBe(404)
    })

    it('should return 404 when document belongs to another user', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        userId: 'other-user',
      } as any)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/preview')
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await GET(req, ctx)
      expect(response.status).toBe(404)
    })

    it('should return 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/[id]/preview/route')
      const req = new NextRequest('http://localhost:3000/api/sync/doc-1/preview')
      const ctx = { params: Promise.resolve({ id: 'doc-1' }) }

      const response = await GET(req, ctx)
      expect(response.status).toBe(401)
    })
  })

  // ==========================================================================
  // Authorization: cross-org access denied
  // ==========================================================================

  describe('Cross-org authorization', () => {
    it('should not return documents belonging to other orgs in GET /api/sync', async () => {
      // Simulate the GET handler which fetches by orgId from session
      vi.mocked(getUserOrgId).mockResolvedValue('org-1')

      vi.mocked(prisma.document.findMany).mockImplementation(async (args: any) => {
        const where = args?.where ?? {}
        if (where.organizationId === 'org-1') {
          return [{ id: 'doc-1', title: 'Org 1 Doc' }] as any
        }
        return []
      })

      const { GET } = await import('@/app/api/sync/route')
      const req = new NextRequest('http://localhost:3000/api/sync')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        })
      )
    })

    it('should return 401 for unauthenticated GET /api/sync', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const { GET } = await import('@/app/api/sync/route')
      const response = await GET()
      expect(response.status).toBe(401)
    })
  })
})
