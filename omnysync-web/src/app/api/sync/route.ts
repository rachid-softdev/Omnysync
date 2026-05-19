import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { enqueueSyncJob } from '@/lib/services/queue'
import { checkAndIncrementQuota } from '@/lib/auth/subscription'
import { createSyncSchema } from '@/lib/validations'
import { apiError, sanitizeError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
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
      sourceConnector: true,
      destConnector: true,
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

  return NextResponse.json(documents)
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

  // Check sync limit before creating document
  const { allowed, upgradeUrl } = await checkAndIncrementQuota(session.user.id)
  if (!allowed) {
    const message = upgradeUrl
      ? `Sync limit exceeded. Upgrade: ${upgradeUrl}`
      : 'Sync limit exceeded. Please upgrade your plan.'
    return apiError(message, 429, 'QUOTA_EXCEEDED')
  }

  const sourceConnector = await prisma.connector.findUnique({
    where: { id: sourceConnectorId },
  })

  const destConnector = await prisma.connector.findUnique({
    where: { id: destConnectorId },
  })

  if (!sourceConnector || !destConnector) {
    return apiError('Invalid connectors', 400)
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

  await enqueueSyncJob(document.id, sourceConnectorId, destConnectorId)

  return NextResponse.json(document)
}
