import { NextRequest, NextResponse } from 'next/server'

export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX = 30 // requests per window

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory rate limit store with automatic cleanup
const rateLimitMap = new Map<string, RateLimitRecord>()

// Timer reference for cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first (client)
    return forwarded.split(',')[0]!.trim()
  }

  return realIp ?? request.headers.get('cf-connecting-ip') ?? 'unknown'
}

/**
 * Prune expired entries from the rate limit map
 * Call this periodically to prevent memory leaks
 */
export function pruneRateLimitEntries(): number {
  const now = Date.now()
  let prunedCount = 0

  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
      prunedCount++
    }
  }

  return prunedCount
}

/**
 * Start automatic cleanup of expired rate limit entries
 * Called once on first use, then runs every 5 minutes
 */
export function startRateLimitCleanup(): void {
  if (cleanupInterval) return

  // Initial cleanup
  pruneRateLimitEntries()

  // Run cleanup every 5 minutes
  cleanupInterval = setInterval(
    () => {
      pruneRateLimitEntries()
    },
    5 * 60 * 1000
  )
}

/**
 * Stop automatic cleanup (mainly for testing)
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Core rate limit check function
 * Returns the result with current state
 */
export function rateLimit(request: NextRequest): { allowed: boolean; remainingTime?: number } {
  const ip = getClientIp(request)
  const now = Date.now()

  // Ensure cleanup is running
  startRateLimitCleanup()

  const record = rateLimitMap.get(ip)

  // No record or expired - reset
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  // Rate limit exceeded
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remainingTime: record.resetTime - now }
  }

  record.count++
  return { allowed: true }
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(remainingTime: number): NextResponse {
  const retryAfter = Math.ceil((remainingTime || 1000) / 1000)
  return NextResponse.json(
    { error: 'Too many requests', message: 'Rate limit exceeded. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + remainingTime),
      },
    }
  )
}

/**
 * Middleware wrapper for API routes
 * Returns the response if allowed, or 429 if rate limited
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const result = rateLimit(request)

  if (!result.allowed) {
    return createRateLimitResponse(result.remainingTime || RATE_LIMIT_WINDOW_MS)
  }

  return null
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 * Usage: export const GET = withRateLimit(GET)
 */
export function withRateLimit<T extends (req: NextRequest) => Promise<NextResponse>>(
  handler: T
): T {
  return async function (req: NextRequest): Promise<NextResponse> {
    const rateLimitResult = rateLimit(req)

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.remainingTime || RATE_LIMIT_WINDOW_MS)
    }

    return handler(req)
  } as T
}
