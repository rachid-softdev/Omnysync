/**
 * Tests pour la validation des API keys
 *
 * Couvre :
 *   - hashApiKey : format du hash SHA-256
 *   - validateApiKey : clé valide/invalide/expirée
 *   - Cas limites : clé vide, trop longue, format invalide
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────

const prismaMock = {
  apiKey: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const headerMap = new Map(Object.entries(headers))
  return {
    headers: {
      get: (name: string) => headerMap.get(name) ?? null,
    },
    url: 'http://localhost:3000/api/test',
    nextUrl: { pathname: '/api/test', search: '' },
    method: 'GET',
  } as unknown as NextRequest
}

// ── Suites ──────────────────────────────────────────────────────────────────

describe('hashApiKey', () => {
  it('produit un hash SHA-256 de 64 caractères hex', async () => {
    const { hashApiKey } = await import('@/lib/api-key')
    const hash = hashApiKey('sk-test-key-12345')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produit le même hash pour la même clé', async () => {
    const { hashApiKey } = await import('@/lib/api-key')
    const hash1 = hashApiKey('sk-same-key')
    const hash2 = hashApiKey('sk-same-key')
    expect(hash1).toBe(hash2)
  })

  it('produit des hash différents pour des clés différentes', async () => {
    const { hashApiKey } = await import('@/lib/api-key')
    const hash1 = hashApiKey('sk-key-one')
    const hash2 = hashApiKey('sk-key-two')
    expect(hash1).not.toBe(hash2)
  })
})

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne null si aucun header x-api-key', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    const req = createMockRequest({})
    const result = await validateApiKey(req)
    expect(result).toBeNull()
    expect(prismaMock.apiKey.findFirst).not.toHaveBeenCalled()
  })

  it('retourne null si la clé est trop courte (< 8 caractères)', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    const req = createMockRequest({ 'x-api-key': 'short' })
    const result = await validateApiKey(req)
    expect(result).toBeNull()
    expect(prismaMock.apiKey.findFirst).not.toHaveBeenCalled()
  })

  it('retourne null si la clé est trop longue (> 512 caractères)', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    const req = createMockRequest({ 'x-api-key': 'a'.repeat(600) })
    const result = await validateApiKey(req)
    expect(result).toBeNull()
    expect(prismaMock.apiKey.findFirst).not.toHaveBeenCalled()
  })

  it('retourne null si la clé na pas été trouvée dans la base', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue(null)
    const req = createMockRequest({ 'x-api-key': 'sk-invalid-key-12345678' })
    const result = await validateApiKey(req)
    expect(result).toBeNull()
    expect(prismaMock.apiKey.findFirst).toHaveBeenCalled()
  })

  it('retourne null si la clé est expirée', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      expiresAt: new Date(Date.now() - 86400000), // hier
    })
    const req = createMockRequest({ 'x-api-key': 'sk-expired-key-12345678' })
    const result = await validateApiKey(req)
    expect(result).toBeNull()
  })

  it("retourne les infos d'auth si la clé est valide", async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue({
      userId: 'user-42',
      organizationId: 'org-7',
      expiresAt: null, // jamais expire
    })
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 })

    const req = createMockRequest({ 'x-api-key': 'sk-valid-key-12345678' })
    const result = await validateApiKey(req)

    expect(result).toEqual({
      userId: 'user-42',
      organizationId: 'org-7',
    })
    // Vérifie que lastUsedAt a été mis à jour
    expect(prismaMock.apiKey.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ keyHash: expect.any(String) }),
      data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
    })
  })

  it('utilise orderBy createdAt desc pour un résultat déterministe', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      expiresAt: null,
    })
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 })

    const req = createMockRequest({ 'x-api-key': 'sk-valid-key-12345678' })
    await validateApiKey(req)

    expect(prismaMock.apiKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('retourne null pour une clé avec expiresAt dans le futur mais pas encore valide', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      expiresAt: new Date(Date.now() - 1), // expire depuis 1ms
    })
    const req = createMockRequest({ 'x-api-key': 'sk-just-expired-12345678' })
    const result = await validateApiKey(req)
    expect(result).toBeNull()
  })

  it('gère les erreurs updateMany sans planter (fire-and-forget)', async () => {
    const { validateApiKey } = await import('@/lib/api-key')
    prismaMock.apiKey.findFirst.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      expiresAt: null,
    })
    prismaMock.apiKey.updateMany.mockRejectedValue(new Error('DB error'))

    const req = createMockRequest({ 'x-api-key': 'sk-valid-key-12345678' })
    const result = await validateApiKey(req)

    // Même si updateMany échoue, la validation doit réussir
    expect(result).toEqual({
      userId: 'user-1',
      organizationId: 'org-1',
    })
  })
})
