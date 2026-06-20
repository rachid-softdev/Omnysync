/**
 * Tests complets pour le système de rate limiting Redis (Sprint 2 — S2-8, S2-9)
 *
 * Couvre :
 *   - Middleware global (checkRateLimitRedis)
 *   - Per-endpoint (rateLimitRedisWithConfig)
 *   - Fallback in-memory quand Redis est indisponible
 *   - Cas limites (Redis qui lève une exception, TTL, premier appel)
 *   - Intégration routes auth (configs spécifiques)
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// Mocks hoistés — accessibles dans les factories vi.mock ET dans les tests
// ═══════════════════════════════════════════════════════════════════════════════

const mockRedisIncr = vi.hoisted(() => vi.fn<() => Promise<number>>().mockResolvedValue(1))
const mockRedisExpire = vi.hoisted(() => vi.fn<() => Promise<unknown>>().mockResolvedValue(1))
const mockRedisTtl = vi.hoisted(() => vi.fn<() => Promise<number>>().mockResolvedValue(3600))
const mockInMemRateLimit = vi.hoisted(() =>
  vi.fn<() => { allowed: boolean; remainingTime?: number }>().mockReturnValue({ allowed: true })
)
const mockInMemGetClientIp = vi.hoisted(() => vi.fn<() => string>().mockReturnValue('unknown'))

// Mock @upstash/redis — tous les appels Redis passent par nos mocks
// NOTE: vi.fn(function() {…}) au lieu de vi.fn(() => {…}) pour que `new Redis()`
// fonctionne (vitest 4.x exige une vraie fonction/class pour la constructibilité).
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(function () {
    return {
      incr: mockRedisIncr,
      expire: mockRedisExpire,
      ttl: mockRedisTtl,
    }
  }),
}))

// Mock du module in-memory rate-limit pour tester le fallback
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockInMemRateLimit,
  getClientIp: mockInMemGetClientIp,
  isValidIp: (ip: string) => {
    // Real implementation — pure function, pas besoin de mock
    const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
    const ipv6 = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/
    return ipv4.test(ip) || ipv6.test(ip)
  },
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX: 30,
  createRateLimitResponse: vi.fn(),
  checkRateLimit: vi.fn(),
  startRateLimitCleanup: vi.fn(),
  stopRateLimitCleanup: vi.fn(),
  pruneRateLimitEntries: vi.fn().mockReturnValue(0),
}))

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crée un objet simulant NextRequest avec les headers nécessaires.
 * On n'utilise pas le constructeur NextRequest car il nécessite l'environnement
 * runtime Next.js complet.
 */
function createMockRequest(
  url = 'http://localhost:3000/api/test',
  ip = '192.168.1.1',
  pathname?: string
) {
  return {
    url,
    headers: new Map<string, string>([
      ['x-forwarded-for', ip],
      ['x-real-ip', ip],
    ]),
    nextUrl: {
      pathname: pathname ?? '/api/test',
      search: '',
    },
    method: 'POST',
  } as unknown as Parameters<
    typeof import('@/lib/rate-limit-redis').checkRateLimitRedis extends (req: infer R) => unknown
      ? R
      : never
  >
}

/**
 * Raccourci pour importer dynamiquement le module sous test
 * après avoir réinitialisé le registre des modules.
 * Permet de contrôler les variables d'environnement avant l'évaluation du module.
 */
