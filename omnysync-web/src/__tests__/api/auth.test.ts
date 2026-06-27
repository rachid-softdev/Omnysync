import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PrismaClient } from '@prisma/client'
import { mockSession } from '../helpers/auth-helper'

const isIntegration = !!process.env.TEST_DATABASE_URL

// Mock auth module for 2FA routes — safe because register/forgot/reset routes don't import it.
// Use the same pattern as admin.test.ts: set mockAuth.mockResolvedValue(...) per test.
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

describe.skipIf(!isIntegration)('POST /api/auth/register', () => {
  beforeAll(async () => {
    // Clean the test database before running register tests
    // This ensures a known state for the duplicate-email test
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { cleanDatabase } = await import('../helpers/db-helper')
    await cleanDatabase(prisma)
    await prisma.$disconnect()
  })

  it('should register a new user', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'StrongP@ss1',
        name: 'New User',
      }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(201)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('new@test.com')
  })

  it('should reject duplicate email', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    // First registration
    const first = await POST(
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@test.com',
          password: 'StrongP@ss1',
          name: 'Dup',
        }),
      })
    )
    expect(first.status).toBe(201)

    // Duplicate — route returns 400 for existing email
    const second = await POST(
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@test.com',
          password: 'StrongP@ss1',
          name: 'Dup',
        }),
      })
    )
    expect(second.status).toBe(400)
  })

  // ── Validation ──────────────────────────────────────────────────────────

  it('should reject invalid email', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'StrongP@ss1',
        name: 'Test',
      }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject password shorter than 8 characters', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'shortpw@test.com',
        password: 'Ab1',
        name: 'Test',
      }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject missing name', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'noname@test.com',
        password: 'StrongP@ss1',
      }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject empty body', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})

describe.skipIf(!isIntegration)('POST /api/auth/forgot-password', () => {
  it('should return success (prevents email enumeration)', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return success for valid email', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@omnysync.com' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

describe.skipIf(!isIntegration)('POST /api/auth/reset-password', () => {
  it('should reject invalid token', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token', password: 'NewP@ssword1' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reset password with a valid token', async () => {
    // Fixture: create a user, an org (needed for audit log), and a reset token
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { createTestUser, createTestOrg } = await import('../helpers/db-helper')

    const user = await createTestUser(prisma, { email: 'reset-success@test.com' })
    await createTestOrg(prisma, user.id)

    const { randomBytes } = await import('node:crypto')
    const token = randomBytes(32).toString('hex')
    const future = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt: future },
    })
    await prisma.$disconnect()

    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'NewStr0ng!Pass' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should reject password shorter than 8 characters', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'some-token', password: 'Ab1' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject missing token in body', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NewP@ssword1' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})

// ── 2FA: GET /api/auth/2fa/setup ────────────────────────────────────────────

describe.skipIf(!isIntegration)('GET /api/auth/2fa/setup', () => {
  let userNo2fa: { id: string }
  let userWith2fa: { id: string }

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { cleanDatabase, createTestUser, createTestOrg } = await import('../helpers/db-helper')
    await cleanDatabase(prisma)

    // User without 2FA
    userNo2fa = await createTestUser(prisma, {
      email: '2fa-get-no2fa@test.com',
    })
    await createTestOrg(prisma, userNo2fa.id)

    // User with 2FA enabled
    userWith2fa = await createTestUser(prisma, {
      email: '2fa-get-enabled@test.com',
    })
    await createTestOrg(prisma, userWith2fa.id)

    // Enable 2FA by using setupTwoFactor with a generated secret
    const { generateTotpSecret, setupTwoFactor } =
      await import('@omnysync/core/services/two-factor')
    const { secret } = generateTotpSecret()
    await setupTwoFactor(userWith2fa.id, secret)

    await prisma.$disconnect()
  })

  beforeEach(() => {
    mockAuth.mockReset()
  })

  it('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 200 with secret and otpauthUrl when 2FA not enabled', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userNo2fa.id } }))

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.enabled).toBe(false)
    expect(data.secret).toBeDefined()
    expect(typeof data.secret).toBe('string')
    expect(data.otpauthUrl).toBeDefined()
    expect(data.otpauthUrl).toContain('otpauth://')
  })

  it('should return 200 with enabledAt when 2FA already enabled', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userWith2fa.id } }))

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.enabled).toBe(true)
    expect(data.enabledAt).toBeDefined()
  })
})

// ── 2FA: POST /api/auth/2fa/setup ───────────────────────────────────────────

