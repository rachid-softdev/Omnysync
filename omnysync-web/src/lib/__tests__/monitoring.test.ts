/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Sentry before importing the module
const mockSentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
  setTags: vi.fn(),
  addBreadcrumb: vi.fn(),
  startInactiveSpan: vi.fn(() => ({
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  })),
  startSpan: vi.fn((_opts: any, cb: any) => cb()),
  httpIntegration: vi.fn(() => ({}) as any),
}))

vi.mock('@sentry/nextjs', () => mockSentry)

// Mock health check dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

const mockRedisInstance = vi.hoisted(() => ({ ping: vi.fn() }))
vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      ping = mockRedisInstance.ping
    },
  }
})

const mockModelsList = vi.hoisted(() => vi.fn())
const mockOpenAI = vi.hoisted(() => {
  return class {
    models = { list: mockModelsList }
  }
})
vi.mock('openai', () => ({
  default: mockOpenAI,
}))

import {
  initMonitoring,
  captureError,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  withMonitoring,
  withAPIMonitoring,
  measurePerformance,
  startSpan,
  healthCheck,
} from '../monitoring'

describe('initMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('initializes Sentry when SENTRY_DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('npm_package_version', '1.0.0')

    initMonitoring()

    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/project',
        tracesSampleRate: 0.1,
        environment: 'production',
        release: '1.0.0',
      })
    )
  })

  it('uses 1.0 tracesSampleRate in development', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    vi.stubEnv('NODE_ENV', 'development')

    initMonitoring()

    expect(mockSentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 1.0 }))
  })

  it('does not initialize Sentry when SENTRY_DSN is not set', () => {
    vi.stubEnv('SENTRY_DSN', '')

    initMonitoring()

    expect(mockSentry.init).not.toHaveBeenCalled()
  })

  it('integrates httpIntegration', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    initMonitoring()

    expect(mockSentry.httpIntegration).toHaveBeenCalled()
  })
})

describe('captureError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures an exception with Sentry', () => {
    const error = new Error('Test error')
    captureError(error)

    expect(mockSentry.captureException).toHaveBeenCalledWith(error)
  })

  it('sets context when provided', () => {
    const error = new Error('Test error')
    const context = { component: 'TestComponent', action: 'render' }

    captureError(error, context)

    expect(mockSentry.setContext).toHaveBeenCalledWith('additional', context)
    expect(mockSentry.captureException).toHaveBeenCalledWith(error)
  })

  it('does not set context when not provided', () => {
    const error = new Error('Test error')

    captureError(error)

    expect(mockSentry.setContext).not.toHaveBeenCalled()
  })
})

describe('captureMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures a message with default level', () => {
    captureMessage('Test message')

    expect(mockSentry.captureMessage).toHaveBeenCalledWith('Test message', 'info')
  })

  it('captures a message with custom level', () => {
    captureMessage('Warning message', 'warning')

    expect(mockSentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning')
  })

  it('captures a message with error level', () => {
    captureMessage('Error message', 'error')

    expect(mockSentry.captureMessage).toHaveBeenCalledWith('Error message', 'error')
  })
})

describe('setUser / clearUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets user context with all fields', () => {
    setUser('user-123', 'test@example.com', '192.168.1.1')

    expect(mockSentry.setUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'test@example.com',
      ip_address: '192.168.1.1',
    })
  })

  it('sets user context with only id', () => {
    setUser('user-123')

    expect(mockSentry.setUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: undefined,
      ip_address: undefined,
    })
  })

  it('clears user context', () => {
    clearUser()

    expect(mockSentry.setUser).toHaveBeenCalledWith(null)
  })

  it('clears user after previously being set', () => {
    setUser('user-456', 'prev@example.com')
    expect(mockSentry.setUser).toHaveBeenCalledWith({
      id: 'user-456',
      email: 'prev@example.com',
      ip_address: undefined,
    })

    clearUser()
    expect(mockSentry.setUser).toHaveBeenCalledWith(null)
    // setUser should have been called twice: once with user, once with null
    expect(mockSentry.setUser).toHaveBeenCalledTimes(2)
  })

  it('can be called multiple times without error', () => {
    expect(() => {
      clearUser()
      clearUser()
      clearUser()
    }).not.toThrow()

    expect(mockSentry.setUser).toHaveBeenCalledTimes(3)
    expect(mockSentry.setUser).toHaveBeenCalledWith(null)
  })
})

