/**
 * CacheService test
 *
 * Tests that the re-exported CacheService from @omnysync/core/entitlements/CacheService
 * is correctly forwarded through the web wrapper.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheService, getCacheService, setCacheService, resetCacheService } from '../CacheService'

describe('CacheService (web re-export)', () => {
  beforeEach(() => {
    resetCacheService()
  })

  afterEach(() => {
    resetCacheService()
  })

  it('should export CacheService class', () => {
    const instance = new CacheService()
    expect(instance).toBeInstanceOf(CacheService)
  })

  it('should create a valid CacheService instance with expected methods', () => {
    const instance = new CacheService()
    expect(typeof instance.get).toBe('function')
    expect(typeof instance.set).toBe('function')
    expect(typeof instance.delete).toBe('function')
    expect(typeof instance.clearAll).toBe('function')
    expect(typeof instance.isRedisAvailable).toBe('function')
  })

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls to getCacheService', () => {
      const instance1 = getCacheService()
      const instance2 = getCacheService()
      expect(instance1).toBe(instance2)
    })

    it('should allow overriding instance with setCacheService', () => {
      const customInstance = new CacheService()
      setCacheService(customInstance)
      expect(getCacheService()).toBe(customInstance)
    })

    it('should create new instance after reset', () => {
      const instance1 = getCacheService()
      resetCacheService()
      const instance2 = getCacheService()
      expect(instance2).not.toBe(instance1)
    })
  })

  describe('cache operations', () => {
    it('should set and get cached values', async () => {
      const cache = getCacheService()
      await cache.set('org-1', {
        planKey: 'pro',
        features: { EXPORT_PDF: true },
        limits: {},
        experiments: {},
      })
      const result = await cache.get('org-1')
      expect(result).toBeDefined()
      expect(result?.planKey).toBe('pro')
    })

    it('should return null for missing keys', async () => {
      const cache = getCacheService()
      const result = await cache.get('non-existent-org')
      expect(result).toBeNull()
    })

    it('should delete specific cache entries', async () => {
      const cache = getCacheService()
      await cache.set('org-1', { planKey: 'pro', features: {}, limits: {}, experiments: {} })
      await cache.set('org-2', { planKey: 'free', features: {}, limits: {}, experiments: {} })
      await cache.delete('org-1')

      const result1 = await cache.get('org-1')
      const result2 = await cache.get('org-2')
      expect(result1).toBeNull()
      expect(result2).toBeDefined()
    })

    it('should clear all cache entries', async () => {
      const cache = getCacheService()
      await cache.set('org-1', { planKey: 'pro', features: {}, limits: {}, experiments: {} })
      await cache.set('org-2', { planKey: 'free', features: {}, limits: {}, experiments: {} })
      await cache.clearAll()

      const result1 = await cache.get('org-1')
      const result2 = await cache.get('org-2')
      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })
  })
})
