/**
 * Tests for /api/sync/check-remote route (POST)
 *
 * Pattern: mock auth + prisma + services externes au niveau module.
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
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@omnysync/core/services/sync', () => ({
  checkRemoteChanges: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkRemoteChanges } from '@omnysync/core/services/sync'

// ============================================================================
// POST /api/sync/check-remote
// ============================================================================

describe('POST /api/sync/check-remote', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/sync/check-remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

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

    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(401)
  })

  // ── Document inexistant ──────────────────────────────────────────────────

  it('should return 404 when document is not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({ documentId: 'doc-missing' }))

    expect(response.status).toBe(404)
  })

  // ── Document d'une autre organisation ────────────────────────────────────

  it('should return 404 when document belongs to another organization', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-other',
      userId: 'user-other',
      organizationId: 'org-other',
      title: 'Other organization document',
    } as any)

    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({ documentId: 'doc-other' }))

    expect(response.status).toBe(404)
    expect(checkRemoteChanges).not.toHaveBeenCalled()
  })

  // ── documentId manquant ──────────────────────────────────────────────────

  it('should return 400 when documentId is missing', async () => {
    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    expect(prisma.document.findUnique).not.toHaveBeenCalled()
  })

  // ── Vérification réussie ─────────────────────────────────────────────────

  it('should check remote changes and return remoteData', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'My document',
    } as any)

    const mockRemoteData = {
      hasChanges: true,
      remoteTitle: 'Updated Title',
      lastModified: '2026-06-20T10:00:00Z',
    }
    vi.mocked(checkRemoteChanges).mockResolvedValue(mockRemoteData as any)

    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remoteData).toEqual(mockRemoteData)
    expect(checkRemoteChanges).toHaveBeenCalledWith('doc-1', 'user-1')
  })

  // ── Erreur du service checkRemoteChanges ─────────────────────────────────

  it('should return 500 when checkRemoteChanges throws an error', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'My document',
    } as any)

    vi.mocked(checkRemoteChanges).mockRejectedValue(new Error('Connection timeout'))

    const { POST } = await import('@/app/api/sync/check-remote/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Connection timeout')
  })
})
