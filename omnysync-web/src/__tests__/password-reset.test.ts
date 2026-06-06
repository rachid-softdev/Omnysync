import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted before module imports) ──────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$mockedhashedpassword'),
}))

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  createPasswordResetToken,
  validateResetToken,
  resetPassword,
  cleanupExpiredTokens,
} from '@/lib/services/password-reset'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!process.env.TEST_DATABASE_URL)('password-reset service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── createPasswordResetToken ──────────────────────────────────────────────

  describe('createPasswordResetToken', () => {
    const email = 'user@example.com'

    it('should return success message even if user does not exist (prevent email enumeration)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await createPasswordResetToken(email)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Si ce compte existe')
    })

    it('should create a token and send email when user exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0)
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({
        id: 'reset-1',
        token: 'some-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      } as unknown as Record<string, unknown>)

      const result = await createPasswordResetToken(email)

      expect(result.success).toBe(true)
      expect(prisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      )
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('Omnysync'),
        })
      )
    })

    it('should reject if rate limit exceeded', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(3) // MAX_RESET_ATTEMPTS

      const result = await createPasswordResetToken(email)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Trop de demandes')
    })

    it('should build correct reset URL with token', async () => {
      process.env.NEXTAUTH_URL = 'https://app.omnysync.com'

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0)
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({
        token: 'abc123token',
      } as unknown as Record<string, unknown>)

      await createPasswordResetToken(email)

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(
            'https://app.omnysync.com/auth/reset-password?token=abc123token'
          ),
        })
      )
    })
  })

  // ── validateResetToken ────────────────────────────────────────────────────

  describe('validateResetToken', () => {
    it('should reject invalid token', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null)

      const result = await validateResetToken('nonexistent-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token invalide')
    })

    it('should reject already used token', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: 'used-token',
        usedAt: new Date('2026-01-01'),
        expiresAt: new Date('2099-01-01'),
      } as unknown as Record<string, unknown>)

      const result = await validateResetToken('used-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token déjà utilisé')
    })

    it('should reject expired token', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: 'expired-token',
        usedAt: null,
        expiresAt: new Date('2020-01-01'),
      } as unknown as Record<string, unknown>)

      const result = await validateResetToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token expiré')
    })

    it('should validate a valid token', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: 'valid-token',
        usedAt: null,
        expiresAt: futureDate,
        userId: 'user-1',
        user: { id: 'user-1', email: 'user@example.com' },
      } as unknown as Record<string, unknown>)

      const result = await validateResetToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.userId).toBe('user-1')
    })
  })

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reject an invalid token', async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null)

      const result = await resetPassword('bad-token', 'NewP@ss123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Token invalide')
    })

    it('should reset password, invalidate sessions, mark token used, and audit log', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      const newPassword = 'N3wStr0ng!Pass'

      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: 'valid-token',
        usedAt: null,
        expiresAt: futureDate,
        userId: 'user-1',
        user: { id: 'user-1', email: 'user@example.com' },
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.update).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 2 } as unknown as { count: number })
      vi.mocked(prisma.passwordReset.update).mockResolvedValue(
        {} as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: 'org-1',
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)

      const result = await resetPassword('valid-token', newPassword)

      expect(result.success).toBe(true)

      // Verify password was hashed and stored
      const { hash } = await import('bcrypt')
      expect(hash).toHaveBeenCalledWith(newPassword, expect.any(Number))

      // Verify passwordChangedAt was set
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            passwordChangedAt: expect.any(Date),
          }),
        })
      )

      // Verify sessions were invalidated
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      })

      // Verify token was marked used
      expect(prisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: 'valid-token' },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      )

      // Verify audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'password.reset',
            userId: 'user-1',
          }),
        })
      )
    })
  })

  // ── cleanupExpiredTokens ──────────────────────────────────────────────────

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({
        count: 5,
      } as { count: number })

      const count = await cleanupExpiredTokens()

      expect(count).toBe(5)
      expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      })
    })
  })
})
