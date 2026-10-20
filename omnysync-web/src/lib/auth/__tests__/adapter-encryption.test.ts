import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEncryptData = vi.hoisted(() => vi.fn())
const mockDecryptResult = vi.hoisted(() => vi.fn())

vi.mock('@omnysync/core/prisma', () => ({
  prisma: {},
  getPrisma: vi.fn(),
  encryptData: mockEncryptData,
  decryptResult: mockDecryptResult,
}))

import { withOAuthEncryption } from '../adapter-encryption'

describe('withOAuthEncryption', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a wrapped adapter that preserves the original methods', () => {
    const originalLinkAccount = vi.fn()
    const originalGetAccount = vi.fn()
    const adapter = {
      linkAccount: originalLinkAccount,
      getAccount: originalGetAccount,
      otherMethod: vi.fn(),
    }

    const wrapped = withOAuthEncryption(adapter) as Record<string, unknown>

    expect(typeof wrapped.linkAccount).toBe('function')
    expect(typeof wrapped.getAccount).toBe('function')
    expect(wrapped.otherMethod).toBe(adapter.otherMethod)
  })

  it('encrypts the account before delegating to the original linkAccount', async () => {
    const originalLinkAccount = vi.fn().mockResolvedValue({ id: 'acc-1' })
    const adapter = { linkAccount: originalLinkAccount }
    const account = { access_token: 'secret', providerAccountId: 'p1' }

    const wrapped = withOAuthEncryption(adapter) as {
      linkAccount: (a: Record<string, unknown>) => Promise<unknown>
    }

    const result = await wrapped.linkAccount(account)

    expect(mockEncryptData).toHaveBeenCalledWith(account)
    expect(originalLinkAccount).toHaveBeenCalledWith(account)
    expect(result).toEqual({ id: 'acc-1' })
  })

  it('decrypts the account returned from the original getAccount', async () => {
    const stored = { access_token: 'encrypted', providerAccountId: 'p1' }
    const originalGetAccount = vi.fn().mockResolvedValue(stored)
    const adapter = { getAccount: originalGetAccount }

    const wrapped = withOAuthEncryption(adapter) as {
      getAccount: (id: string, provider: string) => Promise<Record<string, unknown> | null>
    }

    const result = await wrapped.getAccount('p1', 'google')

    expect(originalGetAccount).toHaveBeenCalledWith('p1', 'google')
    expect(mockDecryptResult).toHaveBeenCalledWith(stored)
    expect(result).toBe(stored)
  })

  it('does not decrypt when getAccount returns null', async () => {
    const originalGetAccount = vi.fn().mockResolvedValue(null)
    const adapter = { getAccount: originalGetAccount }

    const wrapped = withOAuthEncryption(adapter) as {
      getAccount: (id: string, provider: string) => Promise<Record<string, unknown> | null>
    }

    const result = await wrapped.getAccount('p1', 'google')

    expect(result).toBeNull()
    expect(mockDecryptResult).not.toHaveBeenCalled()
  })
})
