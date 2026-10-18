import { prisma } from '@/lib/prisma'
import { auditApproval } from '@/lib/audit'

export type ApprovalAction = 'APPROVED' | 'REJECTED'

export interface ApprovalResponseResult {
  status: number
  error?: string
}

/**
 * Applies an approval decision scoped to the caller's organization.
 *
 * Mirrors core `respondToApproval` (used by the token-based public portal):
 * approving moves the document to READY, rejecting only records the decision.
 */
export async function respondToApprovalById(
  approvalId: string,
  organizationId: string,
  userId: string,
  action: ApprovalAction,
  comments?: string
): Promise<ApprovalResponseResult> {
  const approval = await prisma.approvalRequest.findFirst({
    where: {
      id: approvalId,
      document: { organizationId },
    },
  })

  if (!approval) {
    return { status: 404, error: 'Approval request not found' }
  }

  if (approval.status !== 'PENDING') {
    return {
      status: 400,
      error: `Approval request is already ${approval.status.toLowerCase()}`,
    }
  }

  if (approval.expiresAt.getTime() < Date.now()) {
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'EXPIRED' },
    })
    await auditApproval.expired(organizationId, approval.id)
    return { status: 400, error: 'Approval request has expired' }
  }

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: {
      status: action,
      approvedBy: userId,
      approvedAt: new Date(),
      comments: comments ?? approval.comments,
    },
  })

  if (action === 'APPROVED') {
    await prisma.document.update({
      where: { id: approval.documentId },
      data: { status: 'READY' },
    })
    await auditApproval.approved(organizationId, approval.id, userId)
  } else {
    await auditApproval.rejected(organizationId, approval.id, userId, comments)
  }

  return { status: 200 }
}
