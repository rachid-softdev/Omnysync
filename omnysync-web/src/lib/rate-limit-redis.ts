/**
 * Rate limiting avec Redis (Upstash)
 * Alternative au rate limiting in-memory pour la production
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { rateLimit as inMemoryRateLimit, isValidIp } from '@/lib/rate-limit'

export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX = 30 // requests per window

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

/**
 * Extract client IP from request headers.
 *
 * 🔒 Sécurité : valide que l'IP extraite est une adresse IP valide.
 * Rejette les valeurs forgées dans x-forwarded-for qui permettraient
 * de bypasser le rate limiting.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip')

  if (forwarded) {
    const firstIp = forwarded.split(',')[0]!.trim()
    if (isValidIp(firstIp)) {
      return firstIp
    }
    console.warn(`[RATE-LIMIT-REDIS] Rejet x-forwarded-for invalide: "${firstIp}"`)
  }

  if (realIp && isValidIp(realIp)) return realIp
  if (cfIp && isValidIp(cfIp)) return cfIp

  return 'unknown'
}

/**
 * Rate limit check using Redis
 * Uses INCR with automatic key expiration
 */
export async function rateLimitRedis(
  request: NextRequest
): Promise<{ allowed: boolean; remainingTime?: number }> {
  if (!redis) {
    // Fallback to in-memory if Redis not configured
    console.warn('Redis not configured, falling back to in-memory rate limiting')
    return inMemoryRateLimit(request)
  }

  const ip = getClientIp(request)
  const key = `ratelimit:${ip}`
  const windowMs = RATE_LIMIT_WINDOW_MS

  try {
    // Increment counter and set expiration atomically
    const count = await redis.incr(key)

    if (count === 1) {
      // First request, set expiration
      await redis.expire(key, Math.ceil(windowMs / 1000))
    }

    if (count > RATE_LIMIT_MAX) {
      // Get TTL for remaining time
      const ttl = await redis.ttl(key)
      return {
        allowed: false,
        remainingTime: ttl > 0 ? ttl * 1000 : windowMs,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Redis rate limit error, using in-memory fallback:', error)
    return inMemoryRateLimit(request)
  }
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
 * Middleware wrapper for API routes with Redis
 */
export async function checkRateLimitRedis(request: NextRequest): Promise<NextResponse | null> {
  const result = await rateLimitRedis(request)

  if (!result.allowed) {
    return createRateLimitResponse(result.remainingTime || RATE_LIMIT_WINDOW_MS)
  }

  return null
}

export interface RateLimitConfig {
  max: number
  windowMs: number
}

/**
 * Rate limit check with configurable limits for per-endpoint use
 * Falls back to in-memory rate limit if Redis is unavailable (when fallbackRequest is provided)
 */
export async function rateLimitRedisWithConfig(
  identifier: string,
  config: RateLimitConfig,
  fallbackRequest?: NextRequest
): Promise<{ allowed: boolean; remainingTime?: number }> {
  if (!redis) {
    if (fallbackRequest) {
      console.warn(`[RATE-LIMIT] Redis not configured — "${identifier}" using in-memory fallback`)
      return inMemoryRateLimit(fallbackRequest)
    }
    // 🔒 Fail-closed by default when Redis is unavailable and no fallback is provided.
    // This prevents silent rate-limit bypass. Routes that need rate limiting must
    // provide a fallbackRequest (typically the original NextRequest) so in-memory
    // fallback can be used.
    console.error(
      `[RATE-LIMIT] ⚠️ CRITICAL: Redis not configured and no fallback request provided — ` +
        `rate limit for "${identifier}" DENIED (fail-closed). ` +
        `Set UPSTASH_REDIS_REST_URL or pass a fallbackRequest to use in-memory fallback.`
    )
    return { allowed: false, remainingTime: config.windowMs }
  }

  const key = `ratelimit:${identifier}`
  const windowSeconds = Math.ceil(config.windowMs / 1000)

  try {
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }

    if (count > config.max) {
      const ttl = await redis.ttl(key)
      return {
        allowed: false,
        remainingTime: ttl > 0 ? ttl * 1000 : config.windowMs,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error(`Redis rate limit error for "${identifier}":`, error)
    if (fallbackRequest) {
      console.warn(`Using in-memory fallback for "${identifier}"`)
      return inMemoryRateLimit(fallbackRequest)
    }
    // 🔒 Fail-closed: si Redis est indisponible ET aucun fallback,
    // on refuse la requête par défaut pour ne pas bypasser le rate limiting
    return { allowed: false, remainingTime: config.windowMs }
  }
}

/**
 * Higher-order function to wrap API handlers with Redis rate limiting
 */
export function withRateLimitRedis<T extends (req: NextRequest) => Promise<NextResponse>>(
  handler: T
): T {
  return async function (req: NextRequest): Promise<NextResponse> {
    const rateLimitResult = await rateLimitRedis(req)

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.remainingTime || RATE_LIMIT_WINDOW_MS)
    }

    return handler(req)
  } as T
}
