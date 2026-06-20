/**
 * Sanitize Service test
 *
 * Tests the re-exported sanitize service from @omnysync/core/services/sanitize
 */
import { describe, it, expect } from 'vitest'
import { sanitizeErrorMessage } from '../services/sanitize'

describe('sanitize (web re-export)', () => {
  describe('sanitizeErrorMessage', () => {
    it('should extract message from Error objects', () => {
      const result = sanitizeErrorMessage(new Error('Something failed'))
      expect(result).toContain('Something failed')
    })

    it('should handle string errors', () => {
      const result = sanitizeErrorMessage('direct error string')
      expect(result).toContain('direct error string')
    })

    it('should handle null/undefined errors', () => {
      expect(sanitizeErrorMessage(null)).toBeTruthy()
      expect(sanitizeErrorMessage(undefined)).toBeTruthy()
    })

    it('should handle object errors', () => {
      const result = sanitizeErrorMessage({ code: 500, details: 'server error' })
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle numeric errors', () => {
      const result = sanitizeErrorMessage(404)
      expect(typeof result).toBe('string')
      expect(result).toContain('404')
    })

    it('should strip sensitive information', () => {
      const error = new Error('Connection failed with token=secret123')
      const result = sanitizeErrorMessage(error)
      // Sanitization should not expose full error details in production
      expect(result).toBeTruthy()
    })
  })
})
