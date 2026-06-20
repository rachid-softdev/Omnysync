import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set UPSTASH_REDIS_REST_TOKEN but NOT UPSTASH_REDIS_REST_URL
// to test the fallback URL 'https://qstash.upstash.io'
const mockRedisConstructor = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  // Intentionally delete the URL so we test the fallback
  delete process.env.UPSTASH_REDIS_REST_URL

  const constructorCalls: Array<{ url: string; token: string }> = []
  const RedisMock = class {
    constructor(...args: unknown[]) {
      constructorCalls.push(args[0] as { url: string; token: string })
    }
    get = vi.fn()
    set = vi.fn()
    del = vi.fn()
    keys = vi.fn()
    ping = vi.fn()
  }

  return { RedisMock, constructorCalls }
})

vi.mock('@upstash/redis', () => ({
  Redis: mockRedisConstructor.RedisMock,
}))

import { cache } from '../cache'

describe('cache with fallback Redis URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses fallback URL when UPSTASH_REDIS_REST_URL is not set', () => {
    expect(cache.isAvailable()).toBe(true)

    // The Redis constructor should have been called with the fallback URL
    expect(mockRedisConstructor.constructorCalls.length).toBeGreaterThanOrEqual(1)
    const args = mockRedisConstructor.constructorCalls[0]
    expect(args.url).toBe('https://qstash.upstash.io')
    expect(args.token).toBe('test-token')
  })
})
