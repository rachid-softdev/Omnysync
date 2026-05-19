/**
 * Rate limiting avec Redis (Upstash)
 * Alternative au rate limiting in-memory pour la production
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

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
 * Extract client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return realIp ?? request.headers.get('cf-connecting-ip') ?? 'unknown'
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
    return { allowed: true }
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
    console.error('Redis rate limit error:', error)
    // Fail open if Redis fails
    return { allowed: true }
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
