/**
 * Tests for POST /api/admin/cache/invalidate/[orgId]
 *
 * Pattern: mock @/lib/auth/require-admin and the FeatureGateService
 * (invalidateCache).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockRequireAdmin, MockAuthError, mockFeatureGate } = vi.hoisted(() => {
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
    mockFeatureGate: { invalidateCache: vi.fn() },
  }
})

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
  AuthError: MockAuthError,
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: vi.fn(() => mockFeatureGate),
}))

// ── Test body ────────────────────────────────────────────────────────────────

describe('POST /api/admin/cache/invalidate/[orgId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockRequireAdmin).mockResolvedValue({ id: 'admin-1', email: 'a@e.com' })
    vi.mocked(mockFeatureGate.invalidateCache).mockResolvedValue(undefined)
  })

  const call = async (orgId: string) => {
    const { POST } = await import('@/app/api/admin/cache/invalidate/[orgId]/route')
    return POST(
      new NextRequest(`http://localhost:3000/api/admin/cache/invalidate/${orgId}`, {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ orgId }),
      }
    )
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

  it('invalidates the entitlements cache for the org and returns 200', async () => {
    const response = await call('org-42')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.orgId).toBe('org-42')
    expect(mockFeatureGate.invalidateCache).toHaveBeenCalledWith('org-42')
  })

  it('returns 500 when the cache invalidation fails', async () => {
    vi.mocked(mockFeatureGate.invalidateCache).mockRejectedValue(new Error('redis down'))
    const response = await call('org-1')
    expect(response.status).toBe(500)
  })
})
