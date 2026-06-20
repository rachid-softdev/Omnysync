import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetAllOverridesForOrg = vi.fn()
const mockCreateOverride = vi.fn()
const mockInvalidateCache = vi.fn()
const mockPrismaFindMany = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    entitlementOverride: {
      findMany: mockPrismaFindMany,
    },
  },
}))

vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: () => ({
    getAllOverridesForOrg: mockGetAllOverridesForOrg,
    createOverride: mockCreateOverride,
  }),
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: () => ({
    invalidateCache: mockInvalidateCache,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(overrides: { url?: string; body?: unknown } = {}): NextRequest {
  return {
    url: overrides.url ?? 'http://localhost:3000/api/admin/overrides',
    json: vi.fn().mockResolvedValue(overrides.body ?? {}),
  } as unknown as NextRequest
}

function override(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ovr-1',
    scope: 'ORG',
    scopeId: 'org-1',
    featureKey: 'EXPORT_PDF',
    enabled: true,
    limitValue: null,
    expiresAt: null,
    reason: 'Test override',
    ...overrides,
  }
}

// ============================================================================
// GET /api/admin/overrides
// ============================================================================

describe('GET /api/admin/overrides', () => {
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

  it('returns all overrides when no orgId filter', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindMany.mockResolvedValue([override({ id: 'o1' }), override({ id: 'o2' })])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
  })

  it('filters by orgId when query param present', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetAllOverridesForOrg.mockResolvedValue([override({ id: 'o1', scopeId: 'org-1' })])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/overrides?orgId=org-1' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(mockGetAllOverridesForOrg).toHaveBeenCalledWith('org-1')
    expect(mockPrismaFindMany).not.toHaveBeenCalled()
  })

  it('paginates results', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindMany.mockResolvedValue([
      override({ id: 'o1' }),
      override({ id: 'o2' }),
      override({ id: 'o3' }),
    ])

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/overrides?page=1&limit=2' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(3)
    expect(body.pagination.totalPages).toBe(2)
  })

  it('returns empty array when no overrides', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('returns 500 when prisma throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockPrismaFindMany.mockRejectedValue(new Error('DB down'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// POST /api/admin/overrides
// ============================================================================

describe('POST /api/admin/overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'org-1', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'org-1', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 when scope is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scopeId: 'org-1', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when scopeId is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when featureKey is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'org-1', enabled: true, reason: 'test' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when reason is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'org-1', featureKey: 'FEAT', enabled: true },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid scope', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'BOGUS', scopeId: 'x', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
    expect(data.message).toContain('ORG')
  })

  it('returns 400 for empty reason', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'org-1', featureKey: 'FEAT', enabled: true, reason: '' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
    expect(data.message).toContain('audit')
  })

  it('creates ORG-scope override and invalidates cache', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockCreateOverride.mockResolvedValue({
      id: 'new-ovr',
      scope: 'ORG',
      scopeId: 'org-1',
      featureKey: 'EXPORT_PDF',
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: 'Business need',
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: {
          scope: 'ORG',
          scopeId: 'org-1',
          featureKey: 'EXPORT_PDF',
          enabled: true,
          reason: 'Business need',
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('new-ovr')
    expect(mockCreateOverride).toHaveBeenCalledWith({
      scope: 'ORG',
      scopeId: 'org-1',
      featureKey: 'EXPORT_PDF',
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: 'Business need',
      createdBy: 'admin-1',
    })
    expect(mockInvalidateCache).toHaveBeenCalledWith('org-1')
  })

  it('creates USER-scope override without cache invalidation', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockCreateOverride.mockResolvedValue({
      id: 'new-ovr',
      scope: 'USER',
      scopeId: 'user-1',
      featureKey: 'EXPORT_PDF',
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: 'Testing',
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: {
          scope: 'USER',
          scopeId: 'user-1',
          featureKey: 'EXPORT_PDF',
          enabled: true,
          reason: 'Testing',
        },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('new-ovr')
    expect(mockInvalidateCache).not.toHaveBeenCalled()
  })

  it('creates override with expiry and limit value', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockCreateOverride.mockResolvedValue({
      id: 'new-ovr',
      scope: 'ORG',
      scopeId: 'org-1',
      featureKey: 'MAX_CONNECTORS',
      enabled: true,
      limitValue: 50,
      expiresAt: new Date('2026-12-31'),
      reason: 'Campaign',
    })

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: {
          scope: 'ORG',
          scopeId: 'org-1',
          featureKey: 'MAX_CONNECTORS',
          enabled: true,
          limitValue: 50,
          expiresAt: '2026-12-31T00:00:00Z',
          reason: 'Campaign',
        },
      })
    )

    expect(res.status).toBe(201)
    expect(mockCreateOverride).toHaveBeenCalled()
    const args = mockCreateOverride.mock.calls[0][0]
    expect(args.limitValue).toBe(50)
    expect(args.expiresAt).toBeInstanceOf(Date)
  })

  it('returns 500 when repo throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockCreateOverride.mockRejectedValue(new Error('DB down'))

    const { POST } = await import('../route')
    const res = await POST(
      mockRequest({
        body: { scope: 'ORG', scopeId: 'x', featureKey: 'FEAT', enabled: true, reason: 'test' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
