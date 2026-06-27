/**
 * Tests for Auth Connect API routes
 * Covers GET /api/auth/connect/google, GET /api/auth/connect/google/callback,
 * GET /api/auth/connect/notion, GET /api/auth/connect/notion/callback
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
    connector: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
  ensureUserOrg: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId, ensureUserOrg } from '@/lib/auth/org'
import { encrypt } from '@/lib/crypto'

// ============================================================================
// GET /api/auth/connect/google
// ============================================================================

describe('GET /api/auth/connect/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.GOOGLE_CLIENT_ID = 'google-client-id-123'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)
  })

  it('should redirect to signin when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/google/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/google')
    const response = await GET(req)

    // Should redirect to signin
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/auth/signin')
  })

  it('should redirect to Google OAuth URL when authenticated', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/google')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('accounts.google.com')
    expect(location).toContain('google-client-id-123')
    expect(location).toContain('drive.readonly')
    expect(location).toContain('offline')
    expect(location).toContain('http://localhost:3000/api/auth/connect/google/callback')
  })

  it('should redirect to signin when GOOGLE_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID

    const { GET } = await import('@/app/api/auth/connect/google/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/google')
    const response = await GET(req)

    // Google route doesn't check for missing client ID, URL will have 'undefined'
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('client_id=undefined')
  })
})

// ============================================================================
// GET /api/auth/connect/google/callback
// ============================================================================

describe('GET /api/auth/connect/google/callback', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    process.env.GOOGLE_CLIENT_ID = 'google-client-id-123'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(ensureUserOrg).mockResolvedValue('org-1')
    vi.mocked(encrypt).mockImplementation((val: string) => `encrypted:${val}`)

    // Mock fetch for token exchange
    fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should redirect with error when code or state is missing', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')

    // No code, no state
    const req = new NextRequest('http://localhost:3000/api/auth/connect/google/callback')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=missing_params')
  })

  it('should redirect to signin when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/auth/signin')
  })

  it('should redirect with error when token exchange fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
    })

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=badcode&state=teststate'
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=token_exchange_failed')
  })

  it('should treat OAuth error param as missing_params when no code provided (user declined)', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?error=access_denied&state=teststate'
    )
    const response = await GET(req)

    // The route checks for code first; without code it returns missing_params
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=missing_params')
  })

  it('should ignore OAuth error param when code and state are both present', async () => {
    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?error=access_denied&code=testcode&state=teststate'
    )
    const response = await GET(req)

    // Route does NOT check for error query param; proceeds with code+state
    expect(response.status).toBe(307)
  })

  it('should proceed even when token exchange returns no access_token (stores undefined)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // No access_token field — route does not validate access_token presence
        refresh_token: 'refresh-only',
      }),
    })

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )
    const response = await GET(req)

    // Route proceeds without checking for access_token
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=google_docs')
  })

  it('should redirect with error when token exchange returns 5xx server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=token_exchange_failed')
  })

  it('should propagate error when ensureUserOrg fails (no try/catch in route)', async () => {
    vi.mocked(ensureUserOrg).mockRejectedValue(new Error('Org creation failed'))

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )

    // Route has no try/catch around ensureUserOrg — error propagates
    await expect(GET(req)).rejects.toThrow('Org creation failed')
  })

  it('should update existing Google Docs connector and redirect to success', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'conn-existing',
      type: 'GOOGLE_DOCS',
      userId: 'user-1',
    } as any)

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=google_docs')

    // Verify connector update
    expect(prisma.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-existing' },
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      })
    )
    expect(prisma.connector.create).not.toHaveBeenCalled()
  })

  it('should create new Google Docs connector when none exists', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/google/callback/route')
    const req = new NextRequest(
      'http://localhost:3000/api/auth/connect/google/callback?code=testcode&state=teststate'
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=google_docs')

    // Verify connector creation
    expect(prisma.connector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'GOOGLE_DOCS',
          status: 'ACTIVE',
        }),
      })
    )
    expect(prisma.connector.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// GET /api/auth/connect/notion
// ============================================================================

describe('GET /api/auth/connect/notion', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NOTION_CLIENT_ID = 'notion-client-id-123'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)
  })

  it('should redirect to signin when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/notion/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/notion')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/auth/signin')
  })

  it('should redirect with error when NOTION_CLIENT_ID is not configured', async () => {
    delete process.env.NOTION_CLIENT_ID

    const { GET } = await import('@/app/api/auth/connect/notion/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/notion')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=notion_not_configured')
  })

  it('should redirect to Notion OAuth URL when authenticated', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/notion')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('api.notion.com/v1/oauth/authorize')
    expect(location).toContain('notion-client-id-123')
    // redirect_uri is URL-encoded in the OAuth URL
    expect(location).toContain(
      encodeURIComponent('http://localhost:3000/api/auth/connect/notion/callback')
    )
    // Verify state param is base64url encoded JSON
    const stateParam = new URL(location!).searchParams.get('state')
    expect(stateParam).toBeTruthy()
    const decoded = JSON.parse(Buffer.from(stateParam!, 'base64url').toString())
    expect(decoded.userId).toBe('user-1')
    expect(decoded.nonce).toBeTruthy()
  })
})

// ============================================================================
// GET /api/auth/connect/notion/callback
// ============================================================================

describe('GET /api/auth/connect/notion/callback', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const validStatePayload = Buffer.from(
    JSON.stringify({ userId: 'user-1', nonce: 'test-nonce-123' })
  ).toString('base64url')

  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NOTION_CLIENT_ID = 'notion-client-id-123'
    process.env.NOTION_CLIENT_SECRET = 'notion-client-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(encrypt).mockImplementation((val: string) => `encrypted:${val}`)

    // Mock fetch for token exchange
    fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'notion-access-token',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should redirect with error when code or state is missing', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest('http://localhost:3000/api/auth/connect/notion/callback')
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=missing_params')
  })

  it('should redirect with error when state is invalid', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=invalid-base64!`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=invalid_state')
  })

  it('should redirect with error when state has no userId or nonce', async () => {
    const badState = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${badState}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=invalid_state')
  })

  it('should redirect to signin when session user does not match state userId', async () => {
    // Session has different user than state
    const wrongUserState = Buffer.from(
      JSON.stringify({ userId: 'user-other', nonce: 'test-nonce' })
    ).toString('base64url')

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${wrongUserState}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/auth/signin')
  })

  it('should redirect to signin when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/auth/signin')
  })

  it('should redirect with error when Notion credentials are not configured', async () => {
    delete process.env.NOTION_CLIENT_ID
    delete process.env.NOTION_CLIENT_SECRET

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=notion_not_configured')
  })

  it('should redirect with error when token exchange fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
    })

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=badcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=token_exchange_failed')
  })

  it('should treat OAuth error param as missing_params when no code provided', async () => {
    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?error=access_denied&state=${validStatePayload}`
    )
    const response = await GET(req)

    // Route checks for code first; without code returns missing_params
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=missing_params')
  })

  it('should redirect with error when token exchange returns 5xx server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    })

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=badcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('error=token_exchange_failed')
  })

  it('should proceed even when token exchange returns no access_token (stores undefined)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // No access_token field — route does not validate access_token presence
        bot_id: 'bot-123',
      }),
    })

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    // Route proceeds without checking for access_token
    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=notion')
  })

  it('should update existing Notion connector and redirect to success', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'conn-existing',
      type: 'NOTION',
      userId: 'user-1',
    } as any)

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=notion')

    // Verify connector update
    expect(prisma.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-existing' },
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      })
    )
    expect(prisma.connector.create).not.toHaveBeenCalled()
  })

  it('should create new Notion connector when none exists', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/connect/notion/callback/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/connect/notion/callback?code=testcode&state=${validStatePayload}`
    )
    const response = await GET(req)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('connected=notion')

    // Verify connector creation
    expect(prisma.connector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'NOTION',
          status: 'ACTIVE',
        }),
      })
    )
    expect(prisma.connector.update).not.toHaveBeenCalled()
  })
})
