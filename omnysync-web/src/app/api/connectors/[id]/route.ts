import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { hasPermission } from '@/lib/auth/permissions'
import { apiError } from '@/lib/api-error'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  if (!(await hasPermission(session.user.id, orgId, 'connector:delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Verify the connector exists and belongs to the caller's organization.
  // Do not filter by userId: admins must be able to disconnect connectors
  // created by another teammate.
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
    if ((error as { code?: string }).code === 'P2003') {
      return apiError(
        'Cannot delete connector: it has linked documents. Remove document associations first.',
        400
      )
    }
    throw error
  }

  return NextResponse.json({ success: true })
}
