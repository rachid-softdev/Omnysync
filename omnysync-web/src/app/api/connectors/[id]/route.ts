import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { apiError } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const { id } = await params

  // Verify the connector exists and belongs to the user's organization
  const connector = await prisma.connector.findFirst({
    where: {
      id,
      organizationId: orgId,
    },
  })

  if (!connector) {
    return apiError('Connector not found', 404)
  }

  try {
    await prisma.connector.delete({
      where: { id },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return apiError(
          'Cannot delete connector: it has linked documents. Remove document associations first.',
          400
        )
      }
    }
    throw error
  }

  return NextResponse.json({ success: true })
}
