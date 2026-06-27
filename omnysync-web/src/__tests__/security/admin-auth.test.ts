import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockSession {
  user: { id: string; email: string; role: string }
  expires: string
}

function mockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
    expires: '2099-01-01',
    ...overrides,
    user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN', ...overrides?.user },
  }
}

// ── Mock @/lib/auth ─────────────────────────────────────────────────────────
// We mock auth() to simulate three states:
//   1. No session (unauthenticated)
//   2. Session with role=USER (non-admin)
//   3. Session with role=ADMIN (admin)

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma so admin routes that proceed past requireAdmin don't actually hit DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    feature: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    entitlementOverride: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Mock entitlement service dependencies
vi.mock('@/lib/entitlements/EntitlementRepository', () => ({
  getEntitlementRepository: vi.fn(() => ({
    getAllPlansWithFeatures: vi.fn().mockResolvedValue([]),
    getAllFeaturesWithPlans: vi.fn().mockResolvedValue([]),
    getAllOverridesForOrg: vi.fn().mockResolvedValue([]),
    getActiveSubscription: vi.fn().mockResolvedValue(null),
    getPlanKey: vi.fn().mockResolvedValue(null),
    createOverride: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: vi.fn(() => ({
    getAllEntitlements: vi.fn().mockResolvedValue({}),
    invalidateCache: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/lib/entitlements/DowngradeService', () => ({
  getDowngradeService: vi.fn(() => ({
    getDowngradePreview: vi.fn().mockResolvedValue({ recommendedStrategy: 'none' }),
    validateDowngrade: vi
      .fn()
      .mockResolvedValue({ canProceed: true, affectedFeatures: 0, warnings: [] }),
  })),
}))

// ── Imports ─────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

// ── Suite ───────────────────────────────────────────────────────────────────

describe('S1-1: requireAdmin() — admin access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Unit tests on requireAdmin() ──────────────────────────────────────────

  describe('requireAdmin() unit tests', () => {
    it('throws AuthError(401) when there is no session', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      await expect(requireAdmin()).rejects.toThrow(AuthError)
      await expect(requireAdmin()).rejects.toThrow('Non authentifié')
      await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
    })

    it('throws AuthError(403) when session user role is not ADMIN', async () => {
      vi.mocked(auth).mockResolvedValue(
        mockSession({ user: { id: 'user-1', email: 'user@test.com', role: 'USER' } })
      )

      await expect(requireAdmin()).rejects.toThrow('Accès non autorisé')
      await expect(requireAdmin()).rejects.toMatchObject({ status: 403 })
    })

    it('returns user info when session user role is ADMIN', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession())

      const result = await requireAdmin()
      expect(result).toEqual({ id: 'admin-1', email: 'admin@test.com' })
    })
  })

  // ── Route handler integration tests ───────────────────────────────────────

  describe('admin route handlers enforce requireAdmin()', () => {
    const adminSession = () => mockSession()
    const makeReq = (url: string, method = 'GET') =>
      new Request(url, method === 'POST' ? { method: 'POST' } : undefined)
    const makeCtx = (orgId = 'org-1') => ({ params: Promise.resolve({ orgId }) })

    it('GET /api/admin/users calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: usersGet } = await import('@/app/api/admin/users/route')
      const response = await usersGet()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('users')
    })

    it('GET /api/admin/plans calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: plansGet } = await import('@/app/api/admin/plans/route')
      const response = await plansGet(makeReq('http://localhost/api/admin/plans'))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('data')
    })

    it('GET /api/admin/features calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: featuresGet } = await import('@/app/api/admin/features/route')
      const response = await featuresGet(makeReq('http://localhost/api/admin/features'))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('data')
    })

    it('GET /api/admin/overrides calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: overridesGet } = await import('@/app/api/admin/overrides/route')
      const response = await overridesGet(makeReq('http://localhost/api/admin/overrides'))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('data')
    })

    it('GET /api/admin/orgs/:orgId/entitlements calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: entitlementsGet } =
        await import('@/app/api/admin/orgs/[orgId]/entitlements/route')
      const response = await entitlementsGet(
        makeReq('http://localhost/api/admin/orgs/org-1/entitlements'),
        makeCtx()
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('orgId')
    })

    it('GET /api/admin/orgs/:orgId/downgrade-preview calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { GET: downgradeGet } =
        await import('@/app/api/admin/orgs/[orgId]/downgrade-preview/route')
      const response = await downgradeGet(
        makeReq('http://localhost/api/admin/orgs/org-1/downgrade-preview?plan=free'),
        makeCtx()
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toHaveProperty('orgId')
    })

    it('POST /api/admin/cache/invalidate/:orgId calls requireAdmin', async () => {
      vi.mocked(auth).mockResolvedValue(adminSession())
      const { POST: cachePost } = await import('@/app/api/admin/cache/invalidate/[orgId]/route')
      const response = await cachePost(
        makeReq('http://localhost/api/admin/cache/invalidate/org-1', 'POST'),
        makeCtx()
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  // ── Unauthenticated requests return 401 ───────────────────────────────────

  describe.each([
    ['GET', '/api/admin/users', '@/app/api/admin/users/route'],
    ['GET', '/api/admin/plans', '@/app/api/admin/plans/route'],
    ['GET', '/api/admin/features', '@/app/api/admin/features/route'],
    ['GET', '/api/admin/overrides', '@/app/api/admin/overrides/route'],
    [
      'GET',
      '/api/admin/orgs/[orgId]/entitlements',
      '@/app/api/admin/orgs/[orgId]/entitlements/route',
    ],
    [
      'GET',
      '/api/admin/orgs/[orgId]/downgrade-preview',
      '@/app/api/admin/orgs/[orgId]/downgrade-preview/route',
    ],
    [
      'POST',
      '/api/admin/cache/invalidate/[orgId]',
      '@/app/api/admin/cache/invalidate/[orgId]/route',
    ],
  ] as const)('%s %s', (_method, _path, modulePath) => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const mod = await import(modulePath)
      const handler = modulePath.includes('cache/invalidate') ? mod.POST : mod.GET

      const req =
        _method === 'POST'
          ? new Request(`http://localhost${_path}`, { method: 'POST' })
          : new Request(`http://localhost${_path}`)

      const ctx = _path.includes('[orgId]')
        ? { params: Promise.resolve({ orgId: 'org-1' }) }
        : undefined

      const response = await handler(req, ctx)
      expect(response.status).toBe(401)
    })

    it('returns 403 when user role is USER (non-admin)', async () => {
      vi.mocked(auth).mockResolvedValue(
        mockSession({ user: { id: 'user-1', email: 'user@test.com', role: 'USER' } })
      )

      const mod = await import(modulePath)
      const handler = modulePath.includes('cache/invalidate') ? mod.POST : mod.GET

      const req =
        _method === 'POST'
          ? new Request(`http://localhost${_path}`, { method: 'POST' })
          : new Request(`http://localhost${_path}`)

      const ctx = _path.includes('[orgId]')
        ? { params: Promise.resolve({ orgId: 'org-1' }) }
        : undefined

      const response = await handler(req, ctx)
      expect(response.status).toBe(403)
    })
  })
})
