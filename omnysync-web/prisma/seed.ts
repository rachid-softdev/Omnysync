import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed an admin user (only if no users exist)
  const userCount = await prisma.user.count({
    where: {},
  })
  if (userCount === 0) {
    const admin = await prisma.user.upsert({
      where: { email: 'admin@omnysync.com' },
      create: {
        email: 'admin@omnysync.com',
        name: 'Admin',
        role: 'ADMIN',
        userRoles: {
          create: [{ role: 'ADMIN' }, { role: 'USER' }],
        },
      },
      update: {},
    })
    console.log('Admin user created:', admin.email)
  } else {
    console.log('Users already exist, skipping seed')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
