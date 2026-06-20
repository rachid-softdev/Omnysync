/**
 * Route API: Tester un webhook
 * POST /api/webhook-endpoints/[id]/test
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 🔒 Block SSRF to private / internal / cloud-metadata IP ranges
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::$/,
  /^fc00:/i,
  /^fe80:/i,
  /^\[?::1\]?$/,
]

function isPrivateHost(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, '') // strip brackets for IPv6
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))
}

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

    // 🔒 SSRF protection: reject requests to private / internal addresses
    let parsedUrl: URL
    try {
      parsedUrl = new URL(webhook.url)
    } catch {
      return NextResponse.json({ error: 'URL de webhook invalide' }, { status: 400 })
    }

    if (isPrivateHost(parsedUrl)) {
      console.warn(
        `SSRF blocked: webhook test to private address "${webhook.url}" (user ${session.user.id})`
      )
      return NextResponse.json(
        { error: 'Les adresses réseau internes ne sont pas autorisées' },
        { status: 400 }
      )
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
