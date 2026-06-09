import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { createOAuthEncryptionMiddleware } from '@omnysync/core'

const { Pool } = pg

const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined in environment variables')
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  // Middleware: transparent encryption/decryption of OAuth tokens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(client as any).$use(createOAuthEncryptionMiddleware())

  return client
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}
