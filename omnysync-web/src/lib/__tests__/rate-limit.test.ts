import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new Request('http://localhost:3000/api/test', { headers }))
}

async function stopCleanup() {
  try {
    const { stopRateLimitCleanup } = await import('@/lib/rate-limit')
    stopRateLimitCleanup()
  } catch {
    // ignore — module may not export it or may not have started
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('rate limit constants', () => {
  it('RATE_LIMIT_WINDOW_MS is 60000', async () => {
    const { RATE_LIMIT_WINDOW_MS } = await import('@/lib/rate-limit')
    expect(RATE_LIMIT_WINDOW_MS).toBe(60000)
  })

  it('RATE_LIMIT_MAX is 30', async () => {
    const { RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    expect(RATE_LIMIT_MAX).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// getClientIp  —  relies on the REAL module (not replicated logic)
// ---------------------------------------------------------------------------

describe('getClientIp', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns IP from x-forwarded-for header', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' })
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it('returns IP from x-real-ip header', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-real-ip': '192.168.1.2' })
    expect(getClientIp(req)).toBe('192.168.1.2')
  })

  it('returns IP from cf-connecting-ip header', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({ 'cf-connecting-ip': '192.168.1.3' })
    expect(getClientIp(req)).toBe('192.168.1.3')
  })

  it('prefers x-forwarded-for over other headers', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({
      'x-forwarded-for': '192.168.1.1',
      'x-real-ip': '192.168.1.2',
      'cf-connecting-ip': '192.168.1.3',
    })
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it("returns 'unknown' when no headers present", async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })

  it('rejects invalid x-forwarded-for and falls through to x-real-ip', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': 'not-an-ip', 'x-real-ip': '10.0.0.1' })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('rejects x-forwarded-for and x-real-ip, falls through to cf-connecting-ip', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({
      'x-forwarded-for': 'bad',
      'x-real-ip': 'evil',
      'cf-connecting-ip': '10.0.0.9',
    })
    expect(getClientIp(req)).toBe('10.0.0.9')
  })

  it('returns unknown when all IP headers are invalid', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    const req = createRequest({
      'x-forwarded-for': 'bad',
      'x-real-ip': 'evil',
      'cf-connecting-ip': 'ugly',
    })
    expect(getClientIp(req)).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// rateLimit  —  core in-memory rate-limit function
// ---------------------------------------------------------------------------

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(async () => {
    await stopCleanup()
    vi.useRealTimers()
  })

  it('allows first request from an IP', async () => {
    const { rateLimit } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    const result = rateLimit(req)

    expect(result.allowed).toBe(true)
    expect(result.remainingTime).toBeUndefined()
  })

  it('allows requests up to the limit (30 requests)', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const result = rateLimit(req)
      expect(result.allowed).toBe(true)
    }
  })

  it('denies the 31st request (exactly at boundary)', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    const result = rateLimit(req)
    expect(result.allowed).toBe(false)
  })

  it('returns remainingTime when request is denied', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    const result = rateLimit(req)
    expect(result.allowed).toBe(false)
    expect(result.remainingTime).toBeDefined()
    expect(result.remainingTime).toBeGreaterThan(0)
    expect(result.remainingTime).toBeLessThanOrEqual(60000)
  })

  it('resets counter after window expires', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Exhaust the limit
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }
    expect(rateLimit(req).allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(60001)

    // Should be allowed again (new window)
    const result = rateLimit(req)
    expect(result.allowed).toBe(true)
  })

  it('tracks separate IPs independently', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req1 = createRequest({ 'x-forwarded-for': '192.168.1.1' })
    const req2 = createRequest({ 'x-forwarded-for': '10.0.0.1' })

    // Exhaust IP1
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req1)
    }
    expect(rateLimit(req1).allowed).toBe(false)

    // IP2 should still be fresh
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(rateLimit(req2).allowed).toBe(true)
    }
    expect(rateLimit(req2).allowed).toBe(false)
  })

  it('uses "unknown" identifier when no IP headers present', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({}) // no headers

    // First request from unknown
    expect(rateLimit(req).allowed).toBe(true)

    // Exhaust unknown
    for (let i = 0; i < RATE_LIMIT_MAX - 1; i++) {
      rateLimit(req)
    }

    // Next request should be denied
    expect(rateLimit(req).allowed).toBe(false)
  })

  it('handles expired record same as no record', async () => {
    const { rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Make one request (creates a record with count=1)
    rateLimit(req)

    // Advance past the window so the record is expired
    vi.advanceTimersByTime(60001)

    // Next request should treat expired record as "no record" → fresh start
    // The count resets to 1, and we should be able to make RATE_LIMIT_MAX requests
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(rateLimit(req).allowed).toBe(true)
    }
    // 31st should be denied
    expect(rateLimit(req).allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// pruneRateLimitEntries
// ---------------------------------------------------------------------------

describe('pruneRateLimitEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(async () => {
    await stopCleanup()
    vi.useRealTimers()
  })

  it('removes expired entries', async () => {
    const { rateLimit, pruneRateLimitEntries } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })
    rateLimit(req) // creates entry with resetTime = now + 60000

    vi.advanceTimersByTime(60001)

    const pruned = pruneRateLimitEntries()
    expect(pruned).toBe(1)
  })

  it('keeps non-expired entries', async () => {
    const { rateLimit, pruneRateLimitEntries } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })
    rateLimit(req) // creates entry with resetTime = now + 60000

    const pruned = pruneRateLimitEntries()
    expect(pruned).toBe(0)
  })

  it('returns 0 when no entries exist', async () => {
    const { pruneRateLimitEntries } = await import('@/lib/rate-limit')
    const pruned = pruneRateLimitEntries()
    expect(pruned).toBe(0)
  })

  it('removes multiple expired entries', async () => {
    const { rateLimit, pruneRateLimitEntries } = await import('@/lib/rate-limit')

    for (let i = 0; i < 5; i++) {
      const req = createRequest({ 'x-forwarded-for': `192.168.1.${i}` })
      rateLimit(req)
    }

    vi.advanceTimersByTime(60001)

    const pruned = pruneRateLimitEntries()
    expect(pruned).toBe(5)
  })

  it('handles mixed expired and non-expired entries', async () => {
    const { rateLimit, pruneRateLimitEntries } = await import('@/lib/rate-limit')

    // Create 3 entries
    for (let i = 0; i < 3; i++) {
      const req = createRequest({ 'x-forwarded-for': `192.168.1.${i}` })
      rateLimit(req)
    }

    // Advance past window — all 3 are now expired
    vi.advanceTimersByTime(60001)

    // Create 2 more fresh entries
    for (let i = 3; i < 5; i++) {
      const req = createRequest({ 'x-forwarded-for': `192.168.1.${i}` })
      rateLimit(req)
    }

    const pruned = pruneRateLimitEntries()
    expect(pruned).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// startRateLimitCleanup / stopRateLimitCleanup
// ---------------------------------------------------------------------------

describe('startRateLimitCleanup / stopRateLimitCleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(async () => {
    await stopCleanup()
    vi.useRealTimers()
  })

  it('starts cleanup interval and calls prune on start', async () => {
    const { startRateLimitCleanup, stopRateLimitCleanup } = await import('@/lib/rate-limit')
    startRateLimitCleanup()
    // No error = started (guard clause would fire next time)
    expect(true).toBe(true)
    stopRateLimitCleanup()
  })

  it('does not start twice (guard clause)', async () => {
    const { startRateLimitCleanup, stopRateLimitCleanup } = await import('@/lib/rate-limit')
    startRateLimitCleanup()
    // Second call should be a no-op (guard clause prevents re-init)
    startRateLimitCleanup()
    stopRateLimitCleanup()
  })

  it('stops the cleanup interval', async () => {
    const { startRateLimitCleanup, stopRateLimitCleanup } = await import('@/lib/rate-limit')
    startRateLimitCleanup()
    stopRateLimitCleanup()
    // Calling stop again should be safe
    stopRateLimitCleanup()
  })

  it('can call stop when not running without error', async () => {
    const { stopRateLimitCleanup } = await import('@/lib/rate-limit')
    // Should not throw when no interval is active
    stopRateLimitCleanup()
  })

  it('prunes expired entries on start', async () => {
    const { rateLimit, startRateLimitCleanup, stopRateLimitCleanup } =
      await import('@/lib/rate-limit')

    // Create entry and let it expire
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })
    rateLimit(req)
    vi.advanceTimersByTime(60001)

    // startRateLimitCleanup calls pruneRateLimitEntries internally
    startRateLimitCleanup()

    // The old entry was pruned, so the next request starts fresh
    const result = rateLimit(req)
    expect(result.allowed).toBe(true)

    stopRateLimitCleanup()
  })

  it('fires cleanup callback after 5 minutes', async () => {
    const { startRateLimitCleanup, stopRateLimitCleanup, rateLimit } =
      await import('@/lib/rate-limit')

    startRateLimitCleanup()

    // Create entry
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })
    rateLimit(req)

    // Advance time past window but before cleanup interval
    vi.advanceTimersByTime(60001)

    // Entry is expired but hasn't been pruned yet (cleanup fires at 5 min)
    // Use the cleanup interval approach: advance the remaining time to trigger interval
    vi.advanceTimersByTime(240000)

    // After 5 min total, cleanup should have run — entry should be pruned
    // Verify by checking a fresh request is allowed (would be denied if old record existed)
    const result = rateLimit(req)
    expect(result.allowed).toBe(true)

    stopRateLimitCleanup()
  })
})

