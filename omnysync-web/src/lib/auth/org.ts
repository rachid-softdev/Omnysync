import { prisma } from '@/lib/prisma'

export async function getUserOrgId(userId: string): Promise<string> {
  const membership = await prisma.userOrganization.findFirst({
    where: { userId },
  })

  if (!membership) {
    throw new Error('User has no organization membership')
  }

  return membership.organizationId
}

export async function ensureUserOrg(userId: string): Promise<string> {
  const membership = await prisma.userOrganization.findFirst({
    where: { userId },
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
