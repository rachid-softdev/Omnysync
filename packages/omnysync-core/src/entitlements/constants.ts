/**
 * Feature Flags & Entitlements - Constants
 * Omnysync - 2026
 */

// ============================================================================
// PLAN KEYS
// ============================================================================

export const PLAN_KEYS = {
  FREE: "free",
  PRO: "pro",
  BUSINESS: "business",
  ENTERPRISE: "enterprise",
} as const;

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS];

export const DEFAULT_PLAN = PLAN_KEYS.FREE;

// ============================================================================
// FEATURE KEYS
// ============================================================================

export const FEATURE_KEYS = {
  // Boolean features
  EXPORT_PDF: "EXPORT_PDF",
  EXPORT_CSV: "EXPORT_CSV",
  AI_SUMMARY: "AI_SUMMARY",
  AI_SEO: "AI_SEO",
  AI_IMAGES: "AI_IMAGES",
  AI_INTERLINKING: "AI_INTERLINKING",
  TWO_WAY_SYNC: "TWO_WAY_SYNC",
  APPROVAL_PORTAL: "APPROVAL_PORTAL",
  CUSTOM_DOMAIN: "CUSTOM_DOMAIN",
  API_ACCESS: "API_ACCESS",
  PRIORITY_SUPPORT: "PRIORITY_SUPPORT",
  ANALYTICS_EXPORT: "ANALYTICS_EXPORT",
  WEBHOOKS: "WEBHOOKS",
  SCHEDULED_SYNC: "SCHEDULED_SYNC",
  TEAM_MEMBERS: "TEAM_MEMBERS",

  // Limit features
  MAX_CONNECTORS: "MAX_CONNECTORS",
  MAX_DOCUMENTS: "MAX_DOCUMENTS",
  MAX_SYNCS_PER_MONTH: "MAX_SYNCS_PER_MONTH",
  MAX_TEAM_MEMBERS: "MAX_TEAM_MEMBERS",
  MAX_API_CALLS: "MAX_API_CALLS",

  // Experiment features
  NEW_DASHBOARD: "NEW_DASHBOARD",
  AI_V2: "AI_V2",
  NEW_EXPORT_UI: "NEW_EXPORT_UI",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// ============================================================================
// DEFAULT PLAN CONFIGURATION
// ============================================================================

export const DEFAULT_PLAN_FEATURES: Record<
  PlanKey,
  Record<string, boolean | number>
> = {
  free: {
    // Boolean features
    [FEATURE_KEYS.EXPORT_PDF]: false,
    [FEATURE_KEYS.EXPORT_CSV]: true,
    [FEATURE_KEYS.AI_SUMMARY]: false,
    [FEATURE_KEYS.AI_SEO]: false,
    [FEATURE_KEYS.AI_IMAGES]: false,
    [FEATURE_KEYS.AI_INTERLINKING]: false,
    [FEATURE_KEYS.TWO_WAY_SYNC]: false,
    [FEATURE_KEYS.APPROVAL_PORTAL]: false,
    [FEATURE_KEYS.CUSTOM_DOMAIN]: false,
    [FEATURE_KEYS.API_ACCESS]: false,
    [FEATURE_KEYS.PRIORITY_SUPPORT]: false,
    [FEATURE_KEYS.ANALYTICS_EXPORT]: false,
    [FEATURE_KEYS.WEBHOOKS]: false,
    [FEATURE_KEYS.SCHEDULED_SYNC]: false,
    [FEATURE_KEYS.TEAM_MEMBERS]: false,

    // Limit features
    [FEATURE_KEYS.MAX_CONNECTORS]: 2,
    [FEATURE_KEYS.MAX_DOCUMENTS]: 100,
    [FEATURE_KEYS.MAX_SYNCS_PER_MONTH]: 10,
    [FEATURE_KEYS.MAX_TEAM_MEMBERS]: 1,
    [FEATURE_KEYS.MAX_API_CALLS]: 0,
  },

  pro: {
    // Boolean features
    [FEATURE_KEYS.EXPORT_PDF]: true,
    [FEATURE_KEYS.EXPORT_CSV]: true,
    [FEATURE_KEYS.AI_SUMMARY]: true,
    [FEATURE_KEYS.AI_SEO]: true,
    [FEATURE_KEYS.AI_IMAGES]: true,
    [FEATURE_KEYS.AI_INTERLINKING]: true,
    [FEATURE_KEYS.TWO_WAY_SYNC]: false,
    [FEATURE_KEYS.APPROVAL_PORTAL]: false,
    [FEATURE_KEYS.CUSTOM_DOMAIN]: false,
    [FEATURE_KEYS.API_ACCESS]: true,
    [FEATURE_KEYS.PRIORITY_SUPPORT]: false,
    [FEATURE_KEYS.ANALYTICS_EXPORT]: true,
    [FEATURE_KEYS.WEBHOOKS]: true,
    [FEATURE_KEYS.SCHEDULED_SYNC]: true,
    [FEATURE_KEYS.TEAM_MEMBERS]: false,

    // Limit features
    [FEATURE_KEYS.MAX_CONNECTORS]: 10,
    [FEATURE_KEYS.MAX_DOCUMENTS]: -1, // Unlimited
    [FEATURE_KEYS.MAX_SYNCS_PER_MONTH]: 100,
    [FEATURE_KEYS.MAX_TEAM_MEMBERS]: 1,
    [FEATURE_KEYS.MAX_API_CALLS]: 1000,
  },

  business: {
    // Boolean features
    [FEATURE_KEYS.EXPORT_PDF]: true,
    [FEATURE_KEYS.EXPORT_CSV]: true,
    [FEATURE_KEYS.AI_SUMMARY]: true,
    [FEATURE_KEYS.AI_SEO]: true,
    [FEATURE_KEYS.AI_IMAGES]: true,
    [FEATURE_KEYS.AI_INTERLINKING]: true,
    [FEATURE_KEYS.TWO_WAY_SYNC]: true,
    [FEATURE_KEYS.APPROVAL_PORTAL]: true,
    [FEATURE_KEYS.CUSTOM_DOMAIN]: true,
    [FEATURE_KEYS.API_ACCESS]: true,
    [FEATURE_KEYS.PRIORITY_SUPPORT]: true,
    [FEATURE_KEYS.ANALYTICS_EXPORT]: true,
    [FEATURE_KEYS.WEBHOOKS]: true,
    [FEATURE_KEYS.SCHEDULED_SYNC]: true,
    [FEATURE_KEYS.TEAM_MEMBERS]: true,

    // Limit features
    [FEATURE_KEYS.MAX_CONNECTORS]: -1, // Unlimited
    [FEATURE_KEYS.MAX_DOCUMENTS]: -1,
    [FEATURE_KEYS.MAX_SYNCS_PER_MONTH]: -1,
    [FEATURE_KEYS.MAX_TEAM_MEMBERS]: 10,
    [FEATURE_KEYS.MAX_API_CALLS]: 10000,
  },

  enterprise: {
    // Boolean features - all enabled
    [FEATURE_KEYS.EXPORT_PDF]: true,
    [FEATURE_KEYS.EXPORT_CSV]: true,
    [FEATURE_KEYS.AI_SUMMARY]: true,
    [FEATURE_KEYS.AI_SEO]: true,
    [FEATURE_KEYS.AI_IMAGES]: true,
    [FEATURE_KEYS.AI_INTERLINKING]: true,
    [FEATURE_KEYS.TWO_WAY_SYNC]: true,
    [FEATURE_KEYS.APPROVAL_PORTAL]: true,
    [FEATURE_KEYS.CUSTOM_DOMAIN]: true,
    [FEATURE_KEYS.API_ACCESS]: true,
    [FEATURE_KEYS.PRIORITY_SUPPORT]: true,
    [FEATURE_KEYS.ANALYTICS_EXPORT]: true,
    [FEATURE_KEYS.WEBHOOKS]: true,
    [FEATURE_KEYS.SCHEDULED_SYNC]: true,
    [FEATURE_KEYS.TEAM_MEMBERS]: true,

    // Limit features - unlimited
    [FEATURE_KEYS.MAX_CONNECTORS]: -1,
    [FEATURE_KEYS.MAX_DOCUMENTS]: -1,
    [FEATURE_KEYS.MAX_SYNCS_PER_MONTH]: -1,
    [FEATURE_KEYS.MAX_TEAM_MEMBERS]: -1,
    [FEATURE_KEYS.MAX_API_CALLS]: -1,
  },
};

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_CONFIG = {
  // Redis TTL (5 minutes)
  REDIS_TTL: 300,

  // Memory cache TTL (30 seconds)
  MEMORY_TTL: 30,

  // Cache key prefix
  KEY_PREFIX: "entitlements:",

  // Pub/sub channel for cache invalidation
  INVALIDATION_CHANNEL: "entitlements:invalidate",
} as const;

// ============================================================================
// ACTIVE SUBSCRIPTION STATUSES
// ============================================================================

export const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING"] as const;

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: "ACTIVE",
  TRIALING: "TRIALING",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
  INCOMPLETE: "INCOMPLETE",
  INCOMPLETE_EXPIRED: "INCOMPLETE_EXPIRED",
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  FEATURE_NOT_AVAILABLE: "This feature is not available on your current plan",
  LIMIT_REACHED: "You have reached your limit for this feature",
  SUBSCRIPTION_EXPIRED: "Your subscription has expired",
  PLAN_REQUIRED: "This feature requires a higher plan",
  UPGRADE_URL: "/billing/upgrade",
  RENEW_URL: "/billing",
} as const;

// ============================================================================
// EXPERIMENT DEFAULTS
// ============================================================================

export const EXPERIMENT_DEFAULTS = {
  DEFAULT_PERCENTAGE: 0,
  SEED_PREFIX: "omnysync:experiment:",
} as const;

// ============================================================================
// PAGINATION DEFAULTS
// ============================================================================

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ============================================================================
// DOWNGRADE STRATEGY DEFAULTS
// ============================================================================

export const DEFAULT_DOWNGRADE_STRATEGY = "GRACEFUL" as const;

// ============================================================================
// STRIPE PRICE IDS (for reference)
// ============================================================================

export const STRIPE_PRICE_IDS = {
  FREE: "price_free",
  PRO_MONTHLY: "price_pro_monthly",
  PRO_YEARLY: "price_pro_yearly",
  BUSINESS_MONTHLY: "price_business_monthly",
  BUSINESS_YEARLY: "price_business_yearly",
} as const;
