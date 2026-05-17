import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { getPlanFromPriceId } from "@/lib/auth/subscription"

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
        const customerId = session.customer as string

        // Find organization by customer ID or user
        let orgId: string | null = null
        
        if (customerId) {
          const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId as string } })
          orgId = org?.id ?? null
        }

        if (!orgId && userId) {
          const userOrg = await prisma.userOrganization.findFirst({
            where: { userId, role: "OWNER" },
            select: { organizationId: true }
          })
          orgId = userOrg?.organizationId ?? null
        }

        if (orgId && subscriptionId) {
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription
          const priceId = subscriptionData.items.data[0]?.price?.id || ""
          const planKey = getPlanFromPriceId(priceId)

        if (userId && subscriptionId) {
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId) as unknown as Stripe.Subscription

          const sd = subscriptionData as any
          const priceId = sd.items?.data?.[0]?.price?.id || ""
          const plan = getPlanFromPriceId(priceId)

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan,
              status: sd.status,
              currentPeriodEnd: new Date(sd.current_period_end * 1000),
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan,
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

        // Find org by customer ID
        const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } })
        if (!org) break

        const existing = await prisma.subscription.findFirst({
          where: { organizationId: org.id },
        })

        if (existing) {
          const newPlan = sub.status === "active" ? "pro" : sub.status === "trialing" ? "pro" : "free"
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: sub.status.toUpperCase(),
              planKey: newPlan,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            },
          })
          // Invalidate entitlements cache
          const featureGate = await import("@/lib/entitlements/FeatureGateService").then(m => m.getFeatureGateService())
          await featureGate.invalidateCache(org.id)
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: "past_due" },
          })
          // TODO: Send email notification
        }
        break
      }

      case "invoice.upcoming": {
        // Log for dunning reminder
        const invoice = event.data.object as Stripe.Invoice
        console.log("Upcoming invoice:", invoice.id, "for customer:", invoice.customer)
        break
      }

      case "customer.subscription.trial_end": {
        // Log for trial end warning
        const subscription = event.data.object as Stripe.Subscription
        console.log("Trial ending for subscription:", subscription.id, "at:", new Date(subscription.trial_end! * 1000))
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error:", error)
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 })
  }
}
