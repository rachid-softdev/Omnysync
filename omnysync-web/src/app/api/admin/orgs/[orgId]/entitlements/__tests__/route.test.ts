/**
 * Tests for GET /api/admin/orgs/[orgId]/entitlements
 *
 * Pattern: mock @/lib/auth/require-admin, the EntitlementRepository
 * (getActiveSubscription, getPlanKey, getAllOverridesForOrg) and the
 * FeatureGateService (getAllEntitlements).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockRequireAdmin, MockAuthError, mockRepo, mockFeatureGate } = vi.hoisted(() => {
  class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return {
    mockRequireAdmin: vi.fn(),
    MockAuthError: AuthError,
    mockRepo: {
      getActiveSubscription: vi.fn(),
      getPlanKey: vi.fn(),
      getAllOverridesForOrg: vi.fn(),
    },
    mockFeatureGate: { getAllEntitlements: vi.fn() },
  }
})

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
  AuthError: MockAuthError,
}))

vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: vi.fn(() => mockRepo),
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: vi.fn(() => mockFeatureGate),
}))

// ── Test body ────────────────────────────────────────────────────────────────

describe('GET /api/admin/orgs/[orgId]/entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockRequireAdmin).mockResolvedValue({ id: 'admin-1', email: 'a@e.com' })
    vi.mocked(mockRepo.getActiveSubscription).mockResolvedValue({ id: 'sub-1', plan: 'pro' } as any)
    vi.mocked(mockRepo.getPlanKey).mockResolvedValue('pro')
    vi.mocked(mockRepo.getAllOverridesForOrg).mockResolvedValue([{ id: 'ov-1' }] as any)
    vi.mocked(mockFeatureGate.getAllEntitlements).mockResolvedValue({
      featureA: { enabled: true },
    } as any)
  })

  const call = async (orgId: string) => {
    const { GET } = await import('@/app/api/admin/orgs/[orgId]/entitlements/route')
    return GET(new NextRequest(`http://localhost:3000/api/admin/orgs/${orgId}/entitlements`), {
      params: Promise.resolve({ orgId }),
    })
  }

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(mockRequireAdmin).mockRejectedValue(new MockAuthError('Non autorisé', 401))
    const response = await call('org-1')
    expect(response.status).toBe(401)
  })

  it('returns 403 when the user is not an ADMIN', async () => {
    vi.mocked(mockRequireAdmin).mockRejectedValue(new MockAuthError('Accès non autorisé', 403))
    const response = await call('org-1')
    expect(response.status).toBe(403)
  })

  it('returns subscription, plan, entitlements and overrides for the org', async () => {
    const response = await call('org-7')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.orgId).toBe('org-7')
    expect(data.subscription).toEqual({ id: 'sub-1', plan: 'pro' })
    expect(data.planKey).toBe('pro')
    expect(data.entitlements).toEqual({ featureA: { enabled: true } })
    expect(data.overrides).toEqual([{ id: 'ov-1' }])
  })

  it('returns 500 when the repository fails', async () => {
    vi.mocked(mockRepo.getActiveSubscription).mockRejectedValue(new Error('db down'))
    const response = await call('org-1')
    expect(response.status).toBe(500)
  })
})
