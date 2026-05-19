/**
 * Feature Flags & Entitlements - Middleware Factories
 * Omnysync - 2026
 *
 * Framework-agnostic factory functions for API middleware.
 * Works with Express, Next.js App Router, or any other framework.
 *
 * IMPORTANT: The orgId must be resolved from the auth session,
 * never from the request body.
 */

import { getFeatureGateService } from './FeatureGateService'
import { handleFeatureGateError, FeatureGateError } from './errors'
import { ConsumeResult } from './types'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type OrgIdResolver = (request: Request) => Promise<string | null>

export type MiddlewareHandler = (
  req: Request,
  handler: () => Promise<Response>
) => Promise<Response>

// ============================================================================
// DEFAULT ORG ID RESOLVER
// ============================================================================

/**
 * Default resolver - looks for x-org-id header
 * In production, this should extract from auth session/JWT
 */
export function createOrgIdResolver(headerName: string = 'x-org-id'): OrgIdResolver {
  return async (request: Request): Promise<string | null> => {
    // Try header first
    const headerOrgId = request.headers.get(headerName)
    if (headerOrgId) {
      return headerOrgId
    }

    // In a real implementation, this would:
    // 1. Get session from cookies
    // 2. Extract orgId from session
    // 3. Validate org belongs to user

    return null
  }
}

// ============================================================================
// MIDDLEWARE FACTORIES
// ============================================================================

/**
 * requireFeature - Middleware that throws 403 if feature is not enabled
 *
 * Usage (Next.js App Router):
 *   export const POST = withFeature("EXPORT_PDF", async (req) => { ... })
 *
 * Usage (Express):
 *   router.post("/export", requireFeature("EXPORT_PDF"), handler)
 */
export function requireFeature(
  featureKey: string,
  orgIdResolver?: OrgIdResolver
): MiddlewareHandler {
  const resolveOrgId = orgIdResolver ?? createOrgIdResolver()

  return async (req: Request, handler: () => Promise<Response>): Promise<Response> => {
    const featureGate = getFeatureGateService()
    const orgId = await resolveOrgId(req)

    if (!orgId) {
      return Response.json(
        { error: 'INVALID_ORG', message: 'Organization not identified' },
        { status: 401 }
      )
    }

    try {
      // This will throw FeatureNotAvailableError if not enabled
      await featureGate.assertFeature(orgId, featureKey)

      // Feature is enabled, proceed
      return handler()
    } catch (error) {
      const handled = handleFeatureGateError(error)
      return Response.json(handled.body, { status: handled.statusCode })
    }
  }
}

/**
 * requireLimit - Check limit without consuming
 * Useful for UI to show current usage without making API calls
 *
 * Returns current usage info in X-RateLimit-* headers for convenience
 */
export function requireLimit(featureKey: string, orgIdResolver?: OrgIdResolver): MiddlewareHandler {
  const resolveOrgId = orgIdResolver ?? createOrgIdResolver()

  return async (req: Request, handler: () => Promise<Response>): Promise<Response> => {
    const featureGate = getFeatureGateService()
    const orgId = await resolveOrgId(req)

    if (!orgId) {
      return Response.json(
        { error: 'INVALID_ORG', message: 'Organization not identified' },
        { status: 401 }
      )
    }

    try {
      // Check if feature is enabled first
      const hasFeature = await featureGate.hasFeature(orgId, featureKey)

      if (!hasFeature) {
        const planKey = await featureGate.getAllEntitlements(orgId).then((e) => e.planKey)
        throw new FeatureGateError(
          'FEATURE_NOT_AVAILABLE',
          `Feature '${featureKey}' not available on ${planKey} plan`,
          { feature: featureKey, plan: planKey },
          403
        )
      }

      // Check limit
      const canConsume = await featureGate.canConsume(orgId, featureKey)

      if (!canConsume) {
        // Return 402 with limit info
        const limit = await featureGate.getLimit(orgId, featureKey)
        const entitlements = await featureGate.getAllEntitlements(orgId)

        throw new FeatureGateError(
          'LIMIT_REACHED',
          `Limit reached for '${featureKey}'`,
          {
            feature: featureKey,
            limit: limit ?? 0,
            used: entitlements.limits[featureKey] ?? 0,
          },
          402
        )
      }

      // Within limits, proceed
      return handler()
    } catch (error) {
      const handled = handleFeatureGateError(error)
      return Response.json(handled.body, { status: handled.statusCode })
    }
  }
}

/**
 * consumeFeature - Check + consume in one middleware
 * Use for features that count against quota (e.g., exports, API calls)
 */
