/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock-based unit tests for auth API routes
 * These tests do NOT require a database — all dependencies are mocked.
 * The integration tests in auth.test.ts cover real DB scenarios with describe.skipIf(TEST_DATABASE_URL).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks (hoisted before module imports) ──────────────────────────────────

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

const mockTxUserCreate = vi.fn()
const mockTxOrgCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => {
      return cb({
        user: { create: mockTxUserCreate },
        organization: { create: mockTxOrgCreate },
      })
    }),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      create: vi.fn(),
    },
    twoFactorAuth: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  rateLimitRedisWithConfig: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: vi.fn(),
}))

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  verifyPassword: vi.fn(),
  validatePasswordStrength: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}))

vi.mock('@omnysync/core/services/password-reset', () => ({
  createPasswordResetToken: vi.fn().mockResolvedValue({
    success: true,
    message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
  }),
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
}))

const mockTotpValidate = vi.hoisted(() => vi.fn())

vi.mock('@omnysync/core/services/two-factor', () => ({
  generateTotpSecret: vi.fn().mockReturnValue({
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUrl: 'otpauth://totp/Omnysync:test?secret=JBSWY3DPEHPK3PXP',
  }),
  setupTwoFactor: vi.fn().mockResolvedValue({
    success: true,
    backupCodes: Array.from({ length: 10 }, (_, i) => `CODE${i}000`),
  }),
  verifyTotpCode: vi.fn().mockResolvedValue({ valid: true }),
  getTwoFactorStatus: vi.fn(),
  disableTwoFactor: vi.fn(),
  pendingSecrets: new Map(),
}))

vi.mock('otpauth', () => ({
  Secret: {
    fromBase32: vi.fn(() => ({})),
  },
  // Must be a plain function (not vi.fn()) so `new TOTP(...)` works in the route handler
  TOTP: function TOTP() {
    return {
      validate: mockTotpValidate,
      generate: vi.fn().mockReturnValue('123456'),
    }
  },
}))

// ── Suite ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/register (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new user successfully', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    mockTxUserCreate.mockResolvedValue({
      id: 'user-1',
      name: 'New User',
      email: 'new@test.com',
      createdAt: new Date(),
    } as any)
    mockTxOrgCreate.mockResolvedValue({} as any)

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
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-user',
      email: 'dup@test.com',
    } as any)

    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dup@test.com',
        password: 'StrongP@ss1',
        name: 'Dup',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

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

describe('POST /api/auth/forgot-password (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return success (prevents email enumeration)', async () => {
    const { createPasswordResetToken } = await import('@omnysync/core/services/password-reset')
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: true,
      message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
    })

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
    const { createPasswordResetToken } = await import('@omnysync/core/services/password-reset')
    vi.mocked(createPasswordResetToken).mockResolvedValue({
      success: true,
      message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
    })

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

describe('POST /api/auth/reset-password (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject invalid token', async () => {
    const { validateResetToken } = await import('@omnysync/core/services/password-reset')
    vi.mocked(validateResetToken).mockResolvedValue({
      valid: false,
      error: 'Token invalide',
    })

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
    const { validateResetToken, resetPassword } =
      await import('@omnysync/core/services/password-reset')
    vi.mocked(validateResetToken).mockResolvedValue({
      valid: true,
      userId: 'user-1',
    })
    vi.mocked(resetPassword).mockResolvedValue({
      success: true,
    })

    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-token', password: 'NewStr0ng!Pass' }),
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

describe('GET /api/auth/2fa/setup (mocked)', () => {
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
    const { getTwoFactorStatus } = await import('@omnysync/core/services/two-factor')
    vi.mocked(getTwoFactorStatus).mockResolvedValue({ enabled: false })

    mockAuth.mockResolvedValue({
      user: { id: 'user-no-2fa', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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
    const { getTwoFactorStatus } = await import('@omnysync/core/services/two-factor')
    vi.mocked(getTwoFactorStatus).mockResolvedValue({
      enabled: true,
      enabledAt: new Date('2026-01-15'),
    })

    mockAuth.mockResolvedValue({
      user: { id: 'user-with-2fa', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    const { GET } = await import('@/app/api/auth/2fa/setup/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.enabled).toBe(true)
    expect(data.enabledAt).toBeDefined()
  })
})

describe('POST /api/auth/2fa/setup (mocked)', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    vi.clearAllMocks()
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
    mockAuth.mockResolvedValue({
      user: { id: 'user-init', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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
    const { setupTwoFactor } = await import('@omnysync/core/services/two-factor')
    vi.mocked(setupTwoFactor).mockResolvedValue({
      success: true,
      backupCodes: Array.from({ length: 10 }, (_, i) => `CODE${i}000`),
    })

    mockAuth.mockResolvedValue({
      user: { id: 'user-verify-ok', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    const { POST } = await import('@/app/api/auth/2fa/setup/route')

    // Step 1: initiate
    const initiateReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    const initiateRes = await POST(initiateReq)
    expect(initiateRes.status).toBe(200)

    // Step 2: verify
    const verifyReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: '123456' }),
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
    mockAuth.mockResolvedValue({
      user: { id: 'user-verify-bad', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    // Make TOTP.validate return null (invalid code)
    mockTotpValidate.mockReturnValue(null)

    const { POST } = await import('@/app/api/auth/2fa/setup/route')

    // Initiate first
    const initiateReq = new NextRequest('http://localhost:3000/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initiate' }),
    })
    await POST(initiateReq)

    // Verify with bogus code
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
    mockAuth.mockResolvedValue({
      user: { id: 'user-no-pending', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    const { POST } = await import('@/app/api/auth/2fa/setup/route')
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
    mockAuth.mockResolvedValue({
      user: { id: 'user-init', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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
    mockAuth.mockResolvedValue({
      user: { id: 'user-init', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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

describe('POST /api/auth/2fa/verify (mocked)', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    vi.clearAllMocks()
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
    mockAuth.mockResolvedValue({
      user: { id: 'user-verify', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
      userId: 'user-verify',
      secret: 'encrypted:JBSWY3DPEHPK3PXP',
      backupCodes: [],
    } as any)

    const { verifyTotpCode } = await import('@omnysync/core/services/two-factor')
    vi.mocked(verifyTotpCode).mockResolvedValue({ valid: true })

    const { POST } = await import('@/app/api/auth/2fa/verify/route')
    const request = new NextRequest('http://localhost:3000/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return 400 with invalid code', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-verify', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
      userId: 'user-verify',
      secret: 'encrypted:JBSWY3DPEHPK3PXP',
      backupCodes: [],
    } as any)

    const { verifyTotpCode } = await import('@omnysync/core/services/two-factor')
    vi.mocked(verifyTotpCode).mockResolvedValue({ valid: false, error: 'Code invalide' })

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
    mockAuth.mockResolvedValue({
      user: { id: 'user-verify', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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
    mockAuth.mockResolvedValue({
      user: { id: 'user-verify', email: 'test@test.com', role: 'USER' },
      expires: new Date(Date.now() + 86400000).toISOString(),
      update: vi.fn(),
    })

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
