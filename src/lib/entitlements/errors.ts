/**
 * Feature Flags & Entitlements - Errors
 * Omnysync - 2026
 */

import { ERROR_MESSAGES } from "./constants"

export type FeatureGateErrorCode =
  | "FEATURE_NOT_AVAILABLE"
  | "LIMIT_REACHED"
  | "SUBSCRIPTION_EXPIRED"
  | "INVALID_ORG"
  | "INVALID_FEATURE"
  | "CACHE_ERROR"

export interface FeatureGateErrorContext {
  orgId?: string
  userId?: string
  feature?: string
  plan?: string
  limit?: number
  used?: number
  resetAt?: string
}

export class FeatureGateError extends Error {
  public readonly code: FeatureGateErrorCode
  public readonly statusCode: number
  public readonly context: FeatureGateErrorContext
  public readonly upgradeUrl?: string
  public readonly featureKey?: string
  public readonly planRequired?: string

  constructor(
    code: FeatureGateErrorCode,
    message: string,
    context: FeatureGateErrorContext = {},
    statusCode: number = 403
  ) {
    super(message)
    this.name = "FeatureGateError"
    this.code = code
    this.statusCode = statusCode
    this.context = context

    // Set additional properties for specific errors
    if (code === "FEATURE_NOT_AVAILABLE") {
      this.featureKey = context.feature
      this.planRequired = context.plan
      this.upgradeUrl = ERROR_MESSAGES.UPGRADE_URL
    }

    if (code === "LIMIT_REACHED") {
      this.featureKey = context.feature
      this.upgradeUrl = ERROR_MESSAGES.UPGRADE_URL
    }
  }

  toJSON() {
    const response: Record<string, unknown> = {
      error: this.code,
      message: this.message,
    }

    if (this.featureKey) {
      response.feature = this.featureKey
    }

    if (this.planRequired) {
      response.plan_required = this.planRequired
      response.current_plan = this.context.plan
      response.upgrade_url = this.upgradeUrl
    }

    if (this.code === "LIMIT_REACHED") {
      response.limit = this.context.limit
      response.used = this.context.used
      response.reset_at = this.context.resetAt
      response.upgrade_url = this.upgradeUrl
    }

    if (this.code === "SUBSCRIPTION_EXPIRED") {
      response.renew_url = ERROR_MESSAGES.RENEW_URL
    }

    return response
  }
}

// ============================================================================
// SPECIFIC ERROR FACTORIES
// ============================================================================

export class FeatureNotAvailableError extends FeatureGateError {
  constructor(featureKey: string, currentPlan: string, requiredPlan?: string) {
    super(
      "FEATURE_NOT_AVAILABLE",
      requiredPlan
        ? `Feature '${featureKey}' requires ${requiredPlan} plan. You are currently on ${currentPlan}.`
        : `Feature '${featureKey}' is not available on your current plan.`,
      {
        feature: featureKey,
        plan: currentPlan,
      },
      403
    )
  }
}

export class LimitReachedError extends FeatureGateError {
  constructor(
    featureKey: string,
    limit: number,
    used: number,
    resetAt: string
  ) {
    super(
      "LIMIT_REACHED",
      `You have reached your limit for '${featureKey}'. You have used ${used} out of ${limit} allowed.`,
      {
        feature: featureKey,
        limit,
        used,
        resetAt,
      },
      402
    )
  }
}

export class SubscriptionExpiredError extends FeatureGateError {
  constructor(orgId: string) {
    super(
      "SUBSCRIPTION_EXPIRED",
      "Your subscription has expired. Please renew to continue using premium features.",
      { orgId },
      402
    )
  }
}

export class InvalidOrganizationError extends FeatureGateError {
  constructor(orgId: string) {
    super(
      "INVALID_ORG",
      `Organization '${orgId}' not found or does not exist.`,
      { orgId },
      404
    )
  }
}

export class InvalidFeatureError extends FeatureGateError {
  constructor(featureKey: string) {
    super(
      "INVALID_FEATURE",
      `Feature '${featureKey}' is not defined in the system.`,
      { feature: featureKey },
      400
    )
  }
}

export class CacheError extends FeatureGateError {
  constructor(message: string, context: FeatureGateErrorContext = {}) {
    super("CACHE_ERROR", message, context, 500)
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export function logFeatureGateError(
  error: FeatureGateError,
  additionalContext?: Record<string, unknown>
): void {
  console.error("[FeatureGateError]", {
    code: error.code,
    message: error.message,
    context: { ...error.context, ...additionalContext },
    timestamp: new Date().toISOString(),
  })
}

export function isFeatureGateError(error: unknown): error is FeatureGateError {
  return error instanceof FeatureGateError
}

export function handleFeatureGateError(error: unknown): {
  statusCode: number
  body: Record<string, unknown>
} {
  if (isFeatureGateError(error)) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    }
  }

  // Unknown error
  console.error("[UnexpectedError]", error)
  return {
    statusCode: 500,
    body: {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  }
}