import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimitRedis } from '@/lib/rate-limit-redis'

/**
 * Global middleware for rate limiting and CORS preflight
 * Uses Redis (Upstash) with automatic fallback to allow-all if Redis unavailable
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Handle CORS preflight (OPTIONS) - respond immediately with CORS headers
  if (request.method === 'OPTIONS') {
    const origin = process.env.NODE_ENV === 'production' ? 'https://omnysync.app' : '*'
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

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
