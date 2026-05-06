import { NextRequest, NextResponse } from "next/server"

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 30 // requests per window

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(request: NextRequest) {
  const ip = request.ip ?? request.headers.get("x-forwarded-for") ?? "unknown"
  const now = Date.now()
  
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true }
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remainingTime: record.resetTime - now }
  }
  
  record.count++
  return { allowed: true }
}

export function withRateLimit(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(req: NextRequest) {
    const { allowed, remainingTime } = rateLimit(req)
    
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil(remainingTime / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil(remainingTime / 1000)) } }
      )
    }
    
    return handler(req)
  }
}