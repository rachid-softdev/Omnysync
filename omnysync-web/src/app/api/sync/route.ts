import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { enqueueSyncJob } from '@omnysync/core/services/queue'
import { checkAndIncrementQuota, checkDocumentLimit } from '@/lib/auth/subscription'
import { createSyncSchema } from '@/lib/validations'
import { apiError } from '@/lib/api-error'
import { PUBLIC_CONNECTOR_SELECT, sanitizeDocumentConnectors } from '@/lib/public-connector'

// A sync has a direction. Connectors that the sync engine cannot read from (or
// write to) must be rejected here: accepting them created a document that
// synced empty content (or skipped publishing) and was still marked SYNCED.
const SOURCE_CONNECTOR_TYPES = new Set(['GOOGLE_DOCS', 'NOTION', 'AIRTABLE', 'CONTENTFUL'])
const DESTINATION_CONNECTOR_TYPES = new Set([
  'WORDPRESS',
  'GHOST',
  'WEBFLOW',
  'SHOPIFY',
  'CONTENTFUL',
  'MEDIUM',
])

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  const documents = await prisma.document.findMany({
    where: {
      organizationId: orgId,
    },
    include: {
      sourceConnector: { select: PUBLIC_CONNECTOR_SELECT },
      destConnector: { select: PUBLIC_CONNECTOR_SELECT },
      syncLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return NextResponse.json(documents.map(sanitizeDocumentConnectors))
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()

  const parsed = createSyncSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || 'Invalid request', 400)
  }

  const { sourceConnectorId, destConnectorId, sourceDocumentId, title } = parsed.data

  // SECURITY: Connectors must belong to the caller's organization. Without this
  // check a user could bind a sync to another org's connector and, via performSync,
  // read from / write to that org's connected systems using its credentials.
  const sourceConnector = await prisma.connector.findFirst({
    where: { id: sourceConnectorId, organizationId: orgId },
  })

  const destConnector = await prisma.connector.findFirst({
    where: { id: destConnectorId, organizationId: orgId },
  })

  if (!sourceConnector || !destConnector) {
    return apiError('Invalid connectors', 400)
  }

  // Enforce the source/destination capability server-side (the UI already
  // filters the lists, but the API must not rely on it).
  if (!SOURCE_CONNECTOR_TYPES.has(sourceConnector.type)) {
    return apiError(`${sourceConnector.type} cannot be used as a source connector`, 400)
  }

  if (!DESTINATION_CONNECTOR_TYPES.has(destConnector.type)) {
    return apiError(`${destConnector.type} cannot be used as a destination connector`, 400)
  }

  // Check document limit (plan entitlement) before creating the document.
  // checkDocumentLimit was never called anywhere, so MAX_DOCUMENTS was dead.
  const documentLimit = await checkDocumentLimit(session.user.id)
  if (!documentLimit.allowed) {
    return apiError(
      `Document limit reached (${documentLimit.current}/${documentLimit.limit}). Please upgrade your plan.`,
      429,
      'DOCUMENT_LIMIT_EXCEEDED'
    )
  }

  // Check sync limit. Note: validation happens first so a rejected request does
  // not consume the caller's monthly sync quota.
  const { allowed, upgradeUrl } = await checkAndIncrementQuota(session.user.id)
  if (!allowed) {
    const message = upgradeUrl
      ? `Sync limit exceeded. Upgrade: ${upgradeUrl}`
      : 'Sync limit exceeded. Please upgrade your plan.'
    return apiError(message, 429, 'QUOTA_EXCEEDED')
  }

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      sourceConnectorId,
      destConnectorId,
      sourceId: sourceDocumentId,
      title: title || 'New Document',
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    },
  })

  await prisma.syncLog.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      documentId: document.id,
      action: 'sync_started',
      status: 'INFO',
      message: 'Synchronization started',
    },
  })

  await enqueueSyncJob(document.id, sourceConnectorId, destConnectorId, {
    userId: session.user.id,
  })

  return NextResponse.json(document)
}
