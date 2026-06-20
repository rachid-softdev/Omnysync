/**
 * API Key authentication middleware.
 *
 * Validates requests using the `x-api-key` header against stored API keys.
 * API keys are hashed (SHA-256) at rest; the raw key is compared via hash.
 * Expired keys are automatically rejected.
 */
import { prisma } from '@/lib/prisma'
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

export interface ApiKeyAuth {
  userId: string
  organizationId: string
}

/**
 * Hash an API key using SHA-256.
 * Exported for testing.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Extract and validate an API key from the request headers.
 * Returns the authenticated user + org if valid, or null if not.
 *
 * 🔒 Sécurité :
 * - Clés expirées rejetées
 * - findFirst avec orderBy pour éviter les collisions de hash
 * - Update lastUsedAt non-bloquant (fire-and-forget)
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyAuth | null> {
  const rawKey = request.headers.get('x-api-key')
  if (!rawKey) {
    return null
  }

  // 🔒 Protection: rejeter les clés vides ou trop longues (DoS)
  if (rawKey.length < 8 || rawKey.length > 512) {
    console.warn(`[API-KEY] Clé API rejetée: longueur ${rawKey.length} invalide`)
    return null
  }

  const keyHash = hashApiKey(rawKey)

  // 🔒 Utiliser findFirst avec orderBy pour avoir un résultat déterministe
  // en cas de collision de hash (extrêmement rare avec SHA-256)
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash },
    orderBy: { createdAt: 'desc' },
    select: {
      userId: true,
      organizationId: true,
      expiresAt: true,
    },
  })

  if (!apiKey) {
    return null
  }

  // 🔒 Reject expired keys
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    console.warn(`[API-KEY] Clé API expirée rejetée pour l'utilisateur ${apiKey.userId}`)
    return null
  }

  // Update lastUsedAt asynchronously (non-blocking)
  prisma.apiKey
    .updateMany({
      where: { keyHash },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      console.warn('[API-KEY] Échec mise à jour lastUsedAt:', err)
    })

  return {
    userId: apiKey.userId,
    organizationId: apiKey.organizationId,
  }
}
