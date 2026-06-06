import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { createWordPressClient } from '@/lib/services/wordpress'
import { createGhostClient } from '@/lib/services/ghost'
import crypto from 'crypto'

/**
 * Vérifie la signature HMAC du webhook
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Extrait le document depuis la destination
 */
async function fetchRemoteContent(
  connectorId: string,
  externalId: string
): Promise<{ content: string; title: string; updatedAt: Date } | null> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector) return null

  const credentials = decrypt(connector.credentials || '')
  const config = (connector.config || {}) as Record<string, string>

  switch (connector.type) {
    case 'WORDPRESS': {
      const creds = Buffer.from(credentials, 'base64').toString().split(':')
      const client = createWordPressClient(config.siteUrl!, creds[0]!, creds[1]!)
      const post = (await client.getPost(parseInt(externalId))) as unknown as {
        content?: { rendered?: string }
        title?: { rendered?: string }
        modified?: string
      }
      return {
        content: post?.content?.rendered || '',
        title: post?.title?.rendered || 'Untitled',
        updatedAt: post?.modified ? new Date(post.modified) : new Date(),
      }
    }

    case 'GHOST': {
      const client = createGhostClient(config.siteUrl!, credentials)
      const response = (await client.getPost(externalId)) as unknown as {
        posts?: Array<{
          html?: string
          title?: string
          updated_at?: string
        }>
      }
      return {
        content: response?.posts?.[0]?.html || '',
        title: response?.posts?.[0]?.title || 'Untitled',
        updatedAt: response?.posts?.[0]?.updated_at
          ? new Date(response.posts[0].updated_at)
          : new Date(),
      }
    }

    default:
      return null
  }
}

/**
 * Met à jour le document local avec le contenu distant
 */
async function updateLocalDocument(
  documentId: string,
  organizationId: string,
  userId: string,
  remoteContent: string,
  remoteTitle: string,
  updatedAt: Date
) {
  // Parser le contenu HTML en markdown pour la source
  // Pour simplifier, on garde le HTML tel quel
  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: remoteContent, // En production: parseHtmlToMarkdown(remoteContent)
      htmlContent: remoteContent,
      title: remoteTitle,
      version: { increment: 1 },
      sourceUpdatedAt: updatedAt,
    },
  })

  // Logger le changement
  await prisma.syncLog.create({
    data: {
      organizationId,
      userId,
      documentId,
      action: 'remote_change_detected',
      status: 'INFO',
      message: `Changes detected from remote: ${remoteTitle}`,
    },
  })
}

