/**
 * Route API: Gestion des Webhooks
 * GET /api/webhooks
 * POST /api/webhooks
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const createWebhookSchema = z.object({
  connectorId: z.string().min(1, 'Connecteur requis'),
  type: z.enum(['WORDPRESS', 'GHOST', 'WEBFLOW', 'SHOPIFY']),
  url: z.string().url('URL invalide'),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'organisation de l'utilisateur
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        connector: {
          select: { name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      webhooks: webhooks.map((w) => ({
        id: w.id,
        connectorId: w.connectorId,
        connectorName: w.connector?.name,
        type: w.type,
        url: w.url,
        secret: w.secret,
        isActive: w.isActive,
        createdAt: w.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET webhooks error:', error)
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
    const { connectorId, type, url } = createWebhookSchema.parse(body)

    // Vérifier que le connecteur existe et appartient à l'org
    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    const connector = await prisma.connector.findFirst({
      where: { id: connectorId, organizationId: membership.organizationId },
    })

    if (!connector) {
      return NextResponse.json({ error: 'Connecteur non trouvé' }, { status: 404 })
    }

    // Générer un secret pour la signature
    const secret = randomBytes(32).toString('hex')

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        organizationId: membership.organizationId,
        connectorId,
        type,
        url,
        secret,
        isActive: true,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: membership.organizationId,
        userId: session.user.id,
        action: 'webhook.created',
        targetType: 'webhook',
        targetId: webhook.id,
        details: { type, url },
      },
    })

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        connectorId: webhook.connectorId,
        type: webhook.type,
        url: webhook.url,
        secret: webhook.secret,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }
    console.error('POST webhook error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
