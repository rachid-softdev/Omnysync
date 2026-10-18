import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/password')>()
  return {
    ...actual,
    hashPassword: vi.fn().mockResolvedValue('new-hash'),
    verifyPassword: vi.fn(),
  }
})

const mockRateLimit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: mockRateLimit,
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'

async function importRoute() {
  return import('../route')
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/user/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/user/password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockRateLimit.mockResolvedValue({ allowed: true })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: 'current-hash',
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { PUT } = await importRoute()
    const response = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'NewPass123' }))

    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remainingTime: 60000 })

    const { PUT } = await importRoute()
    const response = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'NewPass123' }))

    expect(response.status).toBe(429)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns 400 when the current password is wrong', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const { PUT } = await importRoute()
    const response = await PUT(
      makeRequest({ currentPassword: 'wrong', newPassword: 'NewPass123' })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Mot de passe actuel incorrect')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an OAuth-only account without a password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: null } as any)

    const { PUT } = await importRoute()
    const response = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'NewPass123' }))

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 when the new password is too weak', async () => {
    const { PUT } = await importRoute()
    const response = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'weakpass' }))

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid body', async () => {
    const { PUT } = await importRoute()
    const response = await PUT(makeRequest({ currentPassword: '', newPassword: 'short' }))

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the password hash on success', async () => {
    const { PUT } = await importRoute()
    const response = await PUT(
      makeRequest({ currentPassword: 'ValidPass1', newPassword: 'NewValidPass1' })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'new-hash' },
    })
  })
})
