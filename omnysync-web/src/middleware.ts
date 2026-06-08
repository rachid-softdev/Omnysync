import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimitRedis } from '@/lib/rate-limit-redis'

/**
 * Global middleware for rate limiting
 * Uses Redis (Upstash) with automatic fallback to allow-all if Redis unavailable
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Use Redis rate limit with fallback (handled internally by checkRateLimitRedis)
  const response = await checkRateLimitRedis(request)

  if (response) {
    return response // 429 Too Many Requests
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
