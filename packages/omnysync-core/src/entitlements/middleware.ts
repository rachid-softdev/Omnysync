/**
 * Feature Flags & Entitlements - Middleware
 * Omnysync - 2026
 *
 * Middleware helpers for integrating feature gates into API routes.
 */

import { getFeatureGateService } from "./FeatureGateService";

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Creates middleware that resolves organization ID from a request
 * Override this to customize org ID resolution (e.g., from header, subdomain, JWT)
 */
export function createOrgIdResolver(
  resolver: (request: Request) => string | Promise<string>,
): (request: Request) => string | Promise<string> {
  return resolver;
}

/**
 * Require a feature to be enabled for the organization
 * Throws if the feature is not available
 */
export async function requireFeature(
  orgId: string,
  featureKey: string,
): Promise<void> {
  const service = getFeatureGateService();
  const hasFeature = await service.hasFeature(orgId, featureKey);

  if (!hasFeature) {
    throw new Error(
      `Feature "${featureKey}" is not available on your current plan`,
    );
  }
}

/**
 * Check if the organization can consume quota for a feature
 * Throws if limit is reached
 */
export async function requireLimit(
  orgId: string,
  featureKey: string,
  amount: number = 1,
): Promise<void> {
  const service = getFeatureGateService();
  const canConsume = await service.canConsume(orgId, featureKey, amount);

  if (!canConsume) {
    throw new Error(`Limit reached for "${featureKey}"`);
  }
}

/**
 * Consume quota for a feature (with limit check)
 */
export async function consumeFeature(
  orgId: string,
  featureKey: string,
  amount: number = 1,
) {
  const service = getFeatureGateService();
  return service.consume(orgId, featureKey, amount);
}

// ============================================================================
// WRAPPERS
// ============================================================================

/**
 * Higher-order function that wraps a handler with feature check
 * Returns a function that takes (request, orgId) and calls the handler if feature enabled
 */
export function withFeature(featureKey: string) {
  return (handler: (request: Request, orgId: string) => Promise<Response>) => {
    return async (request: Request, orgId: string): Promise<Response> => {
      await requireFeature(orgId, featureKey);
      return handler(request, orgId);
    };
  };
}

/**
 * Higher-order function that wraps a handler with quota consumption
 */
export function withConsume(featureKey: string, amount: number = 1) {
  return (handler: (request: Request, orgId: string) => Promise<Response>) => {
    return async (request: Request, orgId: string): Promise<Response> => {
      const result = await consumeFeature(orgId, featureKey, amount);
      if (!result.success) {
        return Response.json(
          { error: "Monthly limit reached. Upgrade your plan to continue." },
          { status: 403 },
        );
      }
      return handler(request, orgId);
    };
  };
}

/**
 * Higher-order function that wraps a handler with both feature and limit check
 */
export function withLimit(featureKey: string, amount: number = 1) {
  return (handler: (request: Request, orgId: string) => Promise<Response>) => {
    return async (request: Request, orgId: string): Promise<Response> => {
      await requireFeature(orgId, featureKey);
      await requireLimit(orgId, featureKey, amount);
      return handler(request, orgId);
    };
  };
}

/**
 * Convert middleware to Express-style middleware (for compatibility)
 */
export function toExpress(
  middleware: (request: Request, orgId: string) => Promise<Response>,
) {
  return async (req: any, res: any, next: () => void) => {
    try {
      const result = await middleware(req, req.orgId);
      if (result) {
        res.status(result.status).json(await result.json());
      } else {
        next();
      }
    } catch (err) {
      res.status(403).json({ error: (err as Error).message });
    }
  };
}