async function importRateLimitModule() {
  return await import('@/lib/rate-limit-redis')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suites de tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('rateLimitRedis (global middleware)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Valeur par défaut : en dessous de la limite
    mockRedisIncr.mockResolvedValue(1)
    mockRedisExpire.mockResolvedValue(1)
    mockRedisTtl.mockResolvedValue(3600)
  })

  describe('avec Redis configuré', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('retourne { allowed: true } quand le compteur est sous la limite (1ère requête)', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(true)
      expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:192.168.1.1')
      expect(mockRedisExpire).toHaveBeenCalledWith('ratelimit:192.168.1.1', 60)
    })

    it('retourne { allowed: true } à la 30e requête (exactement à la limite)', async () => {
      mockRedisIncr.mockResolvedValue(30)
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(true)
    })

    it('retourne { allowed: false } à la 31e requête (dépassement)', async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(30)
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBeDefined()
    })

    it('appelle expire UNIQUEMENT quand incr retourne 1 (première requête)', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedis } = await importRateLimitModule()
      mockRedisExpire.mockClear()

      await rateLimitRedis(createMockRequest())

      expect(mockRedisExpire).toHaveBeenCalledTimes(1)
    })

    it("N'appelle PAS expire quand incr retourne > 1", async () => {
      mockRedisIncr.mockResolvedValue(5)
      const { rateLimitRedis } = await importRateLimitModule()
      mockRedisExpire.mockClear()

      await rateLimitRedis(createMockRequest())

      expect(mockRedisExpire).not.toHaveBeenCalled()
    })

    it('calcule remainingTime via TTL quand la limite est dépassée', async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(45) // 45 secondes restantes
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(45000) // 45 * 1000
    })

    it('utilise windowMs par défaut si TTL est 0', async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(0) // clé expirée
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(60000)
    })
  })

  describe('quand la configuration Redis est partielle (URL sans token)', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      // Ne PAS stuber UPSTASH_REDIS_REST_TOKEN — il reste undefined
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('initialise Redis quand URL est défini même sans token (comportement actuel)', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      // Le code ne vérifie que UPSTASH_REDIS_REST_URL, pas le token
      // Donc Redis est initialisé et utilisé malgré l'absence de token
      expect(result.allowed).toBe(true)
      expect(mockRedisIncr).toHaveBeenCalled()
      expect(mockInMemRateLimit).not.toHaveBeenCalled()
    })

    it('tombe en fallback in-memory si Redis lève une erreur (token manquant)', async () => {
      mockRedisIncr.mockRejectedValue(new Error('Unauthorized — token manquant'))
      mockInMemRateLimit.mockReturnValue({ allowed: true })
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(true)
      expect(mockInMemRateLimit).toHaveBeenCalled()
    })
  })

  describe('quand Redis est désactivé (env vars absentes)', () => {
    beforeEach(() => {
      // Ne pas définir UPSTASH_REDIS_REST_URL
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('tombe dans le fallback in-memory', async () => {
      mockInMemRateLimit.mockReturnValue({ allowed: true })
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(true)
      expect(mockInMemRateLimit).toHaveBeenCalled()
    })

    it('retourne le résultat du module in-memory (rate limit atteint)', async () => {
      mockInMemRateLimit.mockReturnValue({ allowed: false, remainingTime: 30000 })
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(30000)
    })
  })

  describe('quand Redis lève une exception', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('tombe dans le fallback in-memory silencieusement', async () => {
      mockRedisIncr.mockRejectedValue(new Error('Connection refused'))
      mockInMemRateLimit.mockReturnValue({ allowed: true })
      const { rateLimitRedis } = await importRateLimitModule()

      const result = await rateLimitRedis(createMockRequest())

      expect(result.allowed).toBe(true)
      expect(mockInMemRateLimit).toHaveBeenCalled()
    })
  })

  describe('checkRateLimitRedis (wrapper middleware)', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('retourne null quand la requête est autorisée', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { checkRateLimitRedis } = await importRateLimitModule()

      const result = await checkRateLimitRedis(createMockRequest())

      expect(result).toBeNull()
    })

    it('retourne une réponse 429 quand la limite est dépassée', async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(30)

      const { checkRateLimitRedis } = await importRateLimitModule()
      const result = await checkRateLimitRedis(createMockRequest())

      expect(result).not.toBeNull()
      expect(result!.status).toBe(429)
    })

    it('inclut les headers de rate limiting (Retry-After, X-RateLimit-*)', async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(30)

      const { checkRateLimitRedis, RATE_LIMIT_MAX } = await importRateLimitModule()
      const result = await checkRateLimitRedis(createMockRequest())

      expect(result!.headers.get('Retry-After')).toBe('30')
      expect(result!.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMIT_MAX))
      expect(result!.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(result!.headers.get('X-RateLimit-Reset')).toBeTruthy()
      // X-RateLimit-Reset doit être un timestamp futur
      expect(Number(result!.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(Date.now())
    })

    it("retourne le body JSON d'erreur en anglais pour le middleware global", async () => {
      mockRedisIncr.mockResolvedValue(31)
      mockRedisTtl.mockResolvedValue(30)

      const { checkRateLimitRedis } = await importRateLimitModule()
      const result = await checkRateLimitRedis(createMockRequest())

      const body = await result!.json()
      expect(body).toHaveProperty('error', 'Too many requests')
      expect(body).toHaveProperty('message', 'Rate limit exceeded. Please try again later.')
    })

    it('fonctionne avec createRateLimitResponse directement', async () => {
      const { createRateLimitResponse, RATE_LIMIT_MAX } = await importRateLimitModule()

      const response = createRateLimitResponse(45000)

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('45')
      expect(response.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMIT_MAX))
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('createRateLimitResponse with remainingTime=0 uses fallback 1s Retry-After', async () => {
      const { createRateLimitResponse, RATE_LIMIT_MAX } = await importRateLimitModule()

      const response = createRateLimitResponse(0)

      expect(response.status).toBe(429)
      // remainingTime || 1000 → ceil(1000/1000) = 1
      expect(response.headers.get('Retry-After')).toBe('1')
      expect(response.headers.get('X-RateLimit-Limit')).toBe(String(RATE_LIMIT_MAX))
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('checkRateLimitRedis fallback: in-memory sans remainingTime utilise RATE_LIMIT_WINDOW_MS', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '') // pas de Redis
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      vi.resetModules()

      // L'in-memory rate limit retourne un résultat sans remainingTime
      mockInMemRateLimit.mockReturnValue({ allowed: false })
      const { checkRateLimitRedis, RATE_LIMIT_WINDOW_MS } = await importRateLimitModule()
      const result = await checkRateLimitRedis(createMockRequest())

      expect(result).not.toBeNull()
      expect(result!.status).toBe(429)
      const retryAfter = result!.headers.get('Retry-After')
      // RATE_LIMIT_WINDOW_MS = 60000 → ceil(60000/1000) = 60
      expect(retryAfter).toBe(String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)))

      vi.unstubAllEnvs()
    })
  })
})

