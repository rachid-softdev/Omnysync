import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '')
}

const checkoutSchema = z.object({
  priceId: z.string().min(1).optional(),
})

/**
 * Price IDs are only read from server-side env vars. Accepting an arbitrary
 * client-provided price ID would let a user check out against any price of the
 * Stripe account, and the webhook maps unknown prices to the free plan.
 */
function getConfiguredPriceIds(): string[] {
  return [
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_YEARLY,
    process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    process.env.STRIPE_PRICE_BUSINESS_YEARLY,
  ].filter((priceId): priceId is string => Boolean(priceId))
}

// Statuses for which a new checkout would create a second, parallel
// subscription and bill the customer twice.
const BLOCKING_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE']

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let orgId: string
  try {
    orgId = await getUserOrgId(session.user.id)
  } catch {
    return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 })
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { status: true, stripeCustomerId: true },
  })

  if (
    existingSubscription &&
    BLOCKING_SUBSCRIPTION_STATUSES.includes(existingSubscription.status)
  ) {
    return NextResponse.json(
      {
        error: 'Subscription already active',
        message: 'Manage your existing subscription from the billing portal',
      },
      { status: 409 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = checkoutSchema.safeParse(body)
    const requestedPriceId = parsed.success ? parsed.data.priceId : undefined

    if (requestedPriceId && !getConfiguredPriceIds().includes(requestedPriceId)) {
      return NextResponse.json({ error: 'Unknown price', code: 'INVALID_PRICE' }, { status: 400 })
    }

    const priceId = requestedPriceId ?? process.env.STRIPE_PRICE_PRO_MONTHLY

    if (!priceId) {
      return NextResponse.json({ error: 'No price ID configured' }, { status: 500 })
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      client_reference_id: session.user.id,
      // Reuse the existing Stripe customer (e.g. a canceled subscription) so
      // the billing portal history stays consistent; Stripe rejects sending
      // both `customer` and `customer_email`.
      ...(existingSubscription?.stripeCustomerId
        ? { customer: existingSubscription.stripeCustomerId }
        : { customer_email: session.user.email || undefined }),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // The webhook resolves the organization from this metadata: the org's
      // stripeCustomerId is only stored after the first checkout completes, and
      // the client_reference_id fallback only covers owners.
      metadata: { organizationId: orgId, userId: session.user.id },
      subscription_data: { metadata: { organizationId: orgId, userId: session.user.id } },
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}
