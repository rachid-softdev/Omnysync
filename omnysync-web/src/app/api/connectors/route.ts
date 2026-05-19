import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { testWordPressConnection } from '@/lib/services/wordpress'
import { testGhostConnection } from '@/lib/services/ghost'
import { testWebflowConnection } from '@/lib/services/webflow'
import { testShopifyConnection } from '@/lib/services/shopify'
import { testMediumConnection } from '@/lib/services/medium'
import { testAirtableConnection } from '@/lib/services/airtable'
import { testContentfulConnection } from '@/lib/services/contentful'
import { createConnectorSchema } from '@/lib/validations'
import { apiError, sanitizeError } from '@/lib/api-error'
import { checkConnectorLimit } from '@/lib/auth/subscription'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  const connectors = await prisma.connector.findMany({
    where: {
      organizationId: orgId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return NextResponse.json(connectors, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()

  // Validate input with Zod schema
  const parsed = createConnectorSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message || 'Invalid connector data', 400)
  }

  const { type, name, config, credentials } = parsed.data

  // Check connector limit based on plan
  const withinLimit = await checkConnectorLimit(session.user.id)
  if (!withinLimit) {
    return apiError(
      'Connector limit exceeded. Please upgrade your plan.',
      429,
      'CONNECTOR_LIMIT_EXCEEDED'
    )
  }

  let testResult: { success: boolean; error?: string } = { success: false }

  switch (type) {
    case 'WORDPRESS':
      testResult = await testWordPressConnection(
        config.siteUrl,
        credentials.username,
        credentials.password
      )
      break
    case 'GHOST':
      testResult = await testGhostConnection(config.siteUrl, credentials.adminApiKey)
      break
    case 'WEBFLOW':
      testResult = await testWebflowConnection(credentials.accessToken, config.siteId)
      break
    case 'SHOPIFY':
      testResult = await testShopifyConnection(config.shopDomain, credentials.accessToken)
      break
    case 'GOOGLE_DOCS':
      // Google Docs doesn't have a test connection unless we try listing docs
      testResult = { success: true, error: '' }
      break
    case 'NOTION':
      // Notion doesn't need a separate test — we verify during listing
      testResult = { success: true, error: '' }
      break
    case 'MEDIUM':
      testResult = await testMediumConnection(credentials.accessToken)
      break
    case 'AIRTABLE':
      testResult = await testAirtableConnection(credentials.apiKey)
      break
    case 'CONTENTFUL':
      testResult = await testContentfulConnection(credentials.accessToken)
      break
  }

  if (!testResult.success) {
    return NextResponse.json({ error: `Connection failed: ${testResult.error}` }, { status: 400 })
  }

  let connector

  switch (type) {
    case 'WORDPRESS': {
      const { saveWordPressConnector } = await import('@/lib/services/wordpress')
      connector = await saveWordPressConnector(
        session.user.id,
        orgId,
        config.siteUrl,
        credentials.username,
        credentials.password
      )
      break
    }
    case 'GHOST': {
      const { saveGhostConnector } = await import('@/lib/services/ghost')
      connector = await saveGhostConnector(
        session.user.id,
        orgId,
        config.siteUrl,
        credentials.adminApiKey
      )
      break
    }
    case 'WEBFLOW': {
      const { saveWebflowConnector } = await import('@/lib/services/webflow')
      connector = await saveWebflowConnector(
        session.user.id,
        orgId,
        config.siteId,
        credentials.accessToken
      )
      break
    }
    case 'SHOPIFY': {
      const { saveShopifyConnector } = await import('@/lib/services/shopify')
      connector = await saveShopifyConnector(
        session.user.id,
        orgId,
        config.shopDomain,
        credentials.accessToken
      )
      break
    }
    case 'GOOGLE_DOCS': {
      const { saveGoogleDocsConnector } = await import('@/lib/services/google-docs')
      connector = await saveGoogleDocsConnector(
        session.user.id,
        orgId,
        credentials.accessToken,
        credentials.refreshToken || ''
      )
      break
    }
    case 'NOTION': {
      const { saveNotionConnector } = await import('@/lib/services/notion')
      connector = await saveNotionConnector(session.user.id, orgId, credentials.accessToken)
      break
    }
    case 'MEDIUM': {
      const { saveMediumConnector } = await import('@/lib/services/medium')
      connector = await saveMediumConnector(
        session.user.id,
        orgId,
        credentials.accessToken,
        config.publicationId ? { publicationId: config.publicationId } : {}
      )
      break
    }
    case 'AIRTABLE': {
      const { saveAirtableConnector } = await import('@/lib/services/airtable')
      connector = await saveAirtableConnector(session.user.id, orgId, credentials.apiKey, {
        baseId: config.baseId,
        tableId: config.tableId,
      })
      break
    }
    case 'CONTENTFUL': {
      const { saveContentfulConnector } = await import('@/lib/services/contentful')
      connector = await saveContentfulConnector(session.user.id, orgId, credentials.accessToken, {
        spaceId: config.spaceId,
        contentTypeId: config.contentTypeId,
      })
      break
    }
    default:
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 })
  }

  return NextResponse.json(connector)
}
