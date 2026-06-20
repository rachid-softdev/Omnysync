/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

/**
 * Tests pour la route API Stripe Webhook
 * Couvre POST /api/stripe/webhook
 *
 * Pattern: mock auth + prisma + stripe + services externes au niveau module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks partagés (hoisted pour disponibilité dans vi.mock factory) ─────────

const { mockHeadersGet, mockConstructEvent, mockStripeInstance } = vi.hoisted(() => {
  const mockHeadersGet = vi.fn()
  const mockConstructEvent = vi.fn()
  const mockRetrieveSubscription = vi.fn()
  const mockRetrieveInvoice = vi.fn()

  return {
    mockHeadersGet,
    mockConstructEvent,
    mockStripeInstance: {
      webhooks: { constructEvent: mockConstructEvent },
      subscriptions: { retrieve: mockRetrieveSubscription },
      invoices: { retrieve: mockRetrieveInvoice },
    },
  }
})

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: mockHeadersGet,
  })),
}))

vi.mock('stripe', () => ({
  default: vi.fn(function () {
    return mockStripeInstance
  }),
}))

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string
      constructor(message: string, meta: { code: string }) {
        super(message)
        this.code = meta.code
      }
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: vi.fn(),
}))

vi.mock('@/lib/api-error', () => ({
  apiError: vi.fn((message: string, status: number, code?: string) => ({
    status,
    json: () =>
      Promise.resolve({
        error: message,
        ...(code ? { code } : {}),
      }),
  })),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { apiError } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWebhookRequest(body: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

const SUBSCRIPTION_RETRIEVE_DEFAULT = {
  status: 'active',
  items: { data: [{ price: { id: 'price_pro_monthly' } }] },
  current_period_start: Math.floor(Date.now() / 1000) - 86400,
  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
  trial_start: null,
  trial_end: null,
  cancel_at_period_end: false,
}

// ============================================================================
// SUITE
// ============================================================================

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Environment: price → plan mapping
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly'
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly'

    // Default: signature valide
    mockHeadersGet.mockReturnValue('test_signature')

    // Default: constructEvent réussit
    mockConstructEvent.mockReturnValue({
      id: 'evt_default',
      type: 'checkout.session.completed',
      data: { object: {} },
    })

    // Default: subscription retrieve
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      ...SUBSCRIPTION_RETRIEVE_DEFAULT,
    })

    // Default: feature gate service
    vi.mocked(getFeatureGateService).mockReturnValue({
      invalidateCache: vi.fn().mockResolvedValue(undefined),
    } as any)

    // Default: pas d'event déjà traité
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
  })

  // ==========================================================================
  // Missing signature
  // ==========================================================================

  it('should return 400 when stripe-signature header is missing', async () => {
    mockHeadersGet.mockReturnValue(null)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))

    expect(response.status).toBe(400)
  })

  // ==========================================================================
  // Invalid signature
  // ==========================================================================

  it('should return 400 when signature verification fails', async () => {
    mockHeadersGet.mockReturnValue('bad_signature')
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))

    expect(response.status).toBe(400)
  })

  // ==========================================================================
  // checkout.session.completed
  // ==========================================================================

  it('should handle checkout.session.completed and return 200', async () => {
    const eventId = 'evt_checkout_123'
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_org123',
          subscription: 'sub_abc',
          client_reference_id: 'user-1',
        },
      },
    })

    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.organization.update).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Vérifie que subscription.upsert a été appelé avec les bonnes données
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        create: expect.objectContaining({
          planKey: 'pro',
          status: 'ACTIVE',
          stripeCustomerId: 'cus_org123',
          stripeSubscriptionId: 'sub_abc',
        }),
      })
    )

    // Vérifie que l'org a été mise à jour avec le stripeCustomerId
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: { stripeCustomerId: 'cus_org123' },
      })
    )

    // Vérifie l'idempotence
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { eventId, eventType: 'checkout.session.completed' },
      })
    )

    // Vérifie l'invalidation de cache
    expect(getFeatureGateService).toHaveBeenCalled()
  })

  it('should handle checkout.session.completed with client_reference_id fallback', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_fallback',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_new',
          subscription: 'sub_new',
          client_reference_id: 'user-1',
        },
      },
    })

    // Pas d'org trouvée par customer ID → fallback vers userOrganization
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.organization.update).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))

    expect(response.status).toBe(200)
    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', role: 'OWNER' },
      })
    )
    expect(prisma.subscription.upsert).toHaveBeenCalled()
  })

  // ==========================================================================
  // customer.subscription.updated
  // ==========================================================================

  it('should handle customer.subscription.updated and return 200', async () => {
    const eventId = 'evt_update_456'
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_abc',
          customer: 'cus_org123',
          status: 'past_due',
          items: {
            data: [{ price: { id: 'price_pro_monthly' } }],
          },
          current_period_start: Math.floor(Date.now() / 1000) - 86400,
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
        },
      },
    })

    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Vérifie le statut mis à jour
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        data: expect.objectContaining({
          status: 'PAST_DUE',
          planKey: 'pro',
        }),
      })
    )
  })

  it('should handle customer.subscription.updated with subscription fallback', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_update_fallback',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_xyz',
          customer: 'cus_unknown',
          status: 'active',
          items: {
            data: [{ price: { id: 'price_pro_monthly' } }],
          },
          current_period_start: Math.floor(Date.now() / 1000) - 86400,
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
        },
      },
    })

    // Pas d'org par customer ID → fallback par subscription ID
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))

    expect(response.status).toBe(200)
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_xyz' },
      })
    )
    expect(prisma.subscription.update).toHaveBeenCalled()
  })

  // ==========================================================================
  // customer.subscription.deleted
  // ==========================================================================

  it('should handle customer.subscription.deleted and return 200', async () => {
    const eventId = 'evt_delete_789'
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_abc',
          customer: 'cus_org123',
        },
      },
    })

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any)
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Vérifie le statut CANCELED
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        data: expect.objectContaining({
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
        }),
      })
    )
  })

  // ==========================================================================
  // Unsupported event type
  // ==========================================================================

  it('should return 200 for unsupported event types (default branch)', async () => {
    const eventId = 'evt_unsupported'
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: 'unknown.event.type',
      data: { object: {} },
    })

    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))
    const data = await response.json()

    // L'event est reçu et marqué comme traité même si type non supporté
    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { eventId, eventType: 'unknown.event.type' },
      })
    )
  })

  // ==========================================================================
  // Idempotence — event déjà traité
  // ==========================================================================

  it('should skip already processed events (idempotency)', async () => {
    const eventId = 'evt_already_done'
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_org123',
          subscription: 'sub_abc',
        },
      },
    })

    // Simulate P2002 unique constraint violation (event already processed)
    const P2002Error = new (vi.mocked(Prisma).PrismaClientKnownRequestError)(
      'Unique constraint failed',
      { code: 'P2002' }
    )
    vi.mocked(prisma.webhookEvent.create).mockRejectedValue(P2002Error)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.skipped).toBe(true)

    // Aucun traitement métier
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  // ==========================================================================
  // Handler error — retour 500
  // ==========================================================================

  it('should return 500 when event handler throws', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_error',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_org123',
          subscription: 'sub_abc',
        },
      },
    })

    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org-1',
    } as any)

    vi.mocked(prisma.subscription.upsert).mockRejectedValue(new Error('DB connection lost'))
    vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const response = await POST(makeWebhookRequest(JSON.stringify({})))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Handler error')
  })
})
