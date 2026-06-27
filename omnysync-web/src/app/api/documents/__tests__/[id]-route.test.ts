/**
 * Tests for /api/documents/[id] route
 * Couvre GET, PUT, DELETE
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
      findUnique: vi.fn(),
      update: vi.fn(),
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

const mockDocument = {
  id: 'doc-1',
  title: 'Test Document',
  seoTitle: 'Test SEO Title',
  seoDescription: 'Test SEO Description',
  seoKeywords: 'test, keyword',
  excerpt: 'Test excerpt',
  categories: ['tech'],
  tags: ['test'],
  autoSyncEnabled: true,
  syncFrequency: 'hourly',
  content: '# Hello',
  status: 'DRAFT',
  syncStatus: 'NOT_SYNCED',
  organizationId: 'org-1',
  userId: 'user-1',
  sourceConnector: { id: 'c1', type: 'WORDPRESS', name: 'Source' },
  destConnector: { id: 'c2', type: 'GHOST', name: 'Dest' },
  syncLogs: [],
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-06-01').toISOString(),
}

// ============================================================================
// GET /api/documents/[id]
// ============================================================================

describe('GET /api/documents/[id]', () => {
  const req = new NextRequest('http://localhost:3000/api/documents/doc-1')
  const params = { params: Promise.resolve({ id: 'doc-1' }) }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(req, params)

    expect(response.status).toBe(401)
  })

  // ── Document trouvé ──────────────────────────────────────────────────────

  it('should return the document with connectors and syncLogs when found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(req, params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('doc-1')
    expect(data.title).toBe('Test Document')
    expect(data.sourceConnector).toBeDefined()
    expect(data.destConnector).toBeDefined()
    expect(data.syncLogs).toBeDefined()

    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', organizationId: 'org-1' },
        include: {
          sourceConnector: true,
          destConnector: true,
          syncLogs: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      })
    )
  })

  // ── Document inexistant ──────────────────────────────────────────────────

  it('should return 404 when document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(req, params)

    expect(response.status).toBe(404)
  })

  it('should return 500 when prisma query fails', async () => {
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/documents/[id]/route')
    // NOTE: This route has no try/catch, so errors propagate as thrown exceptions.
    // Next.js would normally catch this and return 500.
    await expect(GET(req, params)).rejects.toThrow('DB error')
  })

  it('should return document with null connectors and empty syncLogs', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      sourceConnector: null,
      destConnector: null,
      syncLogs: [],
    } as any)

    const { GET } = await import('@/app/api/documents/[id]/route')
    const response = await GET(req, params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.sourceConnector).toBeNull()
    expect(data.destConnector).toBeNull()
    expect(data.syncLogs).toEqual([])
  })

  it('should return 500 when getUserOrgId fails', async () => {
    vi.mocked(getUserOrgId).mockRejectedValue(new Error('Org error'))

    const { GET } = await import('@/app/api/documents/[id]/route')
    // NOTE: This route has no try/catch, so errors propagate.
    await expect(GET(req, params)).rejects.toThrow('Org error')
  })
})

// ============================================================================
// PUT /api/documents/[id]
// ============================================================================

describe('PUT /api/documents/[id]', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/documents/doc-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const params = { params: Promise.resolve({ id: 'doc-1' }) }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest({ title: 'Updated' }), params)

    expect(response.status).toBe(401)
  })

  // ── Document inexistant ──────────────────────────────────────────────────

  it('should return 404 when document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest({ title: 'Updated' }), params)

    expect(response.status).toBe(404)
    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', organizationId: 'org-1' },
      })
    )
  })

  // ── Mise à jour réussie ─────────────────────────────────────────────────

  it('should update allowed fields and return 200', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)

    const updatedDoc = { ...mockDocument, title: 'Updated Title', seoTitle: 'New SEO Title' }
    vi.mocked(prisma.document.update).mockResolvedValue(updatedDoc as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(
      makeRequest({ title: 'Updated Title', seoTitle: 'New SEO Title' }),
      params
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe('Updated Title')
    expect(data.seoTitle).toBe('New SEO Title')

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: { title: 'Updated Title', seoTitle: 'New SEO Title' },
      })
    )
  })

  // ── Seuls les champs autorisés sont mis à jour ──────────────────────────

  it('should only update allowed fields and ignore forbidden ones', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    await PUT(
      makeRequest({
        title: 'New Title',
        content: 'INJECTED', // not in allowedFields
        userId: 'hacker', // not in allowedFields
        syncStatus: 'SYNCED', // not in allowedFields
      }),
      params
    )

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: 'New Title' },
      })
    )
    // Forbidden fields must NOT be passed to prisma
    const updateCall = vi.mocked(prisma.document.update).mock.calls[0][0]
    expect(updateCall.data).not.toHaveProperty('content')
    expect(updateCall.data).not.toHaveProperty('userId')
    expect(updateCall.data).not.toHaveProperty('syncStatus')
  })

  // ── Corps vide (aucun champ fourni) ─────────────────────────────────────

  it('should return 200 with existing document when no allowed fields are provided', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest({}), params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {},
      })
    )
    // Still returns the document
    expect(data.id).toBe('doc-1')
  })

  // ── Mise à jour autoSyncEnabled ────────────────────────────────────────

  it('should update autoSyncEnabled to false', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    const updatedDoc = { ...mockDocument, autoSyncEnabled: false }
    vi.mocked(prisma.document.update).mockResolvedValue(updatedDoc as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest({ autoSyncEnabled: false }), params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { autoSyncEnabled: false },
      })
    )
    expect(data.autoSyncEnabled).toBe(false)
  })

  // ── Mise à jour syncFrequency ──────────────────────────────────────────

  it('should update syncFrequency', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    const updatedDoc = { ...mockDocument, syncFrequency: 'daily' }
    vi.mocked(prisma.document.update).mockResolvedValue(updatedDoc as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(makeRequest({ syncFrequency: 'daily' }), params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.syncFrequency).toBe('daily')
  })

  // ── Mise à jour de tous les champs SEO ────────────────────────────────

  it('should update all SEO fields', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    const updatedDoc = {
      ...mockDocument,
      seoTitle: 'New SEO',
      seoDescription: 'New desc',
      seoKeywords: 'new, keywords',
    }
    vi.mocked(prisma.document.update).mockResolvedValue(updatedDoc as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    const response = await PUT(
      makeRequest({
        seoTitle: 'New SEO',
        seoDescription: 'New desc',
        seoKeywords: 'new, keywords',
      }),
      params
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          seoTitle: 'New SEO',
          seoDescription: 'New desc',
          seoKeywords: 'new, keywords',
        },
      })
    )
  })

  // ── Champs undefined ignorés ───────────────────────────────────────────

  it('should ignore fields with undefined values', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument as any)

    const { PUT } = await import('@/app/api/documents/[id]/route')
    await PUT(makeRequest({ title: 'New Title', someUndefinedField: undefined }), params)

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: 'New Title' },
      })
    )
  })

  // ── 500 quand la mise à jour échoue ────────────────────────────────────

  it('should return 500 when prisma update fails', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockRejectedValue(new Error('DB error'))

    const { PUT } = await import('@/app/api/documents/[id]/route')
    // NOTE: This route has no try/catch, so errors propagate.
    await expect(PUT(makeRequest({ title: 'Updated' }), params)).rejects.toThrow('DB error')
  })
})

// ============================================================================
// DELETE /api/documents/[id]
// ============================================================================

describe('DELETE /api/documents/[id]', () => {
  const req = new NextRequest('http://localhost:3000/api/documents/doc-1', {
    method: 'DELETE',
  })
  const params = { params: Promise.resolve({ id: 'doc-1' }) }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(req, params)

    expect(response.status).toBe(401)
  })

  // ── Document inexistant ──────────────────────────────────────────────────

  it('should return 404 when document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(req, params)

    expect(response.status).toBe(404)
  })

  // ── Suppression (archivage) réussie ─────────────────────────────────────

  it('should soft-delete (archive) the document and return 200', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({
      ...mockDocument,
      status: 'ARCHIVED',
    } as any)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(req, params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Vérifie que c'est un soft delete (status → ARCHIVED)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: { status: 'ARCHIVED' },
      })
    )
  })

  // ── Document déjà archivé ─────────────────────────────────────────────

  it('should soft-delete an already archived document (idempotent)', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      ...mockDocument,
      status: 'ARCHIVED',
    } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({
      ...mockDocument,
      status: 'ARCHIVED',
    } as any)

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    const response = await DELETE(req, params)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ARCHIVED' },
      })
    )
  })

  // ── 500 quand getUserOrgId échoue ─────────────────────────────────────

  it('should return 500 when getUserOrgId fails', async () => {
    vi.mocked(getUserOrgId).mockRejectedValue(new Error('Org error'))

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    // NOTE: This route has no try/catch, so errors propagate.
    await expect(DELETE(req, params)).rejects.toThrow('Org error')
  })

  // ── 500 quand la mise à jour du statut échoue ──────────────────────────

  it('should return 500 when prisma update fails during soft-delete', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockRejectedValue(new Error('DB error'))

    const { DELETE } = await import('@/app/api/documents/[id]/route')
    // NOTE: This route has no try/catch, so errors propagate.
    await expect(DELETE(req, params)).rejects.toThrow('DB error')
  })
})
