import { Redis } from '@upstash/redis'

// Initialiser le client Redis (utilise Upstash qui est déjà utilisé pour QStash)
const redis = process.env.QSTASH_TOKEN
  ? new Redis({
      url: process.env.QSTASH_URL || 'https://qstash.upstash.io',
      token: process.env.QSTASH_TOKEN,
    })
  : null

export interface CacheOptions {
  ttl?: number // Time to live en secondes (défaut: 60)
  prefix?: string // Préfixe pour les clés
}

const DEFAULT_TTL = 60 // 1 minute par défaut
const DEFAULT_PREFIX = 'omnysync:'

/**
 * Wrapper pour le cache Redis
 * Compatible avec ou sans Redis (no-op si non configuré)
 */
export const cache = {
  /**
   * Récupère une valeur du cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null

    try {
      const value = await redis.get<T>(key)
      return value ?? null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  /**
   * Définit une valeur dans le cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!redis) return false

    const ttl = options.ttl ?? DEFAULT_TTL
    const prefix = options.prefix ?? DEFAULT_PREFIX
    const fullKey = `${prefix}${key}`

    try {
      await redis.set(fullKey, JSON.stringify(value), { ex: ttl })
      return true
    } catch (error) {
      console.error('Cache set error:', error)
      return false
    }
  },

  /**
   * Supprime une valeur du cache
   */
  async del(key: string, prefix = DEFAULT_PREFIX): Promise<boolean> {
    if (!redis) return false

    try {
      await redis.del(`${prefix}${key}`)
      return true
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  },

  /**
   * Invalide toutes les clés avec un préfixe donné
   */
  async invalidatePrefix(prefix: string): Promise<boolean> {
    if (!redis) return false

    try {
      const keys = await redis.keys(`${DEFAULT_PREFIX}${prefix}:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      return true
    } catch (error) {
      console.error('Cache invalidate error:', error)
      return false
    }
  },

  /**
   * Vérifie si le cache est disponible
   */
  isAvailable(): boolean {
    return redis !== null
  },
}

/**
 * Décorateur pour mettre en cache le résultat d'une fonction
 * Usage: cachedFunction = withCache(originalFunction, { ttl: 60, prefix: "users" })
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL, prefix = 'fn' } = options

  return async (...args: Parameters<T>): Promise<unknown> => {
    // Générer une clé unique basée sur les arguments
    const key = `${prefix}:${JSON.stringify(args)}`

    // Essayer de récupérer du cache
    const cached = await cache.get(key)
    if (cached !== null) {
      return cached
    }

    // Exécuter la fonction et mettre en cache le résultat
    const result = await fn(...args)
    await cache.set(key, result, { ttl, prefix: '' })

    return result
  }
}

/**
 * Hook pour utiliser le cache dans les composants React (côté client)
 */
export function useCachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL } = options

  // Implémentation simple - en production, utiliser SWR ou React Query
  return {
    data: null as T | null,
    loading: false,
    error: null as Error | null,
    refetch: async () => {
      // Cette implémentation est basique
      // Pour une vraie implémentation, utiliser SWR ou React Query
      return fetchFn()
    },
  }
}

// Cache keys couramment utilisés
export const CACHE_KEYS = {
  // User
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  USER_QUOTA: (userId: string) => `user:${userId}:quota`,

  // Organization
  ORG_STATS: (orgId: string) => `org:${orgId}:stats`,
  ORG_DOCUMENTS: (orgId: string, page: number) => `org:${orgId}:docs:${page}`,
  ORG_CONNECTORS: (orgId: string) => `org:${orgId}:connectors`,

  // Sync
  SYNC_LOGS: (orgId: string, page: number) => `org:${orgId}:logs:${page}`,

  // Public
  BLOG_POSTS: 'public:blog:posts',
  PRICING_PLANS: 'public:pricing',
}