describe('addBreadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds a breadcrumb with category and message', () => {
    addBreadcrumb('auth', 'User logged in')

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'User logged in',
      data: undefined,
      level: 'info',
    })
  })

  it('adds a breadcrumb with data', () => {
    addBreadcrumb('api', 'Request processed', { method: 'GET', status: 200 })

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'Request processed',
      data: { method: 'GET', status: 200 },
      level: 'info',
    })
  })
})

describe('withMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps a function with span and returns result', async () => {
    const fn = vi.fn().mockResolvedValue('result')

    const result = await withMonitoring(fn, { name: 'test-op' })

    expect(result).toBe('result')
    expect(mockSentry.startInactiveSpan).toHaveBeenCalledWith({
      name: 'test-op',
      op: 'function',
      forceTransaction: true,
    })
  })

  it('sets tags when provided', async () => {
    const fn = vi.fn().mockResolvedValue('result')

    await withMonitoring(fn, { tags: { region: 'eu-west' } })

    expect(mockSentry.setTags).toHaveBeenCalledWith({ region: 'eu-west' })
  })

  it('captures error and re-throws', async () => {
    const error = new Error('Operation failed')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withMonitoring(fn, { name: 'fail-op' })).rejects.toThrow('Operation failed')

    expect(mockSentry.captureException).toHaveBeenCalledWith(error)
  })

  it('ends span in finally block', async () => {
    const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() }
    mockSentry.startInactiveSpan.mockReturnValueOnce(mockSpan)
    const fn = vi.fn().mockResolvedValue('done')

    await withMonitoring(fn)

    expect(mockSpan.end).toHaveBeenCalled()
  })

  it('uses "unknown" as default span name', async () => {
    const fn = vi.fn().mockResolvedValue('result')

    await withMonitoring(fn)

    expect(mockSentry.startInactiveSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'unknown' })
    )
  })

  it('sets span status to ok on success', async () => {
    const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() }
    mockSentry.startInactiveSpan.mockReturnValueOnce(mockSpan)
    const fn = vi.fn().mockResolvedValue('success')

    await withMonitoring(fn, { name: 'success-op' })

    expect(mockSpan.setStatus).toHaveBeenCalledWith('ok')
  })

  it('sets span status to internal_error on function failure', async () => {
    const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() }
    mockSentry.startInactiveSpan.mockReturnValueOnce(mockSpan)
    const error = new Error('Operation failed')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withMonitoring(fn, { name: 'fail-op' })).rejects.toThrow('Operation failed')

    expect(mockSpan.setStatus).toHaveBeenCalledWith('internal_error')
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('error', 'Operation failed')
  })
})

describe('withAPIMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps handler and adds breadcrumb on success (GET)', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = withAPIMonitoring(handler)
    const req = new Request('http://localhost/api/test', { method: 'GET' })

    await wrapped(req)

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'GET /api/test',
      data: expect.objectContaining({ status: 200 }),
      level: 'info',
    })
  })

  it('wraps handler and adds breadcrumb on success (PUT)', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('updated', { status: 200 }))
    const wrapped = withAPIMonitoring(handler)
    const req = new Request('http://localhost/api/resource/1', { method: 'PUT' })

    await wrapped(req)

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'PUT /api/resource/1',
      data: expect.objectContaining({ status: 200 }),
      level: 'info',
    })
  })

  it('wraps handler and adds breadcrumb on success (DELETE)', async () => {
    const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const wrapped = withAPIMonitoring(handler)
    const req = new Request('http://localhost/api/resource/1', { method: 'DELETE' })

    await wrapped(req)

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'DELETE /api/resource/1',
      data: expect.objectContaining({ status: 200 }),
      level: 'info',
    })
  })

  it('wraps handler and adds breadcrumb on success (PATCH)', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('patched', { status: 200 }))
    const wrapped = withAPIMonitoring(handler)
    const req = new Request('http://localhost/api/resource/1', { method: 'PATCH' })

    await wrapped(req)

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'PATCH /api/resource/1',
      data: expect.objectContaining({ status: 200 }),
      level: 'info',
    })
  })

  it('captures error and re-throws on failure', async () => {
    const error = new Error('Handler failed')
    const handler = vi.fn().mockRejectedValue(error)
    const wrapped = withAPIMonitoring(handler)
    const req = new Request('http://localhost/api/test', { method: 'POST' })

    await expect(wrapped(req)).rejects.toThrow('Handler failed')

    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'api',
      message: 'POST /api/test',
      data: expect.objectContaining({ status: 'error' }),
      level: 'info',
    })
    expect(mockSentry.setContext).toHaveBeenCalledWith('additional', {
      method: 'POST',
      path: '/api/test',
      duration: expect.any(Number),
    })
    expect(mockSentry.captureException).toHaveBeenCalledWith(error)
  })
})

