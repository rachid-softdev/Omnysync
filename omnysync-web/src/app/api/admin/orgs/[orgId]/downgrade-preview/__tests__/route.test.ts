/**
 * Tests for GET /api/admin/orgs/[orgId]/downgrade-preview
 *
 * Pattern: mock @/lib/auth/require-admin and the DowngradeService
 * (getDowngradePreview + validateDowngrade).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockRequireAdmin, MockAuthError, mockDowngrade } = vi.hoisted(() => {
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
    mockDowngrade: {
      getDowngradePreview: vi.fn(),
      validateDowngrade: vi.fn(),
    },
  }
})

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
  AuthError: MockAuthError,
}))

vi.mock('@/lib/entitlements/DowngradeService', () => ({
  getDowngradeService: vi.fn(() => mockDowngrade),
}))

// ── Test body ────────────────────────────────────────────────────────────────

describe('GET /api/admin/orgs/[orgId]/downgrade-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockRequireAdmin).mockResolvedValue({ id: 'admin-1', email: 'a@e.com' })
    vi.mocked(mockDowngrade.getDowngradePreview).mockResolvedValue({
      recommendedStrategy: 'GRADUAL',
      affectedFeatures: ['f1', 'f2'],
    } as any)
    vi.mocked(mockDowngrade.validateDowngrade).mockResolvedValue({
      canProceed: true,
      warnings: [],
      affectedFeatures: 2,
    } as any)
  })

  const call = async (orgId: string, plan?: string) => {
    const qs = plan ? `?plan=${plan}` : ''
    const { GET } = await import('@/app/api/admin/orgs/[orgId]/downgrade-preview/route')
    return GET(
      new NextRequest(`http://localhost:3000/api/admin/orgs/${orgId}/downgrade-preview${qs}`),
      {
        params: Promise.resolve({ orgId }),
      }
    )
  }

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(mockRequireAdmin).mockRejectedValue(new MockAuthError('Non autorisé', 401))
    const response = await call('org-1', 'free')
    expect(response.status).toBe(401)
  })

  it('returns 403 when the user is not an ADMIN', async () => {
    vi.mocked(mockRequireAdmin).mockRejectedValue(new MockAuthError('Accès non autorisé', 403))
    const response = await call('org-1', 'free')
    expect(response.status).toBe(403)
  })

  it('returns 400 when the plan query param is missing', async () => {
    const response = await call('org-1')
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  it('returns the preview with canProceed and warnings for a valid target plan', async () => {
    const response = await call('org-9', 'free')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.orgId).toBe('org-9')
    expect(data.targetPlan).toBe('free')
    expect(data.canProceed).toBe(true)
    expect(data.warnings).toEqual([])
    expect(data.affectedFeaturesCount).toBe(2)
    expect(data.recommendedStrategy).toBe('GRADUAL')
    expect(mockDowngrade.getDowngradePreview).toHaveBeenCalledWith('org-9', 'free')
    expect(mockDowngrade.validateDowngrade).toHaveBeenCalledWith('org-9', 'free')
  })
})