describe('rateLimitRedisWithConfig (per-endpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisIncr.mockResolvedValue(1)
    mockRedisExpire.mockResolvedValue(1)
    mockRedisTtl.mockResolvedValue(3600)
  })

  describe('avec Redis configuré', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('retourne { allowed: true } quand le compteur est sous le seuil configuré', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(true)
      expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:auth:register:192.168.1.1')
    })

    it('retourne { allowed: false } quand le compteur dépasse le max configuré', async () => {
      mockRedisIncr.mockResolvedValue(6) // max = 5, donc 6 > 5
      mockRedisTtl.mockResolvedValue(1800)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(1800000)
    })

    it('respecte le seuil max configuré (ex: 3 pour forgot-password)', async () => {
      // Test avec max=3
      mockRedisIncr.mockResolvedValue(4) // 4 > 3 → bloqué
      mockRedisTtl.mockResolvedValue(500)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:forgot-password:192.168.1.1', {
        max: 3,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(false)
    })

    it('autorise quand count == max (exactement à la limite)', async () => {
      mockRedisIncr.mockResolvedValue(5) // max = 5, 5 == 5 → autorisé
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(true)
    })

    it('bloque dès la première requête quand max=0', async () => {
      mockRedisIncr.mockResolvedValue(1) // 1 > 0 → bloqué immédiatement
      mockRedisTtl.mockResolvedValue(3600)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('test:edge:1.2.3.4', {
        max: 0,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBeDefined()
    })

    it('utilise la clé Redis avec le bon préfixe ratelimit:', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      await rateLimitRedisWithConfig('auth:reset-password:10.0.0.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:auth:reset-password:10.0.0.1')
    })

    it('définit expire seulement sur la première requête (count === 1)', async () => {
      mockRedisIncr.mockResolvedValue(1)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(mockRedisExpire).toHaveBeenCalledWith('ratelimit:auth:register:192.168.1.1', 3600)
    })

    it("n'appelle PAS expire sur les requêtes suivantes", async () => {
      mockRedisIncr.mockResolvedValue(3)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()
      mockRedisExpire.mockClear()

      await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(mockRedisExpire).not.toHaveBeenCalled()
    })

    it('retourne remainingTime basé sur TTL quand dépassé', async () => {
      mockRedisIncr.mockResolvedValue(6)
      mockRedisTtl.mockResolvedValue(900) // 15 min restantes
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.remainingTime).toBe(900000)
    })

    it('utilise windowMs si TTL est 0 ou négatif', async () => {
      mockRedisIncr.mockResolvedValue(6)
      mockRedisTtl.mockResolvedValue(0)
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.remainingTime).toBe(60 * 60 * 1000)
    })
  })

  describe('fallback per-endpoint sans Redis', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('utilise le fallback in-memory quand fallbackRequest est fourni', async () => {
      mockInMemRateLimit.mockReturnValue({ allowed: true })
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const req = createMockRequest()
      const result = await rateLimitRedisWithConfig(
        'auth:register:192.168.1.1',
        { max: 5, windowMs: 60 * 60 * 1000 },
        req
      )

      expect(result.allowed).toBe(true)
      expect(mockInMemRateLimit).toHaveBeenCalled()
    })

    it("retourne { allowed: false } quand fallbackRequest n'est PAS fourni (fail closed)", async () => {
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(60 * 60 * 1000) // windowMs par défaut
      expect(mockInMemRateLimit).not.toHaveBeenCalled()
    })
  })

  describe('fallback per-endpoint quand Redis lève une exception', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('utilise le fallback in-memory quand fallbackRequest est fourni', async () => {
      mockRedisIncr.mockRejectedValue(new Error('Redis timeout'))
      mockInMemRateLimit.mockReturnValue({ allowed: false, remainingTime: 5000 })
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig(
        'auth:register:192.168.1.1',
        { max: 5, windowMs: 60 * 60 * 1000 },
        createMockRequest()
      )

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(5000)
      expect(mockInMemRateLimit).toHaveBeenCalled()
    })

    it("retourne { allowed: false } (fail closed) quand fallbackRequest n'est PAS fourni", async () => {
      mockRedisIncr.mockRejectedValue(new Error('Redis timeout'))
      const { rateLimitRedisWithConfig } = await importRateLimitModule()

      const result = await rateLimitRedisWithConfig('auth:register:192.168.1.1', {
        max: 5,
        windowMs: 60 * 60 * 1000,
      })

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBe(60 * 60 * 1000) // windowMs = fail-closed fallback
    })
  })
})

