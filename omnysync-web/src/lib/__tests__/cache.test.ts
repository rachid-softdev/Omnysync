import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set env vars BEFORE module evaluation via vi.hoisted
vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
})

// Mock Redis
const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockRedis.get
    set = mockRedis.set
    del = mockRedis.del
    keys = mockRedis.keys
    ping = mockRedis.ping
  },
}))

import { cache, withCache, CACHE_KEYS } from '../cache'

describe('cache.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cached value when key exists', async () => {
    mockRedis.get.mockResolvedValue('cached-value')

    const result = await cache.get('test-key')

    expect(result).toBe('cached-value')
    expect(mockRedis.get).toHaveBeenCalledWith('test-key')
  })

  it('returns null for cache miss', async () => {
    mockRedis.get.mockResolvedValue(null)

    const result = await cache.get('test-key')

    expect(result).toBeNull()
  })

  it('returns null on Redis error', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cache.get('test-key')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('Cache get error:', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('handles JSON objects', async () => {
    const obj = { id: 1, name: 'test' }
    mockRedis.get.mockResolvedValue(obj)

    const result = await cache.get<typeof obj>('obj-key')

    expect(result).toEqual(obj)
  })

  it('handles numeric values', async () => {
    mockRedis.get.mockResolvedValue(42)

    const result = await cache.get<number>('num-key')

    expect(result).toBe(42)
  })
})

describe('cache.set', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets a value with default TTL and prefix', async () => {
    mockRedis.set.mockResolvedValue('OK')

    const result = await cache.set('my-key', 'my-value')

    expect(result).toBe(true)
    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:my-key', '"my-value"', { ex: 60 })
  })

  it('accepts custom TTL', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('key', 'value', { ttl: 300 })

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:key', '"value"', { ex: 300 })
  })

  it('accepts custom prefix', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('key', 'value', { prefix: 'custom:' })

    expect(mockRedis.set).toHaveBeenCalledWith('custom:key', '"value"', { ex: 60 })
  })

  it('returns false on Redis error', async () => {
    mockRedis.set.mockRejectedValue(new Error('Redis error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cache.set('key', 'value')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Cache set error:', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('serializes objects to JSON', async () => {
    mockRedis.set.mockResolvedValue('OK')
    const obj = { nested: { data: [1, 2, 3] } }

    await cache.set('obj-key', obj)

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:obj-key', JSON.stringify(obj), { ex: 60 })
  })

  it('accepts TTL of 0 (immediate expiry)', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('key', 'value', { ttl: 0 })

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:key', '"value"', { ex: 0 })
  })

  it('accepts very large TTL', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('key', 'value', { ttl: 999999 })

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:key', '"value"', { ex: 999999 })
  })
})

describe('cache - special characters in keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles keys with special characters', async () => {
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('stored-value')

    await cache.set('user:email@example.com', 'stored-value')
    expect(mockRedis.set).toHaveBeenCalledWith(
      'omnysync:user:email@example.com',
      '"stored-value"',
      { ex: 60 }
    )

    const result = await cache.get('user:email@example.com')
    expect(result).toBe('stored-value')
  })

  it('handles keys with unicode characters', async () => {
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('unicode-value')

    await cache.set('clé:française', 'unicode-value')
    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:clé:française', '"unicode-value"', {
      ex: 60,
    })

    const result = await cache.get('clé:française')
    expect(result).toBe('unicode-value')
  })

  it('handles keys with special symbols', async () => {
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('symbol-result')

    await cache.set('key$with#special@chars!', 'symbol-result')

    const result = await cache.get('key$with#special@chars!')
    expect(result).toBe('symbol-result')
  })
})

describe('cache - very large values', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles large string values (100KB)', async () => {
    const largeString = 'x'.repeat(100_000)
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(largeString)

    const setResult = await cache.set('large-key', largeString)
    expect(setResult).toBe(true)
    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:large-key', JSON.stringify(largeString), {
      ex: 60,
    })

    const getResult = await cache.get<string>('large-key')
    expect(getResult).toBe(largeString)
  })

  it('handles large nested objects', async () => {
    const largeObj = {
      data: 'x'.repeat(50_000),
      nested: { array: new Array(1000).fill('item') },
    }
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(largeObj)

    const setResult = await cache.set('big-obj', largeObj)
    expect(setResult).toBe(true)

    const getResult = await cache.get<typeof largeObj>('big-obj')
    expect(getResult).toEqual(largeObj)
  })
})

describe('cache - concurrent operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles concurrent get and set operations', async () => {
    mockRedis.set.mockResolvedValue('OK')
    // cache.get passes the key directly (no prefix), cache.set uses "omnysync:" prefix
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key === 'key1') return 'value1'
      if (key === 'key2') return 'value2'
      return null
    })

    const results = await Promise.all([
      cache.get('key1'),
      cache.get('key2'),
      cache.set('key3', 'value3'),
      cache.set('key4', 'value4'),
    ])

    expect(results[0]).toBe('value1')
    expect(results[1]).toBe('value2')
    expect(results[2]).toBe(true)
    expect(results[3]).toBe(true)
  })

  it('handles many concurrent operations', async () => {
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue('data')

    const ops = Array.from({ length: 50 }, (_, i) =>
      i % 2 === 0 ? cache.get(`key-${i}`) : cache.set(`key-${i}`, `value-${i}`)
    )

    const results = await Promise.all(ops)
    expect(results).toHaveLength(50)
    results.forEach((r) => expect(r).toBeDefined())
  })
})

