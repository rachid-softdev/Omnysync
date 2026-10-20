/**
 * Tests for POST /api/auth/2fa/verify
 *
 * Pattern: mock @/lib/auth (auth), @/lib/prisma, @/lib/rate-limit-redis,
 * and verifyTotpCode from the core two-factor service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    twoFactorAuth: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn(),
}))

vi.mock('@omnysync/core/services/two-factor', () => ({
  verifyTotpCode: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { verifyTotpCode } from '@omnysync/core/services/two-factor'

const makePost = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/2fa/verify', () => {
  // Authenticated session with an .update() method for marking 2FA verified.
  // Captured at the file level so we can assert on .update() after the call.
  const session = {
    user: { id: 'user-1', email: 'u@e.com' },
    update: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(auth).mockResolvedValue(session as any)
    vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
      id: '2fa-1',
      userId: 'user-1',
    } as any)
    vi.mocked(verifyTotpCode).mockResolvedValue({ valid: true })
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '123456' }))
    expect(response.status).toBe(401)
  })

  it('rejects a code that is not exactly 6 characters (400)', async () => {
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '12345' }))
    expect(response.status).toBe(400)
    expect(verifyTotpCode).not.toHaveBeenCalled()
  })

  it('rejects a 7-character code (400)', async () => {
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '1234567' }))
    expect(response.status).toBe(400)
  })

  it('rejects when 2FA is not configured for the user (400)', async () => {
    vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '123456' }))
    expect(response.status).toBe(400)
    expect(verifyTotpCode).not.toHaveBeenCalled()
  })

  it('rejects an invalid code (400)', async () => {
    vi.mocked(verifyTotpCode).mockResolvedValue({ valid: false, error: 'Code invalide' })
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '123456' }))
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBe('Code invalide')
  })

  it('verifies a valid code and updates the session (200)', async () => {
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '123456' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(verifyTotpCode).toHaveBeenCalledWith('user-1', '123456')
    expect(session.update).toHaveBeenCalledWith({ twoFactorVerified: true })
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({
      allowed: false,
      remainingTime: 1000,
    })
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const response = await POST(makePost({ code: '123456' }))
    expect(response.status).toBe(429)
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const req = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})
