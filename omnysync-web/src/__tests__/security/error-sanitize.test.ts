import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * S1-5 — Stack trace filtering tests
 *
 * The sanitizeErrorMessage function in @omnysync/core/services/sanitize already
 * strips stack traces and redacts secrets from error messages.
 * The sanitizeError function in @/lib/api-error prevents internal details
 * from leaking to API clients.
 *
 * These tests verify both functions' behaviour.
 */

// Mock prisma so audit.ts import chain doesn't try to connect to a real DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

// Mock auth so audit.ts import chain doesn't load next-auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user' } }),
}))

// Mock next/headers so audit.ts getRequestInfo() doesn't crash outside request scope
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

// ── Imports (dynamic so stage-2 mocks can be set up if needed) ──────────────

describe('S1-5: Error sanitization / stack trace filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── sanitizeErrorMessage — strips stack traces ──────────────────────────

  describe('sanitizeErrorMessage — strips stack traces', () => {
    it('strips the stack trace portion from an Error', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const error = new Error('Something broke')
      error.stack = `Error: Something broke
    at Function.handler (src/app/api/sync/route.ts:42:11)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)`

      const result = sanitizeErrorMessage(error)

      // The core message should be preserved
      expect(result).toContain('Something broke')
      // Stack trace lines should be stripped
      expect(result).not.toContain('at Function.handler')
      expect(result).not.toContain('src/app/api/sync/route.ts')
      expect(result).not.toContain('processTicksAndRejections')
    })

    it('preserves the original error message', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const error = new Error('Rate limit exceeded: try again in 60 seconds')
      const result = sanitizeErrorMessage(error)

      expect(result).toContain('Rate limit exceeded')
    })

    it('handles Error objects without a stack property', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const error = new Error('Simple error')
      // Some environments may not populate stack
      delete (error as any).stack

      const result = sanitizeErrorMessage(error)

      expect(result).toContain('Simple error')
    })

    it('handles string errors', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const result = sanitizeErrorMessage('string error message')

      expect(result).toContain('string error message')
    })

    it('redacts API keys in "key=value" format from error messages', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      // The regex matches api_key=... format, not "API key: ..." natural language
      const error = new Error('Invalid api_key=sk-1234567890abcdef found in response')
      const result = sanitizeErrorMessage(error)

      expect(result).toContain('Invalid api_key')
      expect(result).not.toContain('sk-1234567890abcdef')
      expect(result).toMatch(/\[REDACTED\]/)
    })

    it('redacts Bearer tokens', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const error = new Error('Unauthorized: Bearer ghp_abc123def456')
      const result = sanitizeErrorMessage(error)

      expect(result).toContain('Unauthorized')
      expect(result).not.toContain('ghp_abc123def456')
      expect(result).toContain('[REDACTED]')
    })

    it('truncates long messages to 500 characters', async () => {
      const { sanitizeErrorMessage } = await import('@omnysync/core/services/sanitize')

      const longMessage = 'A'.repeat(1000)
      const error = new Error(longMessage)
      const result = sanitizeErrorMessage(error)

      expect(result.length).toBeLessThanOrEqual(500)
    })
  })

  // ── sanitizeError — prevents internal details from leaking ──────────────

  describe('sanitizeError — prevents internal details from leaking to clients', () => {
    it('returns a generic message for Error instances', async () => {
      const { sanitizeError } = await import('@/lib/api-error')

      const error = new Error('Database connection failed: ECONNREFUSED 10.0.0.1:5432')
      const result = sanitizeError(error)

      // Must not expose internal details
      expect(result).toBe('An internal error occurred')
      expect(result).not.toContain('ECONNREFUSED')
      expect(result).not.toContain('10.0.0.1')
    })

    it('returns a generic message for non-Error objects', async () => {
      const { sanitizeError } = await import('@/lib/api-error')

      expect(sanitizeError('some string')).toBe('An error occurred')
      expect(sanitizeError(null)).toBe('An error occurred')
      expect(sanitizeError(undefined)).toBe('An error occurred')
      expect(sanitizeError({ code: 'ERR001' })).toBe('An error occurred')
    })
  })

  // ── Audit trail — errorStack is NOT stored (S1-5 requirement) ──────────

  describe('Audit trail does not store errorStack', () => {
    it('the withAudit error handler does not include errorStack in details', async () => {
      // This test verifies that after S1-5, the withAudit function does NOT
      // store errorStack in the audit log details.
      //
      // The CURRENT implementation still stores errorStack (line 195 in audit.ts).
      // This test documents the expected post-fix behaviour.
      // Once S1-5 is applied, the assertion below should be uncommented.

      const { prisma } = await import('@/lib/prisma')
      const { withAudit } = await import('@/lib/audit')

      const testError = new Error('Test failure detail')
      testError.stack = 'Error: Test failure detail\n    at test (file.ts:1:1)'

      await expect(
        withAudit('org-1', 'sync.failed' as any, 'sync' as any, 'sync-1', {} as any, () => {
          throw testError
        })
      ).rejects.toThrow('Test failure detail')

      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalled()

      const createArg = vi.mocked(prisma.auditLog.create).mock.calls[0]![0] as Record<string, any>
      expect(createArg).toBeDefined()
      expect(createArg.data).toBeDefined()

      const loggedDetails = createArg.data.details as Record<string, unknown>

      // The audit includes the error message
      expect(loggedDetails.success).toBe(false)
      expect(loggedDetails.errorMessage).toBe('Test failure detail')

      // ✅ S1-5 is already applied: errorStack MUST NOT be stored
      expect(loggedDetails).not.toHaveProperty('errorStack')
    })
  })
})
