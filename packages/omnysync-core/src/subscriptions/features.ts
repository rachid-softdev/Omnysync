/**
 * Plan Features et Subscription
 * Omnysync - 2026
 */

import { prisma } from "../../prisma";
import { auditBilling } from "../audit";

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
// PLAN DEFINITIONS
// ============================================================================

export const plans: Record<string, PlanFeatures> = {
  free: {
    name: "Free",
    price: 0,
    currency: "EUR",
    interval: "month",
    maxConnectors: 2,
    maxDocuments: 100,
    maxSyncsPerMonth: 10,
    maxTeamMembers: 1,
    aiSEO: false,
    aiImages: false,
    aiInterlinking: false,
    twoWaySync: false,
    approvalPortal: false,
    customDomain: false,
    apiAccess: false,
    prioritySupport: false,
    analyticsExport: false,
  },

  pro: {
    name: "Pro",
    price: 29,
    currency: "EUR",
    interval: "month",
    maxConnectors: 10,
    maxDocuments: -1, // Unlimited
    maxSyncsPerMonth: 100,
    maxTeamMembers: 5,
    aiSEO: true,
    aiImages: true,
    aiInterlinking: true,
    twoWaySync: false,
    approvalPortal: false,
    customDomain: false,
    apiAccess: true,
    prioritySupport: false,
    analyticsExport: true,
  },

  business: {
    name: "Business",
    price: 99,
    currency: "EUR",
    interval: "month",
    maxConnectors: -1,
    maxDocuments: -1,
    maxSyncsPerMonth: -1,
    maxTeamMembers: -1,
    aiSEO: true,
    aiImages: true,
    aiInterlinking: true,
    twoWaySync: true,
    approvalPortal: true,
    customDomain: true,
    apiAccess: true,
    prioritySupport: true,
    analyticsExport: true,
  },

  enterprise: {
    name: "Enterprise",
    price: -1,
    currency: "EUR",
    interval: "month",
    maxConnectors: -1,
    maxDocuments: -1,
    maxSyncsPerMonth: -1,
    maxTeamMembers: -1,
    aiSEO: true,
    aiImages: true,
    aiInterlinking: true,
    twoWaySync: true,
    approvalPortal: true,
    customDomain: true,
    apiAccess: true,
    prioritySupport: true,
    analyticsExport: true,
  },
};

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
      users: {
        include: {
          user: {
            include: { subscription: true },
          },
        },
      },
    },
  });

  if (!org) {
    return { allowed: false, message: "Organization not found" };
  }

  // Get plan
  const subscription = org.users[0]?.user?.subscription;
  const planKey = subscription?.plan || "free";
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

  if (!org?.users[0]) return null;

  const userId = org.users[0].userId;

  const quota = await prisma.quotaUsage.findUnique({
    where: { userId_month: { userId, month: monthKey } },
  });

  // Get plan
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const planKey = subscription?.plan || "free";
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
 * Met à jour le plan d'un utilisateur
 */
export async function updateUserPlan(
  userId: string,
  planKey: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  const oldSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const oldPlan = oldSubscription?.plan || "free";

  // Update subscription
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: planKey,
      status: "active",
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan: planKey,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    },
  });

  // Audit log
  if (oldPlan !== planKey) {
    const org = await prisma.organization.findFirst({
      where: {
        users: { some: { userId, role: "OWNER" } },
      },
    });

    if (org) {
      if (plans[planKey]!.price > plans[oldPlan]!.price) {
        await auditBilling.planUpgraded(org.id, oldPlan, planKey);
      } else {
        await auditBilling.planDowngraded(org.id, oldPlan, planKey);
      }
    }
  }
}

/**
 * Annule un abonnement
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: true,
    },
  });

  // Audit log
  const org = await prisma.organization.findFirst({
    where: {
      users: { some: { userId, role: "OWNER" } },
    },
  });

  if (org) {
    await auditBilling.subscriptionCancelled(org.id);
  }
}
