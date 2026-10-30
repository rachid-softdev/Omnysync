/**
 * Tests for the Approvals API route
 * Covers GET /api/approvals and POST /api/approvals
 *
 * Pattern: mock auth + prisma at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrganization: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    approvalRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendApprovalRequestEmail: vi.fn(),
}))

// The approval portal is a Business-plan feature: default to allowed.
vi.mock('@/lib/auth/subscription', () => ({
  checkPlanFeature: vi.fn(async () => ({ allowed: true, plan: 'business' })),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendApprovalRequestEmail } from '@/lib/email'

// ============================================================================
// GET /api/approvals
// ============================================================================

describe('GET /api/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com', role: 'ADMIN' },
    } as any)

    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
      role: 'ADMIN',
    } as any)
  })

  // ── Unauthenticated ─────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('should return 403 when the plan does not include the approval portal', async () => {
    const { checkPlanFeature } = await import('@/lib/auth/subscription')
    vi.mocked(checkPlanFeature).mockResolvedValueOnce({
      allowed: false,
      plan: 'pro',
      upgradeUrl: '/pricing',
    } as any)

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('PLAN_FEATURE_REQUIRED')
  })

  // ── Organization not found ──────────────────────────────────────────────

  it('should return 404 when user has no organization membership', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()

    expect(response.status).toBe(404)
  })

  // ── Returns approvals for OWNER/ADMIN (all statuses) ────────────────────

  it('should return all approvals for OWNER/ADMIN users', async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: 'doc-1', title: 'Doc 1' },
      { id: 'doc-2', title: 'Doc 2' },
    ] as any)

    const mockApprovals = [
      {
        id: 'apr-1',
        documentId: 'doc-1',
        status: 'PENDING',
        requestedBy: 'user-2',
        createdAt: new Date('2026-06-19'),
        expiresAt: new Date('2026-06-26'),
        approvedBy: null,
        approvedAt: null,
        comments: null,
        document: { title: 'Doc 1' },
      },
      {
        id: 'apr-2',
        documentId: 'doc-2',
        status: 'APPROVED',
        requestedBy: 'user-2',
        createdAt: new Date('2026-06-18'),
        expiresAt: new Date('2026-06-25'),
        approvedBy: 'user-1',
        approvedAt: new Date('2026-06-19'),
        comments: 'Looks good',
        document: { title: 'Doc 2' },
      },
    ]

    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(mockApprovals as any)

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.approvals).toHaveLength(2)
    expect(data.approvals[0]).toMatchObject({
      id: 'apr-1',
      documentId: 'doc-1',
      documentTitle: 'Doc 1',
      status: 'PENDING',
      requestedBy: 'user-2',
    })
    expect(data.approvals[1]).toMatchObject({
      id: 'apr-2',
      documentId: 'doc-2',
      documentTitle: 'Doc 2',
      status: 'APPROVED',
      approvedBy: 'user-1',
      comments: 'Looks good',
    })
  })

  // ── Filters PENDING only for non-OWNER/ADMIN ────────────────────────────

  it('should return only PENDING approvals for MEMBER/VIEWER users', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
      role: 'MEMBER',
    } as any)

    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: 'doc-1', title: 'Doc 1' }] as any)

    const mockApprovals = [
      {
        id: 'apr-1',
        documentId: 'doc-1',
        status: 'PENDING',
        requestedBy: 'user-2',
        createdAt: new Date('2026-06-19'),
        expiresAt: new Date('2026-06-26'),
        approvedBy: null,
        approvedAt: null,
        comments: null,
        document: { title: 'Doc 1' },
      },
      {
        id: 'apr-2',
        documentId: 'doc-1',
        status: 'APPROVED',
        requestedBy: 'user-2',
        createdAt: new Date('2026-06-18'),
        expiresAt: new Date('2026-06-25'),
        approvedBy: 'user-1',
        approvedAt: new Date('2026-06-19'),
        comments: null,
        document: { title: 'Doc 1' },
      },
    ]

    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(mockApprovals as any)

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    // MEMBER should only see PENDING approvals
    expect(data.approvals).toHaveLength(1)
    expect(data.approvals[0].status).toBe('PENDING')
  })

  // ── Empty list ──────────────────────────────────────────────────────────

  it('should return empty approvals array when no documents exist', async () => {
    vi.mocked(prisma.document.findMany).mockResolvedValue([])
    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([])

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.approvals).toEqual([])
  })

  // ── Server error ────────────────────────────────────────────────────────

  it('should return 500 when prisma throws', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/approvals/route')
    const response = await GET()

    expect(response.status).toBe(500)
  })
})

// ============================================================================
// POST /api/approvals
// ============================================================================

describe('POST /api/approvals', () => {
  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      organizationId: 'org-1',
    } as any)

    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      organizationId: 'org-1',
      title: 'Doc 1',
    } as any)

    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(null)

    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(prisma.userOrganization.findMany).mockResolvedValue([])
    vi.mocked(sendApprovalRequestEmail).mockResolvedValue(undefined)

    vi.mocked(prisma.approvalRequest.create).mockResolvedValue({
      id: 'apr-new',
      documentId: 'doc-1',
      status: 'PENDING',
      token: 'some-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } as any)
  })

  // ── Unauthenticated ─────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(401)
  })

  // ── Organization not found ──────────────────────────────────────────────

  it('should return 404 when user has no organization membership', async () => {
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(404)
  })

  // ── Document not found ──────────────────────────────────────────────────

  it('should return 404 when document does not exist in the organization', async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-nonexistent' }))

    expect(response.status).toBe(404)
  })

  // ── Existing pending approval ───────────────────────────────────────────

  it('should return 400 when a pending approval already exists', async () => {
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
      id: 'apr-existing',
      documentId: 'doc-1',
      status: 'PENDING',
    } as any)

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(400)
  })

  // ── Creates approval successfully ───────────────────────────────────────

  it('should create an approval request and return 200', async () => {
    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.approval).toMatchObject({
      id: 'apr-new',
      documentId: 'doc-1',
      status: 'PENDING',
    })
    expect(data.approval.expiresAt).toBeDefined()

    // Verify the approvalRequest.create call
    expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-1',
          status: 'PENDING',
          requestedBy: 'user-1',
        }),
      })
    )
  })

  it('emails owners and admins who can review the request', async () => {
    vi.mocked(prisma.userOrganization.findMany).mockResolvedValue([
      { user: { email: 'owner@example.com' } },
      { user: { email: 'admin@example.com' } },
      { user: { email: null } },
    ] as any)

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(200)
    expect(prisma.userOrganization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          role: { in: ['OWNER', 'ADMIN'] },
          userId: { not: 'user-1' },
        }),
      })
    )
    expect(sendApprovalRequestEmail).toHaveBeenCalledTimes(2)
    expect(sendApprovalRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        documentTitle: 'Doc 1',
        organizationName: 'Acme',
        requesterName: 'test@omnysync.com',
        approvalUrl: 'http://localhost:3000/dashboard/approvals',
      })
    )
  })

  it('still creates the request when notification delivery fails', async () => {
    vi.mocked(prisma.userOrganization.findMany).mockResolvedValue([
      { user: { email: 'owner@example.com' } },
    ] as any)
    vi.mocked(sendApprovalRequestEmail).mockRejectedValue(new Error('email down'))

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(200)
    expect(prisma.approvalRequest.create).toHaveBeenCalled()
  })

  // ── Validation error (empty documentId) ─────────────────────────────────

  it('should return 400 when documentId is empty', async () => {
    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: '' }))

    expect(response.status).toBe(400)
  })

  // ── Validation error (missing documentId) ───────────────────────────────

  it('should return 400 when documentId is missing', async () => {
    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
  })

  // ── Server error ────────────────────────────────────────────────────────

  it('should return 500 when prisma throws during create', async () => {
    vi.mocked(prisma.approvalRequest.create).mockRejectedValue(new Error('DB error'))

    const { POST } = await import('@/app/api/approvals/route')
    const response = await POST(makeRequest({ documentId: 'doc-1' }))

    expect(response.status).toBe(500)
  })
})
