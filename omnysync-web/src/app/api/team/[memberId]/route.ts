import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
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
      { error: 'Only organization owners and admins can manage members' },
      { status: 403 }
    )
  }

  const { memberId } = await params

  // Prevent self-demotion
  if (memberId === session.user.id) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
  }

  // Find the target membership
  const targetMembership = await prisma.userOrganization.findFirst({
    where: {
      id: memberId,
      organizationId: orgId,
    },
  })

  if (!targetMembership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Prevent downgrading the OWNER
  if (targetMembership.role === 'OWNER') {
    return NextResponse.json(
      { error: 'Cannot change the role of the organization owner' },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { role } = body

  if (!role || !['ADMIN', 'MEMBER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be ADMIN or MEMBER' }, { status: 400 })
  }

  await prisma.userOrganization.update({
    where: { id: memberId },
    data: { role },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
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
      { error: 'Only organization owners and admins can remove members' },
      { status: 403 }
    )
  }

  const { memberId } = await params

  // Prevent self-removal
  if (memberId === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the organization' },
      { status: 400 }
    )
  }

  // Find the target membership
  const targetMembership = await prisma.userOrganization.findFirst({
    where: {
      id: memberId,
      organizationId: orgId,
    },
  })

  if (!targetMembership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Prevent removing the OWNER
  if (targetMembership.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the organization owner' }, { status: 400 })
  }

  await prisma.userOrganization.delete({
    where: { id: memberId },
  })

  return NextResponse.json({ success: true })
}
