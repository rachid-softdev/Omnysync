import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { apiError } from '@/lib/api-error'
import { paginationSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const pagination = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })
  const { page, limit } = pagination.success ? pagination.data : { page: 1, limit: 20 }

  const documents = await prisma.document.findMany({
    where: {
      organizationId: orgId,
      ...(status && { status }),
    },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  const total = await prisma.document.count({
    where: { organizationId: orgId },
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

  const { title, sourceConnectorId, destConnectorId, sourceId } = body

  if (!title) {
    return apiError('Title is required', 400)
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
