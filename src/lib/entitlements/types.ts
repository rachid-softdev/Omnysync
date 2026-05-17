/**
 * Feature Flags & Entitlements - Types
 */

export type FeatureType = "BOOLEAN" | "LIMIT" | "EXPERIMENT"
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "INCOMPLETE_EXPIRED"
export type OverrideScope = "ORG" | "USER"
export type DowngradeStrategy = "GRACEFUL" | "IMMEDIATE" | "FREEZE"
export type ResolveSource = "user_override" | "org_override" | "plan" | "fallback"

export interface EntitlementValue {
  enabled: boolean
  value: boolean | number | null
  limit?: number | null
}

export interface EntitlementMap {
  planKey: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  experiments: Record<string, { percentage: number; seed: string; enabled: boolean }>
}

export interface ExperimentConfig {
  percentage: number
  seed: string
  enabled: boolean
}

export interface ExperimentBucket {
  inExperiment: boolean
  bucket: number
}

export interface UsageInfo {
  used: number
  limit: number | null
  resetAt: Date
  remaining: number | null
}

export interface ConsumeResult {
  success: boolean
  feature: string
  used: number
  limit: number | null
  remaining: number | null
  resetAt: Date
  error?: { code: string; message: string }
}

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
  subscriptionStatus?: SubscriptionStatus
  orgId: string
}

export interface EntitlementsResponse {
  plan: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  usage: Record<string, number>
  resetAt: Record<string, string>
  experimentGroups?: Record<string, string>
}

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
  configJson: Record<string, unknown> | null
  downgradeStrategy: DowngradeStrategy
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

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]