/**
 * Web-specific Next.js middleware factories for entitlements.
 * These use auth() and FeatureGateError for Next.js App Router.
 * For framework-agnostic helpers, see @omnysync/core/entitlements/middleware.
 */
export {
  createOrgIdResolver,
  requireFeature,
  requireLimit,
  consumeFeature,
  withFeature,
  withConsume,
  withLimit,
  toExpress,
} from './middleware-factories'
