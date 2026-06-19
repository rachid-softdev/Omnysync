/* eslint-disable @typescript-eslint/no-explicit-any */

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
})