describe.skipIf(!isIntegration)('POST /api/auth/2fa/setup', () => {
  let userInit: { id: string }
  let userVerifyValid: { id: string }
  let userVerifyInvalid: { id: string }
  let userNoPending: { id: string }

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { createTestUser, createTestOrg } = await import('../helpers/db-helper')

    // Create separate users for each flow so pendingSecrets map doesn't collide
    userInit = await createTestUser(prisma, { email: '2fa-post-init@test.com' })
    await createTestOrg(prisma, userInit.id)

    userVerifyValid = await createTestUser(prisma, {
      email: '2fa-post-verify-ok@test.com',
    })
    await createTestOrg(prisma, userVerifyValid.id)

    userVerifyInvalid = await createTestUser(prisma, {
      email: '2fa-post-verify-bad@test.com',
    })
    await createTestOrg(prisma, userVerifyInvalid.id)

    userNoPending = await createTestUser(prisma, {
      email: '2fa-post-no-pending@test.com',
    })
    await createTestOrg(prisma, userNoPending.id)

    await prisma.$disconnect()
  })

  beforeEach(() => {
    mockAuth.mockReset()
  })

  it('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 200 with secret and otpauthUrl for action=initiate', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userInit.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.secret).toBeDefined()
    expect(typeof data.secret).toBe('string')
    expect(data.otpauthUrl).toBeDefined()
    expect(data.otpauthUrl).toContain('otpauth://')
  })

  it('should return 200 with backupCodes for action=verify with valid code', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userVerifyValid.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')

    // Step 1: initiate
    const initiateReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    const initiateRes = await POST(initiateReq)
    const initiateData = await initiateRes.json()
    expect(initiateRes.status).toBe(200)
    expect(initiateData.secret).toBeDefined()

    // Generate a valid TOTP code from the returned secret
    const { TOTP, Secret } = await import('otpauth')
    const totp = new TOTP({
      secret: Secret.fromBase32(initiateData.secret),
      issuer: 'Omnysync',
      label: 'Omnysync',
    })
    const validCode = totp.generate()

    // Step 2: verify with valid code
    const verifyReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: validCode }),
    })
    const verifyRes = await POST(verifyReq)
    const verifyData = await verifyRes.json()
    expect(verifyRes.status).toBe(200)
    expect(verifyData.success).toBe(true)
    expect(verifyData.backupCodes).toBeDefined()
    expect(Array.isArray(verifyData.backupCodes)).toBe(true)
    expect(verifyData.backupCodes.length).toBe(10)
  })

  it('should return 400 for action=verify with invalid code', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userVerifyInvalid.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')

    // Initiate first so a pending secret exists
    const initiateReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    const initiateRes = await POST(initiateReq)
    expect(initiateRes.status).toBe(200)

    // Verify with an obviously wrong code
    const verifyReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: '000000' }),
    })
    const verifyRes = await POST(verifyReq)
    const verifyData = await verifyRes.json()
    expect(verifyRes.status).toBe(400)
    expect(verifyData.error).toBeDefined()
  })

  it('should return 400 for action=verify with no pending session', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userNoPending.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')

    // Call verify directly — no initiate was done for this user
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: '123456' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should return 400 for invalid action', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userInit.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bogus' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should return 400 for malformed body', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: userInit.id } }))

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})

// ── 2FA: POST /api/auth/2fa/verify ──────────────────────────────────────────

describe.skipIf(!isIntegration)('POST /api/auth/2fa/verify', () => {
  let user: { id: string }
  let twoFactorSecret: string

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { createTestUser, createTestOrg } = await import('../helpers/db-helper')

    // Create user
    user = await createTestUser(prisma, { email: '2fa-verify@test.com' })
    await createTestOrg(prisma, user.id)

    // Enable 2FA for this user using the real service
    const { generateTotpSecret, setupTwoFactor } =
      await import('@omnysync/core/services/two-factor')
    const { secret } = generateTotpSecret()
    twoFactorSecret = secret
    await setupTwoFactor(user.id, secret)

    await prisma.$disconnect()
  })

  beforeEach(() => {
    mockAuth.mockReset()
  })

  it('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })

  it('should return 200 with valid code', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: user.id } }))

    // Generate a valid TOTP code from the known secret
    const { TOTP, Secret } = await import('otpauth')
    const totp = new TOTP({
      secret: Secret.fromBase32(twoFactorSecret),
      issuer: 'Omnysync',
      label: 'Omnysync',
    })
    const validCode = totp.generate()

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: validCode }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return 400 with invalid code', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: user.id } }))

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '000000' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should return 400 with code too short (less than 6 chars)', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: user.id } }))

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should return 400 with empty body', async () => {
    mockAuth.mockResolvedValue(mockSession({ user: { id: user.id } }))

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
