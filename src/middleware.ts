import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, getClientIp, startRateLimitCleanup } from "@/lib/rate-limit"

// Rate limit configuration
const API_RATE_LIMIT = 30 // requests per window
const API_RATE_WINDOW = 60 * 1000 // 1 minute

/**
 * Global middleware for rate limiting
 * Applies to all /api/* routes
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Start cleanup for rate limit entries
  startRateLimitCleanup()

  // Check rate limit
  const ip = getClientIp(request)
  const now = Date.now()

  // Simple in-memory rate limiting for middleware
  // Note: For production with multiple instances, use Redis (@upstash/ratelimit)
  const key = `middleware:${ip}`
  
  // Import and use the rate limit logic from rate-limit.ts
  const { default: { rateLimit: RL } } = await import("@/lib/rate-limit")
  const result = RL(request)

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.remainingTime || API_RATE_WINDOW) / 1000)
    
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", message: "Rate limit exceeded. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(API_RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(now + (result.remainingTime || API_RATE_WINDOW)),
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
  matcher: "/api/:path*",
}