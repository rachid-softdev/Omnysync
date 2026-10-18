import { NextRequest, NextResponse } from 'next/server'
import { DocumentStatus } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkDocumentLimit } from '@/lib/auth/subscription'
import { apiError } from '@/lib/api-error'
import { paginationSchema } from '@/lib/validations'

const DOCUMENT_STATUSES: string[] = Object.values(DocumentStatus)

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  // Validate the filter against the DocumentStatus enum instead of passing an
  // arbitrary string to Prisma (which threw a runtime error on unknown values).
  if (status !== null && !DOCUMENT_STATUSES.includes(status)) {
    return apiError('Invalid status', 400)
  }

  const pagination = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })
  const { page, limit } = pagination.success ? pagination.data : { page: 1, limit: 20 }

  const where = {
    organizationId: orgId,
    ...(status ? { status: status as DocumentStatus } : {}),
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      sourceConnector: true,
      destConnector: true,
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  // Count with the same filter as the page query, otherwise `total` /
  // `totalPages` are wrong whenever a status filter is applied.
  const total = await prisma.document.count({
    where,
  })

  return NextResponse.json(
    {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()

  const { title, sourceConnectorId, destConnectorId, sourceId } = body ?? {}

  if (typeof title !== 'string' || title.length === 0) {
    return apiError('Title is required', 400)
  }

  for (const [field, value] of [
    ['sourceConnectorId', sourceConnectorId],
    ['destConnectorId', destConnectorId],
    ['sourceId', sourceId],
  ] as const) {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return apiError(`${field} must be a string`, 400)
    }
  }

  // SECURITY: referenced connectors must belong to the caller's organization.
  const connectorIds = [sourceConnectorId, destConnectorId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  if (connectorIds.length > 0) {
    const ownedConnectors = await prisma.connector.findMany({
      where: { id: { in: connectorIds }, organizationId: orgId },
      select: { id: true },
    })
    const ownedIds = new Set(ownedConnectors.map((connector) => connector.id))

    if (typeof sourceConnectorId === 'string' && sourceConnectorId && !ownedIds.has(sourceConnectorId)) {
      return apiError('Source connector not found', 404)
    }
    if (typeof destConnectorId === 'string' && destConnectorId && !ownedIds.has(destConnectorId)) {
      return apiError('Destination connector not found', 404)
    }
  }

  // Plan entitlement: MAX_DOCUMENTS was never enforced before document creation.
  const documentLimit = await checkDocumentLimit(session.user.id)
  if (!documentLimit.allowed) {
    return apiError(
      `Document limit reached (${documentLimit.current}/${documentLimit.limit}). Please upgrade your plan.`,
      429,
      'DOCUMENT_LIMIT_EXCEEDED'
    )
  }

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      title,
      sourceConnectorId,
      destConnectorId,
      sourceId,
      status: 'DRAFT',
      syncStatus: 'NOT_SYNCED',
    },
  })

  return NextResponse.json(document)
}
