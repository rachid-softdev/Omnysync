/**
 * Tests for POST /api/auth/forgot-password
 *
 * Pattern: mock @/lib/rate-limit-redis and the core password-reset service
 * (createPasswordResetToken). The route always returns success to avoid
 * email enumeration — even when the service reports failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn(),
}))

vi.mock('@omnysync/core/services/password-reset', () => ({
  createPasswordResetToken: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { createPasswordResetToken } from '@omnysync/core/services/password-reset'

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: true,
      message: 'Si ce compte existe, un email a été envoyé',
    })
  })

  it('returns 200 with success:true for a known email', async () => {
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: true,
      message: 'Si ce compte existe, un email a été envoyé',
    })

    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(makeRequest({ email: 'known@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(createPasswordResetToken).toHaveBeenCalledWith('known@example.com')
  })

  it('returns 200 with success:true even for an UNKNOWN email (anti-fingerprint)', async () => {
    // Service reports the account does not exist, but the route must still
    // respond identically to prevent email enumeration.
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: true,
      message: 'Si ce compte existe, un email a été envoyé',
    })

    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(makeRequest({ email: 'ghost@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('returns 200 success:true even when the service itself fails (anti-enumeration)', async () => {
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: false,
      message: 'Trop de demandes. Réessayez dans 15 minutes',
    })

    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(makeRequest({ email: 'any@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('rejects an invalid email with 400', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(makeRequest({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({
      allowed: false,
      remainingTime: 1000,
    })

    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(makeRequest({ email: 'known@example.com' }))
    expect(response.status).toBe(429)
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})
