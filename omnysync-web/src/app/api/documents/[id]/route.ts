import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { apiError } from '@/lib/api-error'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
    include: {
      sourceConnector: true,
      destConnector: true,
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!document) {
    return apiError('Document not found', 404)
  }

  return NextResponse.json(document)
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()

  const existing = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
  })

  if (!existing) {
    return apiError('Document not found', 404)
  }

  const allowedFields = [
    'title',
    'seoTitle',
    'seoDescription',
    'seoKeywords',
    'excerpt',
    'categories',
    'tags',
    'autoSyncEnabled',
    'syncFrequency',
  ]

  const updateData: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  const document = await prisma.document.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(document)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const orgId = await getUserOrgId(session.user.id)

  const existing = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
  })

  if (!existing) {
    return apiError('Document not found', 404)
  }

  // Soft delete - just mark as archived
  await prisma.document.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  })

  return NextResponse.json({ success: true })
}
