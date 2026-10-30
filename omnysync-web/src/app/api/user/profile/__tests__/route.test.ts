/**
 * Tests for PATCH /api/user/profile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const sampleUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
}

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'ada@example.com' },
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(sampleUser as any)
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organization: { id: 'org-1', name: 'Analytical Engines' },
    } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/user/profile/route')
    const response = await GET()

    expect(response.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('should return 404 when the user no longer exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/user/profile/route')
    const response = await GET()

    expect(response.status).toBe(404)
  })

  it('should return safe profile fields and the current organization', async () => {
    const { GET } = await import('@/app/api/user/profile/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      ...sampleUser,
      organization: { id: 'org-1', name: 'Analytical Engines' },
    })
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, name: true, email: true, image: true },
    })
  })

  it('should return a null organization when the user has no membership', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/user/profile/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.organization).toBeNull()
  })

  it('should return 500 when the profile query fails', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB down'))

    const { GET } = await import('@/app/api/user/profile/route')
    const response = await GET()

    expect(response.status).toBe(500)
  })
})

describe('PATCH /api/user/profile', () => {
  const makeRequest = (body: string) =>
    new NextRequest('http://localhost:3000/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user-1',
      name: 'New Name',
      email: 'test@omnysync.com',
      image: null,
    } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest(JSON.stringify({ name: 'New Name' })))

    expect(response.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid JSON', async () => {
    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest('{not-json'))

    expect(response.status).toBe(400)
  })

  it('should return 400 when name is empty', async () => {
    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest(JSON.stringify({ name: '   ' })))

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should return 400 when name is too long', async () => {
    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest(JSON.stringify({ name: 'a'.repeat(101) })))

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should update only the authenticated user and return safe fields', async () => {
    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest(JSON.stringify({ name: '  New Name  ' })))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      id: 'user-1',
      name: 'New Name',
      email: 'test@omnysync.com',
      image: null,
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
      select: { id: true, name: true, email: true, image: true },
    })
  })

  it('should not allow changing email, role, or password', async () => {
    const { PATCH } = await import('@/app/api/user/profile/route')
    await PATCH(
      makeRequest(
        JSON.stringify({
          name: 'New Name',
          email: 'attacker@example.com',
          role: 'ADMIN',
          password: 'hunter2',
        })
      )
    )

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'New Name' } })
    )
  })

  it('should return 500 when the update fails', async () => {
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('DB down'))

    const { PATCH } = await import('@/app/api/user/profile/route')
    const response = await PATCH(makeRequest(JSON.stringify({ name: 'New Name' })))

    expect(response.status).toBe(500)
  })
})
