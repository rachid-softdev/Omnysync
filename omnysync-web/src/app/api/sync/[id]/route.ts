import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { performSync } from '@/lib/services/sync'
import { scheduleSync, disableScheduledSync } from '@/lib/services/scheduler'
import { checkAndIncrementQuota } from '@/lib/auth/subscription'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: document.id,
    title: document.title,
    syncStatus: document.syncStatus,
    content: document.content ? document.content.substring(0, 500) : null,
    lastSyncedAt: document.lastSyncedAt,
    autoSyncEnabled: document.autoSyncEnabled,
    syncFrequency: document.syncFrequency,
    nextSyncAt: document.nextSyncAt,
    lastSyncError: document.lastSyncError,
    logs: document.syncLogs.map((log) => ({
      status: log.status,
      message: log.message,
      createdAt: log.createdAt,
    })),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Disable scheduled sync first
  await disableScheduledSync(id)

  // Delete the document
  await prisma.document.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { action } = body

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Action: Retry failed sync
  if (action === 'retry') {
    if (document.syncStatus !== 'FAILED') {
      return NextResponse.json({ error: 'Only failed syncs can be retried' }, { status: 400 })
    }

    // Check quota
    const { allowed, upgradeUrl } = await checkAndIncrementQuota(session.user.id)
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          message: 'Vous avez atteint votre limite de synchronisations mensuelles',
          upgradeUrl,
        },
        { status: 403 }
      )
    }

    // Reset status and trigger sync
    await prisma.document.update({
      where: { id },
      data: { syncStatus: 'NOT_SYNCED', lastSyncError: null },
    })

    if (document.sourceConnectorId && document.destConnectorId) {
      const result = await performSync(
        id,
        document.sourceConnectorId,
        document.destConnectorId,
        session.user.id
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Missing connectors' }, { status: 400 })
  }

  // Action: Schedule sync
  if (action === 'schedule') {
    const { frequency } = body

    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Use DAILY, WEEKLY, or MONTHLY' },
        { status: 400 }
      )
    }

    const result = await scheduleSync(id, frequency)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to schedule sync' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      autoSyncEnabled: true,
      syncFrequency: frequency,
      nextSyncAt: result.nextSyncAt,
    })
  }

  // Action: Disable scheduled sync
  if (action === 'disable_schedule') {
    await disableScheduledSync(id)
    return NextResponse.json({
      success: true,
      autoSyncEnabled: false,
      syncFrequency: 'MANUAL',
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
