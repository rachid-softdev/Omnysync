/**
 * Tests for POST /api/team/invite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userOrganization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  hasPermission: vi.fn(),
}))

vi.mock('@/lib/auth/subscription', () => ({
  checkTeamMemberLimit: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  auditMember: { invited: vi.fn() },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { hasPermission } from '@/lib/auth/permissions'
import { checkTeamMemberLimit } from '@/lib/auth/subscription'
import { auditMember } from '@/lib/audit'

describe('POST /api/team/invite', () => {
  const makeRequest = (body: unknown) =>
    new NextRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(hasPermission).mockResolvedValue(true)
    vi.mocked(checkTeamMemberLimit).mockResolvedValue({
      allowed: true,
      current: 2,
      limit: 10,
    })

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-2',
      name: 'Alice',
      email: 'alice@example.com',
      image: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    } as any)

    vi.mocked(prisma.userOrganization.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.userOrganization.create).mockResolvedValue({
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'MEMBER',
    } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com' }))

    expect(response.status).toBe(401)
  })

  it('should return 403 when the caller cannot invite members', async () => {
    vi.mocked(hasPermission).mockResolvedValue(false)

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com' }))

    expect(response.status).toBe(403)
    expect(prisma.userOrganization.create).not.toHaveBeenCalled()
  })

  it('should return 400 for an invalid email', async () => {
    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'not-an-email' }))

    expect(response.status).toBe(400)
  })

  it('should refuse to assign OWNER through an invitation', async () => {
    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com', role: 'OWNER' }))

    expect(response.status).toBe(400)
    expect(prisma.userOrganization.create).not.toHaveBeenCalled()
  })

  it('should return 404 when no account exists for the email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'nobody@example.com' }))

    expect(response.status).toBe(404)
    expect(prisma.userOrganization.create).not.toHaveBeenCalled()
  })

  it('should return 404 for a soft-deleted user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-2',
      email: 'alice@example.com',
      deletedAt: new Date(),
      createdAt: new Date(),
    } as any)

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com' }))

    expect(response.status).toBe(404)
  })

  it('should return 400 when the user is already a member', async () => {
    vi.mocked(prisma.userOrganization.findUnique).mockResolvedValue({
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'MEMBER',
    } as any)

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com' }))

    expect(response.status).toBe(400)
    expect(prisma.userOrganization.create).not.toHaveBeenCalled()
  })

  it('should return 429 when the team member limit is reached', async () => {
    vi.mocked(checkTeamMemberLimit).mockResolvedValue({
      allowed: false,
      current: 10,
      limit: 10,
      upgradeUrl: '/pricing',
    })

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'alice@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.code).toBe('TEAM_LIMIT_EXCEEDED')
    expect(prisma.userOrganization.create).not.toHaveBeenCalled()
  })

  it('should add an existing account to the organization', async () => {
    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(makeRequest({ email: 'ALICE@example.com', role: 'ADMIN' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.member).toEqual({
      id: 'user-2',
      name: 'Alice',
      email: 'alice@example.com',
      image: null,
      role: 'MEMBER',
      joinedAt: '2026-01-01T00:00:00.000Z',
    })
    // Email is normalized before lookup
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'alice@example.com' } })
    )
    expect(prisma.userOrganization.create).toHaveBeenCalledWith({
      data: { userId: 'user-2', organizationId: 'org-1', role: 'ADMIN' },
    })
    expect(auditMember.invited).toHaveBeenCalledWith('org-1', 'alice@example.com', 'ADMIN')
  })
})
