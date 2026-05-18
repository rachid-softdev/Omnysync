import { prisma } from "../../prisma"

export type Plan = "free" | "pro" | "business"

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
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
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

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan]
}

/**
 * Récupère l'utilisation actuelle du quota pour un utilisateur
 */
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

  // Calcul du pourcentage d'utilisation (pour le plan gratuit)
  const percentUsed = plan === "free" 
    ? Math.round((syncCount / limits.syncsPerMonth) * 100) 
    : 0

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

/**
 * Vérifie si l'utilisateur peut effectuer un sync
 * Lance une erreur si le quota est dépassé
 */
export async function checkAndIncrementQuota(userId: string): Promise<{
  allowed: boolean
  remaining: number
  upgradeUrl?: string
}> {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]
  const month = getCurrentMonth()

  // Plans illimités : toujours autorisé
  if (limits.syncsPerMonth === Infinity) {
    return { allowed: true, remaining: Infinity }
  }

  // Récupérer ou créer l'entrée de quota
  let quota = await prisma.quotaUsage.findUnique({
    where: { userId_month: { userId, month } },
  })

  if (!quota) {
    quota = await prisma.quotaUsage.create({
      data: { userId, month, syncCount: 0 },
    })
  }

  const remaining = limits.syncsPerMonth - quota.syncCount

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      upgradeUrl: "/pricing",
    }
  }

  // Incrémenter le compteur
  await prisma.quotaUsage.update({
    where: { id: quota.id },
    data: { syncCount: { increment: 1 } },
  })

  return { allowed: true, remaining: remaining - 1 }
}

/**
 * Décrémente le quota en cas d'échec de sync (pour ne pas gaspiller le quota)
 */
export async function decrementQuotaOnFailure(userId: string): Promise<void> {
  const month = getCurrentMonth()
  
  await prisma.quotaUsage.updateMany({
    where: { userId, month },
    data: { syncCount: { decrement: 1 } },
  }).catch(() => {
    // Ignore errors - quota is not critical
  })
}

/**
 * Vérifie la limite de connecteurs
 */
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
    upgradeUrl: allowed ? undefined : "/pricing",
  }
}

/**
 * Vérifie la limite de documents
 */
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
    upgradeUrl: allowed ? undefined : "/pricing",
  }
}

export function getPlanFromPriceId(priceId: string): Plan {
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY
  const businessPriceId = process.env.STRIPE_PRICE_BUSINESS_MONTHLY

  if (priceId === proPriceId) return "pro"
  if (priceId === businessPriceId) return "business"
  return "free"
}