// Webhook WordPress
async function handleWordPressWebhook(
  req: NextRequest,
  connectorId: string
): Promise<NextResponse> {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-hub-signature') || ''

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        connectorId,
        type: 'WORDPRESS',
        isActive: true,
      },
    })

    if (webhook?.secret) {
      const isValid = verifyWebhookSignature(body, signature, webhook.secret)
      if (isValid === false && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const data = (await req.json()) as unknown as {
      post_id?: number
      action?: string
    }

    const eventType = req.headers.get('x-wordpress-event') || data.action

    if (eventType === 'post_published' || eventType === 'post_updated') {
      const postId = data.post_id?.toString()

      if (postId) {
        const documents = await prisma.document.findMany({
          where: {
            destConnectorId: connectorId,
            slug: postId,
          },
        })

        for (const doc of documents) {
          const remoteContent = await fetchRemoteContent(connectorId, postId)
          if (remoteContent) {
            await updateLocalDocument(
              doc.id,
              doc.organizationId,
              doc.userId,
              remoteContent.content,
              remoteContent.title,
              remoteContent.updatedAt
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('WordPress webhook error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// Webhook Ghost
async function handleGhostWebhook(req: NextRequest, connectorId: string): Promise<NextResponse> {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-ghost-signature') || ''

    // Ghost signature format: sha256=<hexdigest>[,sha1=<hexdigest>]
    const ghostSignature = signature
      .split(',')
      .find((part) => part.startsWith('sha256='))
      ?.replace('sha256=', '')

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        connectorId,
        type: 'GHOST',
        isActive: true,
      },
    })

    if (webhook?.secret && ghostSignature) {
      const isValid = verifyWebhookSignature(body, ghostSignature, webhook.secret)
      if (!isValid && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production' && !ghostSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const data = JSON.parse(body) as unknown as {
      event?: string
      post?: { id?: string }
    }

    const event = data.event

    if (event === 'post.published' || event === 'post.updated') {
      const postId = data.post?.id

      if (postId) {
        const documents = await prisma.document.findMany({
          where: {
            destConnectorId: connectorId,
            slug: postId,
          },
        })

        for (const doc of documents) {
          const remoteContent = await fetchRemoteContent(connectorId, postId)
          if (remoteContent) {
            await updateLocalDocument(
              doc.id,
              doc.organizationId,
              doc.userId,
              remoteContent.content,
              remoteContent.title,
              remoteContent.updatedAt
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Ghost webhook error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// Webhook Webflow (simplified)
async function handleWebflowWebhook(req: NextRequest, connectorId: string): Promise<NextResponse> {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-webflow-signature') || ''

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        connectorId,
        type: 'WEBFLOW',
        isActive: true,
      },
    })

    if (webhook?.secret) {
      const isValid = verifyWebhookSignature(body, signature, webhook.secret)
      if (!isValid && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const data = JSON.parse(body) as unknown as {
      type?: string
      data?: { item?: { id?: string } }
    }

    if (data.type === 'item_published' || data.type === 'item_updated') {
      const itemId = data.data?.item?.id

      if (itemId) {
        const documents = await prisma.document.findMany({
          where: {
            destConnectorId: connectorId,
            slug: itemId,
          },
        })

        for (const doc of documents) {
          const remoteContent = await fetchRemoteContent(connectorId, itemId)
          if (remoteContent) {
            await updateLocalDocument(
              doc.id,
              doc.organizationId,
              doc.userId,
              remoteContent.content,
              remoteContent.title,
              remoteContent.updatedAt
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webflow webhook error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// Webhook Shopify (simplified)
async function handleShopifyWebhook(req: NextRequest, connectorId: string): Promise<NextResponse> {
  try {
    const body = await req.text()
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || ''

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        connectorId,
        type: 'SHOPIFY',
        isActive: true,
      },
    })

    if (webhook?.secret) {
      // Shopify HMAC is base64-encoded HMAC-SHA256
      const expected = crypto.createHmac('sha256', webhook.secret).update(body).digest('base64')
      try {
        const isValid = crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(expected))
        if (!isValid && process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      } catch {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }
    }

    const topic = req.headers.get('x-shopify-topic') || ''

    // Shopify webhook topics: article_created, article_updated, article_deleted
    if (topic.startsWith('article_')) {
      const data = (await req.json()) as unknown as {
        article?: { id?: number }
      }

      const articleId = data?.article?.id?.toString()

      if (articleId) {
        const documents = await prisma.document.findMany({
          where: {
            destConnectorId: connectorId,
            slug: articleId,
          },
        })

        for (const doc of documents) {
          const remoteContent = await fetchRemoteContent(connectorId, articleId)
          if (remoteContent) {
            await updateLocalDocument(
              doc.id,
              doc.organizationId,
              doc.userId,
              remoteContent.content,
              remoteContent.title,
              remoteContent.updatedAt
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Shopify webhook error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// Handler principal qui route vers le bon handler
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const { connector } = await params

  const url = new URL(req.url)
  const connectorId = url.searchParams.get('connector_id')

  if (!connectorId) {
    return NextResponse.json({ error: 'Missing connector_id' }, { status: 400 })
  }

  switch (connector) {
    case 'wordpress':
      return handleWordPressWebhook(req, connectorId)
    case 'ghost':
      return handleGhostWebhook(req, connectorId)
    case 'webflow':
      return handleWebflowWebhook(req, connectorId)
    case 'shopify':
      return handleShopifyWebhook(req, connectorId)
    default:
      return NextResponse.json({ error: 'Unsupported connector type' }, { status: 400 })
  }
}
