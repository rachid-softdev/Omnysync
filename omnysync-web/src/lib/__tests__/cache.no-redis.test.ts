import { describe, it, expect, vi, beforeEach } from 'vitest'

// DO NOT set UPSTASH_REDIS_REST_TOKEN — simulate Redis not configured
vi.hoisted(() => {
  // Ensure the env vars are NOT set so redis = null
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
})

// Mock Redis module so it won't be instantiated
vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = vi.fn()
    set = vi.fn()
    del = vi.fn()
    keys = vi.fn()
    ping = vi.fn()
  },
}))

import { cache, withCache } from '../cache'

describe('cache without Redis configured', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cache.get', () => {
    it('returns null when Redis is not configured', async () => {
      const result = await cache.get('any-key')
      expect(result).toBeNull()
    })

    it('does not throw when Redis is not configured', async () => {
      await expect(cache.get('any-key')).resolves.toBeNull()
    })
  })

  describe('cache.set', () => {
    it('returns false when Redis is not configured', async () => {
      const result = await cache.set('key', 'value')
      expect(result).toBe(false)
    })

    it('does not throw when Redis is not configured', async () => {
      await expect(cache.set('key', 'value')).resolves.toBe(false)
    })
  })

  describe('cache.del', () => {
    it('returns false when Redis is not configured', async () => {
      const result = await cache.del('key')
      expect(result).toBe(false)
    })

    it('returns false with custom prefix when Redis is not configured', async () => {
      const result = await cache.del('key', 'custom:')
      expect(result).toBe(false)
    })
  })

  describe('cache.invalidatePrefix', () => {
    it('returns false when Redis is not configured', async () => {
      const result = await cache.invalidatePrefix('user')
      expect(result).toBe(false)
    })
  })

  describe('cache.isAvailable', () => {
    it('returns false when Redis is not configured', () => {
      expect(cache.isAvailable()).toBe(false)
    })
  })

  describe('withCache', () => {
    it('executes function directly when Redis is not configured (no caching)', async () => {
      const fn = vi.fn().mockResolvedValue('computed')
      const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

      const result = await cachedFn('arg1')

      // Function executes normally
      expect(result).toBe('computed')
      expect(fn).toHaveBeenCalledWith('arg1')
    })

    it('does not throw when Redis is not configured and function fails', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fn-error'))
      const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

      // Error still propagates from the function itself
      await expect(cachedFn('arg')).rejects.toThrow('fn-error')
    })
  })
})
