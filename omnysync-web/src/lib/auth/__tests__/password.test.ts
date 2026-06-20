import { describe, it, expect, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockHash = vi.hoisted(() => vi.fn())
const mockCompare = vi.hoisted(() => vi.fn())

vi.mock('bcrypt', () => ({
  hash: mockHash,
  compare: mockCompare,
}))

// ── Imports (after mock) ─────────────────────────────────────────────────────

import { validatePasswordStrength, hashPassword, verifyPassword } from '../password'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('validatePasswordStrength', () => {
  it('returns valid for a strong password', () => {
    const result = validatePasswordStrength('StrongP@ss1')
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('returns warning but valid for a strong password without special char', () => {
    const result = validatePasswordStrength('StrongPass1')
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([
      'Suggestion: ajoutez un caractère spécial pour plus de sécurité',
    ])
  })

  it('returns error for password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Ab1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins 8 caractères')
  })

  it('returns error for password without uppercase letter', () => {
    const result = validatePasswordStrength('weakpass1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une majuscule')
  })

  it('returns error for password without lowercase letter', () => {
    const result = validatePasswordStrength('WEAKPASS1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une minuscule')
  })

  it('returns error for password without digit', () => {
    const result = validatePasswordStrength('WeakPass!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins un chiffre')
  })

  it('returns multiple errors for a very weak password', () => {
    const result = validatePasswordStrength('short')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins 8 caractères')
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une majuscule')
  })

  it('returns all errors for an empty password', () => {
    const result = validatePasswordStrength('')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins 8 caractères')
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une majuscule')
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une minuscule')
    expect(result.errors).toContain('Le mot de passe doit contenir au moins un chiffre')
  })

  it('returns warning for password without special characters', () => {
    const result = validatePasswordStrength('ValidPass1')
    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([
      'Suggestion: ajoutez un caractère spécial pour plus de sécurité',
    ])
  })

  it('does not return warning when special character is present', () => {
    const result = validatePasswordStrength('ValidPass1!')
    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('accepts special characters from the defined set', () => {
    const specialChars = '!@#$%^&*(),.?":{}|<>'
    for (const char of specialChars) {
      const pw = `ValidPass1${char}`
      const result = validatePasswordStrength(pw)
      expect(result.valid).toBe(true)
      expect(result.warnings).toEqual([])
    }
  })

  it('detects password with only uppercase and digits but no lowercase', () => {
    const result = validatePasswordStrength('ABCDEF123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Le mot de passe doit contenir au moins une minuscule')
  })
})

describe('hashPassword', () => {
  it('calls bcrypt hash with the password and correct rounds', async () => {
    mockHash.mockResolvedValue('$2b$12$hashedpassword')

    const result = await hashPassword('myPassword')

    expect(mockHash).toHaveBeenCalledWith('myPassword', 12)
    expect(result).toBe('$2b$12$hashedpassword')
  })

  it('returns different hashes for different passwords', async () => {
    mockHash.mockResolvedValueOnce('hash1')
    mockHash.mockResolvedValueOnce('hash2')

    const hash1 = await hashPassword('password1')
    const hash2 = await hashPassword('password2')

    expect(hash1).not.toBe(hash2)
  })

  it('forwards errors from bcrypt hash', async () => {
    const error = new Error('bcrypt error')
    mockHash.mockRejectedValue(error)

    await expect(hashPassword('password')).rejects.toThrow('bcrypt error')
  })
})

describe('verifyPassword', () => {
  it('returns true when password matches the hash', async () => {
    mockCompare.mockResolvedValue(true)

    const result = await verifyPassword('password', '$2b$12$hashedpassword')

    expect(mockCompare).toHaveBeenCalledWith('password', '$2b$12$hashedpassword')
    expect(result).toBe(true)
  })

  it('returns false when password does not match the hash', async () => {
    mockCompare.mockResolvedValue(false)

    const result = await verifyPassword('wrongpassword', '$2b$12$hashedpassword')

    expect(result).toBe(false)
  })

  it('forwards errors from bcrypt compare', async () => {
    const error = new Error('bcrypt compare error')
    mockCompare.mockRejectedValue(error)

    await expect(verifyPassword('password', '$2b$12$hash')).rejects.toThrow('bcrypt compare error')
  })
})
