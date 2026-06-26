/**
 * Feature Flags & Entitlements - Repository Interface & Implementation
 * Omnysync - 2026
 *
 * This is the data layer - interface + Prisma implementation
 * Designed for dependency injection and testability
 */

import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma";
import type {
  FeatureType,
  OverrideScope,
  SubscriptionStatus,
  EntitlementMap,
  PlanWithFeatures,
  FeatureWithPlans,
  OverrideInput,
  DowngradePreview,
  DowngradeStrategy,
  ActiveSubscriptionStatus,
} from "./types";
import { PLAN_KEYS, DEFAULT_PLAN } from "./constants";

// ============================================================================
// TYPES
// ============================================================================

export interface IEntitlementRepository {
  // Organization & Subscription
  getOrganizationStripeCustomerId(orgId: string): Promise<string | null>;
  getActiveSubscription(orgId: string): Promise<SubscriptionData | null>;
  getPlanKey(orgId: string): Promise<string>;

  // Features
  getFeature(featureKey: string): Promise<FeatureData | null>;
  getAllFeatures(): Promise<FeatureData[]>;
  getPlanFeatures(planKey: string): Promise<PlanFeatureData[]>;

  // Entitlements
  getEntitlementMap(orgId: string): Promise<EntitlementMap>;

  // Overrides
  getUserOverride(
    userId: string,
    featureKey: string,
  ): Promise<OverrideData | null>;
  getOrgOverride(
    orgId: string,
    featureKey: string,
  ): Promise<OverrideData | null>;
  getAllOverridesForOrg(orgId: string): Promise<OverrideData[]>;
  createOverride(
    input: OverrideInput & { createdBy: string },
  ): Promise<OverrideData>;
  deleteOverride(id: string): Promise<void>;

  // Usage Tracking
  getUsageTracking(
    orgId: string,
    featureKey: string,
  ): Promise<UsageData | null>;
  consumeUsage(
    orgId: string,
    featureKey: string,
    amount: number,
    limit: number | null,
  ): Promise<ConsumeUsageResult>;

  // Plans & Features (Admin)
  getPlanWithFeatures(planKey: string): Promise<PlanWithFeatures | null>;
  getAllPlansWithFeatures(): Promise<PlanWithFeatures[]>;
  getFeatureWithPlans(featureKey: string): Promise<FeatureWithPlans | null>;
  getAllFeaturesWithPlans(): Promise<FeatureWithPlans[]>;
  updatePlanFeature(
    planKey: string,
    featureKey: string,
    data: Partial<PlanFeatureUpdate>,
  ): Promise<PlanFeatureData>;
  createFeature(data: FeatureCreateInput): Promise<FeatureData>;
  updateFeature(
    featureKey: string,
    data: Partial<FeatureUpdateInput>,
  ): Promise<FeatureData>;

  // Downgrade Preview
  getDowngradePreview(
    orgId: string,
    targetPlanKey: string,
  ): Promise<DowngradePreview>;

  // Webhooks
  isWebhookEventProcessed(eventId: string): Promise<boolean>;
  markWebhookEventProcessed(eventId: string, eventType: string): Promise<void>;
}

export interface SubscriptionData {
  id: string;
  organizationId: string;
  planKey: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialStart: Date | null;
  trialEnd: Date | null;
}

export interface FeatureData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: FeatureType;
  defaultConfig: Record<string, unknown> | null;
}

export interface PlanFeatureData {
  featureKey: string;
  featureName: string;
  enabled: boolean;
  limitValue: number | null;
  configJson: Record<string, unknown> | null;
  downgradeStrategy: DowngradeStrategy;
}

export interface OverrideData {
  id: string;
  scope: OverrideScope;
  scopeId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  expiresAt: Date | null;
  reason: string | null;
}