describe('cache.del', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a key with default prefix', async () => {
    mockRedis.del.mockResolvedValue(1)

    const result = await cache.del('my-key')

    expect(result).toBe(true)
    expect(mockRedis.del).toHaveBeenCalledWith('omnysync:my-key')
  })

  it('deletes a key with custom prefix', async () => {
    mockRedis.del.mockResolvedValue(1)

    await cache.del('my-key', 'custom:')

    expect(mockRedis.del).toHaveBeenCalledWith('custom:my-key')
  })

  it('returns false on Redis error', async () => {
    mockRedis.del.mockRejectedValue(new Error('Redis error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cache.del('key')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Cache delete error:', expect.any(Error))

    consoleSpy.mockRestore()
  })
})

describe('cache.invalidatePrefix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates all keys with given prefix', async () => {
    mockRedis.keys.mockResolvedValue(['omnysync:user:1', 'omnysync:user:2'])
    mockRedis.del.mockResolvedValue(2)

    const result = await cache.invalidatePrefix('user')

    expect(result).toBe(true)
    expect(mockRedis.keys).toHaveBeenCalledWith('omnysync:user:*')
    expect(mockRedis.del).toHaveBeenCalledWith('omnysync:user:1', 'omnysync:user:2')
  })

  it('returns true when no keys match', async () => {
    mockRedis.keys.mockResolvedValue([])

    const result = await cache.invalidatePrefix('nonexistent')

    expect(result).toBe(true)
    expect(mockRedis.del).not.toHaveBeenCalled()
  })

  it('returns false on Redis error', async () => {
    mockRedis.keys.mockRejectedValue(new Error('Redis error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cache.invalidatePrefix('user')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Cache invalidate error:', expect.any(Error))

    consoleSpy.mockRestore()
  })
})

describe('cache.isAvailable', () => {
  it('returns true when Redis is configured', () => {
    expect(cache.isAvailable()).toBe(true)
  })
})

describe('withCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cached value on cache hit', async () => {
    mockRedis.get.mockResolvedValue('cached-result')
    const fn = vi.fn().mockResolvedValue('fresh-result')
    const cachedFn = withCache(fn, { ttl: 120, prefix: 'test' })

    const result = await cachedFn('arg1', 'arg2')

    expect(result).toBe('cached-result')
    expect(fn).not.toHaveBeenCalled()
  })

  it('executes function on cache miss and caches result', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue('computed-result')
    const cachedFn = withCache(fn, { ttl: 120, prefix: 'test' })

    const result = await cachedFn('arg1')

    expect(result).toBe('computed-result')
    expect(fn).toHaveBeenCalledWith('arg1')
    expect(mockRedis.set).toHaveBeenCalled()
  })

  it('propagates error when function throws', async () => {
    mockRedis.get.mockResolvedValue(null) // cache miss
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockRejectedValue(new Error('fn-error'))
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

    await expect(cachedFn('arg')).rejects.toThrow('fn-error')
    // Should NOT cache if function threw
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('handles function returning null', async () => {
    mockRedis.get.mockResolvedValue(null) // cache miss
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue(null)
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

    const result = await cachedFn('arg')
    expect(result).toBeNull()
    // cache.set is still called — the source serializes null via JSON.stringify
    expect(mockRedis.set).toHaveBeenCalled()
  })

  it('handles function returning undefined', async () => {
    mockRedis.get.mockResolvedValue(null) // cache miss
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue(undefined)
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

    const result = await cachedFn('arg')
    expect(result).toBeUndefined()
    // cache.set is still called even though JSON.stringify(undefined) returns undefined
    expect(mockRedis.set).toHaveBeenCalled()
  })
})

describe('CACHE_KEYS', () => {
  it('generates user stats key', () => {
    expect(CACHE_KEYS.USER_STATS('user-1')).toBe('user:user-1:stats')
  })

  it('generates org documents key with page', () => {
    expect(CACHE_KEYS.ORG_DOCUMENTS('org-1', 2)).toBe('org:org-1:docs:2')
  })

  it('generates public blog posts key', () => {
    expect(CACHE_KEYS.BLOG_POSTS).toBe('public:blog:posts')
  })

  it('generates pricing plans key', () => {
    expect(CACHE_KEYS.PRICING_PLANS).toBe('public:pricing')
  })

  it('generates user quota key', () => {
    expect(CACHE_KEYS.USER_QUOTA('user-1')).toBe('user:user-1:quota')
  })

  it('generates org stats key', () => {
    expect(CACHE_KEYS.ORG_STATS('org-1')).toBe('org:org-1:stats')
  })

  it('generates org connectors key', () => {
    expect(CACHE_KEYS.ORG_CONNECTORS('org-1')).toBe('org:org-1:connectors')
  })

  it('generates sync logs key with page', () => {
    expect(CACHE_KEYS.SYNC_LOGS('org-1', 1)).toBe('org:org-1:logs:1')
  })
})
