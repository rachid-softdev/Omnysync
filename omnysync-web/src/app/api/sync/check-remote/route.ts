import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRemoteChanges } from '@/lib/services/sync'

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { documentId } = body

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const remoteData = await checkRemoteChanges(documentId)
    return NextResponse.json({ remoteData })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
