import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const { searchParams } = new URL(req.url)
  const rawPeriod = parseInt(searchParams.get('period') || '30', 10)

  // An unparsed or out-of-range period would build an Invalid Date (or scan an
  // unbounded range) and crash the query with a 500.
  if (!Number.isFinite(rawPeriod) || rawPeriod < 1 || rawPeriod > 365) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'period must be an integer between 1 and 365' },
      { status: 400 }
    )
  }

  const period = rawPeriod

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - period)

  // A sync writes several progress logs (fetch, parse, AI, publish). Counting
  // every row inflates the dashboard and makes the success rate meaningless, so
  // only the terminal outcome rows represent one completed sync attempt.
  const terminalActions = ['sync_completed', 'sync_failed'] as const

  // Fetch a little before the reporting window so a sync that started just
  // before midnight can still contribute a real duration.
  const durationWindowStart = new Date(startDate)
  durationWindowStart.setDate(durationWindowStart.getDate() - 1)

  const syncLogs = await prisma.syncLog.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: durationWindowStart },
      action: { in: ['sync_started', ...terminalActions] },
    },
    orderBy: { createdAt: 'asc' },
  })

  const terminalLogs = syncLogs.filter(
    (log) =>
      log.createdAt >= startDate && (terminalActions as readonly string[]).includes(log.action)
  )

  // Pair each terminal outcome with the closest preceding start for the same
  // document. Runs without a measurable start are excluded instead of being
  // assigned an invented duration.
  const openStarts = new Map<string, Date>()
  const durationsMs: number[] = []

  for (const log of syncLogs) {
    if (!log.documentId) continue

    if (log.action === 'sync_started') {
      openStarts.set(log.documentId, log.createdAt)
      continue
    }

    if (!(terminalActions as readonly string[]).includes(log.action)) continue

    const startedAt = openStarts.get(log.documentId)
    if (startedAt && log.createdAt >= startedAt) {
      durationsMs.push(log.createdAt.getTime() - startedAt.getTime())
    }
    openStarts.delete(log.documentId)
  }

  // Calculate stats from terminal outcomes only
  const totalSyncs = terminalLogs.length
  const successCount = terminalLogs.filter((l) => l.action === 'sync_completed').length
  const failedCount = terminalLogs.filter((l) => l.action === 'sync_failed').length
  const successRate = totalSyncs > 0 ? Math.round((successCount / totalSyncs) * 100) : 0

  const avgDuration =
    durationsMs.length > 0
      ? Math.round(
          (durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length / 1000) * 10
        ) / 10
      : null

  // Get documents count
  const totalDocuments = await prisma.document.count({
    where: { organizationId: orgId },
  })

  // Get active connectors
  const activeConnectors = await prisma.connector.count({
    where: { organizationId: orgId, status: 'ACTIVE' },
  })

  // Group terminal outcomes by day
  const syncByDay: Record<string, number> = {}
  terminalLogs.forEach((log) => {
    const date = log.createdAt.toISOString().slice(0, 10)
    syncByDay[date] = (syncByDay[date] ?? 0) + 1
  })

  const syncByDayArray = Object.entries(syncByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  // Connector usage
  const documents = await prisma.document.findMany({
    where: { organizationId: orgId },
    select: { destConnector: { select: { type: true } } },
  })

  const connectorsUsage: Record<string, number> = {}
  documents.forEach((doc) => {
    if (doc.destConnector?.type) {
      connectorsUsage[doc.destConnector.type] = (connectorsUsage[doc.destConnector.type] || 0) + 1
    }
  })

  const connectorsUsageArray = Object.entries(connectorsUsage).map(([type, count]) => ({
    type,
    count,
  }))

  return NextResponse.json({
    totalSyncs,
    successRate,
    avgDuration,
    failedSyncs: failedCount,
    totalDocuments,
    activeConnectors,
    syncByDay: syncByDayArray,
    connectorsUsage: connectorsUsageArray,
    recentActivity: [...terminalLogs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        createdAt: log.createdAt.toISOString(),
      })),
  })
}