export interface UsageData {
  id: string;
  organizationId: string;
  featureKey: string;
  usageCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface ConsumeUsageResult {
  success: boolean;
  newUsageCount: number;
  limitReached: boolean;
}

export interface PlanFeatureUpdate {
  enabled: boolean;
  limitValue: number | null;
  configJson: Record<string, unknown> | null;
  downgradeStrategy: DowngradeStrategy;
}

export interface FeatureCreateInput {
  key: string;
  name: string;
  description?: string;
  type: FeatureType;
  defaultConfig?: Record<string, unknown>;
}

export interface FeatureUpdateInput {
  name?: string;
  description?: string;
  defaultConfig?: Record<string, unknown>;
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

function isSerializationError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error as any).code === "P2034"
  ) {
    return true;
  }
  // Fallback pour éviter l'import si @prisma/client n'est pas accessible
  if (
    error instanceof Error &&
    "code" in error &&
    (error as any).code === "P2034"
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// PRISMA IMPLEMENTATION
// ============================================================================

export class PrismaEntitlementRepository implements IEntitlementRepository {
  async getOrganizationStripeCustomerId(orgId: string): Promise<string | null> {
    const prisma = getPrisma();
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });
    return org?.stripeCustomerId ?? null;
  }

  async getActiveSubscription(orgId: string): Promise<SubscriptionData | null> {
    const prisma = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = (await (prisma.subscription.findUnique as any)({
      where: { organizationId: orgId },
    })) as SubscriptionData | null;

    if (!subscription) return null;

    const isActive = ["ACTIVE", "TRIALING"].includes(subscription.status);
    if (!isActive && !subscription.currentPeriodEnd) return null;

    // Check if period has ended
    if (
      subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd) < new Date() &&
      subscription.status !== "TRIALING"
    ) {
      return null;
    }

    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      planKey: subscription.planKey,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
    };
  }

  async getPlanKey(orgId: string): Promise<string> {
    const sub = await this.getActiveSubscription(orgId);
    return sub?.planKey ?? DEFAULT_PLAN;
  }

  async getFeature(featureKey: string): Promise<FeatureData | null> {
    const prisma = getPrisma();
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    });

    if (!feature) return null;

    return {
      id: feature.id,
      key: feature.key,
      name: feature.name,
      description: feature.description,
      type: feature.type as FeatureType,
      defaultConfig: feature.defaultConfig as Record<string, unknown> | null,
    };
  }

  async getAllFeatures(): Promise<FeatureData[]> {
    const prisma = getPrisma();
    const features = await prisma.feature.findMany({
      orderBy: { key: "asc" },
    });

    return features.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      type: f.type as FeatureType,
      defaultConfig: f.defaultConfig as Record<string, unknown> | null,
    }));
  }

  async getPlanFeatures(planKey: string): Promise<PlanFeatureData[]> {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!plan) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return plan.features.map((pf: any) => ({
      featureKey: pf.feature.key,
      featureName: pf.feature.name,
      enabled: pf.enabled,
      limitValue: pf.limitValue,
      configJson: pf.configJson as Record<string, unknown> | null,
      downgradeStrategy: pf.downgradeStrategy as DowngradeStrategy,
    }));
  }

  async getEntitlementMap(orgId: string): Promise<EntitlementMap> {
    const planKey = await this.getPlanKey(orgId);
    const planFeatures = await this.getPlanFeatures(planKey);

    const features: Record<string, boolean> = {};
    const limits: Record<string, number | null> = {};
    const experiments: Record<
      string,
      { percentage: number; seed: string; enabled: boolean }
    > = {};

    for (const pf of planFeatures) {
      features[pf.featureKey] = pf.enabled;

      if (pf.enabled) {
        if (pf.configJson && "percentage" in pf.configJson) {
          // Experiment type
          experiments[pf.featureKey] = {
            percentage: (pf.configJson.percentage as number) || 0,
            seed: (pf.configJson.seed as string) || pf.featureKey,
            enabled: false, // Will be determined by ExperimentService
          };
        } else if (pf.limitValue !== null) {
          // Limit type
          limits[pf.featureKey] = pf.limitValue === -1 ? null : pf.limitValue;
        }
      } else {
        if (pf.limitValue !== null) {
          limits[pf.featureKey] = 0;
        }
      }
    }

    return {
      planKey,
      features,
      limits,
      experiments,
    };
  }

  async getUserOverride(
    userId: string,
    featureKey: string,
  ): Promise<OverrideData | null> {
    const prisma = getPrisma();
    const override = await prisma.entitlementOverride.findFirst({
      where: {
        scope: "USER",
        scopeId: userId,
        featureKey,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!override) return null;

    // Check if expired
    if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
      return null;
    }

    return {
      id: override.id,
      scope: override.scope as OverrideScope,
      scopeId: override.scopeId,
      featureKey: override.featureKey,
      enabled: override.enabled,
      limitValue: override.limitValue,
      expiresAt: override.expiresAt,
      reason: override.reason,
    };
  }

  async getOrgOverride(
    orgId: string,
    featureKey: string,
  ): Promise<OverrideData | null> {
    const prisma = getPrisma();
    const override = await prisma.entitlementOverride.findFirst({
      where: {
        scope: "ORG",
        scopeId: orgId,
        featureKey,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!override) return null;

    // Check if expired
    if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
      return null;
    }

    return {
      id: override.id,
      scope: override.scope as OverrideScope,
      scopeId: override.scopeId,
      featureKey: override.featureKey,
      enabled: override.enabled,
      limitValue: override.limitValue,
      expiresAt: override.expiresAt,
      reason: override.reason,
    };
  }

  async getAllOverridesForOrg(orgId: string): Promise<OverrideData[]> {
    const prisma = getPrisma();
    const overrides = await prisma.entitlementOverride.findMany({
      where: {
        scope: "ORG",
        scopeId: orgId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out expired
    const now = new Date();
    return overrides
      .filter((o) => !o.expiresAt || new Date(o.expiresAt) > now)
      .map((o) => ({
        id: o.id,
        scope: o.scope as OverrideScope,
        scopeId: o.scopeId,
        featureKey: o.featureKey,
        enabled: o.enabled,
        limitValue: o.limitValue,
        expiresAt: o.expiresAt,
        reason: o.reason,
      }));
  }

  async createOverride(
    input: OverrideInput & { createdBy: string },
  ): Promise<OverrideData> {
    const prisma = getPrisma();
    // For org-level overrides, we need the organizationId
    let organizationId: string | undefined = undefined;

    if (input.scope === "ORG") {
      const org = await prisma.organization.findUnique({
        where: { id: input.scopeId },
        select: { id: true },
      });
      organizationId = org?.id;
    }

    const override = await prisma.entitlementOverride.create({
      data: {
        scope: input.scope,
        scopeId: input.scopeId,
        featureKey: input.featureKey,
        enabled: input.enabled,
        limitValue: input.limitValue,
        expiresAt: input.expiresAt,
        reason: input.reason,
        createdBy: input.createdBy,
        organizationId,
      },
    });

    return {
      id: override.id,
      scope: override.scope as OverrideScope,
      scopeId: override.scopeId,
      featureKey: override.featureKey,
      enabled: override.enabled,
      limitValue: override.limitValue,
      expiresAt: override.expiresAt,
      reason: override.reason,
    };
  }

  async deleteOverride(id: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.entitlementOverride.delete({
      where: { id },
    });
  }

  async getUsageTracking(
    orgId: string,
    featureKey: string,
  ): Promise<UsageData | null> {
    const prisma = getPrisma();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const usage = await prisma.usageTracking.findUnique({
      where: {
        organizationId_featureKey_periodStart: {
          organizationId: orgId,
          featureKey,
          periodStart: startOfMonth,
        },
      },
    });

    if (!usage) return null;

    // Check if we need to reset (new month)
    if (usage.periodEnd < now) {
      return null; // Will create new entry in consumeUsage
    }

    return {
      id: usage.id,
      organizationId: usage.organizationId,
      featureKey: usage.featureKey,
      usageCount: usage.usageCount,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    };
  }

  async consumeUsage(
    orgId: string,
    featureKey: string,
    amount: number,
    limit: number | null,
  ): Promise<ConsumeUsageResult> {
    const prisma = getPrisma();
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const endOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Unlimited case — upsert atomique
    if (limit === null) {
      const usage = await prisma.usageTracking.upsert({
        where: {
          organizationId_featureKey_periodStart: {
            organizationId: orgId,
            featureKey,
            periodStart: startOfMonth,
          },
        },
        create: {
          organizationId: orgId,
          featureKey,
          usageCount: amount,
          periodStart: startOfMonth,
          periodEnd: endOfMonth,
        },
        update: {
          usageCount: { increment: amount },
        },
      });
      return {
        success: true,
        newUsageCount: usage.usageCount,
        limitReached: false,
      };
    }

    // Limited case — SERIALIZABLE transaction avec retry
    const MAX_RETRIES = 3;
    const BASE_BACKOFF_MS = 50;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = tx as any;
            const usage = await p.usageTracking.upsert({
              where: {
                organizationId_featureKey_periodStart: {
                  organizationId: orgId,
                  featureKey,
                  periodStart: startOfMonth,
                },
              },
              create: {
                organizationId: orgId,
                featureKey,
                usageCount: amount,
                periodStart: startOfMonth,
                periodEnd: endOfMonth,
              },
              update: {
                usageCount: { increment: amount },
              },
            });

            if (usage.usageCount > limit) {
              await p.usageTracking.update({
                where: {
                  organizationId_featureKey_periodStart: {
                    organizationId: orgId,
                    featureKey,
                    periodStart: startOfMonth,
                  },
                },
                data: { usageCount: { decrement: amount } },
              });
              return {
                success: false,
                newUsageCount: usage.usageCount - amount,
                limitReached: true,
              };
            }

            return {
              success: true,
              newUsageCount: usage.usageCount,
              limitReached: false,
            };
          },
          {
            isolationLevel: "Serializable",
            maxWait: 5000,
            timeout: 10000,
          },
        );
      } catch (error) {
        if (isSerializationError(error) && attempt < MAX_RETRIES) {
          const jitter = Math.random() * BASE_BACKOFF_MS;
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              BASE_BACKOFF_MS * Math.pow(2, attempt - 1) + jitter,
            ),
          );
          continue;
        }
        lastError = error;
        break;
      }
    }

    throw lastError;
  }

  async getPlanWithFeatures(planKey: string): Promise<PlanWithFeatures | null> {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!plan) return null;

    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      priceMonthly: plan.priceMonthly ? Number(plan.priceMonthly) : null,
      priceYearly: plan.priceYearly ? Number(plan.priceYearly) : null,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      features: plan.features.map((pf: any) => ({
        featureKey: pf.feature.key,
        featureName: pf.feature.name,
        enabled: pf.enabled,
        limitValue: pf.limitValue,
        configJson: pf.configJson as Record<string, unknown> | null,
        downgradeStrategy: pf.downgradeStrategy as DowngradeStrategy,
      })),
    };
  }

  async getAllPlansWithFeatures(): Promise<PlanWithFeatures[]> {
    const prisma = getPrisma();
    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    return plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      priceMonthly: plan.priceMonthly ? Number(plan.priceMonthly) : null,
      priceYearly: plan.priceYearly ? Number(plan.priceYearly) : null,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      features: plan.features.map((pf: any) => ({
        featureKey: pf.feature.key,
        featureName: pf.feature.name,
        enabled: pf.enabled,
        limitValue: pf.limitValue,
        configJson: pf.configJson as Record<string, unknown> | null,
        downgradeStrategy: pf.downgradeStrategy as DowngradeStrategy,
      })),
    }));
  }

  async getFeatureWithPlans(
    featureKey: string,
  ): Promise<FeatureWithPlans | null> {
    const prisma = getPrisma();
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
      include: {
        plans: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!feature) return null;

    return {
      id: feature.id,
      key: feature.key,
      name: feature.name,
      description: feature.description,
      type: feature.type as FeatureType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultConfig: feature.defaultConfig as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plans: feature.plans.map((pp: any) => ({
        featureKey: feature.key,
        featureName: feature.name,
        enabled: pp.enabled,
        limitValue: pp.limitValue,
        configJson: pp.configJson as Record<string, unknown> | null,
        downgradeStrategy: pp.downgradeStrategy as DowngradeStrategy,
      })),
    };
  }

  async getAllFeaturesWithPlans(): Promise<FeatureWithPlans[]> {
    const prisma = getPrisma();
    const features = await prisma.feature.findMany({
      orderBy: { key: "asc" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      include: {
        plans: {
          include: {
            plan: true,
          },
        },
      } as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return features.map((f: any) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      type: f.type as FeatureType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultConfig: f.defaultConfig as any,
      plans: f.plans.map((pp: any) => ({
        featureKey: f.key,
        featureName: f.name,
        enabled: pp.enabled,
        limitValue: pp.limitValue,
        configJson: pp.configJson as Record<string, unknown> | null,
        downgradeStrategy: pp.downgradeStrategy as DowngradeStrategy,
      })),
    }));
  }

  async updatePlanFeature(
    planKey: string,
    featureKey: string,
    data: Partial<PlanFeatureUpdate>,
  ): Promise<PlanFeatureData> {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({ where: { key: planKey } });
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    });

    if (!plan || !feature) {
      throw new Error("Plan or Feature not found");
    }

    const planFeature = await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: plan.id,
          featureId: feature.id,
        },
      },
      create: {
        planId: plan.id,
        featureId: feature.id,
        ...data,
      },
      update: data,
      include: {
        feature: true,
      },
    });

    return {
      featureKey: planFeature.feature.key,
      featureName: planFeature.feature.name,
      enabled: planFeature.enabled,
      limitValue: planFeature.limitValue,
      configJson: planFeature.configJson as Record<string, unknown> | null,
      downgradeStrategy: planFeature.downgradeStrategy as DowngradeStrategy,
    };
  }

  async createFeature(data: FeatureCreateInput): Promise<FeatureData> {
    const prisma = getPrisma();
    const feature = await prisma.feature.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        type: data.type,
        defaultConfig: data.defaultConfig,
      },
    });

    return {
      id: feature.id,
      key: feature.key,
      name: feature.name,
      description: feature.description,
      type: feature.type as FeatureType,
      defaultConfig: feature.defaultConfig as Record<string, unknown> | null,
    };
  }

  async updateFeature(
    featureKey: string,
    data: Partial<FeatureUpdateInput>,
  ): Promise<FeatureData> {
    const prisma = getPrisma();
    const feature = await prisma.feature.update({
      where: { key: featureKey },
      data,
    });

    return {
      id: feature.id,
      key: feature.key,
      name: feature.name,
      description: feature.description,
      type: feature.type as FeatureType,
      defaultConfig: feature.defaultConfig as Record<string, unknown> | null,
    };
  }

  async getDowngradePreview(
    orgId: string,
    targetPlanKey: string,
  ): Promise<DowngradePreview> {
    const currentPlanKey = await this.getPlanKey(orgId);
    const currentFeatures = await this.getPlanFeatures(currentPlanKey);
    const targetFeatures = await this.getPlanFeatures(targetPlanKey);

    const currentMap = new Map(currentFeatures.map((f) => [f.featureKey, f]));
    const targetMap = new Map(targetFeatures.map((f) => [f.featureKey, f]));

    const allFeatureKeys = new Set([...currentMap.keys(), ...targetMap.keys()]);

    const features: DowngradePreview["features"] = [];
    let affectedCount = 0;

    for (const key of allFeatureKeys) {
      const current = currentMap.get(key);
      const target = targetMap.get(key);

      const willBeAffected =
        (current?.enabled === true && target?.enabled === false) ||
        // Going from unlimited (null) to a specific limit
        (current?.limitValue === null && target?.limitValue !== null) ||
        (current?.limitValue !== null &&
          target?.limitValue !== null &&
          target.limitValue < current.limitValue);

      if (willBeAffected) {
        affectedCount++;
      }

      // Check if there's active usage
      const usage = await this.getUsageTracking(orgId, key);
      const hasActiveUsage = usage ? usage.usageCount > 0 : false;

      features.push({
        featureKey: key,
        featureName: current?.featureName || target?.featureName || key,
        currentPlanValue: current?.enabled ?? false,
        targetPlanValue: target?.enabled ?? false,
        currentLimit: current?.limitValue ?? null,
        targetLimit: target?.limitValue ?? null,
        downgradeStrategy: target?.downgradeStrategy ?? "GRACEFUL",
        willBeAffected,
        hasActiveUsage,
      });
    }

    // Determine recommended strategy
    const hasActiveUsageInAffected = features.some(
      (f) => f.willBeAffected && f.hasActiveUsage,
    );
    const recommendedStrategy: DowngradeStrategy = hasActiveUsageInAffected
      ? "GRACEFUL"
      : "IMMEDIATE";

    return {
      features,
      recommendedStrategy,
    };
  }

  async isWebhookEventProcessed(eventId: string): Promise<boolean> {
    const prisma = getPrisma();
    const event = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });
    return event !== null;
  }

  async markWebhookEventProcessed(
    eventId: string,
    eventType: string,
  ): Promise<void> {
    const prisma = getPrisma();
    // Atomic upsert eliminates the check-then-create race condition
    await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
      },
      update: {
        eventType, // No-op — refresh the type if re-processed
      },
    });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let repositoryInstance: IEntitlementRepository | null = null;

export function getEntitlementRepository(): IEntitlementRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PrismaEntitlementRepository();
  }
  return repositoryInstance;
}

export function setEntitlementRepository(repo: IEntitlementRepository): void {
  repositoryInstance = repo;
}

// For testing - reset the instance
export function resetEntitlementRepository(): void {
  repositoryInstance = null;
}
