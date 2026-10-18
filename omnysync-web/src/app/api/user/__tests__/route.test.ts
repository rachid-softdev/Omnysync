/**
 * Tests for DELETE /api/user (account deletion)
 *
 * PUT /api/user/password is covered by
 * src/app/api/user/password/__tests__/route.test.ts
 *
 * Pattern: mock auth + prisma at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    twoFactorAuth: { deleteMany: vi.fn() },
    passwordReset: { deleteMany: vi.fn() },
    apiKey: { deleteMany: vi.fn() },
    userOrganization: { deleteMany: vi.fn() },
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ============================================================================
// DELETE /api/user
// ============================================================================

describe('DELETE /api/user', () => {
  const makeRequest = (confirmText: string | null) => {
    const url = confirmText
      ? `http://localhost:3000/api/user?confirmText=${encodeURIComponent(confirmText)}`
      : 'http://localhost:3000/api/user'
    return new NextRequest(url, { method: 'DELETE' })
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.account.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.twoFactorAuth.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.apiKey.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.userOrganization.deleteMany).mockResolvedValue({ count: 0 } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('SUPPRIMER'))

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Non autorisé')
  })

  // ── Validation: confirmText manquant ─────────────────────────────────────

  it('should return 400 when confirmText is missing', async () => {
    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest(null))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('SUPPRIMER')
  })

  // ── Validation: mauvais confirmText ──────────────────────────────────────

  it('should return 400 when confirmText is not SUPPRIMER', async () => {
    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('DELETE'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('SUPPRIMER')
  })

  // ── Succès: soft delete ──────────────────────────────────────────────────

  it('should soft-delete the user, revoke auth artifacts and leave the organization', async () => {
    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('SUPPRIMER'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Compte supprimé')

    // Soft delete (deletedAt invalidates all JWT sessions) + PII scrub
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        email: null,
        name: null,
        password: null,
      }),
    })

    // No hard delete that would cascade on Connector.userId / Document.userId
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.twoFactorAuth.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.userOrganization.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    })
  })

  // ── Erreur serveur ───────────────────────────────────────────────────────

  it('should return 500 when the soft delete fails', async () => {
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('DB error'))

    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('SUPPRIMER'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Erreur serveur')
  })
})
