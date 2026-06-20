/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests unitaires pour les routes /api/webhook-endpoints
 *
 * Couvre :
 *   - GET /api/webhook-endpoints (liste des webhooks)
 *   - POST /api/webhook-endpoints (création d'un webhook)
 *   - Cas d'erreur : non-auth, org manquante, validation, connecteur introuvable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks (hoisted before module imports) ──────────────────────────────────

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: {
      findFirst: vi.fn(),
    },
    webhookEndpoint: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    connector: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(body?: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function mockSession(userId = 'user-1') {
  mockAuth.mockResolvedValue({ user: { id: userId } })
}

function mockOrg(orgId = 'org-1') {
  const { prisma } = vi.mocked(awaitImportPrisma())
  prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: orgId })
}

// Helper to get prisma mock after import
let prismaMock: any = null
async function awaitImportPrisma() {
  if (!prismaMock) {
    prismaMock = await import('@/lib/prisma')
  }
  return prismaMock
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('GET /api/webhook-endpoints', () => {
  async function importGET() {
    const mod = await import('@/app/api/webhook-endpoints/route')
    return mod.GET
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null)
    const GET = await importGET()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Non autorisé')
  })

  it('retourne 404 si aucune organisation trouvée', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))
    prisma.userOrganization.findFirst.mockResolvedValue(null)
    const GET = await importGET()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Organisation non trouvée')
  })

  it("retourne la liste des webhooks pour l'organisation", async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))

    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      {
        id: 'wh-1',
        connectorId: 'conn-1',
        type: 'WORDPRESS',
        url: 'https://example.com/webhook',
        secret: 'super-secret',
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        connector: { name: 'Mon WordPress', type: 'WORDPRESS' },
      },
      {
        id: 'wh-2',
        connectorId: 'conn-2',
        type: 'SHOPIFY',
        url: 'https://shop.example.com/webhook',
        secret: 'another-secret',
        isActive: false,
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        connector: { name: 'Ma boutique', type: 'SHOPIFY' },
      },
    ])

    const GET = await importGET()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.webhooks).toHaveLength(2)
    expect(body.webhooks[0]).toMatchObject({
      id: 'wh-1',
      connectorName: 'Mon WordPress',
      type: 'WORDPRESS',
      isActive: true,
    })
    expect(body.webhooks[0].secret).toBe('***') // secret masqué
    expect(body.webhooks[1].id).toBe('wh-2')
    expect(body.webhooks[1].isActive).toBe(false)
  })

  it('retourne une liste vide si aucun webhook', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))

    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })
    prisma.webhookEndpoint.findMany.mockResolvedValue([])

    const GET = await importGET()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.webhooks).toEqual([])
  })

  it('retourne 500 sur erreur serveur', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))

    prisma.userOrganization.findFirst.mockRejectedValue(new Error('DB error'))

    const GET = await importGET()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Erreur serveur')
  })
})

describe('POST /api/webhook-endpoints', () => {
  async function importPOST() {
    const mod = await import('@/app/api/webhook-endpoints/route')
    return mod.POST
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null)
    const POST = await importPOST()

    const response = await POST(createMockRequest({}))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Non autorisé')
  })

  it('retourne 404 si aucune organisation trouvée', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))
    prisma.userOrganization.findFirst.mockResolvedValue(null)

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({ connectorId: 'conn-1', type: 'WORDPRESS', url: 'https://example.com' })
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Organisation non trouvée')
  })

  it('retourne 400 si le body est invalide (URL manquante)', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))
    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({ connectorId: 'conn-1', type: 'WORDPRESS', url: 'pas-une-url' })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('URL invalide')
  })

  it('retourne 400 si connectorId est vide', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))
    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({ connectorId: '', type: 'WORDPRESS', url: 'https://example.com' })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Connecteur requis')
  })

  it("retourne 404 si le connecteur n'existe pas", async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))
    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })
    prisma.connector.findFirst.mockResolvedValue(null)

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({
        connectorId: 'conn-introuvable',
        type: 'WORDPRESS',
        url: 'https://example.com',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Connecteur non trouvé')
  })

  it('crée un webhook avec succès', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))

    prisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-1' })
    prisma.connector.findFirst.mockResolvedValue({ id: 'conn-1' })
    prisma.webhookEndpoint.create.mockResolvedValue({
      id: 'wh-new',
      organizationId: 'org-1',
      connectorId: 'conn-1',
      type: 'SHOPIFY',
      url: 'https://myshop.com/webhook',
      secret: 'generated-secret-abc123',
      isActive: true,
      createdAt: new Date('2025-06-01'),
      updatedAt: new Date('2025-06-01'),
    })
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' })

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({
        connectorId: 'conn-1',
        type: 'SHOPIFY',
        url: 'https://myshop.com/webhook',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.webhook).toMatchObject({
      id: 'wh-new',
      connectorId: 'conn-1',
      type: 'SHOPIFY',
      url: 'https://myshop.com/webhook',
      isActive: true,
    })
    expect(body.webhook.secret).toBe('generated-secret-abc123')
    expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        connectorId: 'conn-1',
        type: 'SHOPIFY',
        url: 'https://myshop.com/webhook',
        isActive: true,
        secret: expect.any(String),
      }),
    })
    // Vérifie que l'audit log a bien été créé
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'webhook.created',
      }),
    })
  })

  it('retourne 500 sur erreur serveur', async () => {
    mockSession()
    const { prisma } = vi.mocked(await import('@/lib/prisma'))

    prisma.userOrganization.findFirst.mockRejectedValue(new Error('DB error'))

    const POST = await importPOST()
    const response = await POST(
      createMockRequest({ connectorId: 'conn-1', type: 'WORDPRESS', url: 'https://example.com' })
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Erreur serveur')
  })
})
