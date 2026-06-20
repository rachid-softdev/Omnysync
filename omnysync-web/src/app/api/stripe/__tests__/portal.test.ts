/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for GET /api/stripe/portal
 *
 * Pattern: mock auth + prisma + stripe + org at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks for Stripe ─────────────────────────────────────────────────

const { mockStripeInstance } = vi.hoisted(() => {
  const mockCreatePortalSession = vi.fn()
  return {
    mockStripeInstance: {
      billingPortal: {
        sessions: {
          create: mockCreatePortalSession,
        },
      },
    },
  }
})

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('stripe', () => ({
  default: vi.fn(function () {
    return mockStripeInstance
  }),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'

// ============================================================================
// SUITE
// ============================================================================

describe('GET /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    // Default: user belongs to org
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: subscription with stripeCustomerId exists
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_test123',
      organizationId: 'org-1',
    } as any)

    // Default: portal session creation succeeds
    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/session/test',
    })
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/stripe/portal/route')
    const response = await GET()

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  // ── Succès — retourne l'URL du portail ───────────────────────────────────

  it('should create portal session and return url', async () => {
    const { GET } = await import('@/app/api/stripe/portal/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://billing.stripe.com/session/test')
    expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test123',
        return_url: 'http://localhost:3000/dashboard/settings',
      })
    )
  })

  // ── Pas d'abonnement → 404 ──────────────────────────────────────────────

  it('should return 404 when no subscription is found', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/stripe/portal/route')
    const response = await GET()

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('No subscription found')
  })

  // ── Abonnement sans stripeCustomerId → 404 ───────────────────────────────

  it('should return 404 when subscription has no stripeCustomerId', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: null,
      organizationId: 'org-1',
    } as any)

    const { GET } = await import('@/app/api/stripe/portal/route')
    const response = await GET()

    expect(response.status).toBe(404)
  })

  // ── Stripe échoue → 500 ──────────────────────────────────────────────────

  it('should return 500 when Stripe portal session creation fails', async () => {
    mockStripeInstance.billingPortal.sessions.create.mockRejectedValue(
      new Error('Stripe API error')
    )

    const { GET } = await import('@/app/api/stripe/portal/route')
    const response = await GET()

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create portal')
  })
})
