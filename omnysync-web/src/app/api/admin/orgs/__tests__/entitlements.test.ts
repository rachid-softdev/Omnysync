import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthFn = vi.fn()
const mockGetAllEntitlements = vi.fn()
const mockGetActiveSubscription = vi.fn()
const mockGetPlanKey = vi.fn()
const mockGetAllOverridesForOrg = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: () => ({
    getAllEntitlements: mockGetAllEntitlements,
  }),
}))

vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: () => ({
    getActiveSubscription: mockGetActiveSubscription,
    getPlanKey: mockGetPlanKey,
    getAllOverridesForOrg: mockGetAllOverridesForOrg,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function mockRequest(): NextRequest {
  return {
    url: 'http://localhost:3000/api/admin/orgs/org-1/entitlements',
  } as unknown as NextRequest
}

function mockParams(orgId: string): { params: Promise<{ orgId: string }> } {
  return { params: Promise.resolve({ orgId }) }
}

const sampleEntitlements = {
  planKey: 'pro',
  features: { EXPORT_PDF: true, AI_SUMMARY: true },
  limits: { MAX_CONNECTORS: 10 },
  experiments: {},
}

const sampleSubscription = {
  id: 'sub-1',
  organizationId: 'org-1',
  planKey: 'pro',
  status: 'ACTIVE' as const,
  currentPeriodStart: new Date('2026-01-01'),
  currentPeriodEnd: new Date('2026-12-31'),
  cancelAtPeriodEnd: false,
  trialStart: null,
  trialEnd: null,
}

// JSON round-trip version for assertions after Response.json() serialization
const expectedSubscription = JSON.parse(JSON.stringify(sampleSubscription))

// ============================================================================
// GET /api/admin/orgs/:orgId/entitlements
// ============================================================================

describe('GET /api/admin/orgs/[orgId]/entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuthFn.mockResolvedValue(mockSession())

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    expect(res.status).toBe(403)
  })

  it('returns full entitlements for org', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockResolvedValue(sampleSubscription)
    mockGetPlanKey.mockResolvedValue('pro')
    mockGetAllEntitlements.mockResolvedValue(sampleEntitlements)
    mockGetAllOverridesForOrg.mockResolvedValue([
      { id: 'ovr-1', scope: 'ORG', scopeId: 'org-1', featureKey: 'EXPORT_PDF', enabled: true },
    ])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.orgId).toBe('org-1')
    expect(body.subscription).toEqual(expectedSubscription)
    expect(body.planKey).toBe('pro')
    expect(body.entitlements).toEqual(sampleEntitlements)
    expect(body.overrides).toHaveLength(1)
    expect(mockGetActiveSubscription).toHaveBeenCalledWith('org-1')
    expect(mockGetPlanKey).toHaveBeenCalledWith('org-1')
    expect(mockGetAllEntitlements).toHaveBeenCalledWith('org-1')
    expect(mockGetAllOverridesForOrg).toHaveBeenCalledWith('org-1')
  })

  it('returns empty overrides when none exist', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockResolvedValue(sampleSubscription)
    mockGetPlanKey.mockResolvedValue('free')
    mockGetAllEntitlements.mockResolvedValue({
      planKey: 'free',
      features: { EXPORT_PDF: false },
      limits: { MAX_CONNECTORS: 2 },
      experiments: {},
    })
    mockGetAllOverridesForOrg.mockResolvedValue([])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overrides).toHaveLength(0)
    expect(body.planKey).toBe('free')
  })

  it('returns null subscription when org has no subscription', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockResolvedValue(null)
    mockGetPlanKey.mockResolvedValue('free')
    mockGetAllEntitlements.mockResolvedValue({
      planKey: 'free',
      features: {},
      limits: {},
      experiments: {},
    })
    mockGetAllOverridesForOrg.mockResolvedValue([])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.subscription).toBeNull()
  })

  it('returns 500 when repo throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockRejectedValue(new Error('DB down'))

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })

  it('returns org with TRIALING subscription status', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    const trialSubscription = {
      ...sampleSubscription,
      status: 'TRIALING' as const,
      trialStart: new Date('2026-06-01'),
      trialEnd: new Date('2026-07-01'),
    }
    mockGetActiveSubscription.mockResolvedValue(trialSubscription)
    mockGetPlanKey.mockResolvedValue('pro')
    mockGetAllEntitlements.mockResolvedValue(sampleEntitlements)
    mockGetAllOverridesForOrg.mockResolvedValue([])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.subscription.status).toBe('TRIALING')
    expect(body.subscription.trialStart).toBeTruthy()
    expect(body.subscription.trialEnd).toBeTruthy()
  })

  it('returns org with cancelAtPeriodEnd subscription', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    const cancelSubscription = {
      ...sampleSubscription,
      cancelAtPeriodEnd: true,
    }
    mockGetActiveSubscription.mockResolvedValue(cancelSubscription)
    mockGetPlanKey.mockResolvedValue('pro')
    mockGetAllEntitlements.mockResolvedValue(sampleEntitlements)
    mockGetAllOverridesForOrg.mockResolvedValue([])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.subscription.cancelAtPeriodEnd).toBe(true)
  })

  it('returns 500 when getAllEntitlements throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockResolvedValue(sampleSubscription)
    mockGetPlanKey.mockResolvedValue('pro')
    mockGetAllEntitlements.mockRejectedValue(new Error('FeatureGate error'))
    mockGetAllOverridesForOrg.mockResolvedValue([])

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))

    expect(res.status).toBe(500)
  })

  it('returns 500 when getAllOverridesForOrg throws', async () => {
    mockAuthFn.mockResolvedValue(mockAdminSession())
    mockGetActiveSubscription.mockResolvedValue(sampleSubscription)
    mockGetPlanKey.mockResolvedValue('pro')
    mockGetAllEntitlements.mockResolvedValue(sampleEntitlements)
    mockGetAllOverridesForOrg.mockRejectedValue(new Error('Overrides error'))

    const { GET } = await import('../[orgId]/entitlements/route')
    const res = await GET(mockRequest(), mockParams('org-1'))

    expect(res.status).toBe(500)
  })
})
