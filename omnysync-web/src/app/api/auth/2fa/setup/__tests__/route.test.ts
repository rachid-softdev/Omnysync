/**
 * Tests for GET / POST /api/auth/2fa/setup
 *
 * Pattern: mock @/lib/auth (auth), @/lib/rate-limit-redis, and the core
 * two-factor service. The route validates TOTP codes with REAL otpauth, so
 * we generate genuine time-based codes against the pending secret.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as OTPAuth from 'otpauth'

// ── Hoisted mocks for the core two-factor service ─────────────────────────────

const mocks = vi.hoisted(() => ({
  generateTotpSecret: vi.fn(),
  setupTwoFactor: vi.fn(),
  getTwoFactorStatus: vi.fn(),
  pendingSecrets: new Map<string, { secret: string; expiresAt: Date }>(),
}))

vi.mock('@omnysync/core/services/two-factor', () => ({
  generateTotpSecret: mocks.generateTotpSecret,
  setupTwoFactor: mocks.setupTwoFactor,
  getTwoFactorStatus: mocks.getTwoFactorStatus,
  pendingSecrets: mocks.pendingSecrets,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'

const TEST_SECRET = 'JBSWY3DPEHPK3PXP' // valid base32 secret

const makePost = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const validTotpFor = (secret: string): string => {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    issuer: 'Omnysync',
    label: 'Omnysync',
  })
  return totp.generate()
}

describe('GET /api/auth/2fa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
    mocks.pendingSecrets.clear()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('returns enabled:true + enabledAt when 2FA is already enabled', async () => {
    vi.mocked(mocks.getTwoFactorStatus).mockResolvedValue({
      enabled: true,
      enabledAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.enabled).toBe(true)
    expect(data.enabledAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('returns secret + otpauthUrl when 2FA is not yet enabled', async () => {
    vi.mocked(mocks.getTwoFactorStatus).mockResolvedValue({ enabled: false })
    vi.mocked(mocks.generateTotpSecret).mockReturnValue({
      secret: TEST_SECRET,
      otpauthUrl: 'otpauth://totp/Omnysync?secret=' + TEST_SECRET,
    })

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.enabled).toBe(false)
    expect(data.secret).toBe(TEST_SECRET)
    expect(data.otpauthUrl).toContain(TEST_SECRET)
  })
})

describe('POST /api/auth/2fa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', email: 'u@e.com' } } as any)
    vi.mocked(mocks.generateTotpSecret).mockReturnValue({
      secret: TEST_SECRET,
      otpauthUrl: 'otpauth://totp/Omnysync?secret=' + TEST_SECRET,
    })
    vi.mocked(mocks.setupTwoFactor).mockResolvedValue({
      success: true,
      backupCodes: ['CODE1', 'CODE2'],
    })
    mocks.pendingSecrets.clear()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'initiate' }))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({
      allowed: false,
      remainingTime: 1000,
    })
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'initiate' }))
    expect(response.status).toBe(429)
  })

  it('rejects an invalid action with 400 (Zod)', async () => {
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'explode' }))
    expect(response.status).toBe(400)
  })

  it('rejects verify with no code (400)', async () => {
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'verify' }))
    expect(response.status).toBe(400)
  })

  it('action=initiate generates a secret and stores it in pendingSecrets', async () => {
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'initiate' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.secret).toBe(TEST_SECRET)
    // The secret must be persisted for the subsequent verify step
    expect(mocks.pendingSecrets.get('user-1')?.secret).toBe(TEST_SECRET)
  })

  it('action=verify with a valid TOTP enables 2FA', async () => {
    // Pre-seed the pending secret exactly as action=initiate would.
    mocks.pendingSecrets.set('user-1', {
      secret: TEST_SECRET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    const code = validTotpFor(TEST_SECRET)
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'verify', code }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.backupCodes).toEqual(['CODE1', 'CODE2'])
    expect(mocks.setupTwoFactor).toHaveBeenCalledWith('user-1', TEST_SECRET)
  })

  it('action=verify with an invalid code is rejected (400)', async () => {
    mocks.pendingSecrets.set('user-1', {
      secret: TEST_SECRET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'verify', code: '000000' }))
    expect(response.status).toBe(400)
    expect(mocks.setupTwoFactor).not.toHaveBeenCalled()
  })

  it('action=verify with no pending session is rejected (400)', async () => {
    // pendingSecrets intentionally empty for user-1
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'verify', code: validTotpFor(TEST_SECRET) }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/recommencer/i)
  })

  // NOTE (suspected source gap): the zod schema advertises action 'cancel',
  // but the route has no handler branch for it — it falls through to
  // "Action invalide" (400). Characterization test pins this behavior.
  it('action=cancel is not implemented by the route (returns 400 "Action invalide")', async () => {
    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const response = await POST(makePost({ action: 'cancel' }))
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('Action invalide')
  })
})
