import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { DELETE } from '../route'

describe('DELETE /api/user/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 } as never)
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await DELETE()

    expect(response.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('invalidates JWTs and deletes adapter sessions', async () => {
    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordChangedAt: expect.any(Date) },
    })
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    })
  })

  it('returns 500 when revocation fails', async () => {
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('DB error'))

    const response = await DELETE()

    expect(response.status).toBe(500)
  })
})
