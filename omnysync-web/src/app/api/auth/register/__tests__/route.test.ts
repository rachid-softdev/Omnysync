/**
 * Tests for POST /api/auth/register
 *
 * Pattern: mock @/lib/auth/password (hashPassword + strength),
 * @/lib/rate-limit-redis (rateLimitRedisWithConfig), and @/lib/prisma.
 * Dynamic-import the route handler inside each test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn(),
  validatePasswordStrength: vi.fn(),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { prisma } from '@/lib/prisma'

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default happy path primitives
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({ allowed: true })
    vi.mocked(hashPassword).mockResolvedValue('hashed-pw-placeholder')
    vi.mocked(validatePasswordStrength).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    // Transaction that echoes a created user/org
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          create: vi.fn(async () => ({
            id: 'new-user-id',
            name: 'John Doe',
            email: 'john@example.com',
          })),
        },
        organization: {
          create: vi.fn(async () => ({ id: 'new-org-id' })),
        },
      }
      return cb(tx)
    })
  })

  it('returns 201 with the created user when registration succeeds', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John Doe', email: 'john@example.com', password: 'Password1' })
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.user).toEqual({
      id: 'new-user-id',
      name: 'John Doe',
      email: 'john@example.com',
    })
    expect(data.message).toBe('Compte créé avec succès')
  })

  it('rejects registration when the email already exists (findUnique)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-id',
      email: 'taken@example.com',
    } as any)

    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'taken@example.com', password: 'Password1' })
    )
    const data = await response.json()

    // Source uses findUnique guard → 400 (not 409 P2002)
    expect(response.status).toBe(400)
    expect(data.error).toBe('Un compte avec cet email existe déjà')
  })

  it('rejects an invalid email (Zod) with 400', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'not-an-email', password: 'Password1' })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a password shorter than 8 characters with 400', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'john@example.com', password: 'Short1' })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a missing name with 400', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: '', email: 'john@example.com', password: 'Password1' })
    )
    expect(response.status).toBe(400)
  })

  it('hashes the password before persisting (not plaintext)', async () => {
    let capturedCreate: any = null
    vi.mocked(hashPassword).mockResolvedValue('$2b$12$hashed-secret-value')

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          create: vi.fn(async (args: any) => {
            capturedCreate = args
            return { id: 'u1', name: 'John', email: 'john@example.com' }
          }),
        },
        organization: { create: vi.fn(async () => ({ id: 'org1' })) },
      }
      return cb(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'john@example.com', password: 'Password1' })
    )

    expect(response.status).toBe(201)
    expect(hashPassword).toHaveBeenCalledWith('Password1')
    // The password stored in the DB must be the hashed value, never the plaintext
    expect(capturedCreate.data.password).toBe('$2b$12$hashed-secret-value')
    expect(capturedCreate.data.password).not.toBe('Password1')
  })

  it('creates a Personal organization with OWNER membership in the same transaction', async () => {
    let orgCreate: any = null
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          create: vi.fn(async () => ({ id: 'u1', name: 'John', email: 'e@e.com' })),
        },
        organization: {
          create: vi.fn(async (args: any) => {
            orgCreate = args
            return { id: 'org1' }
          }),
        },
      }
      return cb(tx)
    })

    const { POST } = await import('@/app/api/auth/register/route')
    await POST(makeRequest({ name: 'John', email: 'john@example.com', password: 'Password1' }))

    expect(orgCreate.data.name).toBe('Personal')
    expect(orgCreate.data.users.create).toEqual({
      userId: 'u1',
      role: 'OWNER',
    })
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimitRedisWithConfig).mockResolvedValue({
      allowed: false,
      remainingTime: 1000,
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'john@example.com', password: 'Password1' })
    )
    expect(response.status).toBe(429)
  })

  it('returns 500 when the Prisma transaction fails', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('DB connection lost'))

    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST(
      makeRequest({ name: 'John', email: 'john@example.com', password: 'Password1' })
    )
    expect(response.status).toBe(500)
  })

  it('returns 500 when the request body is not valid JSON (request.json throws)', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    })
    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})
