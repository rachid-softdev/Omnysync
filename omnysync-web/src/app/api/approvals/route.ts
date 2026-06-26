/**
 * Route API: Gestion des approbations
 * GET /api/approvals
 * POST /api/approvals
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const createApprovalSchema = z.object({
  documentId: z.string().min(1, 'Document requis'),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Récupérer les documents de l'org pour trouver les approbations
    const documents = await prisma.document.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true, title: true },
    })

    const documentIds = documents.map((d: any) => d.id)

    const approvals = await prisma.approvalRequest.findMany({
      where: { documentId: { in: documentIds } },
      include: {
        document: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Si viewer/member, ne montrer que les demandes en attente
    const filteredApprovals = ['OWNER', 'ADMIN'].includes(membership.role)
      ? approvals
      : approvals.filter((a: any) => a.status === 'PENDING')

    return NextResponse.json({
      approvals: filteredApprovals.map((a: any) => ({
        id: a.id,
        documentId: a.documentId,
        documentTitle: a.document.title,
        status: a.status,
        requestedBy: a.requestedBy,
        requestedAt: a.createdAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAt?.toISOString(),
        comments: a.comments,
      })),
    })
  } catch (error) {
    console.error('GET approvals error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { documentId } = createApprovalSchema.parse(body)

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Vérifier le document
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId: membership.organizationId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Vérifier si une demande existe déjà
    const existing = await prisma.approvalRequest.findFirst({
      where: { documentId, status: 'PENDING' },
    })

    if (existing) {
      return NextResponse.json({ error: 'Une demande existe déjà' }, { status: 400 })
    }

    // Créer la demande
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours

    const approval = await prisma.approvalRequest.create({
      data: {
        documentId,
        token,
        status: 'PENDING',
        requestedBy: session.user.id,
        expiresAt,
      },
    })

    // TODO: Envoyer un email au personnes qui peuvent approuver

    return NextResponse.json({
      approval: {
        id: approval.id,
        documentId: approval.documentId,
        status: approval.status,
        expiresAt: approval.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }
    console.error('POST approval error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
