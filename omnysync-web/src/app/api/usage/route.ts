import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import {
  getCurrentMonth,
  getPlanLimits,
  getUserPlan,
} from '@/lib/auth/subscription'

const AI_ACTIONS = ['ai_seo_completed', 'ai_image_generated', 'ai_interlinking_found'] as const
const HISTORY_ACTIONS = ['sync_started', ...AI_ACTIONS] as const

/**
 * The UI treats -1 as "unlimited" (plan limits use Infinity internally,
 * which JSON would serialize as null).
 */
function serializeLimit(value: number): number {
  return Number.isFinite(value) ? value : -1
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * GET /api/usage
 * Usage dashboard: current plan, billing period, resource usage vs plan
 * limits, AI usage and a 6-month history.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const orgId = await getUserOrgId(userId)

  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [subscription, quotaUsage, documentsUsed, connectorsUsed, teamUsed, recentLogs, recentDocuments] =
    await Promise.all([
      prisma.subscription.findUnique({ where: { organizationId: orgId } }),
      prisma.quotaUsage.findUnique({
        where: { userId_month: { userId, month: getCurrentMonth() } },
      }),
      prisma.document.count({ where: { organizationId: orgId } }),
      prisma.connector.count({ where: { organizationId: orgId } }),
      prisma.userOrganization.count({ where: { organizationId: orgId } }),
      prisma.syncLog.findMany({
        where: {
          organizationId: orgId,
          action: { in: [...HISTORY_ACTIONS] },
          createdAt: { gte: sixMonthsAgo },
        },
        select: { action: true, createdAt: true },
      }),
      prisma.document.findMany({
        where: { organizationId: orgId, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
    ])

  // Billing cycle: the subscription period when known, otherwise the current
  // calendar month (matches how the monthly sync quota is tracked).
  const billingStart =
    subscription?.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1)
  const billingEnd =
    subscription?.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const aiCount = (action: string) =>
    recentLogs.filter((log) => {
      return (
        log.action === action &&
        log.createdAt >= billingStart &&
        log.createdAt < billingEnd
      )
    }).length

  const history: Array<{ month: string; syncs: number; documents: number; aiCalls: number }> = []

  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const inRange = (date: Date) => date >= from && date < to

    history.push({
      month: monthKey(from),
      syncs: recentLogs.filter((log) => log.action === 'sync_started' && inRange(log.createdAt))
        .length,
      documents: recentDocuments.filter((doc) => inRange(doc.createdAt)).length,
      aiCalls: recentLogs.filter(
        (log) =>
          (AI_ACTIONS as readonly string[]).includes(log.action) && inRange(log.createdAt)
      ).length,
    })
  }

  return NextResponse.json({
    currentPlan: plan.charAt(0).toUpperCase() + plan.slice(1),
    billingCycle: {
      start: billingStart.toISOString(),
      end: billingEnd.toISOString(),
    },

    syncUsed: quotaUsage?.syncCount ?? 0,
    syncLimit: serializeLimit(limits.syncsPerMonth),

    documentsUsed,
    documentsLimit: serializeLimit(limits.documents),

    connectorsUsed,
    connectorsLimit: serializeLimit(limits.connectors),

    teamUsed,
    teamLimit: serializeLimit(limits.teamMembers),

    aiSEO: aiCount('ai_seo_completed'),
    aiImages: aiCount('ai_image_generated'),
    aiInterlinking: aiCount('ai_interlinking_found'),

    history,
  })
}
