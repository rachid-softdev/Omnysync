import { prisma } from "../prisma";
import { performSync } from "./sync";
import { sanitizeErrorMessage } from "./sanitize";

// Note: QStash scheduling requires the serverless SDK or direct HTTP calls
// For now, we'll use a simpler approach with setTimeout for development
// and document how to use QStash in production

/**
 * Calcule la prochaine date de sync basé sur la fréquence
 */
export function calculateNextSync(
  frequency: "DAILY" | "WEEKLY" | "MONTHLY",
): Date {
  const now = new Date();

  switch (frequency) {
    case "DAILY":
      // Tomorrow at 9am
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;

    case "WEEKLY":
      // Next Monday at 9am
      const nextWeek = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextWeek.setDate(now.getDate() + daysUntilMonday);
      nextWeek.setHours(9, 0, 0, 0);
      return nextWeek;

    case "MONTHLY":
      // First day of next month at 9am
      // ⚠️ Always setDate(1) BEFORE setMonth() to avoid Date auto-rolling
      // (e.g. Jan 31 + 1 month → Feb 31 → auto-rolls to March 3)
      const nextMonth = new Date(now);
      nextMonth.setDate(1);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setHours(9, 0, 0, 0);
      return nextMonth;

    default:
      return now;
  }
}

/**
 * Planifie un sync automatique via QStash
 */
export async function scheduleSync(
  documentId: string,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY",
): Promise<{ success: boolean; nextSyncAt: Date; error?: string }> {
  try {
    // Update document with scheduling settings
    const nextSyncAt = calculateNextSync(frequency);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        autoSyncEnabled: true,
        syncFrequency: frequency,
        nextSyncAt,
      },
    });

    // Note: In production, use QStash's HTTP API to schedule cron jobs:
    // POST https://qstash.upstash.io/v1/schedules
    // Body: { "url": syncUrl, "cron": "0 9 * * *" }
    // For now, the scheduling is handled by the nextSyncAt field in DB
    // which can be processed by a cron job calling /api/sync/run

    return { success: true, nextSyncAt };
  } catch (error) {
    return {
      success: false,
      nextSyncAt: new Date(),
      error: sanitizeErrorMessage(error),
    };
  }
}

/**
 * Désactive le sync automatique
 */
export async function disableScheduledSync(
  documentId: string,
): Promise<boolean> {
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        autoSyncEnabled: false,
        syncFrequency: "MANUAL",
        nextSyncAt: null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Exécute tous les sync programmés pour aujourd'hui
 * À appeler via un cron job ou QStash schedule
 */
export async function runScheduledSyncs(): Promise<{
  executed: number;
  failed: number;
  errors: string[];
}> {
  // ⚠️ Create independent Date objects — do NOT chain setHours() on the same instance,
  // otherwise the second setHours() mutates the same underlying `now` and both
  // startOfDay and endOfDay end up pointing at midnight.
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

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
  });

  const results = { executed: 0, failed: 0, errors: [] as string[] };

  for (const doc of scheduledDocs) {
    try {
      if (doc.sourceConnectorId && doc.destConnectorId) {
        await performSync(
          doc.id,
          doc.sourceConnectorId,
          doc.destConnectorId,
          doc.userId,
        );

        // Planifier le prochain sync
        const frequency = doc.syncFrequency as "DAILY" | "WEEKLY" | "MONTHLY";
        const nextSync = calculateNextSync(frequency);

        await prisma.document.update({
          where: { id: doc.id },
          data: { nextSyncAt: nextSync },
        });

        results.executed++;
      }
    } catch (error) {
      const safeMsg = sanitizeErrorMessage(error);
      results.failed++;
      results.errors.push(`Doc ${doc.id}: ${safeMsg}`);

      // Logger l'erreur
      await prisma.syncLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: doc.userId,
          documentId: doc.id,
          action: "scheduled_sync_failed",
          status: "ERROR",
          message: safeMsg,
        },
      });
    }
  }

  return results;
}

export interface ScheduledSyncResult {
  success: boolean;
  documentId: string;
  nextSyncAt: Date;
  error?: string;
}

export interface ScheduledSyncRunResult {
  success: boolean;
  message: string;
  hoursSinceLastSync?: number;
}

/**
 * API route handler pour exécuter un sync programmé
 */
export async function handleScheduledSyncRun(
  documentId: string,
): Promise<ScheduledSyncRunResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  });

  if (!doc) {
    return { success: false, message: "Document not found" };
  }

  if (!doc.autoSyncEnabled || !doc.sourceConnectorId || !doc.destConnectorId) {
    return { success: false, message: "Sync not scheduled" };
  }

  // Vérifier si assez de temps s'est écoulé depuis le dernier sync (éviter les boucles)
  const lastSync = doc.lastSyncedAt;
  if (lastSync) {
    const hoursSinceLastSync =
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSync < 1) {
      return {
        success: true,
        message: "Skipped - sync too recent",
        hoursSinceLastSync,
      };
    }
  }

  try {
    const result = await performSync(
      documentId,
      doc.sourceConnectorId,
      doc.destConnectorId,
      doc.userId,
    );

    // Planifier le prochain sync
    const frequency = doc.syncFrequency as "DAILY" | "WEEKLY" | "MONTHLY";
    const nextSync = calculateNextSync(frequency);

    await prisma.document.update({
      where: { id: documentId },
      data: { nextSyncAt: nextSync, lastSyncError: null },
    });

    return {
      success: result.success,
      message: result.success
        ? "Sync completed"
        : result.error || "Sync failed",
    };
  } catch (error) {
    const safeMsg = sanitizeErrorMessage(error);
    // Logger l'erreur
    await prisma.document.update({
      where: { id: documentId },
      data: { lastSyncError: safeMsg },
    });

    return {
      success: false,
      message: safeMsg,
    };
  }
}
