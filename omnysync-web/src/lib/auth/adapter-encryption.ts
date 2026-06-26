import { encryptData, decryptResult } from '@omnysync/core/prisma'

/**
 * Wraps an Auth.js PrismaAdapter to encrypt/decrypt OAuth tokens.
 *
 * Prisma 7 removed $use middleware, so we intercept at the adapter level:
 * - linkAccount: encrypt tokens before writing to DB
 * - getAccount: decrypt tokens after reading from DB
 *
 * Uses Record<string, unknown> for input/output to avoid type conflicts
 * between stub and real @auth/core/adapters types.
 *
 * @param adapter - The original Auth.js adapter (from PrismaAdapter)
 * @returns A wrapped adapter with OAuth encryption
 */
export function withOAuthEncryption(adapter: Record<string, unknown>): Record<string, unknown> {
  const linkAccount = adapter.linkAccount as
    | ((account: Record<string, unknown>) => Promise<unknown>)
    | undefined

  const getAccount = adapter.getAccount as
    | ((providerAccountId: string, provider: string) => Promise<Record<string, unknown> | null>)
    | undefined

  return {
    ...adapter,

    async linkAccount(account: Record<string, unknown>) {
      encryptData(account)
      return linkAccount!(account)
    },

    async getAccount(providerAccountId: string, provider: string) {
      const account = await getAccount!(providerAccountId, provider)
      if (account) {
        decryptResult(account)
      }
      return account
    },
  }
}
