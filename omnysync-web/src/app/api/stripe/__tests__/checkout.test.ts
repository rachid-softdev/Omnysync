/**
 * Tests for POST /api/stripe/checkout
 *
 * Pattern: mock auth + stripe at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks for Stripe ─────────────────────────────────────────────────

const { mockStripeInstance } = vi.hoisted(() => {
  const mockCreateCheckoutSession = vi.fn()
  return {
    mockStripeInstance: {
      checkout: {
        sessions: {
          create: mockCreateCheckoutSession,
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

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'
import { prisma } from '@/lib/prisma'

// ============================================================================
// SUITE
// ============================================================================

describe('POST /api/stripe/checkout', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly'
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly'
    delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY
    delete process.env.STRIPE_PRICE_BUSINESS_YEARLY
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    // Default: user belongs to an organization
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: no existing subscription
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

    // Default: Stripe checkout succeeds
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_test_abc123',
    })
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 when the user has no organization', async () => {
    vi.mocked(getUserOrgId).mockRejectedValue(new Error('User has no organization membership'))

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('No organization found for this user')
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled()
  })

  // ── Succès avec priceId par défaut ───────────────────────────────────────

  it('should create checkout session with default price when no priceId provided', async () => {
    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/cs_test_abc123')
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        payment_method_types: ['card'],
        client_reference_id: 'user-1',
        customer_email: 'test@omnysync.com',
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        metadata: { organizationId: 'org-1', userId: 'user-1' },
        subscription_data: { metadata: { organizationId: 'org-1', userId: 'user-1' } },
        success_url: 'http://localhost:3000/dashboard?success=true',
        cancel_url: 'http://localhost:3000/pricing?canceled=true',
      })
    )
  })

  // ── Succès avec priceId configuré ────────────────────────────────────────

  it('should use provided priceId when it is configured server-side', async () => {
    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({ priceId: 'price_pro_yearly' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/cs_test_abc123')
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_pro_yearly', quantity: 1 }],
      })
    )
  })

  // ── priceId inconnu → 400 ────────────────────────────────────────────────

  it('should reject a priceId that is not configured server-side', async () => {
    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({ priceId: 'price_attacker_supplied' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_PRICE')
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled()
  })

  // ── Abonnement déjà actif → 409 ──────────────────────────────────────────

  it('should return 409 when the organization already has an active subscription', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: 'ACTIVE',
      stripeCustomerId: 'cus_existing',
    } as any)

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(409)
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('should reuse the existing Stripe customer after a canceled subscription', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: 'CANCELED',
      stripeCustomerId: 'cus_existing',
    } as any)

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(200)
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
      })
    )
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: expect.anything(),
      })
    )
  })

  // ── Aucun priceId configuré → 500 ────────────────────────────────────────

  it('should return 500 when no price ID is configured and none provided', async () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('No price ID configured')
  })

  // ── Stripe échoue → 500 ──────────────────────────────────────────────────

  it('should return 500 when Stripe checkout session creation fails', async () => {
    mockStripeInstance.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'))

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create checkout')
  })

  // ── Corps JSON invalide → fallback aux valeurs par défaut ────────────────

  it('should handle invalid JSON body gracefully (fallback to defaults)', async () => {
    const req = new NextRequest('http://localhost:3000/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    })

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(req)

    // Falls back to STRIPE_PRICE_PRO_MONTHLY since body parsing fails silently
    expect(response.status).toBe(200)
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalled()
  })

  // ── Utilisateur sans email ──────────────────────────────────────────────

  it('should create checkout session when user has no email', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-no-email' },
    } as any)

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/cs_test_abc123')
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: 'user-no-email',
        customer_email: undefined,
      })
    )
  })

  // ── priceId chaîne vide → fallback au défaut ────────────────────────────

  it('should fallback to default price when priceId is empty string', async () => {
    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({ priceId: '' }))

    expect(response.status).toBe(200)
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
      })
    )
  })

  // ── Stripe retourne session sans URL ────────────────────────────────────

  it('should return success even when Stripe session has no URL', async () => {
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: null,
    })

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBeNull()
  })

  // ── STRIPE_SECRET_KEY vide ──────────────────────────────────────────────

  it('should handle empty STRIPE_SECRET_KEY gracefully (mock ignores key)', async () => {
    process.env.STRIPE_SECRET_KEY = ''

    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({}))

    // The Stripe constructor is mocked and doesn't validate the key,
    // so the request still succeeds in tests
    expect(response.status).toBe(200)
  })
})
