import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "")

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = (await headers()).get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    )
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        const subscriptionId = session.subscription as string

        if (userId && subscriptionId) {
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId) as unknown as Stripe.Subscription

          const sd = subscriptionData as any

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: "pro",
              status: sd.status,
              currentPeriodEnd: new Date(sd.current_period_end * 1000),
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: "pro",
              status: sd.status,
              currentPeriodEnd: new Date(sd.current_period_end * 1000),
            },
          })
        }
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any
        const customerId = sub.customer as string

        const existing = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: sub.status,
              plan: sub.status === "active" ? "pro" : "free",
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error:", error)
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 })
  }
}
