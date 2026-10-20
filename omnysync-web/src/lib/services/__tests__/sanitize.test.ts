import { describe, it, expect } from 'vitest'
import { sanitizeErrorMessage } from '@/lib/services/sanitize'

describe('sanitizeErrorMessage', () => {
  it('redacts api key / token / secret / password credentials', () => {
    expect(sanitizeErrorMessage('api_key=sk-1234567890')).toBe('api_key=[REDACTED]')
    expect(sanitizeErrorMessage('access_token: abcdef123456')).toBe('access_token=[REDACTED]')
    expect(sanitizeErrorMessage('secret=topsecret')).toBe('secret=[REDACTED]')
    expect(sanitizeErrorMessage('password: hunter2')).toBe('password=[REDACTED]')
  })

  it('redacts Bearer tokens', () => {
    expect(sanitizeErrorMessage('Authorization Bearer eyJhbGciOi')).toBe(
      'Authorization Bearer [REDACTED]'
    )
  })

  it('redacts secrets in URL query params', () => {
    expect(sanitizeErrorMessage('https://x.com/cb?token=abc&other=1')).toBe(
      'https://x.com/cb?token=[REDACTED]&other=1'
    )
    expect(sanitizeErrorMessage('https://x.com/cb?key=secretvalue')).toBe(
      'https://x.com/cb?key=[REDACTED]'
    )
  })

  it('redacts file paths ending in source extensions', () => {
    expect(sanitizeErrorMessage('Cannot read /home/user/app/src/lib/foo.ts')).toContain(
      '[PATH_REDACTED]'
    )
  })

  it('strips stack trace lines', () => {
    const input = 'boom\n    at Object.<anonymous> (/app/index.js:10:5)'
    expect(sanitizeErrorMessage(input)).toBe('boom')
  })

  it('truncates to 500 characters', () => {
    const long = 'x'.repeat(600)
    expect(sanitizeErrorMessage(long).length).toBe(500)
  })

  it('coerces non-Error values to a string', () => {
    expect(sanitizeErrorMessage(42)).toBe('42')
    expect(sanitizeErrorMessage(null)).toBe('null')
    expect(sanitizeErrorMessage(undefined)).toBe('undefined')
    // The "Unknown error" fallback only applies to empty messages.
    expect(sanitizeErrorMessage('')).toBe('Unknown error')
    expect(sanitizeErrorMessage(new Error(''))).toBe('Unknown error')
  })

  it('returns the error message for Error instances', () => {
    expect(sanitizeErrorMessage(new Error('something failed'))).toBe('something failed')
  })
})
