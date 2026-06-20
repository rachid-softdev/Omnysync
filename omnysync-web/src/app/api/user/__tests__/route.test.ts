/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for User API routes
 * Covers DELETE /api/user and PUT /api/user/password
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
      delete: vi.fn(),
    },
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

    vi.mocked(prisma.user.delete).mockResolvedValue({} as any)
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

  // ── Succès ───────────────────────────────────────────────────────────────

  it('should delete user and return success when confirmText is SUPPRIMER', async () => {
    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('SUPPRIMER'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Compte supprimé')
    expect(prisma.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
      })
    )
  })

  // ── Erreur serveur ───────────────────────────────────────────────────────

  it('should return 500 when prisma delete fails', async () => {
    vi.mocked(prisma.user.delete).mockRejectedValue(new Error('DB error'))

    const { DELETE } = await import('@/app/api/user/route')
    const response = await DELETE(makeRequest('SUPPRIMER'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Erreur serveur')
  })
})

// ============================================================================
// PUT /api/user/password
// ============================================================================

describe('PUT /api/user/password', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(
      makeRequest({ currentPassword: 'old', newPassword: 'newpassword123' })
    )

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Non autorisé')
  })

  // ── Succès — retourne le message de configuration requise ────────────────

  it('should return message indicating password auth is not configured', async () => {
    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(
      makeRequest({ currentPassword: 'old', newPassword: 'newpassword123' })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.error).toContain('mot de passe')
    expect(data.requiresPasswordAuth).toBe(true)
  })

  // ── Validation: currentPassword manquant → 400 ──────────────────────────

  it('should return 400 when currentPassword is missing', async () => {
    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(makeRequest({ newPassword: 'newpassword123' }))

    expect(response.status).toBe(400)
    // Zod v4: message is "Invalid input: expected string, received undefined" for missing fields
  })

  // ── Validation: newPassword trop court → 400 ────────────────────────────

  it('should return 400 when newPassword is too short (< 8 characters)', async () => {
    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'short' }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('8 caractères')
  })

  // ── Validation: newPassword manquant → 400 ──────────────────────────────

  it('should return 400 when newPassword is missing', async () => {
    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(makeRequest({ currentPassword: 'old' }))

    expect(response.status).toBe(400)
  })

  // ── Corps JSON invalide → 500 ────────────────────────────────────────────

  it('should return 500 when JSON body is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const { PUT } = await import('@/app/api/user/password/route')
    const response = await PUT(req)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Erreur serveur')
  })
})
