import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS — vi.mock factories are hoisted, but variables are captured by closure
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetAllFeaturesWithPlans = vi.fn()
const mockPrismaFindUnique = vi.fn()
const mockPrismaCreate = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feature: {
      findUnique: mockPrismaFindUnique,
      create: mockPrismaCreate,
    },
  },
}))

// Repo is used only in GET (POST uses prisma directly)
vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: () => ({
    getAllFeaturesWithPlans: mockGetAllFeaturesWithPlans,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(
  overrides: {
    url?: string
    body?: unknown
  } = {}
): NextRequest {
  return {
    url: overrides.url ?? 'http://localhost:3000/api/admin/features',
    json: vi.fn().mockResolvedValue(overrides.body ?? {}),
  } as unknown as NextRequest
}

function feature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feat-1',
    key: 'EXPORT_PDF',
    name: 'Export PDF',
    description: null,
    type: 'BOOLEAN',
    defaultConfig: null,
    plans: [],
    ...overrides,
  }
}

// ============================================================================
// GET /api/admin/features
// ============================================================================

describe('GET /api/admin/features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns paginated features for admin', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([
      feature({ id: 'f1', key: 'A' }),
      feature({ id: 'f2', key: 'B' }),
      feature({ id: 'f3', key: 'C' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/features?page=1&limit=2' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    })
  })

  it('caps limit at MAX_LIMIT (100)', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([feature()])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/features?limit=999' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.pagination.limit).toBeLessThanOrEqual(100)
  })

  it('sorts by key:asc by default', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([
      feature({ id: 'f2', key: 'B' }),
      feature({ id: 'f1', key: 'A' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].key).toBe('A')
    expect(body.data[1].key).toBe('B')
  })

  it('returns 500 when repo throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockRejectedValue(new Error('DB down'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })

  it('returns empty data when no features exist', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.totalPages).toBe(0)
  })

  it('returns empty data for page beyond range', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([feature({ id: 'f1', key: 'A' })])

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ url: 'http://localhost:3000/api/admin/features?page=99' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination.page).toBe(99)
  })

  it('normalizes negative page number to 1', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([feature()])

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ url: 'http://localhost:3000/api/admin/features?page=-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.pagination.page).toBe(1)
  })

  it('sorts by name:desc when specified', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllFeaturesWithPlans.mockResolvedValue([
      feature({ id: 'f1', key: 'B', name: 'Beta' }),
      feature({ id: 'f2', key: 'A', name: 'Alpha' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/features?sort=name:desc' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].name).toBe('Beta')
    expect(body.data[1].name).toBe('Alpha')
  })

  it('returns 401 when auth throws', async () => {
    mockAuthFn.mockRejectedValue(new Error('Auth error'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest())

    expect(res.status).toBe(500)
  })
})

// ============================================================================
// POST /api/admin/features
// ============================================================================

describe('POST /api/admin/features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X', type: 'BOOLEAN' } }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X', type: 'BOOLEAN' } }))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it('returns 400 when key is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { name: 'X', type: 'BOOLEAN' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when name is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', type: 'BOOLEAN' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when type is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid type', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'x', name: 'X', type: 'BOGUS' } }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toContain('BOOLEAN')
  })

  it('returns 409 for duplicate key', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue({ id: 'existing', key: 'EXPORT_PDF' })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'EXPORT_PDF', name: 'Export', type: 'BOOLEAN' } })
    )
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe('DUPLICATE_KEY')
  })

  it('creates a feature and returns 201', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'MY_FEATURE',
      name: 'My Feature',
      description: 'desc',
      type: 'BOOLEAN',
      defaultConfig: null,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { key: 'MY_FEATURE', name: 'My Feature', description: 'desc', type: 'BOOLEAN' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('new')
    expect(body.key).toBe('MY_FEATURE')
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        key: 'MY_FEATURE',
        name: 'My Feature',
        description: 'desc',
        type: 'BOOLEAN',
        defaultConfig: undefined,
      },
    })
  })

  it('creates LIMIT type feature', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'MAX_CONNECTORS',
      name: 'Connectors',
      type: 'LIMIT',
      defaultConfig: null,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({ body: { key: 'MAX_CONNECTORS', name: 'Connectors', type: 'LIMIT' } })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.type).toBe('LIMIT')
  })

  it('returns 500 when prisma create fails', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockRejectedValue(new Error('connection lost'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'X', name: 'X', type: 'BOOLEAN' } }))
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

  it('creates feature with EXPERIMENT type', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'A_B_TEST',
      name: 'A/B Test',
      description: null,
      type: 'EXPERIMENT',
      defaultConfig: null,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { key: 'A_B_TEST', name: 'A/B Test', type: 'EXPERIMENT' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.type).toBe('EXPERIMENT')
  })

  it('creates feature with defaultConfig', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaCreate.mockResolvedValue({
      id: 'new',
      key: 'CHAT_LIMIT',
      name: 'Chat Limit',
      description: null,
      type: 'LIMIT',
      defaultConfig: 5,
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { key: 'CHAT_LIMIT', name: 'Chat Limit', type: 'LIMIT', defaultConfig: 5 },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.type).toBe('LIMIT')
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        key: 'CHAT_LIMIT',
        name: 'Chat Limit',
        description: undefined,
        type: 'LIMIT',
        defaultConfig: 5,
      },
    })
  })

  it('returns 500 when prisma findUnique throws on duplicate check', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindUnique.mockRejectedValue(new Error('DB error'))

    const { POST } = await import('../route')
    const res = await POST(mockRequest({ body: { key: 'X', name: 'X', type: 'BOOLEAN' } }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
