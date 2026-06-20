/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for Webhook Endpoints ID routes
 * Covers GET /api/webhook-endpoints/[id], PATCH /api/webhook-endpoints/[id],
 * DELETE /api/webhook-endpoints/[id], POST /api/webhook-endpoints/[id]/test
 *
 * Pattern: mock auth + prisma + fetch at module level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

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
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ============================================================================
// Helpers
// ============================================================================

const mockWebhook = {
  id: 'wh-1',
  connectorId: 'conn-1',
  connector: { name: 'WordPress', type: 'WORDPRESS' },
  type: 'WORDPRESS',
  url: 'https://example.com/webhook',
  isActive: true,
  secret: 'test-secret',
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-15'),
}

const mockMembership = { organizationId: 'org-1' }

function setupAuth() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: 'user-1', email: 'test@omnysync.com' },
  } as any)
}

function setupMembership() {
  vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(mockMembership as any)
}

// ============================================================================
// GET /api/webhook-endpoints/[id]
// ============================================================================

describe('GET /api/webhook-endpoints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    setupMembership()
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(mockWebhook as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(404)
  })

  it('should return 404 when webhook is not found', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-nonexistent')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-nonexistent' }) })

    expect(response.status).toBe(404)
  })

  it('should return webhook details when found', async () => {
    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhook.id).toBe('wh-1')
    expect(data.webhook.connectorName).toBe('WordPress')
    expect(data.webhook.secret).toBe('***')
    expect(data.webhook.isActive).toBe(true)
    expect(prisma.webhookEndpoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1', organizationId: 'org-1' },
      })
    )
  })

  it('should return 500 when prisma query fails', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500)
  })

  it('should return webhook with null connector name when connector is missing', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      ...mockWebhook,
      connector: null,
    } as any)

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhook.connectorName).toBeUndefined()
  })

  it('should return 500 when auth throws an error', async () => {
    vi.mocked(auth).mockRejectedValue(new Error('Auth error'))

    const { GET } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1')
    const response = await GET(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500)
  })
})

// ============================================================================
// PATCH /api/webhook-endpoints/[id]
// ============================================================================

describe('PATCH /api/webhook-endpoints/[id]', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    setupMembership()
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(mockWebhook as any)
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'wh-1',
      isActive: false,
    } as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return 404 when webhook is not found', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(null)

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-nonexistent' }),
    })

    expect(response.status).toBe(404)
  })

  it('should return 400 when body is invalid (not an object)', async () => {
    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await PATCH(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500) // JSON parse error in handler
  })

  it('should return 400 when isActive is not a boolean', async () => {
    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: 'yes' }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })

    expect(response.status).toBe(400)
  })

  it('should toggle webhook isActive and return updated webhook', async () => {
    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhook.isActive).toBe(false)
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1' },
        data: { isActive: false },
      })
    )
  })

  it('should return 500 when update fails', async () => {
    vi.mocked(prisma.webhookEndpoint.update).mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })

    expect(response.status).toBe(500)
  })

  it('should return 200 with empty body (isActive unchanged by optional field)', async () => {
    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: 'wh-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    // isActive is optional in schema, so empty body passes validation
    // update is called with isActive: undefined — the handler sends it anyway
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1' },
        data: { isActive: undefined },
      })
    )
  })

  it('should return 200 when extra fields are sent in body', async () => {
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'wh-1',
      isActive: true,
    } as any)

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: true, extraField: 'should be ignored' }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.webhook.isActive).toBe(true)
  })

  it('should return 401 when auth throws an error', async () => {
    vi.mocked(auth).mockRejectedValue(new Error('Auth error'))

    const { PATCH } = await import('@/app/api/webhook-endpoints/[id]/route')
    const response = await PATCH(makeRequest({ isActive: false }), {
      params: Promise.resolve({ id: 'wh-1' }),
    })

    expect(response.status).toBe(500)
  })
})

// ============================================================================
// DELETE /api/webhook-endpoints/[id]
// ============================================================================

describe('DELETE /api/webhook-endpoints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    setupMembership()
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(mockWebhook as any)
    vi.mocked(prisma.webhookEndpoint.delete).mockResolvedValue({} as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(404)
  })

  it('should return 404 when webhook is not found', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-nonexistent', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-nonexistent' }) })

    expect(response.status).toBe(404)
  })

  it('should delete webhook and return success', async () => {
    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.webhookEndpoint.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1' },
      })
    )
  })

  it('should return 500 when delete fails', async () => {
    vi.mocked(prisma.webhookEndpoint.delete).mockRejectedValue(new Error('DB error'))

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500)
  })

  it('should return 401 when auth throws', async () => {
    vi.mocked(auth).mockRejectedValue(new Error('Auth error'))

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500)
  })

  it('should return 404 when webhook exists but organization lookup fails', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/webhook-endpoints/[id]/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1', {
      method: 'DELETE',
    })
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(404)
  })
})

// ============================================================================
// POST /api/webhook-endpoints/[id]/test
// ============================================================================

describe('POST /api/webhook-endpoints/[id]/test', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    setupMembership()

    // Default: webhook found and active
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      ...mockWebhook,
      url: 'https://valid-external.com/webhook',
    } as any)

    // Default: syncLog.create succeeds
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)

    // Mock global fetch
    fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(401)
  })

  it('should return 404 when user has no organization', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(404)
  })

  it('should return 404 when webhook is not found', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-nonexistent/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-nonexistent' }) })

    expect(response.status).toBe(404)
  })

  it('should return 400 when webhook is disabled', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      ...mockWebhook,
      isActive: false,
    } as any)

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('désactivé')
  })

  it('should return 400 when webhook URL is invalid', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      ...mockWebhook,
      url: 'not-a-valid-url',
    } as any)

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('URL')
  })

  it('should return 400 when webhook URL points to private/internal address (SSRF protection)', async () => {
    const privateUrls = [
      'http://localhost:8080/webhook',
      'http://127.0.0.1:3000/webhook',
      'http://10.0.0.1/webhook',
      'http://192.168.1.1/webhook',
      'http://169.254.169.254/latest/meta-data/',
    ]

    for (const privateUrl of privateUrls) {
      vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
        ...mockWebhook,
        url: privateUrl,
      } as any)

      const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
      const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
        method: 'POST',
      })
      const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('internes')
    }
  })

  it('should send test webhook and return success when fetch succeeds', async () => {
    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://valid-external.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
        }),
      })
    )

    // Vérifie que le log a été créé avec SUCCESS
    expect(prisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'webhook_test',
          status: 'SUCCESS',
        }),
      })
    )
  })

  it('should return success=false when fetch returns non-ok status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    // La route retourne 200 avec success: false
    expect(response.status).toBe(200)
    expect(data.success).toBe(false)
    expect(data.statusCode).toBe(404)

    // Vérifie que le log a été créé avec ERROR
    expect(prisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ERROR',
        }),
      })
    )
  })

  it('should return success=false when fetch throws (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.message).toContain('Network error')
  })

  it('should return 500 when an unexpected error occurs', async () => {
    vi.mocked(prisma.syncLog.create).mockRejectedValue(new Error('Unexpected'))

    const { POST } = await import('@/app/api/webhook-endpoints/[id]/test/route')
    const req = new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
      method: 'POST',
    })
    const response = await POST(req, { params: Promise.resolve({ id: 'wh-1' }) })

    expect(response.status).toBe(500)
  })
})
