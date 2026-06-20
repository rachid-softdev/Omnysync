import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetDowngradePreview = vi.fn()
const mockValidateDowngrade = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/entitlements/DowngradeService', () => ({
  getDowngradeService: () => ({
    getDowngradePreview: mockGetDowngradePreview,
    validateDowngrade: mockValidateDowngrade,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(overrides: { url?: string } = {}): NextRequest {
  return {
    url: overrides.url ?? 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
  } as unknown as NextRequest
}

function mockParams(orgId: string): { params: Promise<{ orgId: string }> } {
  return { params: Promise.resolve({ orgId }) }
}

const samplePreview = {
  features: [
    {
      featureKey: 'EXPORT_PDF',
      featureName: 'Export PDF',
      currentPlanValue: true,
      targetPlanValue: false,
      currentLimit: null,
      targetLimit: null,
      downgradeStrategy: 'GRACEFUL',
      willBeAffected: true,
      hasActiveUsage: false,
    },
  ],
  recommendedStrategy: 'GRACEFUL',
}

const sampleValidation = {
  canProceed: true,
  warnings: [],
  affectedFeatures: 1,
}

// ============================================================================
// GET /api/admin/orgs/:orgId/downgrade-preview
// ============================================================================

describe('GET /api/admin/orgs/[orgId]/downgrade-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
      }),
      mockParams('org-1')
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
      }),
      mockParams('org-1')
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 when plan query param is missing', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({ url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview' }),
      mockParams('org-1')
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns downgrade preview with validation', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDowngradePreview.mockResolvedValue(samplePreview)
    mockValidateDowngrade.mockResolvedValue(sampleValidation)

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
      }),
      mockParams('org-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.orgId).toBe('org-1')
    expect(body.targetPlan).toBe('free')
    expect(body.preview).toEqual(samplePreview)
    expect(body.canProceed).toBe(true)
    expect(body.warnings).toEqual([])
    expect(body.affectedFeaturesCount).toBe(1)
    expect(body.recommendedStrategy).toBe('GRACEFUL')
    expect(mockGetDowngradePreview).toHaveBeenCalledWith('org-1', 'free')
    expect(mockValidateDowngrade).toHaveBeenCalledWith('org-1', 'free')
  })

  it('returns downgrade preview with warnings when features affected', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDowngradePreview.mockResolvedValue(samplePreview)
    mockValidateDowngrade.mockResolvedValue({
      canProceed: true,
      warnings: ['Export PDF: Access will be cut immediately'],
      affectedFeatures: 1,
    })

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
      }),
      mockParams('org-1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.warnings).toHaveLength(1)
    expect(body.affectedFeaturesCount).toBe(1)
  })

  it('returns 500 when service throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetDowngradePreview.mockRejectedValue(new Error('Service error'))

    const { GET } = await import('../[orgId]/downgrade-preview/route')
    const res = await GET(
      mockRequest({
        url: 'http://localhost:3000/api/admin/orgs/org-1/downgrade-preview?plan=free',
      }),
      mockParams('org-1')
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
