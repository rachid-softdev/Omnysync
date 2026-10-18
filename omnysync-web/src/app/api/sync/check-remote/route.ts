import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkRemoteChanges } from '@omnysync/core/services/sync'

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { documentId } = body

  if (typeof documentId !== 'string' || documentId.length === 0) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
  }

  // Documents are organization-scoped: any member of the document's
  // organization may check remote content (checkRemoteChanges enforces the
  // same rule through requireDocumentAccess).
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document || document.organizationId !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const remoteData = await checkRemoteChanges(documentId, session.user.id)
    return NextResponse.json({ remoteData })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
