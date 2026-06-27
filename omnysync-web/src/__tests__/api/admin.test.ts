import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '../helpers/auth-helper'

// Use local mock variables to avoid type issues with vi.mocked()
const mockAuthFn = vi.fn()
const mockFindMany = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mockFindMany,
    },
  },
}))

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('@/app/api/admin/users/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 403 for non-admin user', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('@/app/api/admin/users/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('should return users for admin', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockFindMany.mockResolvedValue([
      { id: '1', name: 'Alice', email: 'alice@test.com', role: 'ADMIN' },
      { id: '2', name: 'Bob', email: 'bob@test.com', role: 'USER' },
    ])

    const { GET } = await import('@/app/api/admin/users/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeDefined()
    expect(data.users).toHaveLength(2)
  })
})
