/**
 * Tests for POST /api/approvals/[id]/approve and /reject
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    document: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  hasPermission: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  auditApproval: {
    approved: vi.fn(),
    rejected: vi.fn(),
    expired: vi.fn(),
  },
}))

// The approval portal is a Business-plan feature: default to allowed.
vi.mock('@/lib/auth/subscription', () => ({
  checkPlanFeature: vi.fn(async () => ({ allowed: true, plan: 'business' })),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { hasPermission } from '@/lib/auth/permissions'
import { auditApproval } from '@/lib/audit'

const makeContext = (id = 'approval-1') => ({ params: Promise.resolve({ id }) })

const pendingApproval = () => ({
  id: 'approval-1',
  documentId: 'doc-1',
  status: 'PENDING',
  requestedBy: 'user-1',
  approvedBy: null,
  approvedAt: null,
  comments: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('POST /api/approvals/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(hasPermission).mockResolvedValue(true)
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(pendingApproval() as any)
    vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(401)
  })

  it('should return 403 when the caller cannot manage approvals', async () => {
    vi.mocked(hasPermission).mockResolvedValue(false)

    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(403)
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled()
  })

  it('should scope the lookup to the caller organization', async () => {
    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'approval-1', document: { organizationId: 'org-1' } },
    })
  })

  it('should return 404 when the approval does not exist or belongs to another org', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(404)
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled()
  })

  it('should return 400 when the request is already handled', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
      ...pendingApproval(),
      status: 'APPROVED',
    } as any)

    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(400)
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled()
  })

  it('should expire the request when it is past its expiry date', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
      ...pendingApproval(),
      expiresAt: new Date(Date.now() - 1000),
    } as any)

    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(400)
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'approval-1' },
      data: { status: 'EXPIRED' },
    })
    expect(prisma.document.update).not.toHaveBeenCalled()
    expect(auditApproval.expired).toHaveBeenCalledWith('org-1', 'approval-1')
  })

  it('should approve the request and move the document to READY', async () => {
    const { POST } = await import('@/app/api/approvals/[id]/approve/route')
    const response = await POST(
      new NextRequest('http://localhost:3000/api/approvals/approval-1/approve', {
        method: 'POST',
      }),
      makeContext()
    )

    expect(response.status).toBe(200)
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'approval-1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedBy: 'user-1',
        }),
      })
    )
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'READY' },
    })
    expect(auditApproval.approved).toHaveBeenCalledWith('org-1', 'approval-1', 'user-1')
  })
})

describe('POST /api/approvals/[id]/reject', () => {
  const makeRequest = (body?: unknown) =>
    new NextRequest('http://localhost:3000/api/approvals/approval-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')
    vi.mocked(hasPermission).mockResolvedValue(true)
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(pendingApproval() as any)
    vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any)
  })

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest(), makeContext())

    expect(response.status).toBe(401)
  })

  it('should return 403 when the caller cannot manage approvals', async () => {
    vi.mocked(hasPermission).mockResolvedValue(false)

    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest(), makeContext())

    expect(response.status).toBe(403)
  })

  it('should reject the request with a comment and not touch the document', async () => {
    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest({ comments: 'Needs more detail' }), makeContext())

    expect(response.status).toBe(200)
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'approval-1' },
      data: expect.objectContaining({
        status: 'REJECTED',
        approvedBy: 'user-1',
        comments: 'Needs more detail',
      }),
    })
    expect(prisma.document.update).not.toHaveBeenCalled()
    expect(auditApproval.rejected).toHaveBeenCalledWith(
      'org-1',
      'approval-1',
      'user-1',
      'Needs more detail'
    )
  })

  it('should accept an empty body (batch rejection sends an empty comment)', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
      ...pendingApproval(),
      comments: 'existing comment',
    } as any)

    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest(), makeContext())

    expect(response.status).toBe(200)
    // No new comment: the existing one is preserved
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ comments: 'existing comment' }),
      })
    )
  })

  it('should return 400 when the comment is too long', async () => {
    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest({ comments: 'a'.repeat(501) }), makeContext())

    expect(response.status).toBe(400)
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled()
  })

  it('should expire the request when it is past its expiry date', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
      ...pendingApproval(),
      expiresAt: new Date(Date.now() - 1000),
    } as any)

    const { POST } = await import('@/app/api/approvals/[id]/reject/route')
    const response = await POST(makeRequest({ comments: 'late' }), makeContext())

    expect(response.status).toBe(400)
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: 'approval-1' },
      data: { status: 'EXPIRED' },
    })
    expect(auditApproval.expired).toHaveBeenCalledWith('org-1', 'approval-1')
  })
})