export function consumeFeature(
  featureKey: string,
  amount: number = 1,
  orgIdResolver?: OrgIdResolver
): MiddlewareHandler {
  const resolveOrgId = orgIdResolver ?? createOrgIdResolver()

  return async (req: Request, handler: () => Promise<Response>): Promise<Response> => {
    const featureGate = getFeatureGateService()
    const orgId = await resolveOrgId(req)

    if (!orgId) {
      return Response.json(
        { error: 'INVALID_ORG', message: 'Organization not identified' },
        { status: 401 }
      )
    }

    try {
      // Check feature is enabled and consume atomically
      const result = await featureGate.consume(orgId, featureKey, amount)

      // Add consumption info to request headers for downstream use
      const headers = new Headers()
      headers.set('X-Consumed-Units', amount.toString())
      headers.set('X-Remaining-Units', (result.remaining ?? 'unlimited').toString())

      // Merge with existing response
      const response = await handler()

      // Add consumption headers to response
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers([...response.headers, ...headers]),
      })

      return newResponse
    } catch (error) {
      const handled = handleFeatureGateError(error)
      return Response.json(handled.body, { status: handled.statusCode })
    }
  }
}

// ============================================================================
// EXPRESS.JS ADAPTERS
// ============================================================================

/**
 * Convert our middleware factories to Express middleware
 * Usage:
 *   const requireFeatureExpress = toExpress(requireFeature("EXPORT_PDF"))
 *   app.get("/export", requireFeatureExpress, handler)
 */
export function toExpress(factory: (orgIdResolver?: OrgIdResolver) => MiddlewareHandler) {
  return (featureKey: string) => {
    const middleware = factory(featureKey)

    return (
      req: { headers: Record<string, string | undefined> },
      res: unknown,
      next: (err?: Error) => void
    ) => {
      // Create a mock Request object
      const mockReq = new Request('http://localhost', {
        method: 'GET',
        headers: req.headers as Record<string, string>,
      })

      // Mock Response handler
      const handler = async () => {
        // This would be the actual route handler
        // For middleware, we just pass through
        return new Response('OK')
      }

      middleware(mockReq, handler)
        .then((response) => {
          if (response.status >= 400) {
            res.status(response.status).json({ error: 'Feature not available' })
          } else {
            next()
          }
        })
        .catch((err) => {
          next(err)
        })
    }
  }
}

// ============================================================================
// DECORATOR PATTERN (for Next.js App Router)
// ============================================================================

/**
 * Wrapper for Next.js App Router handlers
 * Usage:
 *   export const POST = withFeature("EXPORT_PDF",
 *     withConsume("EXPORT_PDF",
 *       async (req) => { ... }
 *     )
 *   )
 */
export function withFeature(featureKey: string) {
  return <T extends (req: Request) => Promise<Response>>(handler: T): T => {
    return (async (req: Request) => {
      const featureGate = getFeatureGateService()

      // Get orgId from session (implementation depends on auth setup)
      const orgId = req.headers.get('x-org-id')

      if (!orgId) {
        return Response.json(
          { error: 'INVALID_ORG', message: 'Organization not identified' },
          { status: 401 }
        )
      }

      try {
        await featureGate.assertFeature(orgId, featureKey)
        return handler(req)
      } catch (error) {
        const handled = handleFeatureGateError(error)
        return Response.json(handled.body, { status: handled.statusCode })
      }
    }) as T
  }
}

export function withConsume(featureKey: string, amount: number = 1) {
  return <T extends (req: Request) => Promise<Response>>(handler: T): T => {
    return (async (req: Request) => {
      const featureGate = getFeatureGateService()
      const orgId = req.headers.get('x-org-id')

      if (!orgId) {
        return Response.json(
          { error: 'INVALID_ORG', message: 'Organization not identified' },
          { status: 401 }
        )
      }

      try {
        await featureGate.consume(orgId, featureKey, amount)
        return handler(req)
      } catch (error) {
        const handled = handleFeatureGateError(error)
        return Response.json(handled.body, { status: handled.statusCode })
      }
    }) as T
  }
}

export function withLimit(featureKey: string) {
  return <T extends (req: Request) => Promise<Response>>(handler: T): T => {
    return (async (req: Request) => {
      const featureGate = getFeatureGateService()
      const orgId = req.headers.get('x-org-id')

      if (!orgId) {
        return Response.json(
          { error: 'INVALID_ORG', message: 'Organization not identified' },
          { status: 401 }
        )
      }

      try {
        const canConsume = await featureGate.canConsume(orgId, featureKey)

        if (!canConsume) {
          const limit = await featureGate.getLimit(orgId, featureKey)
          const entitlements = await featureGate.getAllEntitlements(orgId)

          return Response.json(
            {
              error: 'LIMIT_REACHED',
              feature: featureKey,
              limit: limit ?? 'unlimited',
              used: entitlements.limits[featureKey] ?? 0,
              upgrade_url: '/billing/upgrade',
            },
            { status: 402 }
          )
        }

        return handler(req)
      } catch (error) {
        const handled = handleFeatureGateError(error)
        return Response.json(handled.body, { status: handled.statusCode })
      }
    }) as T
  }
}
