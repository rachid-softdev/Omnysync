import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'

// ============================================================================
// MOCKS — vi.mock factories are hoisted, but variables are captured by closure
// ============================================================================

const mockAuthFn = vi.fn()
const mockPrismaUserFindMany = vi.fn()
const mockPrismaUserCreate = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mockPrismaUserFindMany,
      create: mockPrismaUserCreate,
    },
  },
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(body: unknown = {}): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@omnysync.com',
    name: 'Alice',
    role: 'USER',
    createdAt: new Date('2026-06-01'),
    ...overrides,
  }
}

// ============================================================================
// GET /api/admin/users
// ============================================================================

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('../route')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('../route')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns 200 with user list for admin', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserFindMany.mockResolvedValue([
      makeUser({ id: 'u1', email: 'alice@test.com', name: 'Alice', role: 'USER' }),
      makeUser({ id: 'u2', email: 'bob@test.com', name: 'Bob', role: 'ADMIN' }),
    ])

    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.users).toHaveLength(2)
    expect(body.users[0].email).toBe('alice@test.com')
    expect(body.users[1].role).toBe('ADMIN')
  })

  it('returns 200 with empty array when no users exist', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserFindMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.users).toEqual([])
  })

  it('does not return sensitive fields (password)', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserFindMany.mockResolvedValue([
      makeUser({ id: 'u1', email: 'a@b.com', name: 'A', role: 'USER' }),
    ])

    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    // Response should not contain password
    expect(body.users[0]).not.toHaveProperty('password')

    // Verify the Prisma query select excludes password
    const callArgs = mockPrismaUserFindMany.mock.calls[0][0]
    expect(callArgs.select).not.toHaveProperty('password')
    expect(callArgs.select).toHaveProperty('id')
    expect(callArgs.select).toHaveProperty('email')
    expect(callArgs.select).toHaveProperty('name')
    expect(callArgs.select).toHaveProperty('role')
    expect(callArgs.select).toHaveProperty('createdAt')
  })

  it('sorts by createdAt desc', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserFindMany.mockResolvedValue([
      makeUser({ id: 'u1', createdAt: new Date('2026-06-01') }),
      makeUser({ id: 'u2', createdAt: new Date('2026-06-02') }),
    ])

    const { GET } = await import('../route')
    await GET()

    const callArgs = mockPrismaUserFindMany.mock.calls[0][0]
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('returns 500 when Prisma throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserFindMany.mockRejectedValue(new Error('DB connection failed'))

    const { GET } = await import('../route')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('Internal Server Error')
  })

  it('returns 500 when auth throws unexpectedly', async () => {
    mockAuthFn.mockRejectedValue(new Error('Auth service error'))

    const { GET } = await import('../route')
    const res = await GET()

    expect(res.status).toBe(500)
  })
})

// ============================================================================
// POST /api/admin/users
// ============================================================================

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'new@test.com', role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'new@test.com', role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns 400 when email is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeDefined()
    // Zod flatten returns fieldErrors
    expect(data.error.fieldErrors).toHaveProperty('email')
  })

  it('returns 400 when email is invalid', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'not-an-email', role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error.fieldErrors).toHaveProperty('email')
  })

  it('returns 400 when role is invalid', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'test@test.com', role: 'INVALID' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error.fieldErrors).toHaveProperty('role')
  })

  it('returns 400 when request body is empty', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error.fieldErrors).toHaveProperty('email')
    expect(data.error.fieldErrors).toHaveProperty('role')
  })

  it('returns 409 when email already exists (P2002)', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    const prismaError = new Error('Unique constraint failed on email')
    ;(prismaError as Record<string, unknown>).code = 'P2002'
    mockPrismaUserCreate.mockRejectedValue(prismaError)

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'existing@test.com', role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe('Email already exists')
  })

  it('creates user with USER role and returns 201', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserCreate.mockResolvedValue({
      id: 'new-user-1',
      email: 'newuser@test.com',
      name: null,
      role: 'USER',
    })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'newuser@test.com', role: 'USER' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.user.id).toBe('new-user-1')
    expect(body.user.email).toBe('newuser@test.com')
    expect(body.user.role).toBe('USER')
    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        email: 'newuser@test.com',
        name: undefined,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })
  })

  it('creates user with ADMIN role and returns 201', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserCreate.mockResolvedValue({
      id: 'new-admin-1',
      email: 'newadmin@test.com',
      name: null,
      role: 'ADMIN',
    })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'newadmin@test.com', role: 'ADMIN' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.user.role).toBe('ADMIN')
  })

  it('creates user with optional name', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserCreate.mockResolvedValue({
      id: 'new-user-2',
      email: 'named@test.com',
      name: 'John Doe',
      role: 'USER',
    })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'named@test.com', name: 'John Doe', role: 'USER' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.user.name).toBe('John Doe')
    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        email: 'named@test.com',
        name: 'John Doe',
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })
  })

  it('returns 500 when Prisma create throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaUserCreate.mockRejectedValue(new Error('DB connection failed'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'fail@test.com', role: 'USER' }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('Internal Server Error')
  })

  it('returns 500 when auth throws unexpectedly during POST', async () => {
    mockAuthFn.mockRejectedValue(new Error('Auth error'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ email: 'test@test.com', role: 'USER' }))

    expect(res.status).toBe(500)
  })
})
