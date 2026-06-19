/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// ── Mocks ──────────────────────────────────────────────────────────────────
// Must be hoisted before module imports

// The two-factor service imports prisma from @omnysync/core (relative: "../prisma"),
// not from @/lib/prisma. Both mocks must point to the SAME mock functions
// so test assertions via import { prisma } from '@/lib/prisma' stay in sync.
const sharedMockPrisma = vi.hoisted(() => ({
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
}))

vi.mock('@/lib/prisma', () => ({
  prisma: sharedMockPrisma,
}))

// The two-factor service imports prisma via "../prisma" (relative to the source file).
// The @omnysync/core/prisma alias resolves to the same file — both mocks must point
// to the SAME mock functions so test assertions via import { prisma } from '@/lib/prisma' stay in sync.
vi.mock('@omnysync/core/prisma', () => ({
  prisma: sharedMockPrisma,
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}))

// The two-factor service imports encrypt/decrypt from '../crypto' (relative to the service file),
// which resolves to @omnysync/core/crypto — same as @/lib/crypto in the web app context.
vi.mock('@omnysync/core/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}))

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

// Mock otpauth for controlled TOTP verification
// Use vi.hoisted to create a mutable container that both the mock factory
// and test helpers can reference
const mockTotpContainer = vi.hoisted(() => ({
  /** vi.fn() so tests can call .mockReturnValue() to control TOTP validation */
  validate: vi.fn(),
}))
vi.mock('otpauth', () => {
  const fromBase32 = vi.fn((base32: string) => ({ base32 }))
  return {
    Secret: Object.assign(
      function Secret() {
        return { base32: 'JBSWY3DPEHPK3PXP' }
      },
      { fromBase32 }
    ),
    TOTP: function TOTP() {
      return {
        validate: mockTotpContainer.validate,
        toString: () => 'otpauth://totp/Omnysync:test?secret=TEST',
      }
    },
  }
})

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
} from '../../../packages/omnysync-core/src/services/two-factor'
import { prisma } from '@/lib/prisma'

// Get the mock validate function for controlling TOTP verification
const getMockTotpValidate = () => mockTotpContainer.validate

// ── Suite ───────────────────────────────────────────────────────────────────

