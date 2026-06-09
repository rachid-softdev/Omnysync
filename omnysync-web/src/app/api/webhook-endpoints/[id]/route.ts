/**
 * Route API: Gestion des endpoints de webhook
 * GET /api/webhook-endpoints/[id]
 * DELETE /api/webhook-endpoints/[id]
 * PATCH /api/webhook-endpoints/[id] - Toggle isActive
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateWebhookSchema = z.object({
  isActive: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Récupérer l'organisation de l'utilisateur
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      include: {
        connector: {
          select: { name: true, type: true },
        },
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook non trouvé' }, { status: 404 })
    }

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        connectorId: webhook.connectorId,
        connectorName: webhook.connector?.name,
        type: webhook.type,
        url: webhook.url,
        isActive: webhook.isActive,
        secret: webhook.secret ? '***' : null,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('GET webhook error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { isActive } = updateWebhookSchema.parse(body)

    // Récupérer l'organisation de l'utilisateur
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Vérifier que le webhook existe et appartient à l'organisation
    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook non trouvé' }, { status: 404 })
    }

    // Mettre à jour
    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({
      webhook: {
        id: updated.id,
        isActive: updated.isActive,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }
    console.error('PATCH webhook error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Récupérer l'organisation de l'utilisateur
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Vérifier que le webhook existe et appartient à l'organisation
    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook non trouvé' }, { status: 404 })
    }

    // Supprimer le webhook
    await prisma.webhookEndpoint.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE webhook error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
