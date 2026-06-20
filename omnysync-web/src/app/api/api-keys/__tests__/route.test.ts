/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: { findFirst: vi.fn() },
    apiKey: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}))

import { GET, POST } from '../route'

describe('GET /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when no organization found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it('returns list of API keys', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      {
        id: 'key-1',
        name: 'Production',
        prefix: 'omny_a1b2',
        lastUsedAt: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'key-2',
        name: 'Development',
        prefix: 'omny_c3d4',
        lastUsedAt: new Date('2026-06-01'),
        expiresAt: new Date('2026-12-01'),
        createdAt: new Date('2026-03-01'),
      },
    ] as any)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.apiKeys).toHaveLength(2)
    expect(data.apiKeys[0].name).toBe('Production')
  })

  it('returns empty array when no keys exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([])

    const response = await GET()
    const data = await response.json()

    expect(data.apiKeys).toEqual([])
  })

  it('returns 500 on prisma error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.apiKey.findMany).mockRejectedValue(new Error('DB error'))

    const response = await GET()
    expect(response.status).toBe(500)
  })
})

describe('POST /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Key' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('creates an API key successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)
    vi.mocked(prisma.apiKey.create).mockResolvedValue({
      id: 'key-new',
      name: 'My Key',
      prefix: 'omny_a1b2',
      expiresAt: new Date('2027-01-01'),
      createdAt: new Date('2026-01-01'),
    } as any)

    const request = new NextRequest('http://localhost:3000/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Key' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.apiKey.name).toBe('My Key')
    expect(data.rawKey).toBeDefined()
    expect(typeof data.rawKey).toBe('string')
  })

  it('rejects missing name', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const request = new NextRequest('http://localhost:3000/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('rejects empty name', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const request = new NextRequest('http://localhost:3000/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
