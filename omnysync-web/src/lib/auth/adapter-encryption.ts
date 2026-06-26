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

    async linkAccount(data: Record<string, unknown>) {
      ;(encryptData as (data: string) => string)(data)
      return (adapter.linkAccount as (data: Record<string, unknown>) => Promise<unknown>)(data)
    },

    async getAccount(providerAccountId: string, provider: string) {
      const account = await (
        adapter.getAccount as (
          providerAccountId: string,
          provider: string
        ) => Promise<Record<string, unknown> | null>
      )(providerAccountId, provider)
      if (account) {
        ;(decryptResult as (data: string) => string)(account)
      }
      return account
    },
  }
}
