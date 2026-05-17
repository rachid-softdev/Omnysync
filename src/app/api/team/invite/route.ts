/**
 * Route API: Inviter un membre dans l'équipe
 * POST /api/team/invite
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const inviteSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Vérifier que l'utilisateur peut inviter (owner ou admin)
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    })

    if (!membership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    const body = await request.json()
    const { email, role } = inviteSchema.parse(body)

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Vérifier s'il est déjà membre de l'organisation
      const existingMembership = await prisma.userOrganization.findFirst({
        where: {
          userId: existingUser.id,
          organizationId: membership.organizationId,
        },
      })

      if (existingMembership) {
        return NextResponse.json({ error: "Cet utilisateur est déjà membre de l'organisation" }, { status: 400 })
      }

      // Ajouter directement l'utilisateur existant
      const newMembership = await prisma.userOrganization.create({
        data: {
          userId: existingUser.id,
          organizationId: membership.organizationId,
          role,
        },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      })

      return NextResponse.json({
        member: {
          id: newMembership.id,
          userId: newMembership.userId,
          role: newMembership.role,
          user: {
            name: newMembership.user.name,
            email: newMembership.user.email,
            image: newMembership.user.image,
          },
        },
        addedDirectly: true,
      })
    }

    // TODO: Implémenter真正的邀请系统 avec token
    // Pour l'instant, retourner un message indiquant que l'utilisateur n'existe pas
    return NextResponse.json({
      error: "Utilisateur non trouvé. Cette fonctionnalité nécessite un système d'invitation par email.",
      requiresInviteSystem: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("POST team invite error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}