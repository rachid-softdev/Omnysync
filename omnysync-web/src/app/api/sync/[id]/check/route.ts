import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { checkPlanFeature } from '@/lib/auth/subscription'
import { enqueueChangeDetection, isQueueConfigured } from '@omnysync/core/services/queue'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Documents belong to an organization: any member of the same organization
  // may trigger change detection (matches the authorization used by
  // performSync/detectAndSyncChanges, which only require org membership).
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id },
    select: { organizationId: true },
  })

  if (!document || document.organizationId !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Change detection runs an AI comparison before deciding whether to sync.
  // Gate it behind the existing AI entitlement so a Free account cannot spend
  // AI credits through this route.
  const aiAccess = await checkPlanFeature(session.user.id, 'aiFeatures')
  if (!aiAccess.allowed) {
    return NextResponse.json(
      {
        error: 'AI-powered change detection is not included in your plan',
        code: 'PLAN_FEATURE_REQUIRED',
        upgradeUrl: aiAccess.upgradeUrl,
      },
      { status: 403 }
    )
  }

  if (!isQueueConfigured()) {
    return NextResponse.json(
      { error: 'Sync queue is not configured', code: 'QUEUE_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  await enqueueChangeDetection(id, session.user.id)

  return NextResponse.json({ success: true, message: 'Change detection queued' })
}
