import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { performSync } from '@omnysync/core/services/sync'
import { scheduleSync, disableScheduledSync } from '@omnysync/core/services/scheduler'
import {
  checkAndIncrementQuota,
  checkPlanFeature,
  decrementQuotaOnFailure,
  getPlanLimits,
  getUserPlan,
} from '@/lib/auth/subscription'
import { hasPermission } from '@/lib/auth/permissions'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Documents are organization-scoped: authorize through the caller's
  // organization membership (the same rule performSync enforces), not through
  // the document creator, otherwise members of a shared org get a 404 on
  // documents they legitimately own access to.
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!document || document.organizationId !== orgId) {
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
    logs: document.syncLogs.map(
      (log: { status: string; message: string | null; createdAt: Date }) => ({
        status: log.status,
        message: log.message,
        createdAt: log.createdAt,
      })
    ),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id },
    select: { organizationId: true },
  })

  if (!document || document.organizationId !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await hasPermission(session.user.id, orgId, 'sync:delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Disable scheduled sync first
  await disableScheduledSync(id)

  // Delete the document
  await prisma.document.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}

async function executeSync(
  documentId: string,
  sourceConnectorId: string,
  destConnectorId: string,
  userId: string
) {
  const limits = getPlanLimits(await getUserPlan(userId))

  try {
    const result = await performSync(documentId, sourceConnectorId, destConnectorId, userId, {
      ai: limits.aiFeatures,
    })

    // performSync() returns a failure result for most provider errors instead
    // of throwing. Do not charge the monthly quota for a sync that failed.
    if (!result.success) {
      await decrementQuotaOnFailure(userId)
    }

    return result
  } catch (error) {
    await decrementQuotaOnFailure(userId)
    throw error
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { action } = body
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      organizationId: true,
      syncStatus: true,
      sourceConnectorId: true,
      destConnectorId: true,
    },
  })

  if (!document || document.organizationId !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Actions that execute a sync. Both are server-authorized and quota-gated;
  // the old sync-detail page called performSync() directly from a server
  // action, which let Free users run unlimited syncs and AI enrichment.
  if (action === 'retry' || action === 'run') {
    if (!(await hasPermission(session.user.id, orgId, 'sync:run'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!document.sourceConnectorId || !document.destConnectorId) {
      return NextResponse.json({ error: 'Missing connectors' }, { status: 400 })
    }

    if (action === 'retry' && document.syncStatus !== 'FAILED') {
      return NextResponse.json({ error: 'Only failed syncs can be retried' }, { status: 400 })
    }

    if (document.syncStatus === 'SYNCING') {
      return NextResponse.json({ error: 'This sync is already running' }, { status: 409 })
    }

    // Check quota before touching the document so a rejected run does not
    // reset the status or consume a slot.
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

    if (action === 'retry') {
      await prisma.document.update({
        where: { id },
        data: { syncStatus: 'NOT_SYNCED', lastSyncError: null },
      })
    }

    const result = await executeSync(
      id,
      document.sourceConnectorId,
      document.destConnectorId,
      session.user.id
    )
    return NextResponse.json(result)
  }

  // Action: Schedule sync
  if (action === 'schedule') {
    if (!(await hasPermission(session.user.id, orgId, 'sync:update'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { frequency } = body

    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Use DAILY, WEEKLY, or MONTHLY' },
        { status: 400 }
      )
    }

    // Scheduled sync is a paid feature (pricing page).
    const scheduled = await checkPlanFeature(session.user.id, 'scheduledSync')
    if (!scheduled.allowed) {
      return NextResponse.json(
        {
          error: 'Scheduled syncs are not included in your plan',
          code: 'PLAN_FEATURE_REQUIRED',
          upgradeUrl: scheduled.upgradeUrl,
        },
        { status: 403 }
      )
    }

    const result = await scheduleSync(id, frequency)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to schedule sync' },
        { status: 500 }
      )
    }

    await prisma.syncLog.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        documentId: id,
        action: 'schedule_enabled',
        status: 'INFO',
        message: `Scheduled sync enabled (${frequency})`,
      },
    })

    return NextResponse.json({
      success: true,
      autoSyncEnabled: true,
      syncFrequency: frequency,
      nextSyncAt: result.nextSyncAt,
    })
  }

  // Action: Disable scheduled sync
  if (action === 'disable_schedule') {
    if (!(await hasPermission(session.user.id, orgId, 'sync:update'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await disableScheduledSync(id)

    await prisma.syncLog.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        documentId: id,
        action: 'schedule_disabled',
        status: 'INFO',
        message: 'Scheduled sync disabled',
      },
    })

    return NextResponse.json({
      success: true,
      autoSyncEnabled: false,
      syncFrequency: 'MANUAL',
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
