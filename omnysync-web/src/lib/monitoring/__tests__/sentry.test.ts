/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Sentry before importing
const mockSentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => mockSentry)

import {
  initSentry,
  captureError,
  captureMessage,
  setContext,
  setUser,
  setTag,
  capturePromiseError,
  withSentryCapture,
} from '../sentry'

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('initializes Sentry when SENTRY_DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    vi.stubEnv('NODE_ENV', 'production')

    initSentry()

    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/project',
        tracesSampleRate: 0.1,
      })
    )
  })

  it('uses tracesSampleRate 1.0 in development', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    vi.stubEnv('NODE_ENV', 'development')

    initSentry()

    expect(mockSentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 1.0 }))
  })

  it('filters out health check transactions in beforeSendTransaction', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    initSentry()

    const initCall = mockSentry.init.mock.calls[0][0]
    const beforeSend = initCall.beforeSendTransaction

    expect(beforeSend({ transaction: '/api/health' } as any)).toBeNull()
    expect(beforeSend({ transaction: '/api/health/check' } as any)).toBeNull()
    expect(beforeSend({ transaction: '/api/users' } as any)).toEqual({ transaction: '/api/users' })
  })

  it('skips initialization when SENTRY_DSN is not set', () => {
    vi.stubEnv('SENTRY_DSN', '')

    initSentry()

    expect(mockSentry.init).not.toHaveBeenCalled()
  })

  it('sets initial scope tags', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    initSentry()

    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        initialScope: {
          tags: { app: 'omnysync' },
        },
      })
    )
  })

  it('ignores common network errors', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    initSentry()

    const initCall = mockSentry.init.mock.calls[0][0]
    const ignoreErrors = initCall.ignoreErrors

    expect(ignoreErrors).toContainEqual(/Network Error/)
    expect(ignoreErrors).toContainEqual(/fetch failed/)
    expect(ignoreErrors).toContainEqual(/Failed to fetch/)
    expect(ignoreErrors).toContain('ResizeObserver loop limit exceeded')
  })
})

describe('captureError (sentry module)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('captures exception with context when DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    const error = new Error('Test error')
    captureError(error, { requestId: 'req-123' })

    expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
      extra: { requestId: 'req-123' },
    })
  })

  it('logs to console when DSN is not set', () => {
    vi.stubEnv('SENTRY_DSN', '')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const error = new Error('Test error')
    captureError(error, { extra: 'info' })

    expect(consoleSpy).toHaveBeenCalledWith('Error:', error, { extra: 'info' })
    expect(mockSentry.captureException).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('captures exception without context when DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    const error = new Error('Simple error')
    captureError(error)

    expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
      extra: undefined,
    })
  })
})

describe('captureMessage (sentry module)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('captures message with level and context when DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    captureMessage('Test message', 'warning', { userId: 'user-1' })

    expect(mockSentry.captureMessage).toHaveBeenCalledWith('Test message', {
      level: 'warning',
      extra: { userId: 'user-1' },
    })
  })

  it('logs to console when DSN is not set', () => {
    vi.stubEnv('SENTRY_DSN', '')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    captureMessage('Info message', 'info', { tag: 'test' })

    expect(consoleSpy).toHaveBeenCalledWith('[info]', 'Info message', { tag: 'test' })
    expect(mockSentry.captureMessage).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('uses info as default level', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    captureMessage('Default level message')

    expect(mockSentry.captureMessage).toHaveBeenCalledWith('Default level message', {
      level: 'info',
      extra: undefined,
    })
  })

  it('accepts all severity levels', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')

    const levels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const
    for (const level of levels) {
      captureMessage(`Level ${level}`, level)
      expect(mockSentry.captureMessage).toHaveBeenCalledWith(
        `Level ${level}`,
        expect.objectContaining({ level })
      )
      vi.clearAllMocks()
    }
  })
})

describe('setContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets context data in Sentry', () => {
    setContext('user', { id: 'user-1', plan: 'pro' })

    expect(mockSentry.setContext).toHaveBeenCalledWith('user', { id: 'user-1', plan: 'pro' })
  })
})

describe('setUser (sentry module)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets user with id, email and username', () => {
    setUser({ id: 'user-1', email: 'test@example.com', username: 'tester' })

    expect(mockSentry.setUser).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'test@example.com',
      username: 'tester',
    })
  })

  it('sets user with only id', () => {
    setUser({ id: 'user-1' })

    expect(mockSentry.setUser).toHaveBeenCalledWith({ id: 'user-1' })
  })

  it('clears user when null', () => {
    setUser(null)

    expect(mockSentry.setUser).toHaveBeenCalledWith(null)
  })
})

describe('setTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets a tag in Sentry', () => {
    setTag('environment', 'staging')

    expect(mockSentry.setTag).toHaveBeenCalledWith('environment', 'staging')
  })
})

describe('capturePromiseError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('captures error from rejected promise and re-throws', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    const error = new Error('Promise failed')
    const promise = Promise.reject(error)

    await expect(capturePromiseError(promise)).rejects.toThrow('Promise failed')
    expect(mockSentry.captureException).toHaveBeenCalledWith(error, expect.anything())
  })

  it('returns resolved value for successful promise', async () => {
    const promise = Promise.resolve('success')

    const result = await capturePromiseError(promise)

    expect(result).toBe('success')
    expect(mockSentry.captureException).not.toHaveBeenCalled()
  })
})

describe('withSentryCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns handler response on success', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = withSentryCapture(handler)

    const response = await wrapped(new Request('http://localhost/api/test'))

    expect(response.status).toBe(200)
    expect(mockSentry.captureException).not.toHaveBeenCalled()
  })

  it('captures error and re-throws on failure', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/project')
    const error = new Error('Handler error')
    const handler = vi.fn().mockRejectedValue(error)
    const wrapped = withSentryCapture(handler)
    const req = new Request('http://localhost/api/test', { method: 'POST' })

    await expect(wrapped(req)).rejects.toThrow('Handler error')
    expect(mockSentry.captureException).toHaveBeenCalledWith(error, expect.anything())
  })
})

describe('default export', () => {
  it('exports all functions as default', async () => {
    const sentryConfig = (await import('../sentry')).default

    expect(sentryConfig.initSentry).toBeDefined()
    expect(sentryConfig.captureError).toBeDefined()
    expect(sentryConfig.captureMessage).toBeDefined()
    expect(sentryConfig.setContext).toBeDefined()
    expect(sentryConfig.setUser).toBeDefined()
    expect(sentryConfig.setTag).toBeDefined()
    expect(sentryConfig.capturePromiseError).toBeDefined()
    expect(sentryConfig.withSentryCapture).toBeDefined()
  })
})
