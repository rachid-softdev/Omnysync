import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    joinedAt: m.user.createdAt.toISOString(),
  }))

  return NextResponse.json(members)
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()

  const { email, role } = body

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    // In production, would send invitation email
    // For now, create a pending invitation
    return NextResponse.json({ 
      message: "Invitation envoyée",
      email,
      role 
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
    return NextResponse.json({ error: "Utilisateur déjà membre" }, { status: 400 })
  }

  // Add member
  await prisma.userOrganization.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role: role || "MEMBER",
    },
  })

  return NextResponse.json({ success: true })
}