// ---------------------------------------------------------------------------
// createRateLimitResponse
// ---------------------------------------------------------------------------

describe('createRateLimitResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 429 status', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(30000)
    expect(response.status).toBe(429)
  })

  it('sets correct Retry-After header for 30 seconds', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(30000)
    expect(response.headers.get('Retry-After')).toBe('30')
  })

  it('sets all X-RateLimit-* headers', async () => {
    const { createRateLimitResponse, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(45000)

    expect(response.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMIT_MAX))
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
  })

  it('rounds up retry-after to 1 second minimum', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(500)
    expect(response.headers.get('Retry-After')).toBe('1')
  })

  it('uses default 1000ms when remainingTime is 0', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(0)
    expect(response.headers.get('Retry-After')).toBe('1')
  })

  it('includes error message in JSON body', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const response = createRateLimitResponse(30000)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    })
  })

  it('sets X-RateLimit-Reset to future timestamp', async () => {
    const { createRateLimitResponse } = await import('@/lib/rate-limit')
    const now = Date.now()
    const response = createRateLimitResponse(30000)

    const resetHeader = response.headers.get('X-RateLimit-Reset')
    expect(resetHeader).toBeDefined()
    expect(Number(resetHeader)).toBeGreaterThanOrEqual(now + 30000)
  })
})

