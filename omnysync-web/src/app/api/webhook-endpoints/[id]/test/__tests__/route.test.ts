import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: { findFirst: vi.fn() },
    webhookEndpoint: { findFirst: vi.fn() },
    syncLog: { create: vi.fn() },
  },
}))

const mockCheckPlanFeature = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/subscription', () => ({
  checkPlanFeature: mockCheckPlanFeature,
}))

const { mockPostJson, UnsafeOutboundUrlError } = vi.hoisted(() => {
  class UnsafeOutboundUrlError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'UnsafeOutboundUrlError'
    }
  }

  return { mockPostJson: vi.fn(), UnsafeOutboundUrlError }
})

vi.mock('@omnysync/core/services/safe-fetch', () => ({
  postJsonWithPinnedDns: mockPostJson,
  UnsafeOutboundUrlError,
}))

import { prisma } from '@/lib/prisma'

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/webhook-endpoints/wh-1/test', {
    method: 'POST',
  })
}

async function callRoute() {
  const { POST } = await import('../route')
  return POST(makeRequest(), { params: Promise.resolve({ id: 'wh-1' }) })
}

describe('POST /api/webhook-endpoints/[id]/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockCheckPlanFeature.mockResolvedValue({ allowed: true })
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hooks/omnysync',
      isActive: true,
    } as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    mockPostJson.mockResolvedValue({ ok: true, status: 200, body: '', headers: {} })
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await callRoute()

    expect(response.status).toBe(401)
  })

  it('returns 403 when the plan does not include webhooks', async () => {
    mockCheckPlanFeature.mockResolvedValue({ allowed: false, upgradeUrl: '/pricing' })

    const response = await callRoute()
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('PLAN_FEATURE_REQUIRED')
  })

  it('returns 404 when the webhook does not belong to the organization', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue(null)

    const response = await callRoute()

    expect(response.status).toBe(404)
    expect(mockPostJson).not.toHaveBeenCalled()
  })

  it('returns 400 when the webhook is disabled', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hooks/omnysync',
      isActive: false,
    } as any)

    const response = await callRoute()

    expect(response.status).toBe(400)
    expect(mockPostJson).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid URL', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      url: 'not-a-url',
      isActive: true,
    } as any)

    const response = await callRoute()

    expect(response.status).toBe(400)
    expect(mockPostJson).not.toHaveBeenCalled()
  })

  it('returns 400 when the safe fetch rejects a private target', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'wh-1',
      url: 'http://127.0.0.1:5432/hook',
      isActive: true,
    } as any)
    mockPostJson.mockRejectedValue(
      new UnsafeOutboundUrlError('Webhook URL must point to a public host')
    )

    const response = await callRoute()

    expect(response.status).toBe(400)
    expect(mockPostJson).toHaveBeenCalledTimes(1)
    expect(prisma.syncLog.create).not.toHaveBeenCalled()
  })

  it('returns 400 when a public hostname resolves to an internal address', async () => {
    mockPostJson.mockRejectedValue(
      new UnsafeOutboundUrlError('Webhook URL must point to a public host')
    )

    const response = await callRoute()

    expect(response.status).toBe(400)
    expect(mockPostJson).toHaveBeenCalledTimes(1)
  })

  it('sends the test request through the pinned-DNS helper', async () => {
    const response = await callRoute()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockPostJson).toHaveBeenCalledWith(
      'https://example.com/hooks/omnysync',
      expect.any(String),
      { 'X-Webhook-Test': 'true' }
    )

    const body = JSON.parse(mockPostJson.mock.calls[0][1])
    expect(body.event).toBe('test')
    expect(prisma.syncLog.create).toHaveBeenCalled()
  })

  it('reports failure when the outbound request fails', async () => {
    mockPostJson.mockRejectedValue(new Error('connection refused'))

    const response = await callRoute()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(false)
  })
})
