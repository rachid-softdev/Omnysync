/**
 * Tests pour les routes API de Sync
 * Couvre GET /api/sync, POST /api/sync, POST /api/sync/[id]/run, POST /api/sync/[id]/check
 *
 * Pattern: mock auth + prisma + services externes au niveau module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    connector: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
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
  apiError: vi.fn((message: string, status: number, code?: string) => ({
    status,
    json: () =>
      Promise.resolve({
        error: message,
        ...(code ? { code } : {}),
      }),
  })),
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
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkAndIncrementQuota } from '@/lib/auth/subscription'
import { createSyncSchema } from '@/lib/validations'
import { apiError } from '@/lib/api-error'
import { enqueueSyncJob, enqueueChangeDetection } from '@omnysync/core/services/queue'
import {
  handleScheduledSyncRun,
  scheduleSync,
  disableScheduledSync,
} from '@omnysync/core/services/scheduler'
import { performSync } from '@omnysync/core/services/sync'

// ============================================================================
// GET /api/sync
// ============================================================================

describe('GET /api/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/sync/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  // ── Retourne les documents de l'org ──────────────────────────────────────

  it('should return documents with sourceConnector, destConnector, and syncLogs', async () => {
    const createdAt = '2026-06-19T13:20:57.445Z'

    const mockDocuments = [
      {
        id: 'doc-1',
        title: 'Doc 1',
        status: 'DRAFT',
        syncStatus: 'NOT_SYNCED',
        organizationId: 'org-1',
        sourceConnector: { id: 'c1', type: 'WORDPRESS', name: 'Source WP' },
        destConnector: { id: 'c2', type: 'GHOST', name: 'Dest Ghost' },
        syncLogs: [
          { id: 'log-1', status: 'INFO', message: 'Started', createdAt: new Date(createdAt) },
        ],
      },
      {
        id: 'doc-2',
        title: 'Doc 2',
        status: 'PUBLISHED',
        syncStatus: 'SYNCED',
        organizationId: 'org-1',
        sourceConnector: { id: 'c3', type: 'NOTION', name: 'Source Notion' },
        destConnector: { id: 'c4', type: 'WEBFLOW', name: 'Dest Webflow' },
        syncLogs: [],
      },
    ]

    // Après sérialisation JSON, les Dates deviennent des strings ISO
    const expectedDocuments = [
      {
        ...mockDocuments[0],
        syncLogs: [{ id: 'log-1', status: 'INFO', message: 'Started', createdAt }],
      },
      mockDocuments[1],
    ]

    vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocuments as any)

    const { GET } = await import('@/app/api/sync/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(expectedDocuments)
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        include: {
          sourceConnector: true,
          destConnector: true,
          syncLogs: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        },
        orderBy: { updatedAt: 'desc' },
      })
    )
  })
})

// ============================================================================
// POST /api/sync
// ============================================================================

describe('POST /api/sync', () => {
  const validBody = {
    sourceConnectorId: '550e8400-e29b-41d4-a716-446655440000',
    destConnectorId: '550e8400-e29b-41d4-a716-446655440001',
    sourceDocumentId: 'ext-doc-123',
    title: 'Test Sync',
  }

  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: validation Zod passe
    vi.mocked(createSyncSchema.safeParse).mockReturnValue({
      success: true,
      data: validBody,
    } as any)

    // Default: quota OK
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true, remaining: 99 } as any)

    // Default: connecteurs existent et appartiennent à l'org
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'connector-id',
      type: 'WORDPRESS',
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(401)
  })

  // ── Création réussie ─────────────────────────────────────────────────────

  it('should create sync with source and dest connectors', async () => {
    const createdDoc = {
      id: 'doc-new',
      userId: 'user-1',
      organizationId: 'org-1',
      sourceConnectorId: validBody.sourceConnectorId,
      destConnectorId: validBody.destConnectorId,
      sourceId: validBody.sourceDocumentId,
      title: validBody.title,
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(enqueueSyncJob).mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(makeRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('doc-new')
    expect(data.title).toBe('Test Sync')

    // Vérifie document.create
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          sourceConnectorId: validBody.sourceConnectorId,
          destConnectorId: validBody.destConnectorId,
          title: 'Test Sync',
          status: 'DRAFT',
          syncStatus: 'NOT_SYNCED',
        }),
      })
    )

    // Vérifie syncLog.create
    expect(prisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          documentId: 'doc-new',
          action: 'sync_started',
          status: 'INFO',
        }),
      })
    )

    // Vérifie enqueueSyncJob
    expect(enqueueSyncJob).toHaveBeenCalledWith(
      'doc-new',
      validBody.sourceConnectorId,
      validBody.destConnectorId,
      'user-1'
    )
  })

  // ── sourceConnectorId manquant (Zod) ────────────────────────────────────

  it('should return 400 when sourceConnectorId is missing (Zod validation fails)', async () => {
    vi.mocked(createSyncSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'sourceConnectorId is required' }] },
    } as any)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(
      makeRequest({ destConnectorId: 'uuid-1', sourceDocumentId: 'doc-1' })
    )

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalled()
  })

  // ── destConnectorId manquant (Zod) ──────────────────────────────────────

  it('should return 400 when destConnectorId is missing (Zod validation fails)', async () => {
    vi.mocked(createSyncSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'destConnectorId is required' }] },
    } as any)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(
      makeRequest({ sourceConnectorId: 'uuid-1', sourceDocumentId: 'doc-1' })
    )

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalled()
  })

  // ── Connecteurs invalides ───────────────────────────────────────────────

  it('should return 400 when source or dest connector is not found', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalledWith('Invalid connectors', 400)
  })

  // ── Connecteur d'une autre org (IDOR) ──────────────────────────────────

  it('should scope connector lookups by the caller organizationId (no cross-org bind)', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'connector-id',
      type: 'WORDPRESS',
    } as any)

    const { POST } = await import('@/app/api/sync/route')
    await POST(makeRequest(validBody))

    // Both connector lookups must be constrained to the caller's org
    expect(prisma.connector.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validBody.sourceConnectorId, organizationId: 'org-1' },
      })
    )
    expect(prisma.connector.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validBody.destConnectorId, organizationId: 'org-1' },
      })
    )
  })

  // ── Quota dépassé ───────────────────────────────────────────────────────

  it('should return 429 when sync quota is exceeded', async () => {
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({
      allowed: false,
      remaining: 0,
      upgradeUrl: '/pricing',
    } as any)

    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(429)
    expect(apiError).toHaveBeenCalledWith(
      expect.stringContaining('Sync limit exceeded'),
      429,
      'QUOTA_EXCEEDED'
    )
  })
})

// ============================================================================
// POST /api/sync/[id]/run
// ============================================================================

describe('POST /api/sync/[id]/run', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── Mode prod: header Authorization manquant → 401 ─────────────────────

  it('should return 401 in production when CRON_SECRET is set and authorization is missing', async () => {
    vi.stubEnv('CRON_SECRET', 'my-cron-secret')
    vi.stubEnv('NODE_ENV', 'production')

    const { POST } = await import('@/app/api/sync/[id]/run/route')
    const req = new NextRequest('http://localhost:3000/api/sync/sync-1/run', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'sync-1' }) })

    expect(response.status).toBe(401)
  })

  // ── Mode prod: header Authorization erroné → 401 ───────────────────────

  it('should return 401 in production when authorization header does not match CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', 'my-cron-secret')
    vi.stubEnv('NODE_ENV', 'production')

    const { POST } = await import('@/app/api/sync/[id]/run/route')
    const req = new NextRequest('http://localhost:3000/api/sync/sync-1/run', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'sync-1' }) })

    expect(response.status).toBe(401)
  })

  // ── Mode dev: pas de vérification CRON → 200 ───────────────────────────

  it('should bypass cron auth in dev mode and execute sync', async () => {
    vi.stubEnv('CRON_SECRET', 'my-cron-secret')
    vi.stubEnv('NODE_ENV', 'development')

    vi.mocked(handleScheduledSyncRun).mockResolvedValue(
      NextResponse.json({ success: true, message: 'Sync completed' })
    )

    const { POST } = await import('@/app/api/sync/[id]/run/route')
    const req = new NextRequest('http://localhost:3000/api/sync/sync-1/run', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'sync-1' }) })

    expect(response.status).toBe(200)
    expect(handleScheduledSyncRun).toHaveBeenCalledWith('sync-1')
  })

  // ── Sync exécuté avec succès ───────────────────────────────────────────

  it('should execute sync and return result', async () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')

    vi.mocked(handleScheduledSyncRun).mockResolvedValue(
      NextResponse.json({ success: true, message: 'Sync executed successfully' })
    )

    const { POST } = await import('@/app/api/sync/[id]/run/route')
    const req = new NextRequest('http://localhost:3000/api/sync/sync-1/run', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'sync-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(handleScheduledSyncRun).toHaveBeenCalledWith('sync-1')
  })
})

// ============================================================================
// POST /api/sync/[id]/check
// ============================================================================

describe('POST /api/sync/[id]/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/sync/[id]/check/route')
    const req = new NextRequest('http://localhost:3000/api/sync/doc-1/check', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'doc-1' }) })

    expect(response.status).toBe(401)
  })

  // ── Document trouvé ─────────────────────────────────────────────────────

  it('should enqueue change detection when document is found and belongs to user', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
      title: 'Mon document',
    } as any)

    vi.mocked(enqueueChangeDetection).mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/sync/[id]/check/route')
    const req = new NextRequest('http://localhost:3000/api/sync/doc-1/check', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'doc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Change detection queued')
    expect(enqueueChangeDetection).toHaveBeenCalledWith('doc-1')
  })

  // ── Document inexistant ─────────────────────────────────────────────────

  it('should return 404 when document does not exist', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { POST } = await import('@/app/api/sync/[id]/check/route')
    const req = new NextRequest('http://localhost:3000/api/sync/doc-nonexistent/check', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'doc-nonexistent' }) })

    expect(response.status).toBe(404)
  })

  // ── Document d'un autre utilisateur ─────────────────────────────────────

  it('should return 404 when document belongs to another user', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-other',
      userId: 'user-other',
      title: 'Document de quelquun',
    } as any)

    const { POST } = await import('@/app/api/sync/[id]/check/route')
    const req = new NextRequest('http://localhost:3000/api/sync/doc-other/check', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'doc-other' }) })

    expect(response.status).toBe(404)
  })
})

// ============================================================================
// GET /api/sync — empty list
// ============================================================================

describe('GET /api/sync — empty list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 't@o.com' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  it('should return an empty array when the organization has no syncs', async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/sync/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})

// ============================================================================
// POST /api/sync — default title
// ============================================================================

describe('POST /api/sync — default title', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(createSyncSchema.safeParse).mockReturnValue({
      success: true,
      data: { sourceConnectorId: 'c1', destConnectorId: 'c2', sourceDocumentId: 'd1' },
    } as any)
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true } as any)
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'conn',
      type: 'WORDPRESS',
    } as any)
    vi.mocked(prisma.document.create).mockResolvedValue({
      id: 'doc-new',
      title: 'New Document',
    } as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(enqueueSyncJob).mockResolvedValue(undefined)
  })

  it('should default the title to "New Document" when title is omitted', async () => {
    const { POST } = await import('@/app/api/sync/route')
    const response = await POST(
      makeRequest({ sourceConnectorId: 'c1', destConnectorId: 'c2', sourceDocumentId: 'd1' })
    )

    expect(response.status).toBe(200)
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'New Document' }),
      })
    )
  })
})

// ============================================================================
// POST /api/sync/[id]/run — dev bypass with a secret set
// ============================================================================

describe('POST /api/sync/[id]/run — dev bypass with secret set', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should execute the sync in development even when CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', 'my-cron-secret')
    vi.stubEnv('NODE_ENV', 'development')

    vi.mocked(handleScheduledSyncRun).mockResolvedValue(NextResponse.json({ success: true }))

    const { POST } = await import('@/app/api/sync/[id]/run/route')
    const req = new NextRequest('http://localhost:3000/api/sync/sync-1/run', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'sync-1' }) })

    expect(response.status).toBe(200)
    expect(handleScheduledSyncRun).toHaveBeenCalledWith('sync-1')
  })
})

// ============================================================================
// GET /api/sync/[id]
// ============================================================================

describe('GET /api/sync/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  const buildDoc = (overrides: any = {}) => ({
    id: 'doc-1',
    title: 'My Doc',
    syncStatus: 'FAILED',
    userId: 'user-1',
    content: 'x'.repeat(600),
    autoSyncEnabled: true,
    syncFrequency: 'DAILY',
    nextSyncAt: new Date('2026-07-20'),
    lastSyncedAt: new Date('2026-07-19'),
    lastSyncError: 'boom',
    sourceConnector: { id: 's1', type: 'WORDPRESS' },
    destConnector: { id: 'd1', type: 'GHOST' },
    syncLogs: [{ status: 'ERROR', message: 'boom', createdAt: new Date('2026-07-18') }],
    ...overrides,
  })

  it('should return the sync with logs, scheduled info, and truncated content', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(buildDoc() as any)

    const { GET } = await import('@/app/api/sync/[id]/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/sync/doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('doc-1')
    expect(data.syncStatus).toBe('FAILED')
    expect(data.autoSyncEnabled).toBe(true)
    expect(data.syncFrequency).toBe('DAILY')
    expect(data.lastSyncError).toBe('boom')
    expect(typeof data.content).toBe('string')
    expect(data.content.length).toBe(500)
    expect(Array.isArray(data.logs)).toBe(true)
    expect(data.logs[0].status).toBe('ERROR')

    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        include: expect.objectContaining({
          syncLogs: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        }),
      })
    )
  })

  it('should return 404 when the document does not exist', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/sync/[id]/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/sync/doc-x'), {
      params: Promise.resolve({ id: 'doc-x' }),
    })

    expect(response.status).toBe(404)
  })
})

// ============================================================================
// DELETE /api/sync/[id]
// ============================================================================

describe('DELETE /api/sync/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  it('should disable scheduled sync and delete the document', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
    } as any)
    vi.mocked(prisma.document.delete).mockResolvedValue({} as any)
    vi.mocked(disableScheduledSync).mockResolvedValue(undefined)

    const { DELETE } = await import('@/app/api/sync/[id]/route')
    const response = await DELETE(new NextRequest('http://localhost:3000/api/sync/doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(disableScheduledSync).toHaveBeenCalledWith('doc-1')
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })

  it('should return 404 when the document does not exist', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/sync/[id]/route')
    const response = await DELETE(new NextRequest('http://localhost:3000/api/sync/doc-x'), {
      params: Promise.resolve({ id: 'doc-x' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return 404 when the document belongs to another user', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-2',
      userId: 'user-other',
    } as any)

    const { DELETE } = await import('@/app/api/sync/[id]/route')
    const response = await DELETE(new NextRequest('http://localhost:3000/api/sync/doc-2'), {
      params: Promise.resolve({ id: 'doc-2' }),
    })

    expect(response.status).toBe(404)
    expect(prisma.document.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// PATCH /api/sync/[id]
// ============================================================================

describe('PATCH /api/sync/[id]', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/sync/doc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true } as any)
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
      syncStatus: 'FAILED',
      sourceConnectorId: 's1',
      destConnectorId: 'd1',
    } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(performSync).mockResolvedValue({ success: true, message: 'done' } as any)
    vi.mocked(scheduleSync).mockResolvedValue({
      success: true,
      nextSyncAt: new Date('2026-08-01').toISOString(),
    } as any)
    vi.mocked(disableScheduledSync).mockResolvedValue(undefined)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'retry' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('should return 404 when the document does not exist', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'retry' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('should reject retry when the sync status is not FAILED', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
      syncStatus: 'SYNCED',
      sourceConnectorId: 's1',
      destConnectorId: 'd1',
    } as any)

    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'retry' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(400)
    expect(performSync).not.toHaveBeenCalled()
  })

  it('should reset a FAILED sync and re-execute it on retry', async () => {
    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'retry' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: { syncStatus: 'NOT_SYNCED', lastSyncError: null },
      })
    )
    expect(performSync).toHaveBeenCalledWith('doc-1', 's1', 'd1', 'user-1')
  })

  it('should return 403 QUOTA_EXCEEDED when retry is over quota', async () => {
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({
      allowed: false,
      upgradeUrl: '/pricing',
    } as any)

    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'retry' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('QUOTA_EXCEEDED')
    expect(performSync).not.toHaveBeenCalled()
  })

  it('should schedule a sync with a valid DAILY frequency', async () => {
    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'schedule', frequency: 'DAILY' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.autoSyncEnabled).toBe(true)
    expect(data.syncFrequency).toBe('DAILY')
    expect(scheduleSync).toHaveBeenCalledWith('doc-1', 'DAILY')
  })

  it('should return 400 for an invalid schedule frequency', async () => {
    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'schedule', frequency: 'HOURLY' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(400)
    expect(scheduleSync).not.toHaveBeenCalled()
  })

  it('should disable the schedule on disable_schedule', async () => {
    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'disable_schedule' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.autoSyncEnabled).toBe(false)
    expect(data.syncFrequency).toBe('MANUAL')
    expect(disableScheduledSync).toHaveBeenCalledWith('doc-1')
  })

  it('should return 400 for an unknown action', async () => {
    const { PATCH } = await import('@/app/api/sync/[id]/route')
    const response = await PATCH(makeRequest({ action: 'frobnicate' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(400)
  })
})

// ============================================================================
// GET /api/sync/[id] — edge cases (path traversal, non-UUID, cross-user)
// TAE5 #29 — these ids must resolve to 404, never a crash / 500.
// ============================================================================

describe('GET /api/sync/[id] — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  it('should return 404 (not crash) for a path-traversal id', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/sync/[id]/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/sync/x'), {
      params: Promise.resolve({ id: '../../etc/passwd' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return 404 (not crash) for a non-UUID id', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/sync/[id]/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/sync/x'), {
      params: Promise.resolve({ id: 'not-a-uuid!!' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return 404 when the document belongs to another user', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      userId: 'user-other',
    } as any)

    const { GET } = await import('@/app/api/sync/[id]/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/sync/x'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(404)
  })
})
