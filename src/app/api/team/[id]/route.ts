/**
 * Route API: Gestion d'un membre de l'équipe
 * PUT /api/team/[id] - Mettre à jour le rôle
 * DELETE /api/team/[id] - Supprimer un membre
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id: memberId } = await params
    const body = await request.json()
    const { role } = updateRoleSchema.parse(body)

    // Vérifier que l'utilisateur actuel est owner ou admin
    const currentMembership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    })

    if (!currentMembership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    if (!["OWNER", "ADMIN"].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    // Ne pas autoriser de rétrograder le owner
    const targetMembership = await prisma.userOrganization.findUnique({
      where: { id: memberId },
    })

    if (!targetMembership) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "Impossible de modifier le rôle du propriétaire" }, { status: 400 })
    }

    // Vérifier que les deux sont dans la même organisation
    if (targetMembership.organizationId !== currentMembership.organizationId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Mettre à jour le rôle
    const updated = await prisma.userOrganization.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    return NextResponse.json({
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        user: {
          name: updated.user.name,
          email: updated.user.email,
          image: updated.user.image,
        },
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("PUT team member error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id: memberId } = await params

    // Vérifier que l'utilisateur actuel est owner ou admin
    const currentMembership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    })

    if (!currentMembership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    if (!["OWNER", "ADMIN"].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    // Récupérer le membre à supprimer
    const targetMembership = await prisma.userOrganization.findUnique({
      where: { id: memberId },
    })

    if (!targetMembership) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    // Vérifier que les deux sont dans la même organisation
    if (targetMembership.organizationId !== currentMembership.organizationId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Ne pas autoriser la suppression du owner
    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "Impossible de supprimer le propriétaire" }, { status: 400 })
    }

    // Supprimer le membre
    await prisma.userOrganization.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE team member error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}