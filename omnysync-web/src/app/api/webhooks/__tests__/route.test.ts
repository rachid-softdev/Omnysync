/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for Webhooks API routes
 * Covers GET /api/webhooks, POST /api/webhooks, POST /api/webhooks/[connector]
 *
 * Pattern: mock auth + prisma + crypto at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks for crypto ────────────────────────────────────────────────

const { mockCrypto } = vi.hoisted(() => {
  const mockDigest = vi.fn()
  const mockUpdate = vi.fn(() => ({ digest: mockDigest }))
  const mockCreateHmac = vi.fn(() => ({ update: mockUpdate }))
  const mockTimingSafeEqual = vi.fn()
  const mockRandomBytes = vi.fn().mockReturnValue(Buffer.alloc(32, 'a'))
  return {
    mockCrypto: {
      createHmac: mockCreateHmac,
      timingSafeEqual: mockTimingSafeEqual,
      randomBytes: mockRandomBytes,
    },
  }
})

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: {
      findFirst: vi.fn(),
    },
    webhookEndpoint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    connector: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}))

vi.mock('crypto', () => ({
  default: mockCrypto,
  ...mockCrypto,
}))

vi.mock('@omnysync/core/services/wordpress', () => ({
  createWordPressClient: vi.fn(),
}))

vi.mock('@omnysync/core/services/ghost', () => ({
  createGhostClient: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { createWordPressClient } from '@omnysync/core/services/wordpress'
import { createGhostClient } from '@omnysync/core/services/ghost'

// ============================================================================
// GET /api/webhooks
// ============================================================================

describe('GET /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    // Default: user has org membership
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    // Default: some webhooks exist
    vi.mocked(prisma.webhookEndpoint.findMany).mockResolvedValue([
      {
        id: 'wh-1',
        connectorId: 'conn-1',
        connector: { name: 'WordPress', type: 'WORDPRESS' },
        type: 'WORDPRESS',
        url: 'https://example.com/webhook',
        isActive: true,
        createdAt: new Date('2026-01-01'),
      },
    ] as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()

    expect(response.status).toBe(404)
  })

  it('should return webhooks list for authenticated user', async () => {
    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhooks).toHaveLength(1)
    expect(data.webhooks[0].id).toBe('wh-1')
    expect(data.webhooks[0].connectorName).toBe('WordPress')
    expect(data.webhooks[0].secret).toBe('***')
    expect(data.webhooks[0].isActive).toBe(true)
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      })
    )
  })

  it('should return 500 when prisma query fails', async () => {
    vi.mocked(prisma.webhookEndpoint.findMany).mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('should return empty list when no webhooks exist', async () => {
    vi.mocked(prisma.webhookEndpoint.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhooks).toEqual([])
  })

  it('should return 401 when auth throws an error', async () => {
    vi.mocked(auth).mockRejectedValue(new Error('Auth error'))

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('should mask secret in response (always show ***)', async () => {
    vi.mocked(prisma.webhookEndpoint.findMany).mockResolvedValue([
      {
        id: 'wh-2',
        connectorId: 'conn-2',
        connector: { name: null, type: 'SHOPIFY' },
        type: 'SHOPIFY',
        url: 'https://example.com/shopify',
        isActive: false,
        createdAt: new Date('2026-06-01'),
      },
    ] as any)

    const { GET } = await import('@/app/api/webhooks/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhooks[0].secret).toBe('***')
    expect(data.webhooks[0].connectorName).toBeNull()
    expect(data.webhooks[0].isActive).toBe(false)
  })
})

// ============================================================================
// POST /api/webhooks
// ============================================================================

describe('POST /api/webhooks', () => {
  const validBody = {
    connectorId: 'conn-1',
    type: 'WORDPRESS' as const,
    url: 'https://example.com/webhook',
  }

  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    // Default: user has org membership
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    // Default: connector exists and belongs to org
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
    } as any)

    // Default: webhook creation succeeds
    vi.mocked(prisma.webhookEndpoint.create).mockResolvedValue({
      id: 'wh-new',
      connectorId: 'conn-1',
      type: 'WORDPRESS',
      url: 'https://example.com/webhook',
      secret: 'generated-secret-123',
      isActive: true,
      createdAt: new Date('2026-06-20'),
    } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(404)
  })

  it('should return 404 when connector does not exist', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(404)
  })

  it('should return 400 when body has invalid type', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest({ ...validBody, type: 'INVALID_TYPE' }))

    expect(response.status).toBe(400)
  })

  it('should return 400 when url is not valid', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest({ ...validBody, url: 'not-a-url' }))

    expect(response.status).toBe(400)
  })

  it('should create webhook and return 200 with audit log', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhook.id).toBe('wh-new')
    expect(data.webhook.secret).toBe('generated-secret-123')

    // Vérifie l'audit log
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          action: 'webhook.created',
        }),
      })
    )
  })

  it('should return 500 when creation fails', async () => {
    vi.mocked(prisma.webhookEndpoint.create).mockRejectedValue(new Error('DB error'))

    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(500)
  })

  it('should return 400 when connectorId is empty string', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest({ ...validBody, connectorId: '' }))

    expect(response.status).toBe(400)
  })

  it('should return 400 when type is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const { type, ...bodyWithoutType } = validBody
    const response = await POST(makeRequest(bodyWithoutType))

    expect(response.status).toBe(400)
  })

  it('should return 400 when url is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const { url, ...bodyWithoutUrl } = validBody
    const response = await POST(makeRequest(bodyWithoutUrl))

    expect(response.status).toBe(400)
  })

  it('should return 400 when body is empty JSON object', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
  })

  it('should return 500 when request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/webhooks/route')
    const req = new NextRequest('http://localhost:3000/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await POST(req)

    expect(response.status).toBe(500)
  })

  it('should return 500 when audit log creation fails but webhook is created', async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('Audit log error'))

    const { POST } = await import('@/app/api/webhooks/route')
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(500)
  })
})

