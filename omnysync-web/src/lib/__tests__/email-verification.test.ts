/**
 * Email Verification Service test
 *
 * Tests the re-exported email verification service from @omnysync/core/services/email-verification
 *
 * Note: DB-dependent functions (createEmailVerification, verifyEmail,
 * resendVerificationEmail) require Prisma mocking. The setup-core-mock
 * provides a proxy that returns null for all prisma calls, which causes
 * DB operations to fail. These tests verify that exports resolve correctly.
 */
import { describe, it, expect } from 'vitest'
import {
  createEmailVerification,
  verifyEmail,
  resendVerificationEmail,
} from '../services/email-verification'

describe('email-verification (web re-export)', () => {
  it('should export createEmailVerification function', () => {
    expect(typeof createEmailVerification).toBe('function')
  })

  it('should export verifyEmail function', () => {
    expect(typeof verifyEmail).toBe('function')
  })

  it('should export resendVerificationEmail function', () => {
    expect(typeof resendVerificationEmail).toBe('function')
  })
})
