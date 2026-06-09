import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enqueueChangeDetection } from '@omnysync/core/services/queue'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
  })

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await enqueueChangeDetection(id, session.user.id)

  return NextResponse.json({ success: true, message: 'Change detection queued' })
}
