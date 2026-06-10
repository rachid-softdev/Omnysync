import { encryptData, decryptResult } from '@omnysync/core/prisma'
import type { Adapter } from '@auth/core/adapters'

/**
 * Wraps an Auth.js PrismaAdapter to encrypt/decrypt OAuth tokens.
 *
 * Prisma 7 removed $use middleware, so we intercept at the adapter level:
 * - linkAccount: encrypt tokens before writing to DB
 * - getUserByAccount: decrypt tokens after reading from DB
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

    async getUserByAccount(providerAccountId) {
      const account = await adapter.getUserByAccount!(providerAccountId)
      if (account) {
        decryptResult(account)
      }
      return account
    },
  }
}
