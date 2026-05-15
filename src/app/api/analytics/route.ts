import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const { searchParams } = new URL(req.url)
  const period = parseInt(searchParams.get("period") || "30")

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - period)

  // Get sync logs for the period
  const syncLogs = await prisma.syncLog.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: startDate },
      action: { contains: "sync" },
    },
    orderBy: { createdAt: "desc" },
  })

  // Calculate stats
  const totalSyncs = syncLogs.length
  const successCount = syncLogs.filter((l) => l.status === "SUCCESS").length
  const failedCount = syncLogs.filter((l) => l.status === "ERROR").length
  const successRate = totalSyncs > 0 ? Math.round((successCount / totalSyncs) * 100) : 0

  // Get documents count
  const totalDocuments = await prisma.document.count({
    where: { organizationId: orgId },
  })

  // Get active connectors
  const activeConnectors = await prisma.connector.count({
    where: { organizationId: orgId, status: "ACTIVE" },
  })

  // Group by day
  const syncByDay: Record<string, number> = {}
  syncLogs.forEach((log) => {
    const date = log.createdAt.toISOString().split("T")[0]
    syncByDay[date] = (syncByDay[date] || 0) + 1
  })

  const syncByDayArray = Object.entries(syncByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  // Connector usage
  const documents = await prisma.document.findMany({
    where: { organizationId: orgId },
    include: { sourceConnector: true, destConnector: true },
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
    avgDuration: 12, // Would calculate from actual duration
    failedSyncs: failedCount,
    totalDocuments,
    activeConnectors,
    syncByDay: syncByDayArray,
    connectorsUsage: connectorsUsageArray,
    recentActivity: syncLogs.slice(0, 10).map((log) => ({
      id: log.id,
      action: log.action,
      status: log.status,
      createdAt: log.createdAt.toISOString(),
    })),
  })
}