describe('two-factor service', () => {
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

    it('should hash backup codes with SHA-256 before storing', async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

      await setupTwoFactor(userId, secret)

      const createCall = vi.mocked(prisma.twoFactorAuth.upsert).mock.calls[0][0]
      const storedBackupCodes = createCall.create.backupCodes as string[]

      // Each backup code should be a SHA-256 hash (64 hex chars)
      storedBackupCodes.forEach((code) => {
        expect(code).toMatch(/^[a-f0-9]{64}$/)
      })

      // The plaintext backup codes returned should be 8 hex chars
      const result = await setupTwoFactor(userId, secret)
      result.backupCodes!.forEach((code) => {
        expect(code).toMatch(/^[0-9A-F]{8}$/)
      })
    })
  })

  // ── verifyTotpCode ────────────────────────────────────────────────────────

  describe('verifyTotpCode', () => {
    const userId = 'user-1'
    const secret = 'JBSWY3DPEHPK3PXP'

    beforeEach(() => {
      // Reset the mock validate to default behavior (return null for invalid)
      getMockTotpValidate().mockReturnValue(null)
    })

    it('should return error if 2FA is not enabled', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null)

      const result = await verifyTotpCode(userId, '123456')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('2FA non activé')
    })

    it('should validate a backup code and remove it', async () => {
      const backupCode = 'ABCD1234'
      // The service hashes with salt = userId.substring(0, 16). For 'user-1' that's 'user-1'.
      const codeHash = createHash('sha256').update(backupCode.toUpperCase() + 'user-1').digest('hex')
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

    // ── NEW: Backup code edge cases ─────────────────────────────────────────

    it('should consume backup codes one at a time (decrementing count)', async () => {
      const backupCode1 = 'FIRST123'
      const backupCode2 = 'SECOND456'
      // The service hashes with salt = userId.substring(0, 16). For 'user-1' that's 'user-1'.
      const hash1 = createHash('sha256').update(backupCode1.toUpperCase() + 'user-1').digest('hex')
      const hash2 = createHash('sha256').update(backupCode2.toUpperCase() + 'user-1').digest('hex')

      // First call: both codes available
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [hash1, hash2],
      } as unknown as Record<string, unknown>)

      // Mock update to simulate removing the used code (for second call)
      vi.mocked(prisma.twoFactorAuth.update).mockImplementation(async () => ({}) as any)

      // Use first backup code
      const result1 = await verifyTotpCode(userId, backupCode1)
      expect(result1.valid).toBe(true)

      // Verify it was removed
      const updateCall1 = vi.mocked(prisma.twoFactorAuth.update).mock.calls[0]?.[0]
      expect(updateCall1.data.backupCodes).toEqual([hash2])
    })

    it('should accept backup code case-insensitively', async () => {
      const backupCode = 'AbCd1234'
      // The service uppercases and adds salt: sha256(code.toUpperCase() + userId.substring(0,16))
      const codeHash = createHash('sha256').update('ABCD1234user-1').digest('hex')

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [codeHash],
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )

      // Provide mixed case code - service uppercases before hashing
      const result = await verifyTotpCode(userId, backupCode)

      expect(result.valid).toBe(true)
    })

    it('should fall through to TOTP verification when backup codes list is empty', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      // Make TOTP validate return a valid delta
      getMockTotpValidate().mockReturnValue(0)

      const result = await verifyTotpCode(userId, '123456')

      expect(result.valid).toBe(true)
    })

    it('should fall through to TOTP when no backup code matches', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: ['SOMEHASH'],
      } as unknown as Record<string, unknown>)

      // Make TOTP validate return a valid delta
      getMockTotpValidate().mockReturnValue(0)

      // Code that doesn't match any backup code
      const result = await verifyTotpCode(userId, '654321')

      expect(result.valid).toBe(true)
      // Should NOT have called update to remove backup code (TOTP path)
      expect(prisma.twoFactorAuth.update).not.toHaveBeenCalled()
    })

    // ── NEW: TOTP verification edge cases ───────────────────────────────────

    it('should accept TOTP code when delta=0 (exact match)', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      getMockTotpValidate().mockReturnValue(0)

      const result = await verifyTotpCode(userId, '123456')
      expect(result.valid).toBe(true)
    })

    it('should accept TOTP code when delta=1 (window tolerance)', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      getMockTotpValidate().mockReturnValue(1)

      const result = await verifyTotpCode(userId, '123456')
      expect(result.valid).toBe(true)
    })

    it('should accept TOTP code when delta=-1 (window tolerance)', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      getMockTotpValidate().mockReturnValue(-1)

      const result = await verifyTotpCode(userId, '123456')
      expect(result.valid).toBe(true)
    })

    it('should reject TOTP code when delta is null (invalid)', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      getMockTotpValidate().mockReturnValue(null)

      const result = await verifyTotpCode(userId, '000000')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Code invalide')
    })

    it('should decrypt the secret before TOTP verification', async () => {
      const encryptedSecret = `encrypted:${secret}`

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: encryptedSecret,
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      getMockTotpValidate().mockReturnValue(0)

      await verifyTotpCode(userId, '123456')

      // Verify decrypt was called (the mock strips 'encrypted:' prefix)
      // The service imports decrypt from '../crypto' which is @omnysync/core/crypto
      const { decrypt } = await import('@omnysync/core/crypto')
      expect(vi.mocked(decrypt)).toHaveBeenCalledWith(encryptedSecret)
    })

    it('should handle TOTP validation throwing an error gracefully', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        secret: `encrypted:${secret}`,
        backupCodes: ['SOMEHASH'],
      } as unknown as Record<string, unknown>)

      // Make the mock validate function throw to test error handling in verifyTotp
      getMockTotpValidate().mockImplementation(() => {
        throw new Error('Invalid secret')
      })

      const result = await verifyTotpCode(userId, '654321')
      expect(result.valid).toBe(false)
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

    it('should return enabled=true when 2FA exists without enabledAt date', async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId: 'user-1',
        secret: 'encrypted:secret',
        backupCodes: [],
      } as unknown as Record<string, unknown>)

      const result = await getTwoFactorStatus('user-1')

      expect(result.enabled).toBe(true)
      expect(result.enabledAt).toBeUndefined()
    })
  })

  // ── NEW: Combined activation flow tests ───────────────────────────────────

  describe('Activation flow (generate → verify → setup)', () => {
    it('should generate a valid secret then setup 2FA with it', async () => {
      // Step 1: Generate secret
      const { secret, otpauthUrl } = generateTotpSecret()
      expect(secret).toMatch(/^[A-Z2-7]+=*$/)
      expect(otpauthUrl).toContain('otpauth://totp/')

      // Step 2: Setup with generated secret
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.user.findUnique).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

      const setupResult = await setupTwoFactor('user-1', secret)
      expect(setupResult.success).toBe(true)
      expect(setupResult.backupCodes).toBeDefined()
      expect(setupResult.backupCodes!.length).toBe(10)

      // Step 3: Verify the secret was stored encrypted
      expect(prisma.twoFactorAuth.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            secret: `encrypted:${secret}`,
          }),
        })
      )
    })
  })
})
