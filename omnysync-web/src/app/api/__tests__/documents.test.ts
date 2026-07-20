/**
 * Tests pour les routes API des Documents
 * Couvre GET /api/documents et POST /api/documents
 *
 * Pattern: mock auth + prisma + org au niveau module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
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

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { apiError } from '@/lib/api-error'

// ============================================================================
// SUITE
// ============================================================================

describe('GET /api/documents', () => {
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

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  // ── Retourne les documents ───────────────────────────────────────────────

  it('should return documents for the authenticated organization', async () => {
    const mockDocs = [
      { id: 'doc-1', title: 'Doc 1', status: 'DRAFT', organizationId: 'org-1' },
      { id: 'doc-2', title: 'Doc 2', status: 'PUBLISHED', organizationId: 'org-1' },
    ]

    vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as any)
    vi.mocked(prisma.document.count).mockResolvedValue(2)

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.documents).toEqual(mockDocs)
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        include: { sourceConnector: true, destConnector: true },
        orderBy: { updatedAt: 'desc' },
      })
    )
  })

  // ── Pagination ───────────────────────────────────────────────────────────

  it('should support pagination and return pagination metadata', async () => {
    const mockDocs = Array.from({ length: 5 }, (_, i) => ({
      id: `doc-${i}`,
      title: `Doc ${i}`,
      status: 'DRAFT',
      organizationId: 'org-1',
    }))

    vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as any)
    vi.mocked(prisma.document.count).mockResolvedValue(25)

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents?page=2&limit=5')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.documents).toHaveLength(5)
    expect(data.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 25,
      totalPages: 5,
    })

    // Vérifie que skip/take sont corrects
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      })
    )
  })

  // ── Filtre par status ────────────────────────────────────────────────────

  it('should filter documents by status', async () => {
    const mockDocs = [{ id: 'doc-1', title: 'Draft Doc', status: 'DRAFT', organizationId: 'org-1' }]

    vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as any)
    vi.mocked(prisma.document.count).mockResolvedValue(1)

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents?status=DRAFT')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.documents).toHaveLength(1)
    expect(data.documents[0].status).toBe('DRAFT')

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'DRAFT' }),
      })
    )
  })

  // ── Pagination par défaut ────────────────────────────────────────────────

  it('should use default pagination (page=1, limit=20)', async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.document.count).mockResolvedValue(0)

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.pagination.page).toBe(1)
    expect(data.pagination.limit).toBe(20)
  })

  // ── Cache-Control header ────────────────────────────────────────────────

  it('should include Cache-Control header', async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.document.count).mockResolvedValue(0)

    const { GET } = await import('@/app/api/documents/route')
    const req = new NextRequest('http://localhost:3000/api/documents')
    const response = await GET(req)

    expect(response.headers.get('Cache-Control')).toMatch(/private/)
    expect(response.headers.get('Cache-Control')).toMatch(/max-age=30/)
  })
})

// ============================================================================
// POST /api/documents
// ============================================================================

describe('POST /api/documents', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/documents', {
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
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest({ title: 'Test' }))

    expect(response.status).toBe(401)
  })

  // ── Création avec titre ──────────────────────────────────────────────────

  it('should create a document with title and return 200', async () => {
    const input = {
      title: 'Mon nouveau document',
      sourceConnectorId: 'connector-1',
      destConnectorId: 'connector-2',
      sourceId: 'src-123',
    }

    const createdDoc = {
      id: 'doc-new',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'Mon nouveau document',
      sourceConnectorId: 'connector-1',
      destConnectorId: 'connector-2',
      sourceId: 'src-123',
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest(input))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('doc-new')
    expect(data.title).toBe('Mon nouveau document')
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          title: 'Mon nouveau document',
          sourceConnectorId: 'connector-1',
          destConnectorId: 'connector-2',
          sourceId: 'src-123',
        }),
      })
    )
  })

  // ── Valeurs par défaut ───────────────────────────────────────────────────

  it('should set default values: status=DRAFT and syncStatus=NOT_SYNCED', async () => {
    const input = { title: 'Doc minimal' }

    const createdDoc = {
      id: 'doc-min',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'Doc minimal',
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest(input))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('DRAFT')
    expect(data.syncStatus).toBe('NOT_SYNCED')

    // Vérifie que l'appel à create contient les valeurs par défaut
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          syncStatus: 'NOT_SYNCED',
        }),
      })
    )
  })

  // ── Titre manquant ──────────────────────────────────────────────────────

  it('should return 400 when title is missing', async () => {
    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest({ sourceConnectorId: 'c1' }))

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalledWith('Title is required', 400)
  })

  // ── Champs optionnels absents ───────────────────────────────────────────

  it('should create a document with only title (optional fields omitted)', async () => {
    const createdDoc = {
      id: 'doc-title-only',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'Seulement le titre',
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest({ title: 'Seulement le titre' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe('Seulement le titre')
  })

  // ── Titre très long (>1000 caractères) ────────────────────────────────────
  // TAE5 #30 — un titre démesuré ne doit pas planter la route ; il est stocké
  // tel quel et la création renvoie 200.

  it('should handle a very long title (>1000 chars) and return 200', async () => {
    const longTitle = 'A'.repeat(1500)

    const createdDoc = {
      id: 'doc-long',
      userId: 'user-1',
      organizationId: 'org-1',
      title: longTitle,
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest({ title: longTitle }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe(longTitle)
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: longTitle }),
      })
    )
  })

  // ── Titre avec unicode/emoji ──────────────────────────────────────────────
  // TAE5 #44 — les caractères unicode/emoji doivent être acceptés sans erreur.

  it('should accept a title containing unicode and emoji and return 200', async () => {
    const emojiTitle = 'Café 🚀 résumé — hôtel'

    const createdDoc = {
      id: 'doc-emoji',
      userId: 'user-1',
      organizationId: 'org-1',
      title: emojiTitle,
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    }

    vi.mocked(prisma.document.create).mockResolvedValue(createdDoc as any)

    const { POST } = await import('@/app/api/documents/route')
    const response = await POST(makeRequest({ title: emojiTitle }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe(emojiTitle)
  })
})

// ============================================================================
// GET /api/documents/[id]
// ============================================================================

describe('GET /api/documents/[id]', () => {
  const makeReq = (id: string) => new NextRequest(`http://localhost:3000/api/documents/${id}`)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(makeReq('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })

    expect(response.status).toBe(401)
  })

  it('should return the document with source/dest connectors and 20 sync logs', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      title: 'Doc 1',
      status: 'DRAFT',
      organizationId: 'org-1',
      sourceConnector: { id: 's1', type: 'WORDPRESS' },
      destConnector: { id: 'd1', type: 'GHOST' },
      syncLogs: [{ id: 'log-1', status: 'INFO', message: 'ok', createdAt: new Date('2026-07-19') }],
    } as any)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(makeReq('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('doc-1')
    expect(data.sourceConnector).toEqual({ id: 's1', type: 'WORDPRESS' })
    expect(data.destConnector).toEqual({ id: 'd1', type: 'GHOST' })
    expect(data.syncLogs).toHaveLength(1)

    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', organizationId: 'org-1' },
        include: expect.objectContaining({
          syncLogs: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        }),
      })
    )
  })

  it('should return 404 when the document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(makeReq('doc-x'), { params: Promise.resolve({ id: 'doc-x' }) })

    expect(response.status).toBe(404)
    expect(apiError).toHaveBeenCalledWith('Document not found', 404)
  })

  it('should scope the lookup by the caller organization (cross-org → 404)', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/documents/[id]/route')
    await GET(makeReq('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })

    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', organizationId: 'org-1' },
      })
    )
  })
})

// ============================================================================
// PUT /api/documents/[id]
// ============================================================================

describe('PUT /api/documents/[id]', () => {
  const makeRequest = (id: string, body: any) =>
    new NextRequest(`http://localhost:3000/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({ id: 'doc-1' } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest('doc-1', { title: 'X' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('should update only the allowed fields', async () => {
    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(
      makeRequest('doc-1', {
        title: 'New Title',
        seoTitle: 'SEO',
        tags: ['a', 'b'],
        autoSyncEnabled: true,
        syncFrequency: 'DAILY',
        sourceConnectorId: 'should-be-ignored',
        status: 'PUBLISHED',
      }),
      { params: Promise.resolve({ id: 'doc-1' }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          title: 'New Title',
          seoTitle: 'SEO',
          tags: ['a', 'b'],
          autoSyncEnabled: true,
          syncFrequency: 'DAILY',
          status: 'PUBLISHED',
        }),
      })
    )

    const updateData = vi.mocked(prisma.document.update).mock.calls[0][0].data as Record<
      string,
      unknown
    >
    expect(updateData.sourceConnectorId).toBeUndefined()
    expect(updateData.status).toBe('PUBLISHED')
  })

  it('should allow restoring an archived document', async () => {
    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest('doc-1', { status: 'ARCHIVED' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    expect(response.status).toBe(200)

    const updateData = vi.mocked(prisma.document.update).mock.calls[0][0].data as Record<
      string,
      unknown
    >
    expect(updateData.status).toBe('ARCHIVED')
  })

  it('should filter out the disallowed `description` field', async () => {
    const { PUT } = await import('@/app/api/documents/[id]/route')
    await PUT(makeRequest('doc-1', { description: 'nope', excerpt: 'ok' }), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    const updateData = vi.mocked(prisma.document.update).mock.calls[0][0].data as Record<
      string,
      unknown
    >
    expect(updateData.description).toBeUndefined()
    // `excerpt` is an allowed field
    expect(updateData.excerpt).toBe('ok')
  })

  it('should return 404 when the document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest('doc-x', { title: 'X' }), {
      params: Promise.resolve({ id: 'doc-x' }),
    })

    expect(response.status).toBe(404)
    expect(apiError).toHaveBeenCalledWith('Document not found', 404)
  })
})

// ============================================================================
// DELETE /api/documents/[id]
// ============================================================================

describe('DELETE /api/documents/[id]', () => {
  const makeReq = (id: string) =>
    new NextRequest(`http://localhost:3000/api/documents/${id}`, { method: 'DELETE' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({ id: 'doc-1' } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(makeReq('doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('should soft-delete by archiving (status ARCHIVED), not physically delete', async () => {
    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(makeReq('doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'ARCHIVED' },
    })
    expect(prisma.document.delete).not.toHaveBeenCalled()
  })

  it('should return 404 when the document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(makeReq('doc-x'), {
      params: Promise.resolve({ id: 'doc-x' }),
    })

    expect(response.status).toBe(404)
  })
})
