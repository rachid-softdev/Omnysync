/**
 * Route API: Tester un webhook
 * POST /api/webhook-endpoints/[id]/test
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Récupérer le webhook
    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook non trouvé' }, { status: 404 })
    }

    if (!webhook.isActive) {
      return NextResponse.json({ error: 'Le webhook est désactivé' }, { status: 400 })
    }

    // Envoyer une requête de test
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Omnysync',
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      })

      // Enregistrer le test dans les logs
      await prisma.syncLog.create({
        data: {
          organizationId: membership.organizationId,
          userId: session.user.id,
          action: 'webhook_test',
          status: response.ok ? 'SUCCESS' : 'ERROR',
          message: `Test webhook - Status: ${response.status}`,
          details: {
            webhookId: id,
            url: webhook.url,
            responseStatus: response.status,
          },
        },
      })

      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Test réussi' : `Statut: ${response.status}`,
      })
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue'

      await prisma.syncLog.create({
        data: {
          organizationId: membership.organizationId,
          userId: session.user.id,
          action: 'webhook_test',
          status: 'ERROR',
          message: `Test échoué: ${errorMessage}`,
          details: { webhookId: id, url: webhook.url, error: errorMessage },
        },
      })

      return NextResponse.json({
        success: false,
        message: `Échec: ${errorMessage}`,
      })
    }
  } catch (error) {
    console.error('POST webhook test error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
