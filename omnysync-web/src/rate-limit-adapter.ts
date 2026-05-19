import type { NextRequest } from 'next/server'
import {
  rateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  startRateLimitCleanup,
} from '@omnysync/core/rate-limit'

const API_RATE_LIMIT = 30

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  return realIp ?? request.headers.get('cf-connecting-ip') ?? 'unknown'
}

export async function checkRateLimit(request: NextRequest): Promise<Response | null> {
  startRateLimitCleanup()
  const ip = getClientIp(request)
  const result = rateLimit(ip)
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.remainingTime || API_RATE_LIMIT) / 1000)
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(API_RATE_LIMIT),
        'X-RateLimit-Remaining': '0',
      },
    })
  }
  return null
}