describe('Intégration routes auth — configurations rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('POST /api/auth/register utilise max=5, windowMs=1h', async () => {
    mockRedisIncr.mockResolvedValue(1)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:register:192.168.1.1',
      { max: 5, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(true)
    expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:auth:register:192.168.1.1')
  })

  it('POST /api/auth/register bloque à la 6e tentative (5/h)', async () => {
    mockRedisIncr.mockResolvedValue(6)
    mockRedisTtl.mockResolvedValue(3000)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:register:192.168.1.1',
      { max: 5, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(false)
  })

  it('POST /api/auth/forgot-password utilise max=3, windowMs=1h', async () => {
    mockRedisIncr.mockResolvedValue(1)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:forgot-password:192.168.1.1',
      { max: 3, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(true)
    expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:auth:forgot-password:192.168.1.1')
  })

  it('POST /api/auth/forgot-password bloque à la 4e tentative (3/h)', async () => {
    mockRedisIncr.mockResolvedValue(4)
    mockRedisTtl.mockResolvedValue(3000)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:forgot-password:192.168.1.1',
      { max: 3, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(false)
  })

  it('POST /api/auth/reset-password utilise max=5, windowMs=1h', async () => {
    mockRedisIncr.mockResolvedValue(1)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:reset-password:192.168.1.1',
      { max: 5, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(true)
    expect(mockRedisIncr).toHaveBeenCalledWith('ratelimit:auth:reset-password:192.168.1.1')
  })

  it('POST /api/auth/reset-password bloque à la 6e tentative (5/h)', async () => {
    mockRedisIncr.mockResolvedValue(6)
    mockRedisTtl.mockResolvedValue(3000)
    const { rateLimitRedisWithConfig } = await importRateLimitModule()

    const result = await rateLimitRedisWithConfig(
      'auth:reset-password:192.168.1.1',
      { max: 5, windowMs: 60 * 60 * 1000 },
      createMockRequest()
    )

    expect(result.allowed).toBe(false)
  })
})

describe("getClientIp — extraction d'IP depuis les headers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("extrait l'IP depuis x-forwarded-for", async () => {
    const { getClientIp } = await importRateLimitModule()

    const req = createMockRequest('http://localhost/api/test', '10.0.0.1')
    // On doit modifier le mock req pour qu'il ait les bons headers
    const customReq = {
      ...createMockRequest('http://localhost/api/test', '10.0.0.1'),
      headers: new Map([['x-forwarded-for', '10.0.0.1, 192.168.1.1']]),
    } as unknown as Parameters<typeof getClientIp>[0]

    expect(getClientIp(customReq)).toBe('10.0.0.1')
  })

  it("extrait l'IP depuis x-real-ip si x-forwarded-for absent", async () => {
    const { getClientIp } = await importRateLimitModule()

    const customReq = {
      ...createMockRequest('http://localhost/api/test', '10.0.0.1'),
      headers: new Map([['x-real-ip', '10.0.0.2']]),
    } as unknown as Parameters<typeof getClientIp>[0]

    expect(getClientIp(customReq)).toBe('10.0.0.2')
  })

  it("extrait l'IP depuis cf-connecting-ip si les autres headers sont absents", async () => {
    const { getClientIp } = await importRateLimitModule()

    const customReq = {
      ...createMockRequest('http://localhost/api/test', '10.0.0.1'),
      headers: new Map([['cf-connecting-ip', '10.0.0.3']]),
    } as unknown as Parameters<typeof getClientIp>[0]

    expect(getClientIp(customReq)).toBe('10.0.0.3')
  })

  it("retourne 'unknown' quand aucun header IP n'est présent", async () => {
    const { getClientIp } = await importRateLimitModule()

    const customReq = {
      ...createMockRequest('http://localhost/api/test', '10.0.0.1'),
      headers: new Map(),
    } as unknown as Parameters<typeof getClientIp>[0]

    expect(getClientIp(customReq)).toBe('unknown')
  })

  it('préfère x-forwarded-for même si x-real-ip est présent', async () => {
    const { getClientIp } = await importRateLimitModule()

    const customReq = {
      ...createMockRequest('http://localhost/api/test', '10.0.0.1'),
      headers: new Map([
        ['x-forwarded-for', '10.0.0.99'],
        ['x-real-ip', '10.0.0.1'],
      ]),
    } as unknown as Parameters<typeof getClientIp>[0]

    expect(getClientIp(customReq)).toBe('10.0.0.99')
  })
})

