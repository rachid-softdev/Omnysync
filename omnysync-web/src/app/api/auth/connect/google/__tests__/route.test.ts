/**
 * Tests for GET /api/auth/connect/google  (OAuth initiation)
 * Tests for GET /api/auth/connect/google/callback  (OAuth exchange)
 *
 * Pattern: mock @/lib/auth (auth), @/lib/prisma, @/lib/auth/org
 * (ensureUserOrg), @/lib/crypto (encrypt), the global fetch, and node 'crypto'
 * (randomUUID) since the builtin isn't resolvable under this vitest config.
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
  ensureUserOrg: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
}))

// node:crypto builtin is not resolvable under this vitest config.
vi.mock('crypto', () => ({
  default: { randomUUID: vi.fn(() => 'fake-state-uuid') },
  randomUUID: vi.fn(() => 'fake-state-uuid'),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureUserOrg } from '@/lib/auth/org'
import { encrypt } from '@/lib/crypto'

const makeGet = (url: string) => new NextRequest(url, { method: 'GET' })

describe('GET /api/auth/connect/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
  })

  it('redirects to the sign-in page when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/connect/google/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/google'))
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('/auth/signin')
  })

  it('redirects to Google OAuth with the drive.readonly scope', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/google'))
    const location = response.headers.get('location')!

    expect(response.status).toBe(307)
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(location).toContain('client_id=google-client-id')
    expect(location).toContain('response_type=code')
    // 🔒 Must request drive.readonly scope per the security requirement
    expect(location).toContain('drive.readonly')
    expect(location).toContain('state=fake-state-uuid')
  })
})

describe('GET /api/auth/connect/google/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
    vi.mocked(ensureUserOrg).mockResolvedValue('org-1')
    vi.mocked(encrypt).mockReturnValue('encrypted-creds' as any)
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.connector.create).mockResolvedValue({ id: 'conn-new' } as any)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at', refresh_token: 'rt' }),
      })
    )
  })

  it('redirects to error page when code or state is missing', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const response = await GET(makeGet('http://localhost:3000/api/auth/connect/google/callback'))
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('error=missing_params')
  })

  it('redirects to sign-in when the session is missing', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const response = await GET(
      makeGet('http://localhost:3000/api/auth/connect/google/callback?code=abc&state=s')
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
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const response = await GET(
      makeGet('http://localhost:3000/api/auth/connect/google/callback?code=abc&state=s')
    )
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('error=token_exchange_failed')
  })

  it('creates a connector with encrypted credentials and redirects to connected=google_docs', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const response = await GET(
      makeGet('http://localhost:3000/api/auth/connect/google/callback?code=abc&state=s')
    )
    const location = response.headers.get('location')!
    expect(response.status).toBe(307)
    expect(location).toContain('connected=google_docs')

    expect(encrypt).toHaveBeenCalledWith(JSON.stringify({ accessToken: 'at', refreshToken: 'rt' }))
    expect(prisma.connector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'GOOGLE_DOCS',
          name: 'Google Docs',
          status: 'ACTIVE',
          credentials: 'encrypted-creds',
        }),
      })
    )
  })

  it('updates an existing connector instead of creating a duplicate', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({ id: 'conn-existing' } as any)
    vi.mocked(prisma.connector.update).mockResolvedValue({ id: 'conn-existing' } as any)

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    await GET(makeGet('http://localhost:3000/api/auth/connect/google/callback?code=abc&state=s'))

    expect(prisma.connector.update).toHaveBeenCalled()
    expect(prisma.connector.create).not.toHaveBeenCalled()
  })
})
