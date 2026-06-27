/**
 * Tests pour les routes API Team
 * Couvre GET /api/team, POST /api/team, PUT /api/team/[memberId], DELETE /api/team/[memberId]
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
    userOrganization: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'

// ============================================================================
// GET /api/team
// ============================================================================

describe('GET /api/team', () => {
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

    const { GET } = await import('@/app/api/team/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  // ── Retourne les membres ────────────────────────────────────────────────

  it('should return members with id, name, email, image, role, joinedAt', async () => {
    const mockMemberships = [
      {
        role: 'OWNER',
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@omnysync.com',
          image: 'https://avatar.com/alice',
          createdAt: new Date('2024-01-01'),
        },
      },
      {
        role: 'MEMBER',
        user: {
          id: 'user-2',
          name: 'Bob',
          email: 'bob@omnysync.com',
          image: null,
          createdAt: new Date('2024-06-15'),
        },
      },
    ]

    vi.mocked(prisma.userOrganization.findMany).mockResolvedValue(mockMemberships as any)

    const { GET } = await import('@/app/api/team/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]).toEqual({
      id: 'user-1',
      name: 'Alice',
      email: 'alice@omnysync.com',
      image: 'https://avatar.com/alice',
      role: 'OWNER',
      joinedAt: '2024-01-01T00:00:00.000Z',
    })
    expect(data[1]).toEqual({
      id: 'user-2',
      name: 'Bob',
      email: 'bob@omnysync.com',
      image: null,
      role: 'MEMBER',
      joinedAt: '2024-06-15T00:00:00.000Z',
    })

    expect(prisma.userOrganization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, createdAt: true },
          },
        },
      })
    )
  })

  // ── Liste vide ──────────────────────────────────────────────────────────

  it('should return empty array when no members exist', async () => {
    vi.mocked(prisma.userOrganization.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/team/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})

// ============================================================================
// POST /api/team
// ============================================================================

describe('POST /api/team', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'admin@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: caller is OWNER/ADMIN
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      id: 'membership-admin',
      role: 'ADMIN',
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/team/route')
    const response = await POST(makeRequest({ email: 'new@omnysync.com', role: 'MEMBER' }))

    expect(response.status).toBe(401)
  })

  // ── Appelant pas OWNER/ADMIN ─────────────────────────────────────────────

  it('should return 403 when caller is not OWNER or ADMIN', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/team/route')
    const response = await POST(makeRequest({ email: 'new@omnysync.com', role: 'MEMBER' }))

    expect(response.status).toBe(403)
  })

  // ── Email non trouvé (nouvel utilisateur) ────────────────────────────────

  it('should return 200 with invitation message when email is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const { POST } = await import('@/app/api/team/route')
    const response = await POST(makeRequest({ email: 'unknown@example.com', role: 'MEMBER' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Invitation envoyée')
    expect(data.email).toBe('unknown@example.com')
    expect(data.role).toBe('MEMBER')
  })

  // ── Utilisateur déjà membre ──────────────────────────────────────────────

  it('should return 400 when user is already a member', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-user',
      email: 'existing@omnysync.com',
    } as any)

    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      id: 'membership-existing',
      role: 'MEMBER',
    } as any)

    const { POST } = await import('@/app/api/team/route')
    const response = await POST(makeRequest({ email: 'existing@omnysync.com', role: 'MEMBER' }))

    expect(response.status).toBe(400)
  })

  // ── Ajout membre existant ────────────────────────────────────────────────

  it('should add an existing user as member and return 200', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'new-user',
      email: 'new@omnysync.com',
    } as any)

    // Premier appel findFirst pour le caller (OWNER/ADMIN), deuxième pour existingMember (null)
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'membership-admin', role: 'ADMIN' } as any)
      .mockResolvedValueOnce(null)

    vi.mocked(prisma.userOrganization.create).mockResolvedValue({
      id: 'new-membership',
      userId: 'new-user',
      organizationId: 'org-1',
      role: 'MEMBER',
    } as any)

    const { POST } = await import('@/app/api/team/route')
    const response = await POST(makeRequest({ email: 'new@omnysync.com', role: 'MEMBER' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.userOrganization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'new-user',
          organizationId: 'org-1',
          role: 'MEMBER',
        }),
      })
    )
  })
})

// ============================================================================
// PUT /api/team/[memberId]
// ============================================================================

describe('PUT /api/team/[memberId]', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/team/member-to-update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'admin@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: caller is OWNER/ADMIN
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      id: 'caller-membership',
      role: 'ADMIN',
      userId: 'user-1',
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'ADMIN' }), {
      params: Promise.resolve({ memberId: 'member-to-update' }),
    })

    expect(response.status).toBe(401)
  })

  // ── Appelant pas OWNER/ADMIN ─────────────────────────────────────────────

  it('should return 403 when caller is not OWNER or ADMIN', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'ADMIN' }), {
      params: Promise.resolve({ memberId: 'member-to-update' }),
    })

    expect(response.status).toBe(403)
  })

  // ── Auto-rétrogradation ──────────────────────────────────────────────────

  it('should return 400 when trying to change own role (self-demotion)', async () => {
    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'MEMBER' }), {
      params: Promise.resolve({ memberId: 'user-1' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Membre inexistant ────────────────────────────────────────────────────

  it('should return 404 when target membership is not found', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValueOnce({
      id: 'caller-membership',
      role: 'ADMIN',
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValueOnce(null)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'ADMIN' }), {
      params: Promise.resolve({ memberId: 'nonexistent-membership' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Rétrograder le OWNER ─────────────────────────────────────────────────

  it('should return 400 when trying to change role of the organization owner', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce({ id: 'owner-membership', role: 'OWNER', userId: 'user-owner' } as any)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'MEMBER' }), {
      params: Promise.resolve({ memberId: 'owner-membership' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Rôle invalide ────────────────────────────────────────────────────────

  it('should return 400 when role is invalid', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce({
        id: 'target-membership',
        role: 'MEMBER',
        userId: 'user-target',
      } as any)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'INVALID_ROLE' }), {
      params: Promise.resolve({ memberId: 'target-membership' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Changer rôle MEMBER → ADMIN ─────────────────────────────────────────

  it('should change member role from MEMBER to ADMIN and return 200', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce({
        id: 'target-membership',
        role: 'MEMBER',
        userId: 'user-target',
      } as any)

    vi.mocked(prisma.userOrganization.update).mockResolvedValue({
      id: 'target-membership',
      role: 'ADMIN',
    } as any)

    const { PUT } = await import('@/app/api/team/[memberId]/route')
    const response = await PUT(makeRequest({ role: 'ADMIN' }), {
      params: Promise.resolve({ memberId: 'target-membership' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.userOrganization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-membership' },
        data: { role: 'ADMIN' },
      })
    )
  })
})

// ============================================================================
// DELETE /api/team/[memberId]
// ============================================================================

describe('DELETE /api/team/[memberId]', () => {
  const makeRequest = () =>
    new NextRequest('http://localhost:3000/api/team/member-to-delete', {
      method: 'DELETE',
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'admin@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: caller is OWNER/ADMIN
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      id: 'caller-membership',
      role: 'ADMIN',
      userId: 'user-1',
    } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'member-to-delete' }),
    })

    expect(response.status).toBe(401)
  })

  // ── Appelant pas OWNER/ADMIN ─────────────────────────────────────────────

  it('should return 403 when caller is not OWNER or ADMIN', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'member-to-delete' }),
    })

    expect(response.status).toBe(403)
  })

  // ── Auto-suppression ─────────────────────────────────────────────────────

  it('should return 400 when trying to remove yourself', async () => {
    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'user-1' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Membre inexistant ────────────────────────────────────────────────────

  it('should return 404 when target membership is not found', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce(null)

    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'nonexistent-membership' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Supprimer le OWNER ───────────────────────────────────────────────────

  it('should return 400 when trying to remove the organization owner', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce({ id: 'owner-membership', role: 'OWNER', userId: 'user-owner' } as any)

    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'owner-membership' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Supprimer membre avec succès ─────────────────────────────────────────

  it('should delete member and return 200', async () => {
    vi.mocked(prisma.userOrganization.findFirst)
      .mockResolvedValueOnce({ id: 'caller-membership', role: 'ADMIN', userId: 'user-1' } as any)
      .mockResolvedValueOnce({
        id: 'target-membership',
        role: 'MEMBER',
        userId: 'user-target',
      } as any)

    vi.mocked(prisma.userOrganization.delete).mockResolvedValue({
      id: 'target-membership',
    } as any)

    const { DELETE } = await import('@/app/api/team/[memberId]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ memberId: 'target-membership' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.userOrganization.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-membership' },
      })
    )
  })
})
