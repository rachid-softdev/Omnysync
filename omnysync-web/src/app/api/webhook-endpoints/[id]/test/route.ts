/**
 * Route API: Tester un webhook
 * POST /api/webhook-endpoints/[id]/test
 */
import { NextRequest, NextResponse } from 'next/server'
import { postJsonWithPinnedDns, UnsafeOutboundUrlError } from '@omnysync/core/services/safe-fetch'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanFeature } from '@/lib/auth/subscription'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Webhook endpoints are a plan feature (pricing page).
    const webhooks = await checkPlanFeature(session.user.id, 'webhooks')
    if (!webhooks.allowed) {
      return NextResponse.json(
        {
          error: 'Webhooks are not included in your plan',
          code: 'PLAN_FEATURE_REQUIRED',
          upgradeUrl: webhooks.upgradeUrl,
        },
        { status: 403 }
      )
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

    // Parse early so malformed URLs get a 400 before any DNS work.
    let parsedUrl: URL
    try {
      parsedUrl = new URL(webhook.url)
    } catch {
      return NextResponse.json({ error: 'URL de webhook invalide' }, { status: 400 })
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL de webhook invalide' }, { status: 400 })
    }

    // Envoyer une requête de test. postJsonWithPinnedDns validates the target,
    // pins the resolved DNS address, and never follows redirects.
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Omnysync',
    }

    try {
      const response = await postJsonWithPinnedDns(webhook.url, JSON.stringify(testPayload), {
        'X-Webhook-Test': 'true',
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
      if (fetchError instanceof UnsafeOutboundUrlError) {
        console.warn(
          `SSRF blocked: webhook test to "${parsedUrl.host}" (user ${session.user.id}): ${fetchError.message}`
        )
        return NextResponse.json({ error: fetchError.message }, { status: 400 })
      }

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
