/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import {
  FeatureNotAvailableError,
  LimitReachedError,
  SubscriptionExpiredError,
  InvalidFeatureError,
  CacheError,
  FeatureGateError,
  InvalidOrganizationError,
  logFeatureGateError,
  isFeatureGateError,
  handleFeatureGateError,
} from '../errors'

describe('Feature Gate Errors', () => {
  describe('FeatureGateError', () => {
    it('should create base error with code and message', () => {
      const error = new FeatureGateError(
        'FEATURE_NOT_AVAILABLE',
        'Feature not available',
        { feature: 'EXPORT_PDF' },
        403
      )

      expect(error.code).toBe('FEATURE_NOT_AVAILABLE')
      expect(error.message).toBe('Feature not available')
      expect(error.statusCode).toBe(403)
      expect(error.context.feature).toBe('EXPORT_PDF')
      expect(error.name).toBe('FeatureGateError')
    })
  })

  describe('FeatureNotAvailableError', () => {
    it('should create error with feature key', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free')

      expect(error.message).toContain('EXPORT_PDF')
      expect(error.featureKey).toBe('EXPORT_PDF')
      expect(error.planRequired).toBeDefined()
    })

    it('should include required plan when specified', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free', 'pro')

      expect(error.message).toContain('pro')
      expect(error.message).toContain('free')
    })

    it('should be instance of FeatureGateError', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free')

      expect(error).toBeInstanceOf(FeatureGateError)
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('LimitReachedError', () => {
    it('should create error with limit details', () => {
      const error = new LimitReachedError('MAX_SYNCS', 10, 5, '2026-02-01')

      expect(error.message).toContain('MAX_SYNCS')
      expect(error.message).toContain('5')
      expect(error.message).toContain('10')
      expect(error.featureKey).toBe('MAX_SYNCS')
    })

    it('should be instance of FeatureGateError', () => {
      const error = new LimitReachedError('MAX_SYNCS', 10, 5, '2026-02-01')

      expect(error).toBeInstanceOf(FeatureGateError)
    })
  })

  describe('SubscriptionExpiredError', () => {
    it('should create error with org id', () => {
      const error = new SubscriptionExpiredError('org-123')

      expect(error.message).toContain('expired')
      expect(error.context.orgId).toBe('org-123')
    })

    it('should be instance of FeatureGateError', () => {
      const error = new SubscriptionExpiredError('org-123')

      expect(error).toBeInstanceOf(FeatureGateError)
    })
  })

  describe('InvalidFeatureError', () => {
    it('should create error with feature key', () => {
      const error = new InvalidFeatureError('INVALID_FEATURE')

      expect(error.message).toContain('INVALID_FEATURE')
      expect(error.context.feature).toBe('INVALID_FEATURE')
    })

    it('should be instance of FeatureGateError', () => {
      const error = new InvalidFeatureError('INVALID_FEATURE')

      expect(error).toBeInstanceOf(FeatureGateError)
    })
  })

  describe('InvalidOrganizationError', () => {
    it('should create error with org id', () => {
      const error = new InvalidOrganizationError('org-invalid')

      expect(error.message).toContain('org-invalid')
    })
  })

  describe('CacheError', () => {
    it('should create error with message', () => {
      const error = new CacheError('Cache connection failed')

      expect(error.message).toContain('Cache connection failed')
      expect(error.statusCode).toBe(500)
    })
  })

  describe('logFeatureGateError', () => {
    it('should log error with context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free')

      logFeatureGateError(error, { requestId: 'req-123' })

      expect(consoleSpy).toHaveBeenCalled()
      const logCall = consoleSpy.mock.calls[0]![0]
      expect(logCall).toBe('[FeatureGateError]')

      consoleSpy.mockRestore()
    })
  })

  describe('isFeatureGateError', () => {
    it('should return true for FeatureGateError', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free')

      expect(isFeatureGateError(error)).toBe(true)
    })

    it('should return false for regular Error', () => {
      const error = new Error('Regular error')

      expect(isFeatureGateError(error)).toBe(false)
    })
  })

  describe('handleFeatureGateError', () => {
    it('should return formatted error response', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free', 'pro')

      const result = handleFeatureGateError(error)

      expect(result.statusCode).toBe(403)
      expect(result.body.error).toBe('FEATURE_NOT_AVAILABLE')
      expect(result.body.feature).toBe('EXPORT_PDF')
    })

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error')

      const result = handleFeatureGateError(error)

      expect(result.statusCode).toBe(500)
      expect(result.body.error).toBe('INTERNAL_ERROR')
    })
  })

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new FeatureNotAvailableError('EXPORT_PDF', 'free', 'pro')

      const json = error.toJSON()

      expect(json.error).toBe('FEATURE_NOT_AVAILABLE')
      expect(json.feature).toBe('EXPORT_PDF')
      expect(json.current_plan).toBe('free')
    })
  })
})
