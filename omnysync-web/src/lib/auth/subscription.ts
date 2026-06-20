import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export type Plan = 'free' | 'pro' | 'business'

export interface PlanLimits {
  syncsPerMonth: number
  connectors: number
  documents: number
  aiFeatures: boolean
  bidirectionalSync: boolean
  multiUser: boolean
  apiAccess: boolean
  scheduledSync: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    syncsPerMonth: 5,
    connectors: 2,
    documents: 50,
    aiFeatures: false,
    bidirectionalSync: false,
    multiUser: false,
    apiAccess: false,
    scheduledSync: false,
  },
  pro: {
    syncsPerMonth: 100,
    connectors: 10,
    documents: 500,
    aiFeatures: true,
    bidirectionalSync: false,
    multiUser: false,
    apiAccess: false,
    scheduledSync: true,
  },
  business: {
    syncsPerMonth: Infinity,
    connectors: Infinity,
    documents: Infinity,
    aiFeatures: true,
    bidirectionalSync: true,
    multiUser: true,
    apiAccess: true,
    scheduledSync: true,
  },
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const orgMembership = await prisma.userOrganization.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          subscriptions: { take: 1 },
        },
      },
    },
  })

  const subscription = orgMembership?.organization?.subscriptions?.[0]

  if (!subscription || subscription.status !== 'ACTIVE') {
    return 'free'
  }

  return (subscription.planKey as Plan) || 'free'
}

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan]
}

export async function getQuotaUsage(userId: string): Promise<{
  syncCount: number
  syncLimit: number
  connectorCount: number
  connectorLimit: number
  documentCount: number
  documentLimit: number
  percentUsed: number
}> {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]
  const month = getCurrentMonth()

  const [quotaUsage, connectorCount, documentCount] = await Promise.all([
    prisma.quotaUsage.findUnique({
      where: { userId_month: { userId, month } },
    }),
    prisma.connector.count({ where: { userId } }),
    prisma.document.count({ where: { userId } }),
  ])

  const syncCount = quotaUsage?.syncCount || 0
  const percentUsed = plan === 'free' ? Math.round((syncCount / limits.syncsPerMonth) * 100) : 0

  return {
    syncCount,
    syncLimit: limits.syncsPerMonth,
    connectorCount,
    connectorLimit: limits.connectors,
    documentCount,
    documentLimit: limits.documents,
    percentUsed,
  }
}

export async function checkAndIncrementQuota(userId: string): Promise<{
  allowed: boolean
  remaining: number
  upgradeUrl?: string
}> {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]
  const month = getCurrentMonth()

  if (limits.syncsPerMonth === Infinity) {
    return { allowed: true, remaining: Infinity }
  }

  // Atomic upsert + conditional increment using a raw SQL query to avoid TOCTOU race condition.
  // Uses PostgreSQL CTE to ensure the check and increment happen in a single statement.
  const result = await prisma.$queryRaw<Array<{ allowed: boolean; sync_count: number }>>`
    WITH
      upserted AS (
        INSERT INTO "QuotaUsage" ("id", "userId", "month", "syncCount", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userId}, ${month}, 0, NOW(), NOW())
        ON CONFLICT ("userId", "month") DO UPDATE SET "updatedAt" = NOW()
        RETURNING "syncCount"
      ),
      limited AS (
        SELECT "syncCount" FROM upserted
        WHERE "syncCount" < ${limits.syncsPerMonth}
      ),
      updated AS (
        UPDATE "QuotaUsage"
        SET "syncCount" = "syncCount" + 1, "updatedAt" = NOW()
        FROM limited
        WHERE "QuotaUsage"."userId" = ${userId}
          AND "QuotaUsage"."month" = ${month}
        RETURNING "QuotaUsage"."syncCount" AS sync_count
      )
    SELECT
      COALESCE((SELECT true FROM updated LIMIT 1), false) AS allowed,
      COALESCE((SELECT sync_count FROM updated LIMIT 1), 0) AS sync_count
  `

  if (!result[0]?.allowed) {
    return {
      allowed: false,
      remaining: 0,
      upgradeUrl: '/pricing',
    }
  }

  const remaining = limits.syncsPerMonth - result[0].sync_count

  return { allowed: true, remaining: Math.max(0, remaining) }
}

export async function decrementQuotaOnFailure(userId: string): Promise<void> {
  const month = getCurrentMonth()

  await prisma.quotaUsage
    .updateMany({
      where: { userId, month },
      data: { syncCount: { decrement: 1 } },
    })
    .catch(() => {
      // Ignore errors - quota is not critical
    })
}

export async function checkConnectorLimit(userId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  upgradeUrl?: string
}> {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]

  const connectorCount = await prisma.connector.count({
    where: { userId },
  })

  const allowed = connectorCount < limits.connectors

  return {
    allowed,
    current: connectorCount,
    limit: limits.connectors,
    upgradeUrl: allowed ? undefined : '/pricing',
  }
}

export async function checkDocumentLimit(userId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  upgradeUrl?: string
}> {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]

  const documentCount = await prisma.document.count({
    where: { userId },
  })

  const allowed = documentCount < limits.documents

  return {
    allowed,
    current: documentCount,
    limit: limits.documents,
    upgradeUrl: allowed ? undefined : '/pricing',
  }
}

export async function withQuotaCheck(
  request: Request,
  handler: (userId: string) => Promise<Response>
): Promise<Response> {
  // 🔒 Use session authentication instead of trusting the x-user-id header.
  // The x-user-id header is trivially forgeable by clients and would allow
  // quota bypass / identity impersonation.
  const { auth } = await import('@/lib/auth')
  const session = await auth()

  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed, upgradeUrl } = await checkAndIncrementQuota(userId)

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        message: 'Vous avez atteint votre limite de synchronisations mensuelles',
        upgradeUrl,
      },
      { status: 403 }
    )
  }

  try {
    return await handler(userId)
  } catch (error) {
    await decrementQuotaOnFailure(userId)
    throw error
  }
}

export function getPlanFromPriceId(priceId: string): Plan {
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY
  const businessPriceId = process.env.STRIPE_PRICE_BUSINESS_MONTHLY

  if (priceId === proPriceId) return 'pro'
  if (priceId === businessPriceId) return 'business'
  return 'free'
}