describe('withRateLimitRedis (HOF)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exécute le handler quand la requête est autorisée', async () => {
    mockRedisIncr.mockResolvedValue(1)
    const { withRateLimitRedis } = await importRateLimitModule()
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

    const wrapped = withRateLimitRedis(handler)
    const result = await wrapped(createMockRequest())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(200)
  })

  it('retourne 429 sans exécuter le handler quand la limite est dépassée', async () => {
    mockRedisIncr.mockResolvedValue(31)
    mockRedisTtl.mockResolvedValue(30)
    const { withRateLimitRedis } = await importRateLimitModule()
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

    const wrapped = withRateLimitRedis(handler)
    const result = await wrapped(createMockRequest())

    expect(handler).not.toHaveBeenCalled()
    expect(result.status).toBe(429)
  })

  it('withRateLimitRedis: fallback sans remainingTime utilise RATE_LIMIT_WINDOW_MS', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '') // pas de Redis
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.resetModules()

    mockInMemRateLimit.mockReturnValue({ allowed: false })
    const { withRateLimitRedis, RATE_LIMIT_WINDOW_MS } = await importRateLimitModule()
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

    const wrapped = withRateLimitRedis(handler)
    const result = await wrapped(createMockRequest())

    expect(handler).not.toHaveBeenCalled()
    expect(result.status).toBe(429)
    const retryAfter = result.headers.get('Retry-After')
    expect(retryAfter).toBe(String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)))

    vi.unstubAllEnvs()
  })
})

describe('Constantes et structure du module', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('RATE_LIMIT_WINDOW_MS = 60000 (1 minute)', async () => {
    const mod = await importRateLimitModule()
    expect(mod.RATE_LIMIT_WINDOW_MS).toBe(60000)
  })

  it('RATE_LIMIT_MAX = 30', async () => {
    const mod = await importRateLimitModule()
    expect(mod.RATE_LIMIT_MAX).toBe(30)
  })

  it('le module exporte toutes les fonctions attendues', async () => {
    const mod = await importRateLimitModule()
    expect(mod.rateLimitRedis).toBeInstanceOf(Function)
    expect(mod.checkRateLimitRedis).toBeInstanceOf(Function)
    expect(mod.rateLimitRedisWithConfig).toBeInstanceOf(Function)
    expect(mod.createRateLimitResponse).toBeInstanceOf(Function)
    expect(mod.getClientIp).toBeInstanceOf(Function)
    expect(mod.withRateLimitRedis).toBeInstanceOf(Function)
  })
})
