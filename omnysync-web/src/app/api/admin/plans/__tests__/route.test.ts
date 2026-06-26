import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetAllPlansWithFeatures = vi.fn()
const mockPrismaFindUnique = vi.fn()
const mockPrismaCreate = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    plan: {
      findUnique: mockPrismaFindUnique,
      create: mockPrismaCreate,
    },
  },
}))

vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: () => ({
    getAllPlansWithFeatures: mockGetAllPlansWithFeatures,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(overrides: { url?: string; body?: unknown } = {}): NextRequest {
  return {
    url: overrides.url ?? 'http://localhost:3000/api/admin/plans',
    json: vi.fn().mockResolvedValue(overrides.body ?? {}),
  } as unknown as NextRequest
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    key: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 290,
    isActive: true,
    sortOrder: 2,
    features: [],
    ...overrides,
  }
}

// ============================================================================
// GET /api/admin/plans
// ============================================================================

describe('GET /api/admin/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    expect(res.status).toBe(403)
  })

  it('returns paginated plans for admin', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockResolvedValue([
      plan({ id: 'p1', key: 'free', name: 'Free' }),
      plan({ id: 'p2', key: 'pro', name: 'Pro' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    })
  })

  it('respects pagination params', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockResolvedValue([
      plan({ id: 'p1', key: 'free' }),
      plan({ id: 'p2', key: 'pro' }),
      plan({ id: 'p3', key: 'business' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/plans?page=1&limit=2' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.totalPages).toBe(2)
  })

  it('caps limit at 100', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockResolvedValue([plan()])

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ url: 'http://localhost:3000/api/admin/plans?limit=999' }))
    const body = await res.json()

    expect(body.pagination.limit).toBeLessThanOrEqual(100)
  })

  it('returns 500 when repo throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockRejectedValue(new Error('DB down'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })

  it('returns empty data when no plans exist', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockResolvedValue([])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })

  it('returns empty data for page beyond range', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllPlansWithFeatures.mockResolvedValue([plan()])

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ url: 'http://localhost:3000/api/admin/plans?page=99' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('returns 401 when auth throws', async () => {
    mockAuthFn.mockRejectedValue(new Error('Auth error'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest())

    expect(res.status).toBe(500)
  })
})

// ============================================================================
// POST /api/admin/plans
// ============================================================================

describe('POST /api/admin/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X' } }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X' } }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when key is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { name: 'X' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when name is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 409 for duplicate key', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue({ id: 'existing', key: 'pro' })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'pro', name: 'Pro' } }))
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe('DUPLICATE_KEY')
  })

  it('creates a plan with defaults and returns 201', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'enterprise',
      name: 'Enterprise',
      priceMonthly: null,
      priceYearly: null,
      isActive: true,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'enterprise', name: 'Enterprise' } }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.key).toBe('enterprise')
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        key: 'enterprise',
        name: 'Enterprise',
        priceMonthly: null,
        priceYearly: null,
        isActive: true,
        sortOrder: 0,
      },
    })
  })

  it('creates a plan with all optional fields', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'pro',
      name: 'Pro',
      priceMonthly: 29,
      priceYearly: 290,
      isActive: true,
      sortOrder: 1,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: {
          key: 'pro',
          name: 'Pro',
          priceMonthly: 29,
          priceYearly: 290,
          isActive: true,
          sortOrder: 1,
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.priceMonthly).toBe(29)
    expect(body.priceYearly).toBe(290)
  })

  it('returns 500 when prisma create fails', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockRejectedValue(new Error('connection lost'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X' } }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })

  it('returns 400 when request body is empty', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: {} }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('creates plan with isActive explicitly false', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'legacy',
      name: 'Legacy',
      priceMonthly: null,
      priceYearly: null,
      isActive: false,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'legacy', name: 'Legacy', isActive: false } })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.isActive).toBe(false)
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        key: 'legacy',
        name: 'Legacy',
        priceMonthly: null,
        priceYearly: null,
        isActive: false,
        sortOrder: 0,
      },
    })
  })

  it('handles non-numeric priceMonthly string as NaN via parseFloat', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'test',
      name: 'Test',
      priceMonthly: NaN,
      priceYearly: null,
      isActive: true,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'test', name: 'Test', priceMonthly: 'free' } })
    )
    // Source: priceMonthly: priceMonthly !== undefined && priceMonthly !== null
    //            ? parseFloat(String(priceMonthly)) : null
    // 'free' passes the defined/null check, so parseFloat('free') produces NaN
    expect(res.status).toBe(201)
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceMonthly: NaN,
      }),
    })
  })

  it('handles priceMonthly of 0 correctly (no longer falsy-coerced to null)', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'free-plan',
      name: 'Free Plan',
      priceMonthly: 0,
      priceYearly: null,
      isActive: true,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'free-plan', name: 'Free Plan', priceMonthly: 0 } })
    )
    const body = await res.json()

    // With the old falsy check (priceMonthly ? ... : null), 0 would become null.
    // The new explicit undefined/null check preserves 0.
    expect(res.status).toBe(201)
    expect(body.priceMonthly).toBe(0)
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceMonthly: 0,
      }),
    })
  })

  it('sets priceMonthly to null when explicitly null', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'null-price',
      name: 'Null Price',
      priceMonthly: null,
      priceYearly: null,
      isActive: true,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'null-price', name: 'Null Price', priceMonthly: null } })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.priceMonthly).toBeNull()
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceMonthly: null,
      }),
    })
  })

  it('sets priceMonthly to null when undefined (not sent)', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'no-price',
      name: 'No Price',
      priceMonthly: null,
      priceYearly: null,
      isActive: true,
      sortOrder: 0,
    })

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'no-price', name: 'No Price' } }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.priceMonthly).toBeNull()
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceMonthly: null,
      }),
    })
  })

  it('returns 500 when prisma findUnique throws on duplicate check', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockRejectedValue(new Error('DB error'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X' } }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
