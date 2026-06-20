import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockInvalidateCache = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: () => ({
    invalidateCache: mockInvalidateCache,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(overrides: { url?: string } = {}): NextRequest {
  return {
    url: overrides.url ?? 'http://localhost:3000/api/admin/cache/invalidate/org-1',
  } as unknown as NextRequest
}

function mockParams(orgId: string): { params: Promise<{ orgId: string }> } {
  return { params: Promise.resolve({ orgId }) }
}

// ============================================================================
// POST /api/admin/cache/invalidate/:orgId
// ============================================================================

describe('POST /api/admin/cache/invalidate/[orgId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { POST } = await import('../[orgId]/route')
    const res = await POST(mockRequest(), mockParams('org-1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { POST } = await import('../[orgId]/route')
    const res = await POST(mockRequest(), mockParams('org-1'))
    expect(res.status).toBe(403)
  })

  it('invalidates cache and returns 200', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockInvalidateCache.mockResolvedValue(undefined)

    const { POST } = await import('../[orgId]/route')
    const res = await POST(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.orgId).toBe('org-1')
    expect(body.message).toContain('invalidated')
    expect(mockInvalidateCache).toHaveBeenCalledWith('org-1')
  })

  it('uses orgId from params', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockInvalidateCache.mockResolvedValue(undefined)

    const { POST } = await import('../[orgId]/route')
    const res = await POST(
      mockRequest({ url: 'http://localhost:3000/api/admin/cache/invalidate/org-42' }),
      mockParams('org-42')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.orgId).toBe('org-42')
    expect(mockInvalidateCache).toHaveBeenCalledWith('org-42')
  })

  it('returns 500 when service throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockInvalidateCache.mockRejectedValue(new Error('Redis down'))

    const { POST } = await import('../[orgId]/route')
    const res = await POST(mockRequest(), mockParams('org-1'))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
