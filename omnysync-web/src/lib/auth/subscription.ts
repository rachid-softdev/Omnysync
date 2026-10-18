import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  DEFAULT_PLAN_FEATURES,
  FEATURE_KEYS,
  PLAN_KEYS,
  type PlanKey,
} from '@omnysync/core/entitlements/constants'

export type Plan = PlanKey

export interface PlanLimits {
  syncsPerMonth: number
  connectors: number
  documents: number
  teamMembers: number
  aiFeatures: boolean
  bidirectionalSync: boolean
  multiUser: boolean
  apiAccess: boolean
  scheduledSync: boolean
  webhooks: boolean
  approvalPortal: boolean
}

/**
 * Limited-feature values are stored as `-1` for "unlimited" in the shared plan
 * catalogue (packages/omnysync-core/src/entitlements/constants.ts), while this
 * module exposes `Infinity` internally.
 */
function toLimit(value: boolean | number | undefined): number {
  if (typeof value !== 'number') return 0
  return value < 0 ? Infinity : value
}

function toFlag(value: boolean | number | undefined): boolean {
  return value === true
}

/**
 * Single source of truth: the shared plan catalogue in @omnysync/core
 * (`DEFAULT_PLAN_FEATURES`), which mirrors the public pricing page.
 * Do not hard-code plan limits here — update the core catalogue instead.
 */
function limitsFromCore(plan: PlanKey): PlanLimits {
  const features = DEFAULT_PLAN_FEATURES[plan]
  return {
    syncsPerMonth: toLimit(features[FEATURE_KEYS.MAX_SYNCS_PER_MONTH]),
    connectors: toLimit(features[FEATURE_KEYS.MAX_CONNECTORS]),
    documents: toLimit(features[FEATURE_KEYS.MAX_DOCUMENTS]),
    teamMembers: toLimit(features[FEATURE_KEYS.MAX_TEAM_MEMBERS]),
    aiFeatures:
      toFlag(features[FEATURE_KEYS.AI_SEO]) &&
      toFlag(features[FEATURE_KEYS.AI_IMAGES]) &&
      toFlag(features[FEATURE_KEYS.AI_INTERLINKING]),
    bidirectionalSync: toFlag(features[FEATURE_KEYS.TWO_WAY_SYNC]),
    multiUser: toFlag(features[FEATURE_KEYS.TEAM_MEMBERS]),
    apiAccess: toFlag(features[FEATURE_KEYS.API_ACCESS]),
    scheduledSync: toFlag(features[FEATURE_KEYS.SCHEDULED_SYNC]),
    webhooks: toFlag(features[FEATURE_KEYS.WEBHOOKS]),
    approvalPortal: toFlag(features[FEATURE_KEYS.APPROVAL_PORTAL]),
  }
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [PLAN_KEYS.FREE]: limitsFromCore(PLAN_KEYS.FREE),
  [PLAN_KEYS.PRO]: limitsFromCore(PLAN_KEYS.PRO),
  [PLAN_KEYS.BUSINESS]: limitsFromCore(PLAN_KEYS.BUSINESS),
  [PLAN_KEYS.ENTERPRISE]: limitsFromCore(PLAN_KEYS.ENTERPRISE),
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const PLAN_KEY_VALUES: string[] = Object.values(PLAN_KEYS)

function isPlanKey(value: string | null | undefined): value is Plan {
  return typeof value === 'string' && PLAN_KEY_VALUES.includes(value)
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

  // Trials must keep their paid plan — Stripe reports trialing subscriptions
  // with the TRIALING status, not ACTIVE.
  const isActive =
    subscription != null &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status)

  if (!isActive) {
    return PLAN_KEYS.FREE
  }

  return isPlanKey(subscription.planKey) ? subscription.planKey : PLAN_KEYS.FREE
}

export function getPlanLimits(plan: Plan): PlanLimits {
  // Defensive: an unknown plan key must never turn into a TypeError.
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS[PLAN_KEYS.FREE]
}

export type PlanFeature = keyof Pick<
  PlanLimits,
  | 'aiFeatures'
  | 'apiAccess'
  | 'bidirectionalSync'
  | 'multiUser'
  | 'scheduledSync'
  | 'webhooks'
  | 'approvalPortal'
>

/**
 * Server-side gate for boolean plan features (pricing-page features that are
 * not enforced by a numeric quota). Callers must return a 403 when
 * `allowed` is false.
 */
export async function checkPlanFeature(
  userId: string,
  feature: PlanFeature
): Promise<{ allowed: boolean; plan: Plan; upgradeUrl?: string }> {
  const plan = await getUserPlan(userId)
  const allowed = getPlanLimits(plan)[feature]

  return {
    allowed,
    plan,
    upgradeUrl: allowed ? undefined : '/pricing',
  }
}

/**
 * Counts plan-limited resources the same way the API routes scope them: by
 * organization (the plan belongs to the organization), falling back to the user
 * when no organization membership exists yet.
 */
async function getResourceScope(
  userId: string
): Promise<{ organizationId: string } | { userId: string }> {
  const membership = await prisma.userOrganization.findFirst({
    where: { userId },
    select: { organizationId: true },
  })
  return membership ? { organizationId: membership.organizationId } : { userId }
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
  const limits = getPlanLimits(plan)
  const month = getCurrentMonth()
  const scope = await getResourceScope(userId)

  const [quotaUsage, connectorCount, documentCount] = await Promise.all([
    prisma.quotaUsage.findUnique({
      where: { userId_month: { userId, month } },
    }),
    prisma.connector.count({ where: scope }),
    prisma.document.count({ where: scope }),
  ])

  const syncCount = quotaUsage?.syncCount || 0
  const percentUsed =
    limits.syncsPerMonth === Infinity
      ? 0
      : Math.min(100, Math.round((syncCount / limits.syncsPerMonth) * 100))

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
  const limits = getPlanLimits(plan)
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
  const limits = getPlanLimits(plan)
  const scope = await getResourceScope(userId)

  const connectorCount = await prisma.connector.count({
    where: scope,
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
  const limits = getPlanLimits(plan)
  const scope = await getResourceScope(userId)

  const documentCount = await prisma.document.count({
    where: scope,
  })

  const allowed = documentCount < limits.documents

  return {
    allowed,
    current: documentCount,
    limit: limits.documents,
    upgradeUrl: allowed ? undefined : '/pricing',
  }
}

export async function checkTeamMemberLimit(
  userId: string,
  organizationId: string
): Promise<{
  allowed: boolean
  current: number
  limit: number
  upgradeUrl?: string
}> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  const current = await prisma.userOrganization.count({
    where: { organizationId },
  })

  const allowed = current < limits.teamMembers

  return {
    allowed,
    current,
    limit: limits.teamMembers,
    upgradeUrl: allowed ? undefined : '/pricing',
  }
}

export async function withQuotaCheck(
  _request: Request,
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
