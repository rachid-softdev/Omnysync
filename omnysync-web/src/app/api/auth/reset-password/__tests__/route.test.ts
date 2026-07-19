/**
 * Tests for POST /api/auth/reset-password
 *
 * Pattern: mock @/lib/rate-limit-redis and the core password-reset service
 * (validateResetToken + resetPassword).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn(),
}))

vi.mock('@omnysync/core/services/password-reset', () => ({
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { validateResetToken, resetPassword } from '@omnysync/core/services/password-reset'

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(validateResetToken).mockResolvedValue({ valid: true, userId: 'user-1' })
    vi.mocked(resetPassword).mockResolvedValue({ success: true })
  })

  it('resets the password successfully for a valid token + new password', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: 'valid-token', password: 'NewPassword1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Token MUST be validated before the reset is attempted.
    expect(validateResetToken).toHaveBeenCalledWith('valid-token')
    expect(resetPassword).toHaveBeenCalledWith('valid-token', 'NewPassword1')
  })

  it('rejects an invalid/expired token with 400', async () => {
    vi.mocked(validateResetToken).mockResolvedValue({
      valid: false,
      error: 'Token invalide',
    })

    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: 'bad-token', password: 'NewPassword1' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token invalide')
    // Never attempt the reset when the token is invalid.
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters with 400', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: 'valid-token', password: 'Short1' }))
    expect(response.status).toBe(400)
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects an empty token with 400 (Zod)', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: '', password: 'NewPassword1' }))
    expect(response.status).toBe(400)
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when the reset itself fails after validation', async () => {
    vi.mocked(validateResetToken).mockResolvedValue({ valid: true, userId: 'user-1' })
    vi.mocked(resetPassword).mockResolvedValue({ success: false, error: 'Token déjà utilisé' })

    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: 'valid-token', password: 'NewPassword1' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token déjà utilisé')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({
      allowed: false,
      remainingTime: 1000,
    })

    const { POST } = await import('@/app/api/auth/reset-password/route')
    const response = await POST(makeRequest({ token: 'valid-token', password: 'NewPassword1' }))
    expect(response.status).toBe(429)
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})
