/**
 * Feature Flags & Entitlements - Main Export
 * Omnysync - 2026
 *
 * Central export point for all entitlements services.
 * Import from here instead of individual files.
 */

// Types
export * from "./types"

// Constants
export * from "./constants"

// Errors
export {
  FeatureGateError,
  FeatureNotAvailableError,
  LimitReachedError,
  SubscriptionExpiredError,
  InvalidOrganizationError,
  InvalidFeatureError,
  CacheError,
  logFeatureGateError,
  isFeatureGateError,
  handleFeatureGateError,
} from "./errors"

// Repository
export {
  PrismaEntitlementRepository,
  getEntitlementRepository,
  setEntitlementRepository,
  resetEntitlementRepository,
  type IEntitlementRepository,
  type SubscriptionData,
  type FeatureData,
  type PlanFeatureData,
  type OverrideData,
  type UsageData,
  type ConsumeResult,
  type PlanFeatureUpdate,
  type FeatureCreateInput,
  type FeatureUpdateInput,
} from "./EntitlementRepository"

// Cache Service
export {
  getCacheService,
  setCacheService,
  resetCacheService,
  entitlementCache,
  type CacheOptions,
  type InvalidationMessage,
} from "./CacheService"

// Experiment Service
export {
  ExperimentService,
  getExperimentService,
  setExperimentService,
  resetExperimentService,
  calculateExpectedDistribution,
  validateExperimentConfig,
} from "./ExperimentService"

// Feature Gate Service
export {
  getFeatureGateService,
  setFeatureGateService,
  resetFeatureGateService,
  featureGate,
  type FeatureGateConfig,
} from "./FeatureGateService"

// Downgrade Service
export {
  getDowngradeService,
  setDowngradeService,
  resetDowngradeService,
} from "./DowngradeService"

// Middleware
export {
  createOrgIdResolver,
  requireFeature,
  requireLimit,
  consumeFeature,
  toExpress,
  withFeature,
  withConsume,
  withLimit,
} from "./middleware"