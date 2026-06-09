import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// ── Mocks ──────────────────────────────────────────────────────────────────
// Must be hoisted before module imports

vi.mock('@/lib/prisma', () => ({
  prisma: {
    twoFactorAuth: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}))

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
} from '@omnysync/core/services/two-factor'
import { prisma } from '@/lib/prisma'

// ── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!process.env.TEST_DATABASE_URL)('two-factor service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── generateTotpSecret ────────────────────────────────────────────────────

  describe('generateTotpSecret', () => {
    it('should return a secret and otpauth URL', () => {
      const result = generateTotpSecret()

      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('otpauthUrl')
      expect(typeof result.secret).toBe('string')
      expect(result.secret.length).toBeGreaterThan(0)
      expect(result.otpauthUrl).toContain('otpauth://totp/')
      expect(result.otpauthUrl).toContain('Omnysync')
    })

    it('should return a valid base32 secret', () => {
      const result = generateTotpSecret()
      // Base32 characters: A-Z, 2-7, padding with =
      expect(result.secret).toMatch(/^[A-Z2-7]+=*$/)
    })
  })

  // ── setupTwoFactor ────────────────────────────────────────────────────────

  describe('setupTwoFactor', () => {
    const userId = 'user-1'
    const secret = 'JBSWY3DPEHPK3PXP'

    it('should upsert the 2FA secret and return backup codes', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        userId,
        role: 'OWNER',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)

      const result = await setupTwoFactor(userId, secret)

      expect(result.success).toBe(true)
      expect(result.backupCodes).toBeDefined()
      expect(result.backupCodes!.length).toBe(10)
      // Each backup code should be 8 hex chars
      result.backupCodes!.forEach((code) => {
        expect(code).toMatch(/^[0-9A-F]{8}$/)
      })
    })

    it('should call upsert with encrypted secret', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

      await setupTwoFactor(userId, secret)

      expect(prisma.twoFactorAuth.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: expect.objectContaining({
          userId,
          secret: `encrypted:${secret}`,
        }),
        update: expect.objectContaining({
          secret: `encrypted:${secret}`,
        }),
      })
    })

    it('should create an audit log when user is org OWNER', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: 'owner@example.com',
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        userId,
        role: 'OWNER',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)

      await setupTwoFactor(userId, secret)

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            action: 'twofactor.enabled',
          }),
        })
      )
    })

    it('should not create an audit log when user has no org', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

      await setupTwoFactor(userId, secret)

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('should return error on prisma failure', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockRejectedValue(new Error('DB connection lost'))

      const result = await setupTwoFactor(userId, secret)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Échec de la configuration du 2FA')
    })
  })

  // ── verifyTotpCode ────────────────────────────────────────────────────────

  describe('verifyTotpCode', () => {
    const userId = 'user-1'
    const secret = 'JBSWY3DPEHPK3PXP'

    it('should return error if 2FA is not enabled', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null)

      const result = await verifyTotpCode(userId, '123456')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('2FA non activé')
    })

    it('should validate a backup code and remove it', async () => {
      const backupCode = 'ABCD1234'
      const codeHash = createHash('sha256').update(backupCode).digest('hex')
      const remainingCodes = ['OTHERHASH1', 'OTHERHASH2']

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [codeHash, ...remainingCodes],
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )

      const result = await verifyTotpCode(userId, backupCode)

      expect(result.valid).toBe(true)
      expect(prisma.twoFactorAuth.update).toHaveBeenCalledWith({
        where: { userId },
        data: { backupCodes: remainingCodes },
      })
    })

    it('should reject an invalid code', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      const result = await verifyTotpCode(userId, '000000')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code invalide')
    })
  })

  // ── disableTwoFactor ──────────────────────────────────────────────────────

  describe('disableTwoFactor', () => {
    const userId = 'user-1'
    const correctPassword = 'correct-password'
    const wrongPassword = 'wrong-password'

    it('should return error if 2FA is not enabled', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null)

      const result = await disableTwoFactor(userId, correctPassword)

      expect(result.success).toBe(false)
      expect(result.error).toBe('2FA non activé')
    })

    it('should return error if user has no password (OAuth)', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: 'encrypted:secret',
        backupCodes: [],
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        password: null,
      } as unknown as Record<string, unknown>)

      const result = await disableTwoFactor(userId, correctPassword)

      expect(result.success).toBe(false)
      expect(result.error).toContain('OAuth')
    })

    it('should return error on wrong password', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: 'encrypted:secret',
        backupCodes: [],
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        password: '$2b$12$hashedpassword',
      } as unknown as Record<string, unknown>)

      const { compare } = await import('bcrypt')
      vi.mocked(compare).mockImplementation(async () => false)

      const result = await disableTwoFactor(userId, wrongPassword)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Mot de passe incorrect')
    })

    it('should disable 2FA and log audit on correct password', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: 'encrypted:secret',
        backupCodes: [],
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        password: '$2b$12$hashedpassword',
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.twoFactorAuth.delete).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        userId,
        role: 'OWNER',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)

      const { compare } = await import('bcrypt')
      vi.mocked(compare).mockImplementation(async () => true)

      const result = await disableTwoFactor(userId, correctPassword)

      expect(result.success).toBe(true)
      expect(prisma.twoFactorAuth.delete).toHaveBeenCalledWith({
        where: { userId },
      })
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'twofactor.disabled',
          }),
        })
      )
    })
  })

  // ── getTwoFactorStatus ────────────────────────────────────────────────────

  describe('getTwoFactorStatus', () => {
    it('should return enabled=false when no 2FA record', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null)

      const result = await getTwoFactorStatus('user-1')

      expect(result.enabled).toBe(false)
      expect(result.enabledAt).toBeUndefined()
    })

    it('should return enabled=true with date when 2FA is active', async () => {
      const enabledAt = new Date('2026-01-15')
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId: 'user-1',
        secret: 'encrypted:secret',
        backupCodes: [],
        enabledAt,
      } as unknown as Record<string, unknown>)

      const result = await getTwoFactorStatus('user-1')

      expect(result.enabled).toBe(true)
      expect(result.enabledAt).toEqual(enabledAt)
    })
  })
})
