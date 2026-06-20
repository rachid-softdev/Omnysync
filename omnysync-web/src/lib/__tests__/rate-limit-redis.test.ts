import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set env vars BEFORE module evaluation
vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
})

// Mock Redis
const mockRedis = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
}))

vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      incr = mockRedis.incr
      expire = mockRedis.expire
      ttl = mockRedis.ttl
      del = mockRedis.del
      keys = mockRedis.keys
    },
  }
})

// Mock the in-memory rate-limit module
const mockInMemoryRateLimit = vi.hoisted(() => vi.fn().mockResolvedValue({ allowed: true }))
const mockIsValidIp = vi.hoisted(() => vi.fn())

const mockGetClientIpMemory = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockInMemoryRateLimit,
  getClientIp: mockGetClientIpMemory,
  isValidIp: mockIsValidIp,
}))

import { NextRequest, NextResponse } from 'next/server'

describe('rate-limit-redis - getClientIp', () => {
  async function getClientIp(request: NextRequest): Promise<string> {
    const { getClientIp: getIp } = await import('../rate-limit-redis')
    return getIp(request)
  }

  beforeEach(() => {
    mockIsValidIp.mockReset()
  })

  it('extracts valid IP from x-forwarded-for', async () => {
    mockIsValidIp.mockReturnValue(true)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.42, 10.0.0.1' },
      })
    )

    const ip = await getClientIp(request)
    expect(ip).toBe('192.168.1.42')
  })

  it('rejects invalid x-forwarded-for and falls through', async () => {
    mockIsValidIp.mockReturnValueOnce(false).mockReturnValueOnce(true)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: {
          'x-forwarded-for': 'invalid-ip',
          'x-real-ip': '10.0.0.1',
        },
      })
    )

    const ip = await getClientIp(request)
    expect(ip).toBe('10.0.0.1')
  })

  it('falls back to x-real-ip', async () => {
    mockIsValidIp.mockReturnValue(true)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      })
    )

    const ip = await getClientIp(request)
    expect(ip).toBe('10.0.0.1')
  })

  it('falls back to cf-connecting-ip', async () => {
    mockIsValidIp.mockReturnValue(true)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'cf-connecting-ip': '203.0.113.5' },
      })
    )

    const ip = await getClientIp(request)
    expect(ip).toBe('203.0.113.5')
  })

  it('returns "unknown" when no valid IP found', async () => {
    mockIsValidIp.mockReturnValue(false)
    const request = new NextRequest(new Request('http://localhost'))

    const ip = await getClientIp(request)
    expect(ip).toBe('unknown')
  })

  it('prefers x-forwarded-for over other headers', async () => {
    mockIsValidIp.mockReturnValue(true)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '10.0.0.1',
          'cf-connecting-ip': '203.0.113.5',
        },
      })
    )

    const ip = await getClientIp(request)
    expect(ip).toBe('192.168.1.1')
  })
})

describe('rateLimitRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows request within limit (count <= max)', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(5)

    const { rateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await rateLimitRedis(request)

    expect(result.allowed).toBe(true)
  })

  it('allows request exactly at the limit boundary (count === RATE_LIMIT_MAX)', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(30)

    const { rateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await rateLimitRedis(request)

    // count === 30, RATE_LIMIT_MAX === 30, condition is count > 30, so this is allowed
    expect(result.allowed).toBe(true)
  })

  it('denies request when count exceeds limit', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(31)
    mockRedis.ttl.mockResolvedValue(30)

    const { rateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await rateLimitRedis(request)

    expect(result.allowed).toBe(false)
    expect(result.remainingTime).toBe(30 * 1000)
  })

  it('uses windowMs as remainingTime when TTL is -1 (no expiry)', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(31)
    mockRedis.ttl.mockResolvedValue(-1)

    const { rateLimitRedis, RATE_LIMIT_WINDOW_MS } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await rateLimitRedis(request)

    expect(result.allowed).toBe(false)
    expect(result.remainingTime).toBe(RATE_LIMIT_WINDOW_MS)
  })

  it('tracks rate limits separately for different IPs', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(1)

    const { rateLimitRedis } = await import('../rate-limit-redis')

    const req1 = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )
    await rateLimitRedis(req1)

    const req2 = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })
    )
    await rateLimitRedis(req2)

    // First call used IP 192.168.1.1
    expect(mockRedis.incr).toHaveBeenNthCalledWith(1, 'ratelimit:192.168.1.1')
    // Second call used IP 10.0.0.1
    expect(mockRedis.incr).toHaveBeenNthCalledWith(2, 'ratelimit:10.0.0.1')
    // Expire was called for both keys
    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:192.168.1.1', 60)
    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:10.0.0.1', 60)
  })

  it('sets expiration on first request (count === 1)', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(1)

    const { rateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    await rateLimitRedis(request)

    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:192.168.1.1', 60)
  })

  it('falls back to in-memory on Redis error', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockRejectedValue(new Error('Redis down'))
    mockInMemoryRateLimit.mockResolvedValueOnce({ allowed: true })

    const { rateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await rateLimitRedis(request)

    expect(result.allowed).toBe(true)
    expect(mockInMemoryRateLimit).toHaveBeenCalledWith(request)
  })
})

