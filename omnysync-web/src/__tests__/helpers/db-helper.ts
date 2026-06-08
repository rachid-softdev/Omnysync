import { Prisma, PrismaClient } from '@prisma/client'

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$queryRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`)
    }
  }
}

export async function createTestUser(
  prisma: PrismaClient,
  overrides?: Partial<Prisma.UserCreateInput>
) {
  return prisma.user.create({
    data: {
      email: 'test@omnysync.com',
      name: 'Test User',
      password: '$2b$12$hashedpassword',
      role: 'USER',
      ...overrides,
    },
  })
}

export async function createTestOrg(prisma: PrismaClient, userId: string) {
  return prisma.organization.create({
    data: {
      name: 'Test Org',
      users: { create: { userId, role: 'OWNER' } },
    },
  })
}