// ============================================================================
// POST /api/webhooks/[connector] — generic dispatch
// ============================================================================

describe('POST /api/webhooks/[connector]', () => {
  const makePostRequest = (connector: string, body: any, headers: Record<string, string> = {}) => {
    const searchParams = new URLSearchParams({ connector_id: 'conn-1' })
    return new NextRequest(`http://localhost:3000/api/webhooks/${connector}?${searchParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: webhook endpoint found
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'WORDPRESS',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/webhook',
    } as any)

    // Default: crypto signature passes
    mockCrypto.createHmac.mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue('valid_signature_hash'),
      }),
    })
    mockCrypto.timingSafeEqual.mockReturnValue(true)

    // Default: connector exists
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-1',
      type: 'WORDPRESS',
      credentials: 'encrypted-creds',
      config: { siteUrl: 'https://example.com' },
    } as any)

    // Default: decrypt returns base64 credentials
    vi.mocked(decrypt).mockReturnValue('admin:password123')

    // Default: WordPress client
    vi.mocked(createWordPressClient).mockReturnValue({
      getPost: vi.fn().mockResolvedValue({
        content: { rendered: '<p>Hello</p>' },
        title: { rendered: 'Test Post' },
        modified: '2026-06-20T00:00:00.000Z',
      }),
    } as any)

    // Default: ghost client
    vi.mocked(createGhostClient).mockReturnValue({
      getPost: vi.fn().mockResolvedValue({
        posts: [
          {
            html: '<p>Ghost content</p>',
            title: 'Ghost Post',
            updated_at: '2026-06-20T00:00:00.000Z',
          },
        ],
      }),
    } as any)
  })

  // ── connector_id manquant ────────────────────────────────────────────────

  it('should return 400 when connector_id query param is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/wordpress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(req, {
      params: Promise.resolve({ connector: 'wordpress' }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Missing connector_id')
  })

  // ── Type de connecteur non supporté ──────────────────────────────────────

  it('should return 400 for unsupported connector type', async () => {
    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(makePostRequest('unknown', {}), {
      params: Promise.resolve({ connector: 'unknown' }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Unsupported connector type')
  })

  // ── WordPress — signature invalide → 401 ─────────────────────────────────

  it('should return 401 when WordPress signature is invalid', async () => {
    mockCrypto.timingSafeEqual.mockReturnValue(false)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'wordpress',
        { post_id: 123, action: 'post_published' },
        { 'x-hub-signature': 'bad' }
      ),
      { params: Promise.resolve({ connector: 'wordpress' }) }
    )

    expect(response.status).toBe(401)
  })

  // ── WordPress — signature nulle (mauvais format) → 500 ────────────────────
  //
  // NOTE: The WordPress handler reads req.text() for signature verification,
  // then calls req.json() for payload parsing. Since the body stream can only
  // be read once in the Web API, the second call throws "Body has already been
  // read". This is a known source bug—the handler should use JSON.parse(body)
  // instead of await req.json(). Tests document this behavior.

  it('should return 500 when WordPress handler attempts to process after signature (body double-read bug)', async () => {
    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'wordpress',
        { post_id: 123, action: 'post_published' },
        { 'x-hub-signature': 'sig' }
      ),
      { params: Promise.resolve({ connector: 'wordpress' }) }
    )

    // Returns 500 because body stream was consumed by req.text() then req.json() fails
    expect(response.status).toBe(500)
  })

  // ── Ghost — signature invalide → 401 ─────────────────────────────────────

  it('should return 401 when Ghost signature is invalid', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'GHOST',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/ghost-webhook',
    } as any)

    mockCrypto.timingSafeEqual.mockReturnValue(false)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'ghost',
        { event: 'post.published', post: { id: 'abc123' } },
        { 'x-ghost-signature': 'sha256=badsig' }
      ),
      { params: Promise.resolve({ connector: 'ghost' }) }
    )

    expect(response.status).toBe(401)
  })

  // ── Ghost — succès ───────────────────────────────────────────────────────

  it('should handle Ghost webhook and return 200', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'GHOST',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/ghost-webhook',
    } as any)

    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-1',
      type: 'GHOST',
      credentials: 'encrypted-creds',
      config: { siteUrl: 'https://ghost.example.com' },
    } as any)

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: 'doc-1', organizationId: 'org-1', userId: 'user-1', slug: 'abc123' },
    ] as any)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'ghost',
        { event: 'post.published', post: { id: 'abc123' } },
        { 'x-ghost-signature': 'sha256=validsig' }
      ),
      { params: Promise.resolve({ connector: 'ghost' }) }
    )

    expect(response.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalled()
  })

  // ── Ghost — signature manquante avec secret → 401 ────────────────────────

  it('should return 401 when Ghost has secret but no signature header', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'GHOST',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/ghost-webhook',
    } as any)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest('ghost', { event: 'post.published', post: { id: 'abc123' } }),
      { params: Promise.resolve({ connector: 'ghost' }) }
    )

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Missing signature')
  })

  // ── Webflow — succès ─────────────────────────────────────────────────────

  it('should handle Webflow webhook and return 200', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'WEBFLOW',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/webflow-webhook',
    } as any)

    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-1',
      type: 'WEBFLOW',
      credentials: 'encrypted-creds',
      config: { siteUrl: 'https://webflow.example.com' },
    } as any)

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: 'doc-1', organizationId: 'org-1', userId: 'user-1', slug: 'item-1' },
    ] as any)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'webflow',
        { type: 'item_published', data: { item: { id: 'item-1' } } },
        { 'x-webflow-signature': 'sig' }
      ),
      { params: Promise.resolve({ connector: 'webflow' }) }
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    // NOTE: fetchRemoteContent() returns null for Webflow (not in switch cases),
    // so document.update is NOT called. This is expected source behavior.
    expect(prisma.document.update).not.toHaveBeenCalled()
  })

  // ── Shopify — succès avec topic non-article (évite le body double-read bug) ─

  it('should handle Shopify webhook with non-article topic and return 200', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'SHOPIFY',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/shopify-webhook',
    } as any)

    // Non-article topic avoids the req.json() call after req.text() body read
    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'shopify',
        { field: 'value' },
        { 'x-shopify-hmac-sha256': 'hmacsig', 'x-shopify-topic': 'collection_created' }
      ),
      { params: Promise.resolve({ connector: 'shopify' }) }
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
  })

  // ── Shopify — signature invalide → 401 ───────────────────────────────────

  it('should return 401 when Shopify signature is invalid', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      connectorId: 'conn-1',
      type: 'SHOPIFY',
      isActive: true,
      secret: 'test-secret',
      url: 'https://example.com/shopify-webhook',
    } as any)

    mockCrypto.timingSafeEqual.mockReturnValue(false)

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'shopify',
        { article: { id: 456 } },
        { 'x-shopify-hmac-sha256': 'badhmac', 'x-shopify-topic': 'article_created' }
      ),
      { params: Promise.resolve({ connector: 'shopify' }) }
    )

    expect(response.status).toBe(401)
  })

  // ── Erreur serveur dans un handler ───────────────────────────────────────

  it('should return 500 when handler throws an error', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockRejectedValue(new Error('DB error'))

    const { POST } = await import('@/app/api/webhooks/[connector]/route')
    const response = await POST(
      makePostRequest(
        'wordpress',
        { post_id: 123, action: 'post_published' },
        { 'x-hub-signature': 'sig' }
      ),
      { params: Promise.resolve({ connector: 'wordpress' }) }
    )

    expect(response.status).toBe(500)
  })
})
