import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const checkoutSchema = z.object({
  priceId: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = checkoutSchema.safeParse(body)
    const priceId =
      parsed.success && parsed.data.priceId
        ? parsed.data.priceId
        : process.env.STRIPE_PRICE_PRO_MONTHLY

    if (!priceId) {
      return NextResponse.json({ error: 'No price ID configured' }, { status: 500 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      client_reference_id: session.user.id,
      customer_email: session.user.email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }
}
