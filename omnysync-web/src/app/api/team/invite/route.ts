import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { hasPermission } from '@/lib/auth/permissions'
import { checkTeamMemberLimit } from '@/lib/auth/subscription'
import { auditMember } from '@/lib/audit'
import { sendTeamInviteEmail } from '@/lib/email'

// NOTE: `@/lib/validations` resolves to `src/lib/validations.ts`, which shadows
// the larger `src/lib/validations/index.ts` (where `inviteMemberSchema` lives).
// Defining the schema locally avoids depending on the shadowed module.
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
})

// OWNER is deliberately not assignable: transferring ownership goes through a
// dedicated flow, so an admin can never mint another owner from this endpoint.
const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value)
}

/**
 * POST /api/team/invite
 *
 * Adds an existing account to the caller's organization. There is no
 * invitation persistence model yet, so an unknown email cannot be invited
 * (the caller gets an explicit error instead of a fake success).
 */
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  if (!(await hasPermission(session.user.id, orgId, 'team:invite'))) {
    return NextResponse.json({ error: 'You cannot invite team members' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.toLowerCase()
  const role = parsed.data.role

  if (!isAssignableRole(role)) {
    return NextResponse.json(
      { error: 'OWNER cannot be assigned through an invitation' },
      { status: 400 }
    )
  }

  const limit = await checkTeamMemberLimit(session.user.id, orgId)
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Team member limit reached (${limit.current}/${limit.limit}). Upgrade your plan to invite more members.`,
        code: 'TEAM_LIMIT_EXCEEDED',
        upgradeUrl: limit.upgradeUrl,
      },
      { status: 429 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, image: true, createdAt: true, deletedAt: true },
  })

  if (!user || user.deletedAt) {
    return NextResponse.json(
      { error: 'No account found for this email. Ask your teammate to sign up first.' },
      { status: 404 }
    )
  }

  const existing = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId: orgId },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'This user is already a member of your organization' },
      { status: 400 }
    )
  }

  try {
    const membership = await prisma.userOrganization.create({
      data: { userId: user.id, organizationId: orgId, role },
    })

    await auditMember.invited(orgId, email, role)

    // Notify existing owners/admins who kept team invite notifications on.
    // Email delivery must never turn a successful membership into a 500.
    try {
      const [organization, recipients] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        }),
        prisma.userOrganization.findMany({
          where: {
            organizationId: orgId,
            role: { in: ['OWNER', 'ADMIN'] },
            userId: { not: user.id },
          },
          select: {
            user: {
              select: {
                id: true,
                email: true,
                notificationPreference: { select: { teamInvites: true } },
              },
            },
          },
        }),
      ])

      const organizationName = organization?.name || 'your organization'
      const memberName = user.name || user.email || 'A new member'
      const inviterName = session.user.name || 'A teammate'

      await Promise.allSettled(
        recipients
          .filter(
            ({ user: recipient }) =>
              recipient.email && recipient.notificationPreference?.teamInvites !== false
          )
          .map(({ user: recipient }) =>
            sendTeamInviteEmail({
              to: recipient.email as string,
              memberName,
              organizationName,
              inviterName,
            })
          )
      )
    } catch (error) {
      console.error('Team invite notification failed:', error)
    }

    return NextResponse.json({
      success: true,
      member: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: membership.role,
        joinedAt: user.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('POST team invite error:', error)
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 })
  }
}
