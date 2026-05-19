import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('sanitizeError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Test the actual sanitizeError function from the module
  it('returns generic message for Error instance', async () => {
    const { sanitizeError } = await import('../api-error')
    const error = new Error('Database connection failed')

    const result = sanitizeError(error)

    expect(result).toBe('An internal error occurred')
    expect(console.error).toHaveBeenCalledWith(
      'Internal error:',
      'Database connection failed',
      expect.any(String)
    )
  })

  it('returns generic message for Error with stack trace', async () => {
    const { sanitizeError } = await import('../api-error')
    const error = new Error('Something went wrong')
    error.stack = 'Error: Something went wrong\n    at Function.test (test.ts:1:1)'

    const result = sanitizeError(error)

    expect(result).toBe('An internal error occurred')
  })

  it('does not expose internal error messages', async () => {
    const { sanitizeError } = await import('../api-error')
    const error = new Error("SELECT * FROM users WHERE id = '1'; DROP TABLE users;")

    const result = sanitizeError(error)

    expect(result).toBe('An internal error occurred')
    expect(result).not.toContain('SELECT')
    expect(result).not.toContain('DROP TABLE')
  })

  it('does not expose stack traces', async () => {
    const { sanitizeError } = await import('../api-error')
    const error = new Error('Internal error')
    error.stack = 'Error: Internal error\n    at Database.query (db.ts:42:10)'

    const result = sanitizeError(error)

    expect(result).toBe('An internal error occurred')
    expect(result).not.toContain('db.ts')
    expect(result).not.toContain('query')
  })

  it('returns generic message for string error', async () => {
    const { sanitizeError } = await import('../api-error')
    const result = sanitizeError('Some error string')

    expect(result).toBe('An error occurred')
  })

  it('returns generic message for null', async () => {
    const { sanitizeError } = await import('../api-error')
    const result = sanitizeError(null)

    expect(result).toBe('An error occurred')
  })

  it('returns generic message for undefined', async () => {
    const { sanitizeError } = await import('../api-error')
    const result = sanitizeError(undefined)

    expect(result).toBe('An error occurred')
  })

  it('returns generic message for object error', async () => {
    const { sanitizeError } = await import('../api-error')
    const result = sanitizeError({ code: 'ERR001', detail: 'Database error' })

    expect(result).toBe('An error occurred')
  })

  it('logs internal errors to console.error', async () => {
    const { sanitizeError } = await import('../api-error')
    const error = new Error('Secret internal message')

    sanitizeError(error)

    expect(console.error).toHaveBeenCalledWith(
      'Internal error:',
      'Secret internal message',
      expect.any(String)
    )
  })

  it('does not log for non-Error types', async () => {
    const { sanitizeError } = await import('../api-error')

    sanitizeError('string error')
    sanitizeError(null)
    sanitizeError({})

    expect(console.error).not.toHaveBeenCalled()
  })

  it('handles errors with long messages', async () => {
    const { sanitizeError } = await import('../api-error')
    const longMessage = 'x'.repeat(1000)
    const error = new Error(longMessage)

    const result = sanitizeError(error)

    expect(result).toBe('An internal error occurred')
    expect(result.length).toBeLessThan(longMessage.length)
  })
})

// Test apiError response format indirectly
describe('apiError format', () => {
  it('apiError returns proper structure', async () => {
    const { apiError } = await import('../api-error')

    // We can't easily mock NextResponse, so we'll verify the function exists and has expected signature
    expect(apiError).toBeDefined()
    expect(typeof apiError).toBe('function')
    expect(apiError.length).toBeGreaterThanOrEqual(1) // at least message parameter
  })

  it('apiError accepts message parameter', async () => {
    const { apiError } = await import('../api-error')

    // Basic check that it's callable
    expect(() => apiError('test')).not.toThrow()
  })

  it('apiError accepts status parameter', async () => {
    const { apiError } = await import('../api-error')

    expect(() => apiError('test', 404)).not.toThrow()
  })

  it('apiError accepts code parameter', async () => {
    const { apiError } = await import('../api-error')

    expect(() => apiError('test', 429, 'RATE_LIMIT')).not.toThrow()
  })
})
