/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../crypto'

// Set encryption key and salt for tests
process.env.ENCRYPTION_KEY = 'test-encryption-key-32bytes-minimum'
process.env.ENCRYPTION_SALT = 'test-salt-16-chars'

describe('crypto', () => {
  // Must run first before any encrypt() call caches the derived key
  it('throws without ENCRYPTION_KEY', () => {
    const originalKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY

    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')

    process.env.ENCRYPTION_KEY = originalKey
  })

  it('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-token-12345'
    const encrypted = encrypt(plaintext)

    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':')

    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('handles special characters', () => {
    const plaintext = '{"token":"abc123=+/","url":"https://example.com"}'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('handles backward-compatible unencrypted text', () => {
    const unencrypted = 'old-plain-credentials'
    const decrypted = decrypt(unencrypted)
    expect(decrypted).toBe(unencrypted)
  })
})
