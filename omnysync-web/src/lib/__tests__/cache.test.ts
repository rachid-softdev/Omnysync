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

import { cache, withCache, useCachedFetch, CACHE_KEYS } from '../cache'

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

  it('returns null when Redis returns undefined (nullish coalescing)', async () => {
    mockRedis.get.mockResolvedValue(undefined)

    const result = await cache.get('test-key')

    expect(result).toBeNull()
    expect(mockRedis.get).toHaveBeenCalledWith('test-key')
  })

  it('retrieves array values', async () => {
    const arr = [1, 2, 3, { nested: true }]
    mockRedis.get.mockResolvedValue(arr)

    const result = await cache.get<typeof arr>('arr-key')

    expect(result).toEqual(arr)
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

  it('uses default TTL when ttl is explicitly undefined in options', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('key', 'value', { ttl: undefined })

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:key', '"value"', { ex: 60 })
  })

  it('accepts empty prefix (uses key as-is)', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('bare-key', 'bare-value', { prefix: '' })

    expect(mockRedis.set).toHaveBeenCalledWith('bare-key', '"bare-value"', { ex: 60 })
  })

  it('handles circular reference gracefully (JSON.stringify throws)', async () => {
    const circular: Record<string, unknown> = { name: 'circular' }
    circular.self = circular

    // Mock set to throw — JSON.stringify would throw in the actual code
    // but we mock it since the error is caught and returns false
    mockRedis.set.mockRejectedValue(new Error('JSON.stringify error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cache.set('circular', circular)

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Cache set error:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('stores a boolean value', async () => {
    mockRedis.set.mockResolvedValue('OK')

    await cache.set('bool-key', true)

    expect(mockRedis.set).toHaveBeenCalledWith('omnysync:bool-key', 'true', { ex: 60 })
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

  it('returns true when Redis returns 0 (key not found)', async () => {
    mockRedis.del.mockResolvedValue(0)

    const result = await cache.del('nonexistent-key')

    expect(result).toBe(true)
    expect(mockRedis.del).toHaveBeenCalledWith('omnysync:nonexistent-key')
  })

  it('accepts empty string custom prefix', async () => {
    mockRedis.del.mockResolvedValue(1)

    const result = await cache.del('bare-key', '')

    expect(result).toBe(true)
    expect(mockRedis.del).toHaveBeenCalledWith('bare-key')
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

  it('handles many matching keys', async () => {
    const manyKeys = Array.from({ length: 100 }, (_, i) => `omnysync:bulk:key:${i}`)
    mockRedis.keys.mockResolvedValue(manyKeys)
    mockRedis.del.mockResolvedValue(100)

    const result = await cache.invalidatePrefix('bulk')

    expect(result).toBe(true)
    expect(mockRedis.keys).toHaveBeenCalledWith('omnysync:bulk:*')
    expect(mockRedis.del).toHaveBeenCalledWith(...manyKeys)
  })

  it('handles empty prefix (invalidates all)', async () => {
    mockRedis.keys.mockResolvedValue(['omnysync:key1', 'omnysync:key2'])
    mockRedis.del.mockResolvedValue(2)

    const result = await cache.invalidatePrefix('')

    expect(result).toBe(true)
    expect(mockRedis.keys).toHaveBeenCalledWith('omnysync::*')
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

  it('works with no arguments', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue('no-args-result')
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'noargs' })

    const result = await cachedFn()

    expect(result).toBe('no-args-result')
    expect(fn).toHaveBeenCalledWith()
    // Key generated from JSON.stringify([]) = "[]"
    expect(mockRedis.get).toHaveBeenCalledWith('noargs:[]')
  })

  it('works with complex object arguments', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue('complex-result')
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'complex' })

    const result = await cachedFn(
      { userId: 1, roles: ['admin', 'editor'] },
      { pagination: { page: 1, limit: 20 } }
    )

    expect(result).toBe('complex-result')
    // The key is generated from JSON.stringify of the args
    expect(mockRedis.get).toHaveBeenCalled()
  })

  it('still returns function result even when cache.set fails', async () => {
    mockRedis.get.mockResolvedValue(null) // cache miss
    mockRedis.set.mockRejectedValue(new Error('set failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fn = vi.fn().mockResolvedValue('computed-despite-set-failure')
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'test' })

    const result = await cachedFn('arg')

    // Function result is still returned even if caching fails
    expect(result).toBe('computed-despite-set-failure')
    expect(fn).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Cache set error:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('uses default options when none provided', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue('default-result')
    const cachedFn = withCache(fn)

    const result = await cachedFn('x')

    expect(result).toBe('default-result')
    // Default prefix is 'fn', default TTL is 60
    expect(mockRedis.get).toHaveBeenCalledWith('fn:["x"]')
    expect(mockRedis.set).toHaveBeenCalledWith('fn:["x"]', '"default-result"', { ex: 60 })
  })

  it('generates different cache keys for different arguments', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    const fn = vi.fn().mockResolvedValue('data')
    const cachedFn = withCache(fn, { ttl: 60, prefix: 'echo' })

    await cachedFn('a')
    await cachedFn('b')

    expect(mockRedis.get).toHaveBeenCalledWith('echo:["a"]')
    expect(mockRedis.get).toHaveBeenCalledWith('echo:["b"]')
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

  it('handles page 0 boundary for org documents key', () => {
    expect(CACHE_KEYS.ORG_DOCUMENTS('org-1', 0)).toBe('org:org-1:docs:0')
  })

  it('handles page 0 boundary for sync logs key', () => {
    expect(CACHE_KEYS.SYNC_LOGS('org-1', 0)).toBe('org:org-1:logs:0')
  })

  it('handles empty string orgId', () => {
    expect(CACHE_KEYS.ORG_STATS('')).toBe('org::stats')
    expect(CACHE_KEYS.ORG_DOCUMENTS('', 1)).toBe('org::docs:1')
  })

  it('handles empty string userId', () => {
    expect(CACHE_KEYS.USER_STATS('')).toBe('user::stats')
    expect(CACHE_KEYS.USER_QUOTA('')).toBe('user::quota')
  })
})

describe('useCachedFetch', () => {
  it('returns initial state with null data, false loading, null error', () => {
    const fetchFn = vi.fn()
    const result = useCachedFetch(fetchFn)

    expect(result.data).toBeNull()
    expect(result.loading).toBe(false)
    expect(result.error).toBeNull()
  })

  it('refetch calls the fetch function and returns its result', async () => {
    const fetchFn = vi.fn().mockResolvedValue('result-data')
    const result = useCachedFetch(fetchFn)

    const refetchResult = await result.refetch()

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(refetchResult).toBe('result-data')
  })

  it('refetch propagates errors from fetch function', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fetch-error'))
    const result = useCachedFetch(fetchFn)

    await expect(result.refetch()).rejects.toThrow('fetch-error')
  })

  it('accepts options parameter without breaking', () => {
    const fetchFn = vi.fn()
    const result = useCachedFetch(fetchFn, { ttl: 300, prefix: 'test' })

    expect(result.data).toBeNull()
    expect(result.loading).toBe(false)
    expect(result.error).toBeNull()
  })
})
