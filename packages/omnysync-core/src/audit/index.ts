/**
 * Service d'Audit Trail
 * Omnysync - 2026
 */

import { prisma } from "../prisma";
import { auth } from "../auth";

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  // Organisation
  | "org.created"
  | "org.updated"
  | "org.deleted"
  | "org.settings.updated"

  // Membres
  | "member.invited"
  | "member.joined"
  | "member.role.updated"
  | "member.removed"

  // Connecteurs
  | "connector.created"
  | "connector.updated"
  | "connector.deleted"
  | "connector.test"
  | "connector.disconnected"
  | "connector.reconnected"

  // Documents
  | "document.created"
  | "document.updated"
  | "document.deleted"
  | "document.archived"
  | "document.restored"

  // Sync
  | "sync.started"
  | "sync.completed"
  | "sync.failed"
  | "sync.scheduled"
  | "sync.cancelled"
  | "sync.changes.detected"
  | "sync.conflict.resolved"

  // Approvals
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.expired"

  // Billing
  | "billing.plan.upgraded"
  | "billing.plan.downgraded"
  | "billing.subscription.cancelled"
  | "billing.payment.failed";

export type AuditTargetType =
  | "org"
  | "member"
  | "connector"
  | "document"
  | "sync"
  | "approval"
  | "billing";

export interface AuditDetails {
  // Pour les syncs
  sourceType?: string;
  destType?: string;
  syncDuration?: number;
  tokensUsed?: number;

  // Pour les membres
  oldRole?: string;
  newRole?: string;
  inviteEmail?: string;

  // Pour les documents
  wordCount?: number;
  seoScore?: number;

  // Pour les erreurs
  errorMessage?: string;

  // Pour les connecteurs
  connectorName?: string;
  connectionStatus?: string;

  // Pour les-factures
  amount?: number;
  currency?: string;
  invoiceUrl?: string;

  // Générique
  [key: string]: unknown;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Récupère les informations de requête pour l'audit
 */
export async function getRequestInfo() {
  // Note: headers() must be called within a request context
  // This is a placeholder - actual implementation depends on the HTTP framework
  return {
    ipAddress: process.env.AUDIT_IP_ADDRESS || "unknown",
    userAgent: process.env.AUDIT_USER_AGENT || "unknown",
  };
}

/**
 * Récupère l'utilisateur actuel depuis la session
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user?.id;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Crée une entrée d'audit log
 */
export async function auditLog(
  organizationId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId?: string,
  details?: AuditDetails,
): Promise<void> {
  try {
    const userId = await getCurrentUser();
    const { ipAddress, userAgent } = await getRequestInfo();

    // Si pas d'utilisateur, utiliser "system"
    const finalUserId = userId || "system";

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: finalUserId,
        action,
        targetType,
        targetId,
        details: details || {},
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Ne pas bloquer l'action principale si l'audit échoue
    console.error("Audit log failed:", error);
  }
}

/**
 * Wrapper pour audit avec gestion d'erreur automatique
 */
export async function withAudit<T>(
  organizationId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId: string | undefined,
  details: AuditDetails | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();

    // Log succès (pas de details d'erreur)
    await auditLog(organizationId, action, targetType, targetId, {
      ...details,
      success: true,
    });

    return result;
  } catch (error) {
    // Log échec avec les détails de l'erreur
    await auditLog(organizationId, action, targetType, targetId, {
      ...details,
      success: false,
      errorMessage: (error as Error).message,
    });

    throw error;
  }
}

/**
 * Récupère les logs d'audit pour une organisation
 */
export async function getAuditLogs(
  organizationId: string,
  options: {
    action?: AuditAction;
    targetType?: AuditTargetType;
    targetId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {},
) {
  const {
    action,
    targetType,
    targetId,
    userId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  const where: Record<string, unknown> = {
    organizationId,
  };

  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (userId) where.userId = userId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + logs.length < total,
    },
  };
}

/**
 * Récupère les logs d'audit pour une ressource spécifique
 */
export async function getAuditLogsForResource(
  organizationId: string,
  targetType: AuditTargetType,
  targetId: string,
  limit = 20,
) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      targetType,
      targetId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
}

/**
 * Nettoie les vieux logs d'audit (plus de 90 jours)
 */
