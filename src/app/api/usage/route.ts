/**
 * Route API: Utilisation des quotas
 * GET /api/usage
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { subMonths } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Récupérer l'abonnement et les limites
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    })

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: membership.organizationId },
    })

    // Définir les limites selon le plan
    const plan = subscription?.plan || "free"
    const limits = getPlanLimits(plan)

    // Compter les utilisations actuelles
    const [connectorsCount, documentsCount, teamCount, currentMonthUsage] = await Promise.all([
      prisma.connector.count({ where: { organizationId: membership.organizationId } }),
      prisma.document.count({ where: { organizationId: membership.organizationId } }),
      prisma.userOrganization.count({ where: { organizationId: membership.organizationId } }),
      prisma.quotaUsage.findUnique({
        where: {
          userId_month: {
            userId: session.user.id,
            month: getCurrentMonth(),
          },
        },
      }),
    ])

    // Compter les synchronisations du mois en cours
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const syncCount = await prisma.syncLog.count({
      where: {
        organizationId: membership.organizationId,
        action: "sync",
        createdAt: { gte: startOfMonth },
      },
    })

    // Compter les utilisations AI du mois
    const aiUsage = await prisma.syncLog.aggregate({
      where: {
        organizationId: membership.organizationId,
        action: { contains: "ai" },
        createdAt: { gte: startOfMonth },
      },
      _count: true,
    })

    // Générer l'historique des 6 derniers mois
    const history = await getUsageHistory(session.user.id, membership.organizationId)

    // Déterminer le cycle de facturation
    const billingCycle = getBillingCycle(subscription)

    return NextResponse.json({
      currentPlan: plan,
      billingCycle,
      syncUsed: syncCount,
      syncLimit: limits.maxSyncs,
      documentsUsed: documentsCount,
      documentsLimit: limits.maxDocuments,
      connectorsUsed: connectorsCount,
      connectorsLimit: limits.maxConnectors,
      teamUsed: teamCount - 1, // Soustraire l'utilisateur actuel
      teamLimit: limits.maxTeamMembers,
      aiSEO: currentMonthUsage?.syncCount || 0,
      aiImages: 0, // TODO: Track separately
      aiInterlinking: 0, // TODO: Track separately
      history,
    })
  } catch (error) {
    console.error("GET usage error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

function getPlanLimits(plan: string) {
  switch (plan) {
    case "business":
      return {
        maxConnectors: 50,
        maxDocuments: -1, // Unlimited
        maxSyncs: 1000,
        maxTeamMembers: 20,
      }
    case "pro":
      return {
        maxConnectors: 10,
        maxDocuments: -1,
        maxSyncs: 100,
        maxTeamMembers: 5,
      }
    default: // free
      return {
        maxConnectors: 2,
        maxDocuments: 100,
        maxSyncs: 10,
        maxTeamMembers: 1,
      }
  }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function getBillingCycle(subscription: { currentPeriodEnd?: Date | null } | null) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  let end: Date
  if (subscription?.currentPeriodEnd) {
    end = subscription.currentPeriodEnd
  } else {
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

async function getUsageHistory(userId: string, organizationId: string) {
  const history = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`

    const usage = await prisma.quotaUsage.findUnique({
      where: {
        userId_month: {
          userId,
          month: monthStr,
        },
      },
    })

    const startOfMonth = new Date(month)
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    const syncs = await prisma.syncLog.count({
      where: {
        organizationId,
        action: "sync",
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    })

    const documents = await prisma.document.count({
      where: {
        organizationId,
        createdAt: { lte: endOfMonth },
      },
    })

    history.push({
      month: monthStr,
      syncs: usage?.syncCount || syncs,
      documents,
      aiCalls: 0, // TODO: Track
    })
  }

  return history
}