describe('measurePerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('measures and returns function result', async () => {
    const fn = vi.fn().mockResolvedValue('fast-result')

    const result = await measurePerformance('fast-op', fn)

    expect(result).toBe('fast-result')
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'performance',
      message: 'fast-op completed',
      data: { duration: expect.any(Number) },
      level: 'info',
    })
  })

  it('captures warning for slow operations (> 1000ms)', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.resolve())

    const originalDateNow = Date.now
    let callCount = 0
    Date.now = vi.fn(() => {
      callCount++
      return callCount === 1 ? 1000 : 2500
    })

    try {
      await measurePerformance('slow-op', fn)
      expect(mockSentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation: slow-op took'),
        'warning'
      )
    } finally {
      Date.now = originalDateNow
    }
  })

  it('does not capture warning for fast operations', async () => {
    const fn = vi.fn().mockResolvedValue('result')

    const originalDateNow = Date.now
    Date.now = vi.fn(() => 1000)

    try {
      await measurePerformance('fast-op', fn)
      expect(mockSentry.captureMessage).not.toHaveBeenCalled()
    } finally {
      Date.now = originalDateNow
    }
  })
})

describe('startSpan', () => {
  it('starts a Sentry span', () => {
    startSpan('test-span', 'custom-op')

    expect(mockSentry.startSpan).toHaveBeenCalledWith(
      { name: 'test-span', op: 'custom-op' },
      expect.any(Function)
    )
  })
})

describe('healthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns healthy when all checks pass', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    mockRedisInstance.ping.mockResolvedValue('PONG')
    mockModelsList.mockResolvedValue({ data: [] })

    // Set env vars for Redis and OpenAI checks
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const result = await healthCheck()

    expect(result.status).toBe('healthy')
    expect(result.checks.database).toBe(true)
    expect(result.checks.redis).toBe(true)
    expect(result.checks.openai).toBe(true)
    expect(result.timestamp).toBeDefined()
  })

  it('returns unhealthy when all checks fail', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB down'))

    mockRedisInstance.ping.mockRejectedValue(new Error('Redis down'))
    mockModelsList.mockRejectedValue(new Error('Openai down'))

    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const result = await healthCheck()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.database).toBe(false)
    expect(result.checks.redis).toBe(false)
    expect(result.checks.openai).toBe(false)
  })

  it('skips Redis check when not configured', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await healthCheck()

    expect(result.checks.database).toBe(true)
    expect(result.checks.redis).toBe(false)
    expect(result.checks.openai).toBe(false)
  })

  it('skips OpenAI check when not configured', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await healthCheck()

    expect(result.checks.openai).toBe(false)
  })

  it('returns unhealthy with mixed results (DB passes, Redis fails, OpenAI passes)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    mockRedisInstance.ping.mockRejectedValue(new Error('Redis timeout'))
    mockModelsList.mockResolvedValue({ data: [] })

    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const result = await healthCheck()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.database).toBe(true)
    expect(result.checks.redis).toBe(false)
    expect(result.checks.openai).toBe(true)
  })

  it('returns unhealthy when only database passes (Redis/OpenAI not configured)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await healthCheck()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.database).toBe(true)
    expect(result.checks.redis).toBe(false)
    expect(result.checks.openai).toBe(false)
  })
})
