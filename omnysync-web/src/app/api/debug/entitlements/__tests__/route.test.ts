import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetDebugTrace = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: () => ({
    getDebugTrace: mockGetDebugTrace,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(overrides: { url?: string } = {}): NextRequest {
  return {
    url:
      overrides.url ??
      'http://localhost:3000/api/debug/entitlements?orgId=org-1&feature=EXPORT_PDF',
  } as unknown as NextRequest
}

const sampleTrace = {
  resolvedVia: 'plan',
  value: true,
  featureKey: 'EXPORT_PDF',
  featureType: 'BOOLEAN',
  planKey: 'pro',
  planLimit: null,
  subscriptionStatus: 'ACTIVE',
  orgId: 'org-1',
}

// ============================================================================
// GET /api/debug/entitlements
// ============================================================================

describe('GET /api/debug/entitlements', () => {
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

  it('returns 400 when orgId is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/debug/entitlements?feature=EXPORT_PDF' })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when feature is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/debug/entitlements?orgId=org-1' })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns debug trace for admin', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDebugTrace.mockResolvedValue(sampleTrace)

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/debug/entitlements?orgId=org-1&feature=EXPORT_PDF',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(sampleTrace)
    expect(mockGetDebugTrace).toHaveBeenCalledWith('org-1', 'EXPORT_PDF')
  })

  it('returns debug trace with override info when present', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDebugTrace.mockResolvedValue({
      ...sampleTrace,
      resolvedVia: 'org_override',
      overrideId: 'ovr-1',
      overrideScope: 'ORG',
    })

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/debug/entitlements?orgId=org-1&feature=EXPORT_PDF',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resolvedVia).toBe('org_override')
    expect(body.overrideId).toBe('ovr-1')
  })

  it('returns 400 with error message when service throws a known error', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDebugTrace.mockRejectedValue(new Error('Feature not found: BOGUS'))

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/debug/entitlements?orgId=org-1&feature=BOGUS',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('ERROR')
    expect(data.message).toContain('Feature not found')
  })

  it('returns 500 for unknown errors', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDebugTrace.mockRejectedValue('Something cryptic')

    const { GET } = await import('../route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/debug/entitlements?orgId=org-1&feature=EXPORT_PDF',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
