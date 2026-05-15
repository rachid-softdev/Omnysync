import { prisma } from "@/lib/prisma"
import { performSync } from "./sync"
import { NextResponse } from "next/server"

// Note: QStash scheduling requires the serverless SDK or direct HTTP calls
// For now, we'll use a simpler approach with setTimeout for development
// and document how to use QStash in production

/**
 * Calcule la prochaine date de sync basé sur la fréquence
 */
export function calculateNextSync(frequency: "DAILY" | "WEEKLY" | "MONTHLY"): Date {
  const now = new Date()
  
  switch (frequency) {
    case "DAILY":
      // Tomorrow at 9am
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      return tomorrow
    
    case "WEEKLY":
      // Next Monday at 9am
      const nextWeek = new Date(now)
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7
      nextWeek.setDate(now.getDate() + daysUntilMonday)
      nextWeek.setHours(9, 0, 0, 0)
      return nextWeek
    
    case "MONTHLY":
      // First day of next month at 9am
      const nextMonth = new Date(now)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(9, 0, 0, 0)
      return nextMonth
    
    default:
      return now
  }
}

/**
 * Planifie un sync automatique via QStash
 */
export async function scheduleSync(
  documentId: string,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY"
): Promise<{ success: boolean; nextSyncAt: Date; error?: string }> {
  try {
    // Update document with scheduling settings
    const nextSyncAt = calculateNextSync(frequency)
    
    await prisma.document.update({
      where: { id: documentId },
      data: {
        autoSyncEnabled: true,
        syncFrequency: frequency,
        nextSyncAt,
      },
    })

    // Note: In production, use QStash's HTTP API to schedule cron jobs:
    // POST https://qstash.upstash.io/v1/schedules
    // Body: { "url": syncUrl, "cron": "0 9 * * *" }
    // For now, the scheduling is handled by the nextSyncAt field in DB
    // which can be processed by a cron job calling /api/sync/run

    return { success: true, nextSyncAt }
  } catch (error) {
    return {
      success: false,
      nextSyncAt: new Date(),
      error: (error as Error).message,
    }
  }
}

/**
 * Désactive le sync automatique
 */
export async function disableScheduledSync(documentId: string): Promise<boolean> {
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        autoSyncEnabled: false,
        syncFrequency: "MANUAL",
        nextSyncAt: null,
      },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Exécute tous les sync programmés pour aujourd'hui
 * À appeler via un cron job ou QStash schedule
 */
export async function runScheduledSyncs(): Promise<{
  executed: number
  failed: number
  errors: string[]
}> {
  const now = new Date()
  const startOfDay = new Date(now.setHours(0, 0, 0, 0))
  const endOfDay = new Date(now.setHours(23, 59, 59, 999))

  // Trouver tous les documents avec sync programmé
  const scheduledDocs = await prisma.document.findMany({
    where: {
      autoSyncEnabled: true,
      nextSyncAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      syncStatus: { not: "SYNCING" },
      status: "PUBLISHED",
    },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  const results = { executed: 0, failed: 0, errors: [] as string[] }

  for (const doc of scheduledDocs) {
    try {
      if (doc.sourceConnectorId && doc.destConnectorId) {
        await performSync(doc.id, doc.sourceConnectorId, doc.destConnectorId)
        
        // Planifier le prochain sync
        const frequency = doc.syncFrequency as "DAILY" | "WEEKLY" | "MONTHLY"
        const nextSync = calculateNextSync(frequency)
        
        await prisma.document.update({
          where: { id: doc.id },
          data: { nextSyncAt: nextSync },
        })
        
        results.executed++
      }
    } catch (error) {
      results.failed++
      results.errors.push(`Doc ${doc.id}: ${(error as Error).message}`)
      
      // Logger l'erreur
      await prisma.syncLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: doc.userId,
          documentId: doc.id,
          action: "scheduled_sync_failed",
          status: "ERROR",
          message: (error as Error).message,
        },
      })
    }
  }

  return results
}

/**
 * API route handler pour exécuter un sync programmé
 */
export async function handleScheduledSyncRun(documentId: string): Promise<NextResponse> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  if (!doc.autoSyncEnabled || !doc.sourceConnectorId || !doc.destConnectorId) {
    return NextResponse.json({ error: "Sync not scheduled" }, { status: 400 })
  }

  // Vérifier si assez de temps s'est écoulé depuis le dernier sync (éviter les boucles)
  const lastSync = doc.lastSyncedAt
  if (lastSync) {
    const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastSync < 1) {
      return NextResponse.json(
        { message: "Skipped - sync too recent", hoursSinceLastSync },
        { status: 200 }
      )
    }
  }

  try {
    const result = await performSync(documentId, doc.sourceConnectorId, doc.destConnectorId)
    
    // Planifier le prochain sync
    const frequency = doc.syncFrequency as "DAILY" | "WEEKLY" | "MONTHLY"
    const nextSync = calculateNextSync(frequency)
    
    await prisma.document.update({
      where: { id: documentId },
      data: { nextSyncAt: nextSync, lastSyncError: null },
    })

    return NextResponse.json({
      success: result.success,
      documentId,
      nextSyncAt: nextSync,
    })
  } catch (error) {
    // Logger l'erreur
    await prisma.document.update({
      where: { id: documentId },
      data: { lastSyncError: (error as Error).message },
    })

    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}