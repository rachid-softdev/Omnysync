/**
 * Plan Features et Subscription
 * Omnysync - 2026
 */

import { prisma } from "../prisma";
import { auditBilling } from "../audit";
import {
  DEFAULT_PLAN_FEATURES,
  FEATURE_KEYS,
  type PlanKey,
} from "../entitlements/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface PlanFeatures {
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year";

  // Limits
  maxConnectors: number;
  maxDocuments: number;
  maxSyncsPerMonth: number;
  maxTeamMembers: number;

  // Features
  aiSEO: boolean;
  aiImages: boolean;
  aiInterlinking: boolean;
  twoWaySync: boolean;
  approvalPortal: boolean;
  customDomain: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  analyticsExport: boolean;
}

// ============================================================================
// PLAN DEFINITIONS — derived from entitlements/constants.ts (single source of truth)
// ============================================================================

function buildPlanFeatures(): Record<string, PlanFeatures> {
  const planMeta: Record<
    string,
    {
      name: string;
      price: number;
      currency: string;
      interval: "month" | "year";
    }
  > = {
    free: { name: "Free", price: 0, currency: "EUR", interval: "month" },
    pro: { name: "Pro", price: 29, currency: "EUR", interval: "month" },
    business: {
      name: "Business",
      price: 99,
      currency: "EUR",
      interval: "month",
    },
    enterprise: {
      name: "Enterprise",
      price: -1,
      currency: "EUR",
      interval: "month",
    },
  };

  const result: Record<string, PlanFeatures> = {};

  for (const [key, meta] of Object.entries(planMeta)) {
    const config = DEFAULT_PLAN_FEATURES[key as PlanKey];
    if (!config) continue;

    result[key] = {
      ...meta,
      maxConnectors: config[FEATURE_KEYS.MAX_CONNECTORS] as number,
      maxDocuments: config[FEATURE_KEYS.MAX_DOCUMENTS] as number,
      maxSyncsPerMonth: config[FEATURE_KEYS.MAX_SYNCS_PER_MONTH] as number,
      maxTeamMembers: config[FEATURE_KEYS.MAX_TEAM_MEMBERS] as number,
      aiSEO: config[FEATURE_KEYS.AI_SEO] as boolean,
      aiImages: config[FEATURE_KEYS.AI_IMAGES] as boolean,
      aiInterlinking: config[FEATURE_KEYS.AI_INTERLINKING] as boolean,
      twoWaySync: config[FEATURE_KEYS.TWO_WAY_SYNC] as boolean,
      approvalPortal: config[FEATURE_KEYS.APPROVAL_PORTAL] as boolean,
      customDomain: config[FEATURE_KEYS.CUSTOM_DOMAIN] as boolean,
      apiAccess: config[FEATURE_KEYS.API_ACCESS] as boolean,
      prioritySupport: config[FEATURE_KEYS.PRIORITY_SUPPORT] as boolean,
      analyticsExport: config[FEATURE_KEYS.ANALYTICS_EXPORT] as boolean,
    };
  }

  return result;
}

export const plans = buildPlanFeatures();

// ============================================================================
// QUOTA CHECKING
// ============================================================================

/**
 * Vérifie si l'organisation peut effectuer une action selon son plan
 */
export async function checkQuota(
  organizationId: string,
  feature: keyof PlanFeatures,
): Promise<{
  allowed: boolean;
  current?: number;
  limit?: number;
  message?: string;
}> {
  // Get organization and subscription
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscriptions: { take: 1 },
    },
  });

  if (!org) {
    return { allowed: false, message: "Organization not found" };
  }

  // Get plan
  const subscription = org.subscriptions[0];
  const planKey = subscription?.planKey || "free";
  const plan = plans[planKey];

  if (!plan) {
    return { allowed: false, message: "Invalid plan" };
  }

  // Check based on feature
  if (typeof plan[feature] === "boolean") {
    return { allowed: plan[feature] as boolean };
  }

  // For numeric limits
  const limit = plan[feature] as number;

  if (limit === -1) {
    return { allowed: true }; // Unlimited
  }

  switch (feature) {
    case "maxConnectors": {
      const count = await prisma.connector.count({ where: { organizationId } });
      return {
        allowed: count < limit,
        current: count,
        limit,
        message:
          count >= limit
            ? `Limite de ${limit} connecteurs atteinte`
            : undefined,
      };
    }

    case "maxDocuments": {
      const count = await prisma.document.count({ where: { organizationId } });
      return {
        allowed: count < limit,
        current: count,
        limit,
        message:
          count >= limit ? `Limite de ${limit} documents atteinte` : undefined,
      };
    }

    case "maxSyncsPerMonth": {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const count = await prisma.syncLog.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
          status: "SUCCESS",
        },
      });

      return {
        allowed: count < limit,
        current: count,
        limit,
        message:
          count >= limit
            ? `Limite de ${limit} synchronisations atteinte`
            : undefined,
      };
    }

    case "maxTeamMembers": {
      const count = await prisma.userOrganization.count({
        where: { organizationId },
      });
      return {
        allowed: count < limit,
        current: count,
        limit,
        message:
          count >= limit ? `Limite de ${limit} membres atteinte` : undefined,
      };
    }

    default:
      return { allowed: true };
  }
}