describe('createRateLimitResponse', () => {
  it('returns 429 response with headers', async () => {
    const { createRateLimitResponse, RATE_LIMIT_MAX } = await import('../rate-limit-redis')
    const response = createRateLimitResponse(30000)

    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    })
  })

  it('sets Retry-After header', async () => {
    const { createRateLimitResponse } = await import('../rate-limit-redis')
    const response = createRateLimitResponse(30000)

    expect(response.headers.get('Retry-After')).toBe('30')
  })

  it('sets rate limit headers', async () => {
    const { createRateLimitResponse, RATE_LIMIT_MAX } = await import('../rate-limit-redis')
    const response = createRateLimitResponse(45000)

    expect(response.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMIT_MAX))
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
  })

  it('rounds up retry-after to 1 second minimum', async () => {
    const { createRateLimitResponse } = await import('../rate-limit-redis')
    const response = createRateLimitResponse(500)

    expect(response.headers.get('Retry-After')).toBe('1')
  })
})

describe('checkRateLimitRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when allowed', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(1)

    const { checkRateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await checkRateLimitRedis(request)
    expect(result).toBeNull()
  })

  it('returns 429 response when denied', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(31)
    mockRedis.ttl.mockResolvedValue(30)

    const { checkRateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await checkRateLimitRedis(request)
    expect(result).toBeInstanceOf(NextResponse)
    expect(result!.status).toBe(429)
  })

  it('falls back to in-memory when Redis fails', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockRejectedValue(new Error('Redis connection error'))
    mockInMemoryRateLimit.mockResolvedValueOnce({ allowed: true })

    const { checkRateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await checkRateLimitRedis(request)

    // In-memory fallback allowed the request
    expect(result).toBeNull()
    expect(mockInMemoryRateLimit).toHaveBeenCalledWith(request)
  })

  it('returns 429 when Redis fails and in-memory fallback also denies', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockRejectedValue(new Error('Redis connection error'))
    mockInMemoryRateLimit.mockResolvedValueOnce({ allowed: false, remainingTime: 30000 })

    const { checkRateLimitRedis } = await import('../rate-limit-redis')
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const result = await checkRateLimitRedis(request)

    expect(result).toBeInstanceOf(NextResponse)
    expect(result!.status).toBe(429)
  })
})

describe('rateLimitRedisWithConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows request within custom limit', async () => {
    mockRedis.incr.mockResolvedValue(5)

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')

    const result = await rateLimitRedisWithConfig('user-123', { max: 10, windowMs: 60000 })

    expect(result.allowed).toBe(true)
  })

  it('denies request when custom limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(11)
    mockRedis.ttl.mockResolvedValue(30)

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')

    const result = await rateLimitRedisWithConfig('endpoint-x', { max: 10, windowMs: 60000 })

    expect(result.allowed).toBe(false)
    expect(result.remainingTime).toBe(30 * 1000)
  })

  it('sets expiration on first request', async () => {
    mockRedis.incr.mockResolvedValue(1)

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')

    await rateLimitRedisWithConfig('api-key-1', { max: 100, windowMs: 60 * 1000 })

    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:api-key-1', 60)
  })

  afterEach(() => {
    // Restore env and reset module cache so subsequent tests get Redis back
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('fail-closed when Redis unavailable and no fallback', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.resetModules()

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')

    const result = await rateLimitRedisWithConfig('unknown', { max: 10, windowMs: 60000 })

    expect(result.allowed).toBe(false)
    expect(result.remainingTime).toBe(60000)
  })

  it('falls back to in-memory when fallbackRequest provided', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    mockInMemoryRateLimit.mockResolvedValueOnce({ allowed: true })
    vi.resetModules()

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')
    const request = new NextRequest(new Request('http://localhost'))

    const result = await rateLimitRedisWithConfig(
      'fallback-test',
      { max: 10, windowMs: 60000 },
      request
    )

    expect(result.allowed).toBe(true)
    expect(mockInMemoryRateLimit).toHaveBeenCalledWith(request)
  })

  it('falls back to in-memory on Redis error when fallbackRequest provided', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis error'))
    mockInMemoryRateLimit.mockResolvedValueOnce({ allowed: true })

    const { rateLimitRedisWithConfig } = await import('../rate-limit-redis')
    const request = new NextRequest(new Request('http://localhost'))

    const result = await rateLimitRedisWithConfig('user-1', { max: 10, windowMs: 60000 }, request)

    expect(result.allowed).toBe(true)
  })
})

describe('withRateLimitRedis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls handler when rate limit allowed', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(1)

    const { withRateLimitRedis } = await import('../rate-limit-redis')
    const handler = vi.fn().mockResolvedValue(new NextResponse('ok', { status: 200 }))
    const wrapped = withRateLimitRedis(handler)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const response = await wrapped(request)

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledWith(request)
  })

  it('returns 429 when rate limited', async () => {
    mockIsValidIp.mockReturnValue(true)
    mockRedis.incr.mockResolvedValue(31)
    mockRedis.ttl.mockResolvedValue(30)

    const { withRateLimitRedis } = await import('../rate-limit-redis')
    const handler = vi.fn()
    const wrapped = withRateLimitRedis(handler)
    const request = new NextRequest(
      new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const response = await wrapped(request)

    expect(response.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('constants', () => {
  it('RATE_LIMIT_WINDOW_MS is 60 seconds', async () => {
    const { RATE_LIMIT_WINDOW_MS } = await import('../rate-limit-redis')
    expect(RATE_LIMIT_WINDOW_MS).toBe(60000)
  })

  it('RATE_LIMIT_MAX is 30', async () => {
    const { RATE_LIMIT_MAX } = await import('../rate-limit-redis')
    expect(RATE_LIMIT_MAX).toBe(30)
  })
})
