/**
 * Password Reset Service test
 *
 * Tests the re-exported password reset service from @omnysync/core/services/password-reset
 *
 * Note: DB-dependent functions (createPasswordResetToken, validateResetToken,
 * resetPassword, cleanupExpiredTokens) require Prisma mocking. The setup-core-mock
 * provides a proxy that returns null for all prisma calls, which causes
 * DB operations to fail. These tests verify that exports resolve correctly
 * and the function signatures are valid.
 */
import { describe, it, expect } from 'vitest'
import {
  createPasswordResetToken,
  validateResetToken,
  resetPassword,
  cleanupExpiredTokens,
  resetGlobalResetRateLimit,
} from '../services/password-reset'

describe('password-reset (web re-export)', () => {
  it('should export createPasswordResetToken function', () => {
    expect(typeof createPasswordResetToken).toBe('function')
  })

  it('should export validateResetToken function', () => {
    expect(typeof validateResetToken).toBe('function')
  })

  it('should export resetPassword function', () => {
    expect(typeof resetPassword).toBe('function')
  })

  it('should export cleanupExpiredTokens function', () => {
    expect(typeof cleanupExpiredTokens).toBe('function')
  })

  describe('resetGlobalResetRateLimit', () => {
    it('should be a function', () => {
      expect(typeof resetGlobalResetRateLimit).toBe('function')
    })

    it('should execute without error', () => {
      expect(() => resetGlobalResetRateLimit()).not.toThrow()
    })
  })
})