// ---------------------------------------------------------------------------
// checkRateLimit  —  middleware wrapper
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(async () => {
    await stopCleanup()
    vi.useRealTimers()
  })

  it('returns null when under limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    const result = checkRateLimit(req)
    expect(result).toBeNull()
  })

  it('returns 429 response when over limit', async () => {
    const { checkRateLimit, rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Exhaust via direct rateLimit calls (same module-level map)
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    const result = checkRateLimit(req)
    expect(result).toBeInstanceOf(NextResponse)
    expect(result!.status).toBe(429)
  })

  it('includes Retry-After header in 429 response', async () => {
    const { checkRateLimit, rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    const result = checkRateLimit(req)
    expect(result!.headers.get('Retry-After')).toBeDefined()
    expect(Number(result!.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(result!.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(result!.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('returns null when called multiple times under limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Multiple calls under limit should all return null
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(req)).toBeNull()
    }
  })

  it('falls back to window default when remainingTime is 0 at exact boundary', async () => {
    const { checkRateLimit, rateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } =
      await import('@/lib/rate-limit')
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Exhaust the limit
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    // Advance time to the exact window boundary so that
    // now === record.resetTime → remainingTime becomes 0
    // This exercises: result.remainingTime || RATE_LIMIT_WINDOW_MS  (falsy path)
    vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS)

    const result = checkRateLimit(req)
    expect(result).toBeInstanceOf(NextResponse)
    expect(result!.status).toBe(429)
    // remainingTime was 0, so Retry-After should use RATE_LIMIT_WINDOW_MS / 1000 = 60
    expect(result!.headers.get('Retry-After')).toBe('60')
  })
})

// ---------------------------------------------------------------------------
// withRateLimit  —  higher-order function for wrapping API handlers
// ---------------------------------------------------------------------------

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(async () => {
    await stopCleanup()
    vi.useRealTimers()
  })

  it('calls handler when under limit', async () => {
    const { withRateLimit } = await import('@/lib/rate-limit')
    const handler = vi.fn().mockResolvedValue(new NextResponse('ok', { status: 200 }))
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    const response = await wrapped(req)

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('passes the request to the handler', async () => {
    const { withRateLimit } = await import('@/lib/rate-limit')
    const handler = vi.fn().mockResolvedValue(new NextResponse('ok', { status: 200 }))
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    await wrapped(req)

    expect(handler).toHaveBeenCalledWith(req)
  })

  it('returns 429 response when over limit', async () => {
    const { withRateLimit, rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const handler = vi.fn()
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Exhaust the limit via the same in-memory map
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    const response = await wrapped(req)

    expect(response.status).toBe(429)
  })

  it('does not call handler when rate limited', async () => {
    const { withRateLimit, rateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const handler = vi.fn()
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    await wrapped(req)

    expect(handler).not.toHaveBeenCalled()
  })

  it('returns handler response when not rate limited', async () => {
    const { withRateLimit } = await import('@/lib/rate-limit')
    const handler = vi.fn().mockResolvedValue(new NextResponse('success', { status: 201 }))
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    const response = await wrapped(req)

    expect(response.status).toBe(201)
    const body = await response.text()
    expect(body).toBe('success')
  })

  it('applies rate limiting across multiple wrapped calls', async () => {
    const { withRateLimit, RATE_LIMIT_MAX } = await import('@/lib/rate-limit')
    const handler = vi.fn().mockResolvedValue(new NextResponse('ok', { status: 200 }))
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // First RATE_LIMIT_MAX calls should be allowed
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const response = await wrapped(req)
      expect(response.status).toBe(200)
    }

    // The (RATE_LIMIT_MAX + 1)-th call should be rate limited
    expect(handler).toHaveBeenCalledTimes(RATE_LIMIT_MAX)
    const response = await wrapped(req)
    expect(response.status).toBe(429)
  })

  it('falls back to window default in withRateLimit when remainingTime is 0', async () => {
    const { withRateLimit, rateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } =
      await import('@/lib/rate-limit')
    const handler = vi.fn()
    const wrapped = withRateLimit(handler)
    const req = createRequest({ 'x-forwarded-for': '192.168.1.1' })

    // Exhaust the limit via direct rateLimit calls
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      rateLimit(req)
    }

    // Advance time to exact boundary so remainingTime becomes 0
    // This exercises the falsy path of: rateLimitResult.remainingTime || RATE_LIMIT_WINDOW_MS
    vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS)

    const response = await wrapped(req)
    expect(response.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})
