/**
 * Tests for GET /api/auth/connect/notion  (OAuth initiation)
 * Tests for GET /api/auth/connect/notion/callback  (OAuth exchange)
 *
 * Pattern: mock @/lib/auth (auth), @/lib/prisma, @/lib/auth/org
 * (getUserOrgId), @/lib/crypto (encrypt), and the global fetch for the token
 * exchange. State is a base64url-encoded JSON payload {userId, nonce}.
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
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
}))

// node:crypto builtin is not resolvable under this vitest config; provide randomUUID.
vi.mock('node:crypto', () => ({
  default: { randomUUID: vi.fn(() => 'fake-nonce-uuid') },
  randomUUID: vi.fn(() => 'fake-nonce-uuid'),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { encrypt } from '@/lib/crypto'

const makeGet = (url: string) => new NextRequest(url, { method: 'GET' })

describe('GET /api/auth/connect/notion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NOTION_CLIENT_ID = 'notion-client-id'
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
  })

  it('redirects to the sign-in page when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/connect/notion/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/notion'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth/signin')
  })

  it('redirects to the Notion OAuth authorize URL with state=userId', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/notion'))
    const location = response.headers.get('location')!

    expect(response.status).toBe(307)
    expect(location).toContain('https://api.notion.com/v1/oauth/authorize')
    expect(location).toContain('client_id=notion-client-id')
    expect(location).toContain('response_type=code')

    // Decode the state and confirm it carries the authenticated user's id
    const stateParam = new URL(location).searchParams.get('state')!
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    expect(decoded.userId).toBe('user-1')
    expect(decoded.nonce).toBeDefined()
  })
})

describe('GET /api/auth/connect/notion/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NOTION_CLIENT_ID = 'notion-client-id'
    process.env.NOTION_CLIENT_SECRET = 'notion-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(encrypt).mockReturnValue('encrypted-token' as any)
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.connector.create).mockResolvedValue({ id: 'conn-new' } as any)

    // Successful token exchange by default
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'tok-123' }),
      })
    )
  })

  const makeState = (userId: string) =>
    Buffer.from(JSON.stringify({ userId, nonce: 'abc' })).toString('base64url')

  it('redirects to error page when code or state is missing', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/notion/callback'))
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('error=missing_params')
  })

  it('redirects to sign-in when the session does not match the state user', async () => {
    // state claims user-2, but the actual session is user-1
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const response = await GET(
      makeGet(
        `http://localhost:3000/api/auth/connect/notion/callback?code=abc&state=${makeState(
          'user-2'
        )}`
      )
    )
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('/auth/signin')
  })

  it('redirects to error page when the token exchange fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    )
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const response = await GET(
      makeGet(
        `http://localhost:3000/api/auth/connect/notion/callback?code=abc&state=${makeState(
          'user-1'
        )}`
      )
    )
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('error=token_exchange_failed')
  })

  it('creates a connector and redirects to connected=notion on success', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const response = await GET(
      makeGet(
        `http://localhost:3000/api/auth/connect/notion/callback?code=abc&state=${makeState(
          'user-1'
        )}`
      )
    )
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('connected=notion')

    expect(encrypt).toHaveBeenCalledWith('tok-123')
    expect(prisma.connector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'NOTION',
          name: 'Notion',
          status: 'ACTIVE',
          credentials: 'encrypted-token',
        }),
      })
    )
  })

  it('updates an existing connector instead of creating a duplicate', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({ id: 'conn-existing' } as any)
    vi.mocked(prisma.connector.update).mockResolvedValue({ id: 'conn-existing' } as any)

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    await GET(
      makeGet(
        `http://localhost:3000/api/auth/connect/notion/callback?code=abc&state=${makeState(
          'user-1'
        )}`
      )
    )

    expect(prisma.connector.update).toHaveBeenCalled()
    expect(prisma.connector.create).not.toHaveBeenCalled()
  })
})
