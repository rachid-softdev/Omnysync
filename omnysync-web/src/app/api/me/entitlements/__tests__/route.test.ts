import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockGetAllEntitlements = vi.fn()
const mockHasFeature = vi.fn()
const mockGetExperimentGroup = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/auth/org', () => ({ getUserOrgId: vi.fn() }))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: () => ({
    getAllEntitlements: mockGetAllEntitlements,
    hasFeature: mockHasFeature,
  }),
}))

vi.mock('@/lib/entitlements/ExperimentService', () => ({
  getExperimentService: () => ({
    getExperimentGroup: mockGetExperimentGroup,
  }),
}))

// ============================================================================
// HELPERS
// ============================================================================

import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'

function createHeaderMock(headers: Record<string, string>): { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn((key: string) => headers[key] ?? null),
  }
}

function mockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: createHeaderMock(headers),
  } as unknown as NextRequest
}

const baseEntitlements = {
  planKey: 'pro',
  features: { EXPORT_PDF: true, AI_SUMMARY: true },
  limits: { MAX_CONNECTORS: 10, MAX_DOCUMENTS: 1000 },
  experiments: {
    NEW_DASHBOARD: { percentage: 50, seed: 'exp-seed', enabled: false },
  },
}

// ============================================================================
// GET /api/me/entitlements
// ============================================================================

describe('GET /api/me/entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Authenticated by default
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  it('returns 401 when no org header', async () => {
    // Override the authenticated default: simulate an anonymous caller
    vi.mocked(auth).mockResolvedValueOnce(null)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({}))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('UNAUTHORIZED')
  })

  it('returns entitlements with plan and features', async () => {
    mockGetAllEntitlements.mockResolvedValue(baseEntitlements)
    mockHasFeature.mockResolvedValue(true)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.planKey).toBe('pro')
    expect(body.features).toEqual({ EXPORT_PDF: true, AI_SUMMARY: true })
    expect(body.limits).toEqual({ MAX_CONNECTORS: 10, MAX_DOCUMENTS: 1000 })
    expect(body.usage).toBeDefined()
    expect(body.resetAt).toBeDefined()
    expect(mockGetAllEntitlements).toHaveBeenCalledWith('org-1')
  })

  it('includes experimentGroups when x-user-id is present', async () => {
    mockGetAllEntitlements.mockResolvedValue(baseEntitlements)
    mockHasFeature.mockResolvedValue(true)
    mockGetExperimentGroup.mockReturnValue('treatment')

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1', 'x-user-id': 'user-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.experimentGroups).toBeDefined()
    expect(body.experimentGroups!.NEW_DASHBOARD).toBe('treatment')
    expect(mockGetExperimentGroup).toHaveBeenCalledWith(
      'user-1',
      baseEntitlements.experiments.NEW_DASHBOARD
    )
  })

  it('omits experimentGroups when entitlements have no experiments', async () => {
    mockGetAllEntitlements.mockResolvedValue({
      planKey: 'free',
      features: { EXPORT_PDF: false },
      limits: {},
      experiments: {},
    })
    mockHasFeature.mockResolvedValue(true)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.experimentGroups).toBeUndefined()
  })

  it('sets Cache-Control header', async () => {
    mockGetAllEntitlements.mockResolvedValue(baseEntitlements)
    mockHasFeature.mockResolvedValue(true)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))

    expect(res.headers.get('Cache-Control')).toContain('max-age=60')
    // Per-user/per-org data must never be cached by shared/CDN caches
    expect(res.headers.get('Cache-Control')).toContain('private')
    expect(res.headers.get('Cache-Control')).not.toContain('s-maxage')
  })

  it('returns empty usage when features are not limit type', async () => {
    mockGetAllEntitlements.mockResolvedValue({
      planKey: 'free',
      features: { EXPORT_PDF: false },
      limits: {},
      experiments: {},
    })
    mockHasFeature.mockResolvedValue(true)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.usage).toEqual({})
  })

  // ── TAE5 / fix #1: forged x-org-id header must be IGNORED ──────────────────
  //
  // The org is resolved from the authenticated session via getUserOrgId(), never
  // from the forgeable x-org-id / x-user-id headers. A caller sending a hostile
  // x-org-id must still get the session's OWN org entitlements.

  it('ignores forged x-org-id header and resolves org from the session', async () => {
    mockGetAllEntitlements.mockResolvedValue(baseEntitlements)
    mockHasFeature.mockResolvedValue(true)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'attacker-org' }))
    const body = await res.json()

    // Success: request is authorized via the session, not the header.
    expect(res.status).toBe(200)
    // The entitlements service MUST have been called with the session's org,
    // NOT the forged header value.
    expect(mockGetAllEntitlements).toHaveBeenCalledWith('org-1')
    expect(mockGetAllEntitlements).not.toHaveBeenCalledWith('attacker-org')
    // Response reflects org-1's entitlements.
    expect(body.planKey).toBe('pro')
  })

  it('returns 401 when auth() resolves to null (unauthenticated)', async () => {
    // Override the authenticated default: simulate an anonymous caller.
    vi.mocked(auth).mockResolvedValueOnce(null)

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('UNAUTHORIZED')
  })

  it('returns 500 when service throws', async () => {
    mockGetAllEntitlements.mockRejectedValue(new Error('Service down'))

    const { GET } = await import('../route')
    const res = await GET(mockRequest({ 'x-org-id': 'org-1' }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('INTERNAL_ERROR')
  })
})
