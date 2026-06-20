/**
 * Authz Service test
 *
 * Tests the re-exported authorization service from @omnysync/core/services/authz
 */
import { describe, it, expect } from 'vitest'
import { requireDocumentAccess, UnauthorizedError } from '../services/authz'

describe('authz (web re-export)', () => {
  describe('UnauthorizedError', () => {
    it('should be a class that extends Error', () => {
      const error = new UnauthorizedError('Access denied')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(UnauthorizedError)
      expect(error.message).toContain('Access denied')
    })

    it('should have the class name UnauthorizedError', () => {
      const error = new UnauthorizedError('No access')
      expect(error.constructor.name).toBe('UnauthorizedError')
    })
  })

  describe('requireDocumentAccess', () => {
    it('should be a function', () => {
      expect(typeof requireDocumentAccess).toBe('function')
    })

    it('should require two arguments', () => {
      expect(requireDocumentAccess.length).toBeGreaterThanOrEqual(2)
    })
  })
})
