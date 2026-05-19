import { prisma } from '@/lib/prisma'

export async function getUserOrgId(userId: string): Promise<string> {
  // Find the user's first organization
  const membership = await prisma.userOrganization.findFirst({
    where: { userId },
    include: { organization: true },
  })

  if (membership) {
    return membership.organizationId
  }

  // Auto-create a "Personal" organization if none exists
  const org = await prisma.organization.create({
    data: {
      name: 'Personal',
      users: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  })

  return org.id
}
