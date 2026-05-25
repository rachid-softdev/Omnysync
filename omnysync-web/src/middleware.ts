import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  rateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getClientIp,
  startRateLimitCleanup,
} from '@/lib/rate-limit'

/**
 * Global middleware for rate limiting
 * Applies to all /api/* routes
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Start cleanup for rate limit entries
  startRateLimitCleanup()

  // Check rate limit via imported function (not dynamic import)
  const result = rateLimit(request)
  const now = Date.now()

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.remainingTime || RATE_LIMIT_WINDOW_MS) / 1000)

    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(now + (result.remainingTime || RATE_LIMIT_WINDOW_MS)),
        },
      }
    )
  }

  return NextResponse.next()
}

/**
 * Configure which paths the middleware applies to
 */
export const config = {
  matcher: '/api/:path*',
}
