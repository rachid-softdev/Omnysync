import { getPrisma } from "../prisma";
import { DEFAULT_PLAN_FEATURES, FEATURE_KEYS } from "../entitlements/constants";
import type { PlanKey } from "../entitlements/constants";

export type Plan = PlanKey;

export interface PlanLimits {
  syncsPerMonth: number;
  connectors: number;
  documents: number;
  aiFeatures: boolean;
  bidirectionalSync: boolean;
  multiUser: boolean;
  apiAccess: boolean;
  scheduledSync: boolean;
}

/**
 * Maps -1 (unlimited sentinel in constants) to Infinity for backward compat.
 */
function mapLimitValue(value: number): number {
  return value === -1 ? Infinity : value;
}

function buildPlanLimits(): Record<Plan, PlanLimits> {
  const plans: Record<string, PlanLimits> = {};
  for (const key of Object.keys(DEFAULT_PLAN_FEATURES) as Plan[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (DEFAULT_PLAN_FEATURES as any)[key];
    plans[key] = {
      syncsPerMonth: mapLimitValue(
        config[FEATURE_KEYS.MAX_SYNCS_PER_MONTH] as number,
      ),
      connectors: mapLimitValue(config[FEATURE_KEYS.MAX_CONNECTORS] as number),
      documents: mapLimitValue(config[FEATURE_KEYS.MAX_DOCUMENTS] as number),
      aiFeatures: config[FEATURE_KEYS.AI_SUMMARY] as boolean,
      bidirectionalSync: config[FEATURE_KEYS.TWO_WAY_SYNC] as boolean,
      multiUser: config[FEATURE_KEYS.TEAM_MEMBERS] as boolean,
      apiAccess: config[FEATURE_KEYS.API_ACCESS] as boolean,
      scheduledSync: config[FEATURE_KEYS.SCHEDULED_SYNC] as boolean,
    };
  }
  return plans as Record<Plan, PlanLimits>;
}

export const PLAN_LIMITS = buildPlanLimits();

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const prisma = getPrisma();
  // Find org for user, then get org-level subscription
  const orgMembership = await prisma.userOrganization.findFirst({
    where: { userId },
    include: {
      organization: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        include: {
          subscriptions: { take: 1 },
        } as any,
      },
    },
  });

  const subscription = orgMembership?.organization?.subscriptions?.[0];

  if (!subscription || subscription.status !== "ACTIVE") {
    return "free";
  }

  return (subscription.planKey as Plan) || "free";
}

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Récupère l'utilisation actuelle du quota pour un utilisateur
 */
export async function getQuotaUsage(userId: string): Promise<{
  syncCount: number;
  syncLimit: number;
  connectorCount: number;
  connectorLimit: number;
  documentCount: number;
  documentLimit: number;
  percentUsed: number;
}> {
  const prisma = getPrisma();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const month = getCurrentMonth();

  const [quotaUsage, connectorCount, documentCount] = await Promise.all([
    prisma.quotaUsage.findUnique({
      where: { userId_month: { userId, month } },
    }),
    prisma.connector.count({ where: { userId } }),
    prisma.document.count({ where: { userId } }),
  ]);

  const syncCount = quotaUsage?.syncCount || 0;

  // Calcul du pourcentage d'utilisation (pour le plan gratuit)
  const percentUsed =
    plan === "free" ? Math.round((syncCount / limits.syncsPerMonth) * 100) : 0;

  return {
    syncCount,
    syncLimit: limits.syncsPerMonth,
    connectorCount,
    connectorLimit: limits.connectors,
    documentCount,
    documentLimit: limits.documents,
    percentUsed,
  };
}

/**
 * Vérifie si l'utilisateur peut effectuer un sync
 * Lance une erreur si le quota est dépassé
 */
export async function checkAndIncrementQuota(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  upgradeUrl?: string;
}> {
  const prisma = getPrisma();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const month = getCurrentMonth();

  // Plans illimités : toujours autorisé
  if (limits.syncsPerMonth === Infinity) {
    return { allowed: true, remaining: Infinity };
  }

  // Atomic upsert + increment: ensure record exists, then conditionally increment
  // First try to create the record if it doesn't exist
  await prisma.quotaUsage.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, syncCount: 0 },
    update: {}, // No-op if exists
  });

  // Atomically increment ONLY if under limit — eliminates race condition
  const result = await prisma.quotaUsage.updateMany({
    where: {
      userId,
      month,
      syncCount: { lt: limits.syncsPerMonth },
    },
    data: { syncCount: { increment: 1 } },
  });

  if (result.count === 0) {
    // Either record doesn't exist (impossible after upsert) or at limit
    return {
      allowed: false,
      remaining: 0,
      upgradeUrl: "/pricing",
    };
  }

  // Get updated count for accurate remaining
  const updated = await prisma.quotaUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  const remaining = limits.syncsPerMonth - (updated?.syncCount ?? 0);

  return { allowed: true, remaining: Math.max(0, remaining) };
}

/**
 * Décrémente le quota en cas d'échec de sync (pour ne pas gaspiller le quota)
 */
export async function decrementQuotaOnFailure(userId: string): Promise<void> {
  const prisma = getPrisma();
  const month = getCurrentMonth();

  await prisma.quotaUsage
    .updateMany({
      where: { userId, month },
      data: { syncCount: { decrement: 1 } },
    })
    .catch(() => {
      // Ignore errors - quota is not critical
    });
}

/**
 * Vérifie la limite de connecteurs
 */
export async function checkConnectorLimit(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  upgradeUrl?: string;
}> {
  const prisma = getPrisma();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const connectorCount = await prisma.connector.count({
    where: { userId },
  });

  const allowed = connectorCount < limits.connectors;

  return {
    allowed,
    current: connectorCount,
    limit: limits.connectors,
    upgradeUrl: allowed ? undefined : "/pricing",
  };
}

/**
 * Vérifie la limite de documents
 */
export async function checkDocumentLimit(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  upgradeUrl?: string;
}> {
  const prisma = getPrisma();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const documentCount = await prisma.document.count({
    where: { userId },
  });

  const allowed = documentCount < limits.documents;

  return {
    allowed,
    current: documentCount,
    limit: limits.documents,
    upgradeUrl: allowed ? undefined : "/pricing",
  };
}

export function getPlanFromPriceId(priceId: string): Plan {
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const businessPriceId = process.env.STRIPE_PRICE_BUSINESS_MONTHLY;

  if (priceId === proPriceId) return "pro";
  if (priceId === businessPriceId) return "business";
  return "free";
}
