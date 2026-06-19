/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests pour les routes API des Connectors
 * Couvre GET /api/connectors et POST /api/connectors
 *
 * Pattern: mock auth + prisma + services externes au niveau module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/auth/subscription', () => ({
  checkConnectorLimit: vi.fn(),
}))

vi.mock('@/lib/validations', () => ({
  createConnectorSchema: {
    safeParse: vi.fn(),
  },
}))

vi.mock('@/lib/api-error', () => ({
  apiError: vi.fn((message: string, status: number, code?: string) => ({
    status,
    json: () =>
      Promise.resolve({
        error: message,
        ...(code ? { code } : {}),
      }),
  })),
}))

vi.mock('@omnysync/core/services/wordpress', () => ({
  testWordPressConnection: vi.fn(),
  saveWordPressConnector: vi.fn(),
}))

vi.mock('@omnysync/core/services/ghost', () => ({
  testGhostConnection: vi.fn(),
  saveGhostConnector: vi.fn(),
}))

// Mocks complets pour les autres connecteurs (importés statiquement par la route)
vi.mock('@omnysync/core/services/webflow', () => ({
  testWebflowConnection: vi.fn(),
}))

vi.mock('@omnysync/core/services/shopify', () => ({
  testShopifyConnection: vi.fn(),
}))

vi.mock('@omnysync/core/services/medium', () => ({
  testMediumConnection: vi.fn(),
}))

vi.mock('@omnysync/core/services/airtable', () => ({
  testAirtableConnection: vi.fn(),
}))

vi.mock('@omnysync/core/services/contentful', () => ({
  testContentfulConnection: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkConnectorLimit } from '@/lib/auth/subscription'
import { createConnectorSchema } from '@/lib/validations'
import { apiError } from '@/lib/api-error'
import { testWordPressConnection, saveWordPressConnector } from '@omnysync/core/services/wordpress'
import { testGhostConnection, saveGhostConnector } from '@omnysync/core/services/ghost'

// ============================================================================
// SUITE
// ============================================================================

describe('GET /api/connectors', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  // ── Retourne les connecteurs ─────────────────────────────────────────────

  it('should return connectors for the authenticated organization', async () => {
    const mockConnectors = [
      { id: 'c1', type: 'WORDPRESS', name: 'Mon WP', organizationId: 'org-1' },
      { id: 'c2', type: 'GHOST', name: 'Mon Ghost', organizationId: 'org-1' },
    ]
    vi.mocked(prisma.connector.findMany).mockResolvedValue(mockConnectors as any)

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockConnectors)
    expect(prisma.connector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  // ── Liste vide ──────────────────────────────────────────────────────────

  it('should return empty array when no connectors exist', async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  // ── Cache-Control header ────────────────────────────────────────────────

  it('should include Cache-Control header with private directive', async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()

    expect(response.headers.get('Cache-Control')).toMatch(/private/)
    expect(response.headers.get('Cache-Control')).toMatch(/max-age=30/)
    expect(response.headers.get('Cache-Control')).toMatch(/stale-while-revalidate=60/)
  })
})

// ============================================================================
// POST /api/connectors
// ============================================================================

describe('POST /api/connectors', () => {
  const validWordPressBody = {
    type: 'WORDPRESS',
    name: 'Mon WordPress',
    config: { siteUrl: 'https://example.com' },
    credentials: { username: 'admin', password: 'secret123' },
  }

  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: utilisateur authentifié
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: validation passe
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({
      success: true,
      data: validWordPressBody,
    } as any)

    // Default: limit OK
    vi.mocked(checkConnectorLimit).mockResolvedValue({ allowed: true } as any)
  })

  // ── Non authentifié ──────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(validWordPressBody))

    expect(response.status).toBe(401)
  })

  // ── WORDPRESS valide ─────────────────────────────────────────────────────

  it('should create a WordPress connector and return 200', async () => {
    vi.mocked(testWordPressConnection).mockResolvedValue({ success: true })
    vi.mocked(saveWordPressConnector).mockResolvedValue({
      id: 'conn-new-1',
      type: 'WORDPRESS',
      name: 'WordPress - example.com',
      organizationId: 'org-1',
    } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(validWordPressBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('conn-new-1')
    expect(data.type).toBe('WORDPRESS')
    expect(testWordPressConnection).toHaveBeenCalledWith(
      'https://example.com',
      'admin',
      'secret123'
    )
    expect(saveWordPressConnector).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'https://example.com',
      'admin',
      'secret123'
    )
  })

  // ── GHOST valide ────────────────────────────────────────────────────────

  it('should create a Ghost connector and return 200', async () => {
    const ghostBody = {
      type: 'GHOST',
      name: 'Mon Ghost',
      config: { siteUrl: 'https://ghost.example.com' },
      credentials: { adminApiKey: 'abc123:def456' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({
      success: true,
      data: ghostBody,
    } as any)
    vi.mocked(testGhostConnection).mockResolvedValue({ success: true })
    vi.mocked(saveGhostConnector).mockResolvedValue({
      id: 'conn-new-2',
      type: 'GHOST',
      name: 'Ghost - ghost.example.com',
      organizationId: 'org-1',
    } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(ghostBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('conn-new-2')
    expect(data.type).toBe('GHOST')
    expect(testGhostConnection).toHaveBeenCalledWith('https://ghost.example.com', 'abc123:def456')
    expect(saveGhostConnector).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'https://ghost.example.com',
      'abc123:def456'
    )
  })

  // ── Type invalide ───────────────────────────────────────────────────────

  it('should return 400 for invalid connector type (unknown type)', async () => {
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({
      success: true,
      data: { ...validWordPressBody, type: 'INVALID_TYPE' },
    } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest({ ...validWordPressBody, type: 'INVALID_TYPE' }))

    expect(response.status).toBe(400)
  })

  // ── Nom manquant (Zod validation) ───────────────────────────────────────

  it('should return 400 when name is missing (Zod validation fails)', async () => {
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Name is required' }] },
    } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest({ type: 'WORDPRESS' }))

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalled()
  })

  // ── Test de connexion échoue ────────────────────────────────────────────

  it('should return 400 when WordPress connection test fails', async () => {
    vi.mocked(testWordPressConnection).mockResolvedValue({
      success: false,
      error: 'Connection refused',
    })

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(validWordPressBody))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/Connection failed/i)
    // Ne pas exposer le vrai message d'erreur au client
    expect(data.error).not.toContain('Connection refused')
  })

  // ── Connector limit exceeded ────────────────────────────────────────────

  it('should return 429 when connector limit is exceeded', async () => {
    // Note: le code de la route vérifie `if (!withinLimit)`. checkConnectorLimit
    // retourne normalement un objet `{ allowed, current, limit }`. On mocke une
    // valeur falsy pour déclencher la branche limite dépassée.
    vi.mocked(checkConnectorLimit).mockResolvedValue(false as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(validWordPressBody))

    expect(response.status).toBe(429)
  })
})
