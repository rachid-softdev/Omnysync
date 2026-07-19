import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  document: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  approvalRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
}))

const mockAuditApproval = vi.hoisted(() => ({
  requested: vi.fn(),
  approved: vi.fn(),
  rejected: vi.fn(),
  expired: vi.fn(),
}))

vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))
vi.mock('@omnysync/core/audit', () => ({
  auditApproval: mockAuditApproval,
}))
// approval.ts imports `randomBytes` from the node "crypto" builtin. Vite
// externalizes it to node:crypto, which this sandbox cannot load, so we stub it.
vi.mock('crypto', () => {
  const randomBytes = vi.fn(() => ({ toString: () => '0'.repeat(64) }))
  return { randomBytes, default: { randomBytes } }
})

import {
  createApprovalRequest,
  getApprovalByToken,
  respondToApproval,
  canSubmitForApproval,
  expirePendingApprovals,
  cancelApprovalRequest,
} from '@/lib/services/approval'

describe('createApprovalRequest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a PENDING request with a token and 7-day expiry', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1', status: 'DRAFT' })
    mockPrisma.approvalRequest.create.mockResolvedValue({ id: 'apr-1' })

    const result = await createApprovalRequest('org-1', { documentId: 'doc-1' }, 'user-1')

    expect(result.success).toBe(true)
    expect(result.token).toMatch(/^[a-f0-9]{64}$/)
    expect(result.approvalUrl).toBe(`http://localhost:3000/public/approval/${result.token}`)
    expect(result.expiresAt).toBeInstanceOf(Date)
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(Math.abs(result.expiresAt!.getTime() - Date.now())).toBeLessThanOrEqual(sevenDays)
    expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
      data: {
        documentId: 'doc-1',
        token: result.token,
        status: 'PENDING',
        requestedBy: 'user-1',
        expiresAt: result.expiresAt,
        comments: undefined,
      },
    })
    expect(mockAuditApproval.requested).toHaveBeenCalledWith('org-1', 'apr-1', 'doc-1')
  })

  it('fails when the document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null)

    const result = await createApprovalRequest('org-1', { documentId: 'missing' }, 'user-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Document not found')
    expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled()
  })

  it('fails when the document is already published', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1', status: 'PUBLISHED' })

    const result = await createApprovalRequest('org-1', { documentId: 'doc-1' }, 'user-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Document is already published')
  })
})

describe('getApprovalByToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the pending approval when found and not expired', async () => {
    const approval = {
      id: 'apr-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60000),
      document: { organizationId: 'org-1' },
    }
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(approval)

    const result = await getApprovalByToken('tok')

    expect(result).toBe(approval)
    expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled()
  })

  it('returns null when the token does not exist', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(null)

    expect(await getApprovalByToken('nope')).toBeNull()
  })

  it('marks the approval EXPIRED and returns null when past expiry', async () => {
    const approval = {
      id: 'apr-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60000),
      document: { organizationId: 'org-1' },
    }
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(approval)

    const result = await getApprovalByToken('tok')

    expect(result).toBeNull()
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: { status: 'EXPIRED' },
    })
  })
})

describe('respondToApproval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approves: sets APPROVED and moves the document to READY', async () => {
    const approval = {
      id: 'apr-1',
      documentId: 'doc-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60000),
      document: { organizationId: 'org-1', id: 'doc-1' },
    }
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(approval)

    const result = await respondToApproval('tok', { action: 'APPROVED' })

    expect(result.success).toBe(true)
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: {
        status: 'APPROVED',
        approvedBy: expect.any(String),
        approvedAt: expect.any(Date),
        comments: undefined,
      },
    })
    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'READY' },
    })
    expect(mockAuditApproval.approved).toHaveBeenCalled()
  })

  it('rejects: sets REJECTED', async () => {
    const approval = {
      id: 'apr-1',
      documentId: 'doc-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60000),
      document: { organizationId: 'org-1', id: 'doc-1' },
    }
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(approval)

    const result = await respondToApproval('tok', { action: 'REJECTED', comments: 'nope' })

    expect(result.success).toBe(true)
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: {
        status: 'REJECTED',
        approvedBy: expect.any(String),
        approvedAt: expect.any(Date),
        comments: 'nope',
      },
    })
    expect(mockAuditApproval.rejected).toHaveBeenCalled()
  })

  it('returns an error when the approval cannot be found', async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValue(null)

    const result = await respondToApproval('tok', { action: 'APPROVED' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Approval request not found or expired')
  })
})

describe('canSubmitForApproval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows submission for a draft with both connectors and no pending request', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      status: 'DRAFT',
      sourceConnector: { id: 'c1' },
      destConnector: { id: 'c2' },
    })
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(null)

    const result = await canSubmitForApproval('doc-1')

    expect(result).toEqual({ canSubmit: true })
  })

  it('rejects a published document', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', status: 'PUBLISHED' })

    const result = await canSubmitForApproval('doc-1')

    expect(result.canSubmit).toBe(false)
    expect(result.reason).toBe('Document is already published')
  })

  it('rejects when connectors are missing', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      status: 'DRAFT',
      sourceConnector: null,
      destConnector: null,
    })

    const result = await canSubmitForApproval('doc-1')

    expect(result.canSubmit).toBe(false)
    expect(result.reason).toContain('connectors')
  })
})

describe('expirePendingApprovals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the number of expired approvals', async () => {
    mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 3 })

    const count = await expirePendingApprovals()

    expect(count).toBe(3)
    expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
      data: { status: 'EXPIRED' },
    })
  })
})

describe('cancelApprovalRequest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cancels a pending approval', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: 'apr-1', status: 'PENDING' })

    const result = await cancelApprovalRequest('org-1', 'apr-1')

    expect(result.success).toBe(true)
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: { status: 'CANCELLED' },
    })
  })

  it('fails when the approval is not pending', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: 'apr-1', status: 'APPROVED' })

    const result = await cancelApprovalRequest('org-1', 'apr-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Approval request is not pending')
  })
})