export async function cleanupOldAuditLogs(olderThanDays = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON ACTIONS
// ============================================================================

// Organisation
export const auditOrg = {
  created: (orgId: string) => auditLog(orgId, "org.created", "org"),
  updated: (orgId: string, details?: AuditDetails) =>
    auditLog(orgId, "org.updated", "org", undefined, details),
  deleted: (orgId: string) => auditLog(orgId, "org.deleted", "org"),
  settingsUpdated: (orgId: string, details?: AuditDetails) =>
    auditLog(orgId, "org.settings.updated", "org", undefined, details),
};

// Membres
export const auditMember = {
  invited: (orgId: string, email: string, role: string) =>
    auditLog(orgId, "member.invited", "member", undefined, {
      inviteEmail: email,
      newRole: role,
    }),
  joined: (orgId: string, userId: string) =>
    auditLog(orgId, "member.joined", "member", userId),
  roleUpdated: (
    orgId: string,
    userId: string,
    oldRole: string,
    newRole: string,
  ) =>
    auditLog(orgId, "member.role.updated", "member", userId, {
      oldRole,
      newRole,
    }),
  removed: (orgId: string, userId: string) =>
    auditLog(orgId, "member.removed", "member", userId),
};

// Connecteurs
export const auditConnector = {
  created: (
    orgId: string,
    connectorId: string,
    connectorName: string,
    type: string,
  ) =>
    auditLog(orgId, "connector.created", "connector", connectorId, {
      connectorName,
      connectorType: type,
    }),
  updated: (orgId: string, connectorId: string, details?: AuditDetails) =>
    auditLog(orgId, "connector.updated", "connector", connectorId, details),
  deleted: (orgId: string, connectorId: string, connectorName: string) =>
    auditLog(orgId, "connector.deleted", "connector", connectorId, {
      connectorName,
    }),
  tested: (orgId: string, connectorId: string, success: boolean) =>
    auditLog(orgId, "connector.test", "connector", connectorId, { success }),
};

// Documents
export const auditDocument = {
  created: (orgId: string, docId: string, title: string) =>
    auditLog(orgId, "document.created", "document", docId, {
      documentTitle: title,
    }),
  updated: (orgId: string, docId: string, details?: AuditDetails) =>
    auditLog(orgId, "document.updated", "document", docId, details),
  deleted: (orgId: string, docId: string, title: string) =>
    auditLog(orgId, "document.deleted", "document", docId, {
      documentTitle: title,
    }),
  archived: (orgId: string, docId: string) =>
    auditLog(orgId, "document.archived", "document", docId),
  restored: (orgId: string, docId: string) =>
    auditLog(orgId, "document.restored", "document", docId),
};

// Syncs
export const auditSync = {
  started: (orgId: string, syncId: string, details?: AuditDetails) =>
    auditLog(orgId, "sync.started", "sync", syncId, details),
  completed: (orgId: string, syncId: string, details?: AuditDetails) =>
    auditLog(orgId, "sync.completed", "sync", syncId, details),
  failed: (orgId: string, syncId: string, error: string) =>
    auditLog(orgId, "sync.failed", "sync", syncId, { errorMessage: error }),
  scheduled: (orgId: string, syncId: string, frequency: string) =>
    auditLog(orgId, "sync.scheduled", "sync", syncId, {
      syncFrequency: frequency,
    }),
  cancelled: (orgId: string, syncId: string) =>
    auditLog(orgId, "sync.cancelled", "sync", syncId),
  changesDetected: (orgId: string, syncId: string) =>
    auditLog(orgId, "sync.changes.detected", "sync", syncId),
  conflictResolved: (orgId: string, syncId: string, resolution: string) =>
    auditLog(orgId, "sync.conflict.resolved", "sync", syncId, { resolution }),
};

// Approvals
export const auditApproval = {
  requested: (orgId: string, approvalId: string, docId: string) =>
    auditLog(orgId, "approval.requested", "approval", approvalId, {
      documentId: docId,
    }),
  approved: (orgId: string, approvalId: string, approverId: string) =>
    auditLog(orgId, "approval.approved", "approval", approvalId, {
      approvedBy: approverId,
    }),
  rejected: (
    orgId: string,
    approvalId: string,
    approverId: string,
    reason?: string,
  ) =>
    auditLog(orgId, "approval.rejected", "approval", approvalId, {
      approvedBy: approverId,
      reason,
    }),
  expired: (orgId: string, approvalId: string) =>
    auditLog(orgId, "approval.expired", "approval", approvalId),
};

// Billing
export const auditBilling = {
  planUpgraded: (orgId: string, fromPlan: string, toPlan: string) =>
    auditLog(orgId, "billing.plan.upgraded", "billing", undefined, {
      fromPlan,
      toPlan,
    }),
  planDowngraded: (orgId: string, fromPlan: string, toPlan: string) =>
    auditLog(orgId, "billing.plan.downgraded", "billing", undefined, {
      fromPlan,
      toPlan,
    }),
  subscriptionCancelled: (orgId: string) =>
    auditLog(orgId, "billing.subscription.cancelled", "billing"),
  paymentFailed: (orgId: string, amount: number, currency: string) =>
    auditLog(orgId, "billing.payment.failed", "billing", undefined, {
      amount,
      currency,
    }),
};
