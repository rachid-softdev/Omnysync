/**
 * Service d'Approval Portal (Portails d'Approbation)
 * Omnysync - 2026
 */

import { prisma } from "@/lib/prisma"
import { auditApproval } from "@/lib/audit"
import { auth } from "@/lib/auth"
import { randomBytes } from "crypto"
import { headers } from "next/headers"

// ============================================================================
// TYPES
// ============================================================================

export interface CreateApprovalRequest {
  documentId: string
  expiresIn?: number // jours, default 7
  comments?: string
}

export interface ApprovalResponse {
  action: "APPROVED" | "REJECTED"
  comments?: string
}

export interface ApprovalRequestResult {
  success: boolean
  token?: string
  expiresAt?: Date
  approvalUrl?: string
  error?: string
}

// ============================================================================
// CREATE APPROVAL REQUEST
// ============================================================================

/**
 * Crée une demande d'approbation pour un document
 */
export async function createApprovalRequest(
  organizationId: string,
  data: CreateApprovalRequest
): Promise<ApprovalRequestResult> {
  try {
    // Vérifier que le document existe et appartient à l'org
    const document = await prisma.document.findFirst({
      where: {
        id: data.documentId,
        organizationId,
      },
    })

    if (!document) {
      return { success: false, error: "Document not found" }
    }

    if (document.status === "PUBLISHED") {
      return { success: false, error: "Document is already published" }
    }

    // Récupérer l'utilisateur actuel
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return { success: false, error: "User not authenticated" }
    }

    // Générer un token unique
    const token = randomBytes(32).toString("hex")

    // Calculer la date d'expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (data.expiresIn || 7))

    // Créer la demande d'approbation
    const approval = await prisma.approvalRequest.create({
      data: {
        documentId: data.documentId,
        token,
        status: "PENDING",
        requestedBy: userId,
        expiresAt,
        comments: data.comments,
      },
    })

    await auditApproval.requested(organizationId, approval.id, data.documentId)

    // Construire l'URL d'approbation (utilise l'URL de l'app)
    const headersList = await headers()
    const origin = headersList.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const approvalUrl = `${origin}/public/approval/${token}`

    return {
      success: true,
      token,
      expiresAt,
      approvalUrl,
    }
  } catch (error) {
    console.error("Create approval request failed:", error)
    return { success: false, error: (error as Error).message }
  }
}

// ============================================================================
// GET APPROVAL REQUEST BY TOKEN
// ============================================================================

/**
 * Récupère une demande d'approbation par son token public
 */
export async function getApprovalByToken(token: string) {
  const approval = await prisma.approvalRequest.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          sourceConnector: true,
          destConnector: true,
        },
      },
    },
  })

  if (!approval) {
    return null
  }

  // Vérifier si expiré
  if (approval.status !== "PENDING" || approval.expiresAt < new Date()) {
    // Mettre à jour le status
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "EXPIRED" },
    })
    return null
  }

  return approval
}

// ============================================================================
// RESPOND TO APPROVAL
// ============================================================================

/**
 * Approuve ou rejette une demande d'approbation
 */
export async function respondToApproval(
  token: string,
  response: ApprovalResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    const approval = await getApprovalByToken(token)

    if (!approval) {
      return { success: false, error: "Approval request not found or expired" }
    }

    // Récupérer l'utilisateur actuel pour l'approbation
    const session = await auth()
    const userId = session?.user?.id || "anonymous"

    // Mettre à jour la demande
    const updatedApproval = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: response.action === "APPROVED" ? "APPROVED" : "REJECTED",
        approvedBy: userId,
        approvedAt: new Date(),
        comments: response.comments,
      },
    })

    // Logger l'action
    if (response.action === "APPROVED") {
      await auditApproval.approved(approval.document.organizationId, approval.id, userId)

      // Si approuvé, changer le status du document et lancer le sync
      await prisma.document.update({
        where: { id: approval.documentId },
        data: {
          status: "READY",
        },
      })
    } else {
      await auditApproval.rejected(approval.document.organizationId, approval.id, userId, response.comments)
    }

    return { success: true }
  } catch (error) {
    console.error("Respond to approval failed:", error)
    return { success: false, error: (error as Error).message }
  }
}

// ============================================================================
// GET APPROVALS FOR DOCUMENT
// ============================================================================

/**
 * Récupère toutes les demandes d'approbation pour un document
 */
export async function getApprovalsForDocument(documentId: string) {
  return prisma.approvalRequest.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  })
}

// ============================================================================
// CANCEL APPROVAL REQUEST
// ============================================================================

/**
 * Annule une demande d'approbation
 */
export async function cancelApprovalRequest(
  organizationId: string,
  approvalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const approval = await prisma.approvalRequest.findFirst({
      where: {
        id: approvalId,
        document: {
          organizationId,
        },
      },
    })

    if (!approval) {
      return { success: false, error: "Approval request not found" }
    }

    if (approval.status !== "PENDING") {
      return { success: false, error: "Approval request is not pending" }
    }

    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: "REJECTED" }, // Reused status for cancelled
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// ============================================================================
// GET APPROVALS LIST
// ============================================================================

/**
 * Liste les demandes d'approbation pour une organisation
 */
export async function getApprovalsList(
  organizationId: string,
  options: {
    status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
    documentId?: string
    limit?: number
    offset?: number
  } = {}
) {
  const { status, documentId, limit = 20, offset = 0 } = options

  const where: Record<string, unknown> = {
    document: {
      organizationId,
    },
  }

  if (status) where.status = status
  if (documentId) where.documentId = documentId

  const [approvals, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        document: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return {
    approvals,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + approvals.length < total,
    },
  }
}

// ============================================================================
// AUTO-EXPIRE APPROVALS
// ============================================================================

/**
 * Marque les demandes d'approbation expirées comme expirées
 */
export async function expirePendingApprovals(): Promise<number> {
  const result = await prisma.approvalRequest.updateMany({
    where: {
      status: "PENDING",
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: "EXPIRED",
    },
  })

  return result.count
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Vérifie si un document peut être soumis pour approbation
 */
export async function canSubmitForApproval(documentId: string): Promise<{
  canSubmit: boolean
  reason?: string
}> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  if (!document) {
    return { canSubmit: false, reason: "Document not found" }
  }

  if (document.status === "PUBLISHED") {
    return { canSubmit: false, reason: "Document is already published" }
  }

  if (document.status === "ARCHIVED") {
    return { canSubmit: false, reason: "Document is archived" }
  }

  if (!document.sourceConnector || !document.destConnector) {
    return { canSubmit: false, reason: "Document must have source and destination connectors" }
  }

  // Vérifier s'il y a déjà une approbation en attente
  const pendingApproval = await prisma.approvalRequest.findFirst({
    where: {
      documentId,
      status: "PENDING",
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  if (pendingApproval) {
    return { canSubmit: false, reason: "There is already a pending approval request" }
  }

  return { canSubmit: true }
}