/**
 * Wrapper pour vérifier le quota avant une action
 */
export async function withQuotaCheck<T>(
  organizationId: string,
  feature: keyof PlanFeatures,
  action: () => Promise<T>,
): Promise<T> {
  const check = await checkQuota(organizationId, feature);

  if (!check.allowed) {
    throw new Error(check.message || "Quota exceeded");
  }

  return action();
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Enregistre l'utilisation d'une ressource
 */
export async function recordUsage(
  organizationId: string,
  resource: "sync" | "document" | "connector" | "member",
): Promise<void> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Get the owner user ID
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1,
      },
    },
  });

  if (!org?.users[0]) return;

  const userId = org.users[0].userId;

  // Upsert quota usage
  await prisma.quotaUsage.upsert({
    where: {
      userId_month: { userId, month: monthKey },
    },
    create: {
      userId,
      month: monthKey,
      syncCount: resource === "sync" ? 1 : 0,
    },
    update: {
      syncCount: resource === "sync" ? { increment: 1 } : undefined,
    },
  });
}

/**
 * Récupère les statistiques d'utilisation
 */
export async function getUsageStats(organizationId: string) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Get org with owner and subscription
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1,
      },
      subscriptions: { take: 1 },
    },
  });

  if (!org?.users[0]) return null;

  const userId = org.users[0].userId;

  const quota = await prisma.quotaUsage.findUnique({
    where: { userId_month: { userId, month: monthKey } },
  });

  // Get plan from org-level subscription
  const subscription = org.subscriptions?.[0];
  const planKey = subscription?.planKey || "free";
  const plan = plans[planKey];

  return {
    syncCount: quota?.syncCount || 0,
    maxSyncs: plan.maxSyncsPerMonth,
    connectorCount: await prisma.connector.count({ where: { organizationId } }),
    maxConnectors: plan.maxConnectors,
    documentCount: await prisma.document.count({ where: { organizationId } }),
    maxDocuments: plan.maxDocuments,
    memberCount: await prisma.userOrganization.count({
      where: { organizationId },
    }),
    maxMembers: plan.maxTeamMembers,
  };
}

// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

/**
 * Met à jour le plan d'une organisation
 * Uses org-level subscription (new model)
 */
export async function updateUserPlan(
  userId: string,
  planKey: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  // Find org for user
  const orgMembership = await prisma.userOrganization.findFirst({
    where: { userId, role: "OWNER" },
  });
  if (!orgMembership) return;

  const organizationId = orgMembership.organizationId;

  const oldSubscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  const oldPlan = oldSubscription?.planKey || "free";

  // Update subscription
  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      planKey,
      status: "ACTIVE",
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      planKey,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  // Audit log
  if (oldPlan !== planKey) {
    if (plans[planKey]!.price > plans[oldPlan]!.price) {
      await auditBilling.planUpgraded(organizationId, oldPlan, planKey);
    } else {
      await auditBilling.planDowngraded(organizationId, oldPlan, planKey);
    }
  }
}

/**
 * Annule un abonnement
 */
export async function cancelSubscription(userId: string): Promise<void> {
  // Find org for user
  const orgMembership = await prisma.userOrganization.findFirst({
    where: { userId, role: "OWNER" },
  });
  if (!orgMembership) return;

  const organizationId = orgMembership.organizationId;

  await prisma.subscription.update({
    where: { organizationId },
    data: {
      cancelAtPeriodEnd: true,
    },
  });

  // Audit log
  await auditBilling.subscriptionCancelled(organizationId);
}
