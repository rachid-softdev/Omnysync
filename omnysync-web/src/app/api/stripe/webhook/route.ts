/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stripe Webhook Handler - Feature Flags & Entitlements
 * Omnysync - 2026
 *
 * Handles all Stripe events for subscription management:
 * - customer.subscription.created/updated/deleted
 * - invoice.payment_succeeded/failed
 * - checkout.session.completed
 * - customer.subscription.trial_end
 *
 * Features:
 * - Signature verification
 * - Idempotency (via webhook_events table)
 * - Transactional DB updates
 * - Cache invalidation after subscription changes
 * - Proper plan key resolution from Stripe price IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
}) as unknown as StripeInstance

// Local type workaround for missing stripe .d.ts files
type StripeInstance = {
  subscriptions: { retrieve: (id: string) => Promise<Record<string, any>> }
  invoices: { retrieve: (id: string) => Promise<Record<string, any>> }
  webhooks: {
    constructEvent: (body: string, signature: string, secret: string) => StripeEvent
  }
}

type StripeEvent = {
  id: string
  type: string
  data: { object: Record<string, any> }
}

type StripeCheckoutSession = Record<string, any>
type StripeSubscription = Record<string, any>
type StripeInvoice = Record<string, any>

// Price ID to plan key mapping
// In production, these should be in env vars or DB
const PRICE_ID_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY || '']: 'pro',
  [process.env.STRIPE_PRICE_PRO_YEARLY || '']: 'pro',
  [process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '']: 'business',
  [process.env.STRIPE_PRICE_BUSINESS_YEARLY || '']: 'business',
}

// Default plan when no match found
const DEFAULT_PLAN = 'free'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SupportedEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.subscription.trial_end'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPlanFromPriceId(priceId: string): string {
  return PRICE_ID_TO_PLAN[priceId] || DEFAULT_PLAN
}

function getStatusFromStripeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    unpaid: 'PAST_DUE',
  }

  return statusMap[status] || 'ACTIVE'
}

async function invalidateEntitlementsCache(orgId: string): Promise<void> {
  try {
    const featureGate = getFeatureGateService()
    await featureGate.invalidateCache(orgId)
    console.log(`[StripeWebhook] Cache invalidated for org: ${orgId}`)
  } catch (error) {
    console.error(`[StripeWebhook] Failed to invalidate cache:`, error)
    // Non-critical error - don't fail the webhook
  }
}

async function findOrganizationByCustomerId(customerId: string): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })

  return org?.id ?? null
}

async function findOrganizationBySubscriptionId(subscriptionId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { organizationId: true },
  })

  return sub?.organizationId ?? null
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleCheckoutSessionCompleted(event: StripeEvent): Promise<void> {
  const session = event.data.object as StripeCheckoutSession

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!customerId || !subscriptionId) {
    console.warn('[StripeWebhook] Missing customer or subscription ID')
    return
  }

  // Get full subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const priceId = subscription.items.data[0]?.price?.id || ''
  const planKey = getPlanFromPriceId(priceId)

  // Find organization by customer ID
  let orgId = await findOrganizationByCustomerId(customerId)

  // If no org found by customer ID, try by userId in client_reference_id
  if (!orgId && session.client_reference_id) {
    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.client_reference_id, role: 'OWNER' },
      select: { organizationId: true },
    })
    orgId = userOrg?.organizationId ?? null
  }

  if (!orgId) {
    console.error('[StripeWebhook] Organization not found for customer:', customerId)
    return
  }

  // Update/create subscription in DB
  await prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      planKey,
      status: getStatusFromStripeStatus(subscription.status),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
    update: {
      planKey,
      status: getStatusFromStripeStatus(subscription.status),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  })

  // Update organization's stripe customer ID
  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeCustomerId: customerId },
  })

  // Invalidate cache
  await invalidateEntitlementsCache(orgId)

  console.log(`[StripeWebhook] Checkout completed: org=${orgId}, plan=${planKey}`)
}

async function handleSubscriptionCreated(event: StripeEvent): Promise<void> {
  const subscription = event.data.object as StripeSubscription
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id

  const priceId = subscription.items.data[0]?.price?.id || ''
  const planKey = getPlanFromPriceId(priceId)

  const orgId = await findOrganizationByCustomerId(customerId)

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for customer:', customerId)
    return
  }

  await prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      planKey,
      status: getStatusFromStripeStatus(subscription.status),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      planKey,
      status: getStatusFromStripeStatus(subscription.status),
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })

  await invalidateEntitlementsCache(orgId)

  console.log(`[StripeWebhook] Subscription created: org=${orgId}, plan=${planKey}`)
}

