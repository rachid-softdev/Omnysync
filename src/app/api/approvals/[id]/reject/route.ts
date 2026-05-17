/**
 * Route API: Rejeter une demande d'approbation
 * POST /api/approvals/[id]/reject
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const rejectSchema = z.object({
  comments: z.string().min(1, "Un commentaire est requis pour le rejet"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params

    // Vérifier que l'utilisateur a le droit de rejeter (owner ou admin)
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

    // Récupérer la demande d'approbation
    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        document: { select: { organizationId: true } },
      },
    })

    if (!approvalRequest) {
      return NextResponse.json({ error: "Demande d'approbation non trouvée" }, { status: 404 })
    }

    // Vérifier que le rejeté est dans la même organisation
    if (approvalRequest.document.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Vérifier que la demande est toujours en attente
    if (approvalRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Cette demande a déjà été traitée" }, { status: 400 })
    }

    // Vérifier si expirée
    if (new Date() > approvalRequest.expiresAt) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "Cette demande a expiré" }, { status: 400 })
    }

    // Rejeter la demande
    const body = await request.json()
    const { comments } = rejectSchema.parse(body)

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: session.user.id,
        approvedAt: new Date(),
        comments,
      },
    })

    // TODO: Envoyer un email de rejet avec les raisons

    return NextResponse.json({
      approval: {
        id: updated.id,
        status: updated.status,
        approvedBy: updated.approvedBy,
        approvedAt: updated.approvedAt?.toISOString(),
        comments: updated.comments,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("POST reject error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}