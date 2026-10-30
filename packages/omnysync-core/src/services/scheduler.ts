import { prisma } from "../prisma";
import { performSync } from "./sync";
import { sanitizeErrorMessage } from "./sanitize";
import {
  checkAndIncrementQuota,
  decrementQuotaOnFailure,
  getPlanLimits,
  getUserPlan,
} from "../auth/subscription";

type SyncFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

function normalizeFrequency(value: string | null): SyncFrequency {
  return value === "WEEKLY" || value === "MONTHLY" ? value : "DAILY";
}

async function advanceNextSync(
  documentId: string,
  frequency: string | null,
  clearError = false,
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      nextSyncAt: calculateNextSync(normalizeFrequency(frequency)),
      ...(clearError ? { lastSyncError: null } : {}),
    },
  });
}

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
  const now = new Date();

  // Only documents whose scheduled time has arrived. The previous version
  // selected everything due "today", so an hourly cron would run the same
  // document repeatedly from midnight onward.
  const scheduledDocs = await prisma.document.findMany({
    where: {
      autoSyncEnabled: true,
      nextSyncAt: { lte: now },
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
    if (!doc.sourceConnectorId || !doc.destConnectorId) {
      const message = "Missing source or destination connector";
      results.failed++;
      results.errors.push(`Doc ${doc.id}: ${message}`);
      await prisma.syncLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: doc.userId,
          documentId: doc.id,
          action: "scheduled_sync_failed",
          status: "ERROR",
          message,
        },
      });
      await advanceNextSync(doc.id, doc.syncFrequency);
      continue;
    }

    const limits = getPlanLimits(await getUserPlan(doc.userId));

    // Scheduled sync is a paid feature. If the plan no longer includes it,
    // skip this run and advance the date instead of retrying every hour.
    if (!limits.scheduledSync) {
      const message = "Scheduled sync is not included in the current plan";
      results.failed++;
      results.errors.push(`Doc ${doc.id}: ${message}`);
      await prisma.syncLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: doc.userId,
          documentId: doc.id,
          action: "scheduled_sync_skipped",
          status: "WARNING",
          message,
        },
      });
      await advanceNextSync(doc.id, doc.syncFrequency);
      continue;
    }

    const quota = await checkAndIncrementQuota(doc.userId);
    if (!quota.allowed) {
      const message = "Monthly sync quota exceeded";
      results.failed++;
      results.errors.push(`Doc ${doc.id}: ${message}`);
      await prisma.syncLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: doc.userId,
          documentId: doc.id,
          action: "scheduled_sync_skipped",
          status: "WARNING",
          message,
        },
      });
      await advanceNextSync(doc.id, doc.syncFrequency);
      continue;
    }

    try {
      const result = await performSync(
        doc.id,
        doc.sourceConnectorId,
        doc.destConnectorId,
        doc.userId,
        { ai: limits.aiFeatures },
      );

      if (!result.success) {
        await decrementQuotaOnFailure(doc.userId);
        results.failed++;
        results.errors.push(`Doc ${doc.id}: ${result.error || "Sync failed"}`);
        await advanceNextSync(doc.id, doc.syncFrequency);
        continue;
      }

      results.executed++;
      await advanceNextSync(doc.id, doc.syncFrequency, true);
    } catch (error) {
      const safeMsg = sanitizeErrorMessage(error);
      await decrementQuotaOnFailure(doc.userId);
      results.failed++;
      results.errors.push(`Doc ${doc.id}: ${safeMsg}`);

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

      await advanceNextSync(doc.id, doc.syncFrequency);
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

  const limits = getPlanLimits(await getUserPlan(doc.userId));

  if (!limits.scheduledSync) {
    await advanceNextSync(doc.id, doc.syncFrequency);
    return {
      success: false,
      message: "Scheduled sync is not included in the current plan",
    };
  }

  const quota = await checkAndIncrementQuota(doc.userId);
  if (!quota.allowed) {
    await advanceNextSync(doc.id, doc.syncFrequency);
    return {
      success: false,
      message: "Monthly sync quota exceeded",
    };
  }

  try {
    const result = await performSync(
      doc.id,
      doc.sourceConnectorId,
      doc.destConnectorId,
      doc.userId,
      { ai: limits.aiFeatures },
    );

    if (!result.success) {
      await decrementQuotaOnFailure(doc.userId);
    }

    // Planifier le prochain sync, même en cas d'échec : sinon la date reste
    // dans le passé et chaque tick du cron réessaie immédiatement.
    await advanceNextSync(doc.id, doc.syncFrequency, result.success);

    return {
      success: result.success,
      message: result.success
        ? "Sync completed"
        : result.error || "Sync failed",
    };
  } catch (error) {
    const safeMsg = sanitizeErrorMessage(error);
    await decrementQuotaOnFailure(doc.userId);

    await prisma.document.update({
      where: { id: doc.id },
      data: { lastSyncError: safeMsg },
    });

    await advanceNextSync(doc.id, doc.syncFrequency);

    return {
      success: false,
      message: safeMsg,
    };
  }
}
