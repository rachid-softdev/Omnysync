/**
 * Monitoring and Error Tracking
 * Omnysync - 2026
 */

import * as Sentry from '@sentry/nextjs'

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize monitoring services
 * Call this in your app initialization
 */
export function initMonitoring() {
  // Sentry - Error tracking
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
      release: process.env.npm_package_version,
      integrations: [Sentry.httpIntegration()],
    })
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Capture an exception with additional context
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext('additional', context)
  }
  Sentry.captureException(error)
}

/**
 * Capture a message with level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Set user context for tracking
 */
export function setUser(userId: string, email?: string, ip?: string) {
  Sentry.setUser({
    id: userId,
    email,
    ip_address: ip,
  })
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  })
}

// ============================================================================
// WRAPPER FOR API ROUTES
// ============================================================================

/**
 * Wrapper to automatically capture errors in API routes
 */
export async function withMonitoring<T>(
  fn: () => Promise<T>,
  options: {
    name?: string
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  } = {}
): Promise<T> {
  const span = Sentry.startInactiveSpan({
    name: options.name || 'unknown',
    op: 'function',
    forceTransaction: true,
  })

  if (options.tags) {
    Sentry.setTags(options.tags)
  }

  try {
    const result = await fn()
    span.setStatus('ok')
    return result
  } catch (error) {
    span.setStatus('internal_error')
    span.setData('error', (error as Error).message)
    captureError(error as Error, options.extra)
    throw error
  } finally {
    span.end()
  }
}

/**
 * Wrap a Next.js API route handler with monitoring
 */
export function withAPIMonitoring(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now()

    try {
      const response = await handler(req)

      // Add breadcrumb for successful request
      addBreadcrumb('api', `${req.method} ${new URL(req.url).pathname}`, {
        status: response.status,
        duration: Date.now() - startTime,
      })

      return response
    } catch (error) {
      // Add breadcrumb for failed request
      addBreadcrumb('api', `${req.method} ${new URL(req.url).pathname}`, {
        status: 'error',
        duration: Date.now() - startTime,
        error: (error as Error).message,
      })

      captureError(error as Error, {
        method: req.method,
        path: new URL(req.url).pathname,
        duration: Date.now() - startTime,
      })

      throw error
    }
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Measure and log performance metrics
 */
export async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = Date.now()

  try {
    return await fn()
  } finally {
    const duration = Date.now() - startTime

    // Log slow operations
    if (duration > 1000) {
      captureMessage(`Slow operation: ${name} took ${duration}ms`, 'warning')
    }

    // Add performance breadcrumb
    addBreadcrumb('performance', `${name} completed`, { duration })
  }
}

/**
 * Create a custom span for tracing
 */
export function startSpan(name: string, op: string) {
  return Sentry.startSpan({ name, op }, async () => {
    // Span body
  })
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check endpoint handler
 */
export async function healthCheck() {
  const checks = {
    database: false,
    redis: false,
    openai: false,
  }

  // Check database
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch {
    checks.database = false
  }

  // Check Redis (if configured)
  try {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const { Redis } = await import('@upstash/redis')
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
      await redis.ping()
      checks.redis = true
    }
  } catch {
    checks.redis = false
  }

  // Check OpenAI (if configured)
  try {
    if (process.env.OPENAI_API_KEY) {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI()
      await openai.models.list()
      checks.openai = true
    }
  } catch {
    checks.openai = false
  }

  const allHealthy = Object.values(checks).every(Boolean)

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  }
}
