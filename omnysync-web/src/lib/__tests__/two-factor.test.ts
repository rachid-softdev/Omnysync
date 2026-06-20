/**
 * Two-Factor Authentication Service test
 *
 * Tests the re-exported two-factor service from @omnysync/core/services/two-factor
 */
import { describe, it, expect } from 'vitest'
import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
  storePendingSecret,
  getPendingSecret,
  removePendingSecret,
} from '../services/two-factor'

describe('two-factor (web re-export)', () => {
  describe('generateTotpSecret', () => {
    it('should generate a secret and otpauth URL', () => {
      const result = generateTotpSecret('user@example.com', 'Omnysync')
      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('otpauthUrl')
      expect(result.secret).toBeTruthy()
      expect(result.otpauthUrl).toContain('otpauth://totp/')
      expect(result.otpauthUrl).toContain('Omnysync')
    })

    it('should generate different secrets for different calls', () => {
      const r1 = generateTotpSecret('a@b.com', 'App')
      const r2 = generateTotpSecret('a@b.com', 'App')
      expect(r1.secret).not.toBe(r2.secret)
    })

    it('should work with default label', () => {
      const result = generateTotpSecret('testuser')
      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('otpauthUrl')
    })
  })

  describe('setupTwoFactor', () => {
    it('should be a function', () => {
      expect(typeof setupTwoFactor).toBe('function')
    })
  })

  describe('verifyTotpCode', () => {
    it('should be a function', () => {
      expect(typeof verifyTotpCode).toBe('function')
    })
  })

  describe('disableTwoFactor', () => {
    it('should be a function', () => {
      expect(typeof disableTwoFactor).toBe('function')
    })
  })

  describe('getTwoFactorStatus', () => {
    it('should be a function', () => {
      expect(typeof getTwoFactorStatus).toBe('function')
    })
  })

  describe('pending secret store', () => {
    it('should store and retrieve pending secrets', async () => {
      await storePendingSecret('user-1', 'temp-secret-123')
      const secret = await getPendingSecret('user-1')
      expect(secret).toHaveProperty('secret', 'temp-secret-123')
      expect(secret).toHaveProperty('expiresAt')
    })

    it('should remove pending secrets', async () => {
      await storePendingSecret('user-1', 'temp-secret-123')
      await removePendingSecret('user-1')
      const removed = await getPendingSecret('user-1')
      expect(removed).toBeNull()
    })

    it('should return null for unknown user', async () => {
      const secret = await getPendingSecret('non-existent-user')
      expect(secret).toBeNull()
    })
  })
})
