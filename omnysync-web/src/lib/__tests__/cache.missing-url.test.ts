import { afterAll, describe, it, expect, vi } from 'vitest'

// Redis requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
// A token without a URL must not fall back to the QStash endpoint.
const mockRedisConstructor = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
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

describe('cache with missing Redis URL', () => {
  afterAll(() => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('does not create a Redis client without UPSTASH_REDIS_REST_URL', () => {
    expect(cache.isAvailable()).toBe(false)
    expect(mockRedisConstructor.constructorCalls).toHaveLength(0)
  })
})
