import { prisma } from "@/lib/prisma"

export type Plan = "free" | "pro" | "business"

const PLAN_LIMITS: Record<Plan, { syncsPerMonth: number; connectors: number; aiFeatures: boolean }> = {
  free: { syncsPerMonth: 5, connectors: 2, aiFeatures: false },
  pro: { syncsPerMonth: 100, connectors: 10, aiFeatures: true },
  business: { syncsPerMonth: Infinity, connectors: Infinity, aiFeatures: true },
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })

  if (!subscription || subscription.status !== "active") {
    return "free"
  }

  return (subscription.plan as Plan) || "free"
}

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan]
}

export async function checkSyncLimit(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  if (limits.syncsPerMonth === Infinity) return true

  // Count syncs this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const org = await prisma.userOrganization.findFirst({
    where: { userId },
  })

  if (!org) return true

  const syncCount = await prisma.syncLog.count({
    where: {
      organizationId: org.organizationId,
      createdAt: { gte: startOfMonth },
      status: "SUCCESS",
    },
  })

  return syncCount < limits.syncsPerMonth
}

export function getPlanFromPriceId(priceId: string): Plan {
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY
  const businessPriceId = process.env.STRIPE_PRICE_BUSINESS_MONTHLY

  if (priceId === proPriceId) return "pro"
  if (priceId === businessPriceId) return "business"
  return "free"
}

export async function checkConnectorLimit(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  const connectorCount = await prisma.connector.count({
    where: { userId },
  })

  return connectorCount < limits.connectors
}
