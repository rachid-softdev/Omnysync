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
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
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
  saveWebflowConnector: vi.fn(),
}))

vi.mock('@omnysync/core/services/shopify', () => ({
  testShopifyConnection: vi.fn(),
  saveShopifyConnector: vi.fn(),
}))

vi.mock('@omnysync/core/services/medium', () => ({
  testMediumConnection: vi.fn(),
  saveMediumConnector: vi.fn(),
}))

vi.mock('@omnysync/core/services/airtable', () => ({
  testAirtableConnection: vi.fn(),
  saveAirtableConnector: vi.fn(),
}))

vi.mock('@omnysync/core/services/contentful', () => ({
  testContentfulConnection: vi.fn(),
  saveContentfulConnector: vi.fn(),
}))

// Google Docs et Notion : save + list importés dynamiquement par la route
vi.mock('@omnysync/core/services/google-docs', () => ({
  saveGoogleDocsConnector: vi.fn(),
  listGoogleDocs: vi.fn(),
}))

vi.mock('@omnysync/core/services/notion', () => ({
  saveNotionConnector: vi.fn(),
  listNotionPages: vi.fn(),
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
import { testWebflowConnection, saveWebflowConnector } from '@omnysync/core/services/webflow'
import { testShopifyConnection, saveShopifyConnector } from '@omnysync/core/services/shopify'
import { testMediumConnection, saveMediumConnector } from '@omnysync/core/services/medium'
import { testAirtableConnection, saveAirtableConnector } from '@omnysync/core/services/airtable'
import {
  testContentfulConnection,
  saveContentfulConnector,
} from '@omnysync/core/services/contentful'
import { saveGoogleDocsConnector, listGoogleDocs } from '@omnysync/core/services/google-docs'
import { saveNotionConnector, listNotionPages } from '@omnysync/core/services/notion'

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

// ============================================================================
// POST /api/connectors — other connector types
// ============================================================================

describe('POST /api/connectors — other connector types', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 't@o.com' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(checkConnectorLimit).mockResolvedValue({ allowed: true } as any)
  })

  it('should create a Webflow connector', async () => {
    const body = {
      type: 'WEBFLOW',
      name: 'WF',
      config: { siteId: 'site-1' },
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testWebflowConnection).mockResolvedValue({ success: true })
    vi.mocked(saveWebflowConnector).mockResolvedValue({ id: 'c-wf', type: 'WEBFLOW' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('c-wf')
    expect(testWebflowConnection).toHaveBeenCalledWith('tok', 'site-1')
    expect(saveWebflowConnector).toHaveBeenCalledWith('org-1', 'tok', 'site-1')
  })

  it('should create a Shopify connector', async () => {
    const body = {
      type: 'SHOPIFY',
      name: 'SH',
      config: { shopDomain: 'x.myshopify.com' },
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testShopifyConnection).mockResolvedValue({ success: true })
    vi.mocked(saveShopifyConnector).mockResolvedValue({ id: 'c-sh', type: 'SHOPIFY' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(testShopifyConnection).toHaveBeenCalledWith('x.myshopify.com', 'tok')
    expect(saveShopifyConnector).toHaveBeenCalledWith('org-1', 'x.myshopify.com', 'tok')
  })

  it('should create a Google Docs connector (no connection test)', async () => {
    const body = {
      type: 'GOOGLE_DOCS',
      name: 'GD',
      credentials: { accessToken: 'tok', refreshToken: 'ref' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(saveGoogleDocsConnector).mockResolvedValue({ id: 'c-gd', type: 'GOOGLE_DOCS' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(saveGoogleDocsConnector).toHaveBeenCalledWith('org-1', 'tok', 'ref')
  })

  it('should create a Notion connector (no connection test)', async () => {
    const body = {
      type: 'NOTION',
      name: 'NO',
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(saveNotionConnector).mockResolvedValue({ id: 'c-no', type: 'NOTION' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(saveNotionConnector).toHaveBeenCalledWith('org-1', 'tok')
  })

  it('should create a Medium connector', async () => {
    const body = {
      type: 'MEDIUM',
      name: 'MD',
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testMediumConnection).mockResolvedValue({ success: true })
    vi.mocked(saveMediumConnector).mockResolvedValue({ id: 'c-md', type: 'MEDIUM' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(testMediumConnection).toHaveBeenCalledWith('tok')
    expect(saveMediumConnector).toHaveBeenCalledWith('org-1', 'tok')
  })

  it('should create an Airtable connector', async () => {
    const body = {
      type: 'AIRTABLE',
      name: 'AT',
      credentials: { apiKey: 'key' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testAirtableConnection).mockResolvedValue({ success: true })
    vi.mocked(saveAirtableConnector).mockResolvedValue({ id: 'c-at', type: 'AIRTABLE' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(testAirtableConnection).toHaveBeenCalledWith('key')
    expect(saveAirtableConnector).toHaveBeenCalledWith('org-1', 'key')
  })

  it('should create a Contentful connector', async () => {
    const body = {
      type: 'CONTENTFUL',
      name: 'CF',
      config: { spaceId: 'space-1' },
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testContentfulConnection).mockResolvedValue({ success: true })
    vi.mocked(saveContentfulConnector).mockResolvedValue({ id: 'c-cf', type: 'CONTENTFUL' } as any)

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(testContentfulConnection).toHaveBeenCalledWith('tok', 'space-1')
    expect(saveContentfulConnector).toHaveBeenCalledWith('org-1', 'space-1', 'tok')
  })

  it('should return 400 when Webflow connection test fails', async () => {
    const body = {
      type: 'WEBFLOW',
      name: 'WF',
      config: { siteId: 'site-1' },
      credentials: { accessToken: 'tok' },
    }
    vi.mocked(createConnectorSchema.safeParse).mockReturnValue({ success: true, data: body } as any)
    vi.mocked(testWebflowConnection).mockResolvedValue({ success: false, error: 'bad' })

    const { POST } = await import('@/app/api/connectors/route')
    const response = await POST(makeRequest(body))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/Connection failed/i)
    expect(saveWebflowConnector).not.toHaveBeenCalled()
  })
})

// ============================================================================
// DELETE /api/connectors/[id]
// ============================================================================

describe('DELETE /api/connectors/[id]', () => {
  const makeRequest = () =>
    new NextRequest('http://localhost:3000/api/connectors/c-1', { method: 'DELETE' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
  })

  it('should delete a connector owned by the organization', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'c-1',
      organizationId: 'org-1',
      userId: 'user-other',
    } as any)
    vi.mocked(prisma.connector.delete).mockResolvedValue({} as any)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'c-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.connector.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } })
  })

  it('should return 404 when the connector is not found', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(404)
    expect(apiError).toHaveBeenCalledWith('Connector not found', 404)
  })

  it('should return 400 when the connector has linked documents (P2003)', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'c-1',
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.connector.delete).mockRejectedValue({ code: 'P2003' })

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'c-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/linked documents/i)
  })
})

// ============================================================================
// GET /api/connectors/[id]/documents
// ============================================================================

describe('GET /api/connectors/[id]/documents', () => {
  const makeReq = (id: string) =>
    new NextRequest(`http://localhost:3000/api/connectors/${id}/documents`)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(401)
  })

  it('should return 404 when the connector does not exist', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(404)
  })

  it('should return 404 when the connector belongs to another user', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'c-1',
      userId: 'user-other',
      type: 'GOOGLE_DOCS',
    } as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(404)
  })

  it('should list Google Docs for a GOOGLE_DOCS connector', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'c-1',
      userId: 'user-1',
      type: 'GOOGLE_DOCS',
      credentials: JSON.stringify({ accessToken: 'tok' }),
    } as any)
    vi.mocked(listGoogleDocs).mockResolvedValue([{ id: 'doc-a', title: 'A' }] as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([{ id: 'doc-a', title: 'A' }])
    expect(listGoogleDocs).toHaveBeenCalledWith('tok')
  })

  it('should list Notion pages for a NOTION connector', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'c-1',
      userId: 'user-1',
      type: 'NOTION',
      config: { accessToken: 'tok' },
    } as any)
    vi.mocked(listNotionPages).mockResolvedValue([{ id: 'p-1', title: 'Page' }] as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(listNotionPages).toHaveBeenCalledWith('tok')
  })

  it('should return 400 for an unsupported connector type', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'c-1',
      userId: 'user-1',
      type: 'WORDPRESS',
    } as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(400)
  })

  it('should return 500 when the listing throws', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'c-1',
      userId: 'user-1',
      type: 'GOOGLE_DOCS',
      credentials: JSON.stringify({ accessToken: 'tok' }),
    } as any)
    vi.mocked(listGoogleDocs).mockRejectedValue(new Error('api down'))

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeReq('c-1'), { params: Promise.resolve({ id: 'c-1' }) })

    expect(response.status).toBe(500)
  })
})
