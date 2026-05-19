/**
 * Feature Flags & Entitlements - Types
 * Omnysync - 2026
 */

// ============================================================================
// FEATURE TYPES
// ============================================================================

export type FeatureType = 'BOOLEAN' | 'LIMIT' | 'EXPERIMENT'

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'

export type OverrideScope = 'ORG' | 'USER'

export type DowngradeStrategy = 'GRACEFUL' | 'IMMEDIATE' | 'FREEZE'

export type ResolveSource = 'user_override' | 'org_override' | 'plan' | 'fallback'

export type ActiveSubscriptionStatus = 'ACTIVE' | 'TRIALING'

// ============================================================================
// ENTITLEMENT MAP
// ============================================================================

export interface EntitlementValue {
  enabled: boolean
  value: boolean | number | null // null = unlimited for LIMIT type
  limit?: number | null // Explicit limit value (null = unlimited)
}

export interface EntitlementMap {
  planKey: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  experiments: Record<string, ExperimentConfig>
}

// ============================================================================
// EXPERIMENT TYPES
// ============================================================================

export interface ExperimentConfig {
  percentage: number
  seed: string
  enabled: boolean // Whether user is in experiment
}

export interface ExperimentBucket {
  inExperiment: boolean
  bucket: number
}

// ============================================================================
// USAGE & CONSUMPTION
// ============================================================================

export interface UsageInfo {
  used: number
  limit: number | null // null = unlimited
  resetAt: Date
  remaining: number | null // null = unlimited
}

export interface ConsumeResult {
  success: boolean
  feature: string
  used: number
  limit: number | null
  remaining: number | null
  resetAt: Date
  error?: ConsumeError
}

export interface ConsumeError {
  code: 'LIMIT_REACHED' | 'FEATURE_NOT_ENABLED' | 'SUBSCRIPTION_EXPIRED'
  message: string
}

// ============================================================================
// DEBUG TRACE
// ============================================================================

export interface DebugTrace {
  resolvedVia: ResolveSource
  value: boolean | number | null
  featureKey: string
  featureType: FeatureType
  overrideId?: string
  overrideScope?: OverrideScope
  overrideExpiresAt?: Date
  planKey?: string
  planLimit?: number | null
  defaultConfig?: Json
  subscriptionStatus?: SubscriptionStatus
  orgId: string
}

// ============================================================================
// ENTITLEMENTS RESPONSE (Frontend)
// ============================================================================

export interface EntitlementsResponse {
  plan: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  usage: Record<string, number>
  resetAt: Record<string, string>
  experimentGroups?: Record<string, string>
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface PlanWithFeatures {
  id: string
  key: string
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  isActive: boolean
  sortOrder: number
  features: PlanFeatureConfig[]
}

export interface PlanFeatureConfig {
  featureKey: string
  featureName: string
  enabled: boolean
  limitValue: number | null
  configJson: Json | null
  downgradeStrategy: DowngradeStrategy
}

export interface FeatureWithPlans {
  id: string
  key: string
  name: string
  description: string | null
  type: FeatureType
  defaultConfig: Json | null
  plans: PlanFeatureConfig[]
}

export interface OverrideInput {
  scope: OverrideScope
  scopeId: string // orgId or userId
  featureKey: string
  enabled: boolean
  limitValue?: number | null
  expiresAt?: Date | null
  reason: string
}

export interface DowngradePreview {
  features: DowngradeFeatureImpact[]
  recommendedStrategy: DowngradeStrategy
}

export interface DowngradeFeatureImpact {
  featureKey: string
  featureName: string
  currentPlanValue: boolean | number | null
  targetPlanValue: boolean | number | null
  currentLimit: number | null
  targetLimit: number | null
  downgradeStrategy: DowngradeStrategy
  willBeAffected: boolean
  hasActiveUsage: boolean
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationParams {
  page: number
  limit: number
  sort?: string // e.g., "key:asc", "name:desc"
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================================================
// STRIPE WEBHOOK
// ============================================================================

export interface StripeWebhookEvent {
  id: string
  type: StripeWebhookEventType
  processed: boolean
  processedAt?: Date
}

export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.subscription.trial_end'

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CachedEntitlements {
  data: EntitlementMap
  fetchedAt: number
  ttl: number
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface NonNull<T> {
  [key: string]: T
}
