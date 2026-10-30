import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkTeamMemberLimit } from '@/lib/auth/subscription'

// OWNER is deliberately not assignable: transferring ownership goes through a
// dedicated flow, so an admin can never mint another owner from this endpoint.
const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value)
}

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  const memberships = await prisma.userOrganization.findMany({
    where: { organizationId: orgId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      },
    },
  })

  const members = memberships.map((m) => ({
    // Membership id: PUT/DELETE /api/team/[memberId] operate on the
    // UserOrganization row, not the user id. Returning the user id here made
    // role changes and removals fail with 404 for every teammate.
    id: m.id,
    name: (m.user as { name: string | null }).name,
    email: (m.user as { email: string }).email,
    image: (m.user as { image: string | null }).image,
    role: m.role,
    joinedAt: (m.user as { createdAt: { toISOString: () => string } }).createdAt.toISOString(),
  }))

  return NextResponse.json(members)
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  // SECURITY: Verify caller has OWNER or ADMIN role in this organization
  const callerMembership = await prisma.userOrganization.findFirst({
    where: {
      organizationId: orgId,
      userId: session.user.id,
      role: { in: ['OWNER', 'ADMIN'] },
    },
  })

  if (!callerMembership) {
    return NextResponse.json(
      { error: 'Only organization owners and admins can add members' },
      { status: 403 }
    )
  }

  const body = await req.json()

  const { email, role } = body ?? {}

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  if (role !== undefined && !isAssignableRole(role)) {
    return NextResponse.json(
      { error: 'Invalid role. Allowed roles: ADMIN, MEMBER' },
      { status: 400 }
    )
  }

  const memberRole: AssignableRole = isAssignableRole(role) ? role : 'MEMBER'

  // Plan entitlement: the number of organization members is limited by the plan
  // (MAX_TEAM_MEMBERS — "Multi-users" is a Business feature).
  const teamLimit = await checkTeamMemberLimit(session.user.id, orgId)
  if (!teamLimit.allowed) {
    return NextResponse.json(
      {
        error: `Team member limit reached (${teamLimit.current}/${teamLimit.limit}). Please upgrade your plan.`,
        code: 'TEAM_LIMIT_EXCEEDED',
      },
      { status: 429 }
    )
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    // In production, would send invitation email
    // For now, create a pending invitation
    return NextResponse.json({
      message: 'Invitation envoyée',
      email,
      role: memberRole,
    })
  }

  // Check if already a member
  const existingMember = await prisma.userOrganization.findFirst({
    where: {
      organizationId: orgId,
      userId: user.id,
    },
  })

  if (existingMember) {
    return NextResponse.json({ error: 'Utilisateur déjà membre' }, { status: 400 })
  }

  // Add member
  await prisma.userOrganization.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role: memberRole,
    },
  })

  return NextResponse.json({ success: true })
}