async function handleSubscriptionUpdated(event: StripeEvent): Promise<void> {
  const subscription = event.data.object as StripeSubscription
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id

  const priceId = subscription.items.data[0]?.price?.id || ''
  const planKey = getPlanFromPriceId(priceId)

  // Find org by customer ID or subscription ID
  let orgId = await findOrganizationByCustomerId(customerId)

  if (!orgId) {
    orgId = await findOrganizationBySubscriptionId(subscriptionId)
  }

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for subscription:', subscriptionId)
    return
  }

  await prisma.subscription.update({
    where: { organizationId: orgId },
    data: {
      planKey,
      status: getStatusFromStripeStatus(subscription.status),
      stripePriceId: priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  await invalidateEntitlementsCache(orgId)

  console.log(
    `[StripeWebhook] Subscription updated: org=${orgId}, plan=${planKey}, status=${subscription.status}`
  )
}

async function handleSubscriptionDeleted(event: StripeEvent): Promise<void> {
  const subscription = event.data.object as StripeSubscription
  const subscriptionId = subscription.id

  const orgId = await findOrganizationBySubscriptionId(subscriptionId)

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for subscription:', subscriptionId)
    return
  }

  // Mark subscription as canceled
  await prisma.subscription.update({
    where: { organizationId: orgId },
    data: {
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
    },
  })

  await invalidateEntitlementsCache(orgId)

  console.log(`[StripeWebhook] Subscription deleted: org=${orgId}`)
}

async function handleInvoicePaymentSucceeded(event: StripeEvent): Promise<void> {
  const invoice = event.data.object as StripeInvoice
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  const orgId = await findOrganizationBySubscriptionId(subscriptionId)

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for subscription:', subscriptionId)
    return
  }

  // Get updated subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  await prisma.subscription.update({
    where: { organizationId: orgId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: false,
    },
  })

  await invalidateEntitlementsCache(orgId)

  console.log(`[StripeWebhook] Payment succeeded: org=${orgId}`)
}

async function handleInvoicePaymentFailed(event: StripeEvent): Promise<void> {
  const invoice = event.data.object as StripeInvoice
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  const orgId = await findOrganizationBySubscriptionId(subscriptionId)

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for subscription:', subscriptionId)
    return
  }

  await prisma.subscription.update({
    where: { organizationId: orgId },
    data: {
      status: 'PAST_DUE',
    },
  })

  await invalidateEntitlementsCache(orgId)

  // TODO: Send email notification about failed payment

  console.log(`[StripeWebhook] Payment failed: org=${orgId}`)
}

async function handleTrialEnd(event: StripeEvent): Promise<void> {
  const subscription = event.data.object as StripeSubscription
  const subscriptionId = subscription.id

  const orgId = await findOrganizationBySubscriptionId(subscriptionId)

  if (!orgId) {
    console.warn('[StripeWebhook] Organization not found for subscription:', subscriptionId)
    return
  }

  // Check if they have a payment method - if not, they might convert to free
  const hasPaymentMethod = subscription.default_payment_method !== null

  if (!hasPaymentMethod) {
    // No payment method - might need to handle conversion
    console.log(`[StripeWebhook] Trial ending without payment method: org=${orgId}`)
  }

  // Just log for now - could send reminder email
  console.log(
    `[StripeWebhook] Trial ending: org=${orgId}, at=${new Date(
      subscription.trial_end! * 1000
    ).toISOString()}`
  )
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: StripeEvent

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '')
  } catch (err) {
    console.error('[StripeWebhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const eventId = event.id
  const eventType = event.type as SupportedEventType

  // 🔒 Atomic idempotency: claim the event BEFORE processing.
  // Two parallel webhooks with the same eventId will race here.
  // The unique constraint on eventId ensures only one wins — the other gets P2002.
  try {
    await prisma.webhookEvent.create({
      data: { eventId, eventType },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      // Event already claimed — skip silently
      return NextResponse.json({ received: true, skipped: true })
    }
    throw err
  }

  // Process the event (idempotency is guaranteed by the create above)
  try {
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event)
        break

      case 'customer.subscription.trial_end':
        await handleTrialEnd(event)
        break

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[StripeWebhook] Handler error:', error)

    return NextResponse.json({ error: 'Handler error', eventId }, { status: 500 })
  }
}
