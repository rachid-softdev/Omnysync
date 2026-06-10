import { encryptData, decryptResult } from '@omnysync/core/prisma'
import type { Adapter } from '@auth/core/adapters'

/**
 * Wraps an Auth.js PrismaAdapter to encrypt/decrypt OAuth tokens.
 *
 * Prisma 7 removed $use middleware, so we intercept at the adapter level:
 * - linkAccount: encrypt tokens before writing to DB
 * - getAccount: decrypt tokens after reading from DB
 *
 * @param adapter - The original Auth.js adapter (from PrismaAdapter)
 * @returns A wrapped adapter with OAuth encryption
 */
export function withOAuthEncryption(adapter: Adapter): Adapter {
  return {
    ...adapter,

    async linkAccount(data) {
      encryptData(data as Record<string, unknown>)
      return adapter.linkAccount!(data)
    },

    async getAccount(providerAccountId, provider) {
      const account = await adapter.getAccount!(providerAccountId, provider)
      if (account) {
        decryptResult(account)
      }
      return account
    },
  }
}
