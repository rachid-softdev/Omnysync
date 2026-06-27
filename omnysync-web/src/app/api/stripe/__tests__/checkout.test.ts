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

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'

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
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

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
        success_url: 'http://localhost:3000/dashboard?success=true',
        cancel_url: 'http://localhost:3000/pricing?canceled=true',
      })
    )
  })

  // ── Succès avec priceId personnalisé ─────────────────────────────────────

  it('should use provided priceId when given in request body', async () => {
    const { POST } = await import('@/app/api/stripe/checkout/route')
    const response = await POST(makeRequest({ priceId: 'price_custom_123' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/cs_test_abc123')
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_custom_123', quantity: 1 }],
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
