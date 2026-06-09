/**
 * Approval Service Tests
 *
 * Tests covering the full approval workflow:
 * - createApprovalRequest — creates with PENDING status, token generation
 * - getApprovalByToken — retrieves valid requests, returns null for expired
 * - respondToApproval — approve (sets READY), reject, cancel
 * - Edge cases: expired token, duplicate response, invalid document
 * - canSubmitForApproval — validates document eligibility
 * - getApprovalsList — paginated list with filters
 * - cancelApprovalRequest — cancels pending request
 * - expirePendingApprovals — batch expiration
 *
 * Pattern: mock Prisma client directly using vi.mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "crypto";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Must use vi.hoisted() because vi.mock factories are hoisted to top of file
const mockPrisma = vi.hoisted(() => ({
  document: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  approvalRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({
  prisma: mockPrisma,
}));

// Mock crypto for deterministic tokens
vi.mock("crypto", () => ({
  randomBytes: vi.fn(),
}));

// Mock the audit module
vi.mock("../../audit", () => ({
  auditApproval: {
    requested: vi.fn(),
    approved: vi.fn(),
    rejected: vi.fn(),
    cancelled: vi.fn(),
  },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { prisma } from "../../prisma";
import { auditApproval } from "../../audit";
import {
  createApprovalRequest,
  getApprovalByToken,
  respondToApproval,
  getApprovalsForDocument,
  cancelApprovalRequest,
  getApprovalsList,
  expirePendingApprovals,
  canSubmitForApproval,
} from "../approval";

// ============================================================================
// SUITE
// ============================================================================

describe("Approval Service", () => {
  const orgId = "org-1";
  const userId = "user-1";
  const documentId = "doc-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset crypto mock to return deterministic values
    vi.mocked(randomBytes).mockReturnValue(
      Buffer.from("abcdef1234567890abcdef1234567890", "hex"),
    );
  });

  // ==========================================================================
  // createApprovalRequest
  // ==========================================================================

  describe("createApprovalRequest", () => {
    it("should create a PENDING approval request and return token", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        status: "DRAFT",
      } as any);

      const createdApproval = {
        id: "approval-1",
        documentId,
        token: "abcdef1234567890abcdef1234567890",
        status: "PENDING",
        requestedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        comments: "Please review",
      };
      vi.mocked(prisma.approvalRequest.create).mockResolvedValue(
        createdApproval as any,
      );
      vi.mocked(auditApproval.requested).mockResolvedValue(undefined as any);

      const result = await createApprovalRequest(
        orgId,
        { documentId, comments: "Please review" },
        userId,
      );

      expect(result.success).toBe(true);
      expect(result.token).toBe("abcdef1234567890abcdef1234567890");
      expect(result.approvalUrl).toContain("/public/approval/");
      expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId,
            status: "PENDING",
            requestedBy: userId,
          }),
        }),
      );
      expect(auditApproval.requested).toHaveBeenCalledWith(
        orgId,
        "approval-1",
        documentId,
      );
    });

    it("should return error when document not found in org", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

      const result = await createApprovalRequest(orgId, { documentId }, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Document not found");
      expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("should return error when document is already published", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        status: "PUBLISHED",
      } as any);

      const result = await createApprovalRequest(orgId, { documentId }, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Document is already published");
    });

    it("should use custom expiration days", async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        status: "DRAFT",
      } as any);
      vi.mocked(prisma.approvalRequest.create).mockResolvedValue({
        id: "approval-1",
        token: "token-1",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      } as any);
      vi.mocked(auditApproval.requested).mockResolvedValue(undefined as any);

      const result = await createApprovalRequest(
        orgId,
        { documentId, expiresIn: 14 },
        userId,
      );

      expect(result.success).toBe(true);
      // expiresIn overrides the default 7 days
      const createCall = vi.mocked(prisma.approvalRequest.create).mock
        .calls[0][0];
      const storedExpiresAt = createCall.data.expiresAt as Date;
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 14);
      // Should be roughly 14 days from now (allow 1s tolerance)
      expect(
        Math.abs(storedExpiresAt.getTime() - expectedExpiry.getTime()),
      ).toBeLessThan(5000);
    });

    it("should handle prisma errors gracefully", async () => {
      vi.mocked(prisma.document.findFirst).mockRejectedValue(
        new Error("DB connection lost"),
      );

      const result = await createApprovalRequest(orgId, { documentId }, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection lost");
    });
  });

  // ==========================================================================
  // getApprovalByToken
  // ==========================================================================

  describe("getApprovalByToken", () => {
    it("should return the approval when token is valid and not expired", async () => {
      const approval = {
        id: "approval-1",
        token: "valid-token",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        document: { title: "Doc", sourceConnector: {}, destConnector: {} },
      };
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(
        approval as any,
      );

      const result = await getApprovalByToken("valid-token");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("approval-1");
    });

    it("should return null and mark as EXPIRED when token is expired", async () => {
      const approval = {
        id: "approval-1",
        token: "expired-token",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(
        approval as any,
      );
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any);

      const result = await getApprovalByToken("expired-token");

      expect(result).toBeNull();
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: "approval-1" },
        data: { status: "EXPIRED" },
      });
    });

    it("should return null when approval is not found", async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(null);

      const result = await getApprovalByToken("non-existent");

      expect(result).toBeNull();
    });

    it("should return null when status is not PENDING (already responded)", async () => {
      const approval = {
        id: "approval-1",
        token: "responded-token",
        status: "APPROVED",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(
        approval as any,
      );

      const result = await getApprovalByToken("responded-token");

      expect(result).toBeNull();
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: "approval-1" },
        data: { status: "EXPIRED" },
      });
    });
  });

  // ==========================================================================
  // respondToApproval
  // ==========================================================================

  describe("respondToApproval", () => {
    const token = "valid-token";
    const mockApproval = {
      id: "approval-1",
      token,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      documentId,
      document: {
        organizationId: orgId,
        title: "Doc",
        sourceConnector: {},
        destConnector: {},
      },
    };

    it("should approve and set document status to READY", async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(
        mockApproval as any,
      );
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(auditApproval.approved).mockResolvedValue(undefined as any);

      const result = await respondToApproval(token, { action: "APPROVED" });

      expect(result.success).toBe(true);
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "approval-1" },
          data: expect.objectContaining({ status: "APPROVED" }),
        }),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: documentId },
          data: { status: "READY" },
        }),
      );
      expect(auditApproval.approved).toHaveBeenCalledWith(
        orgId,
        "approval-1",
        "anonymous",
      );
    });

    it("should reject and not change document status", async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(
        mockApproval as any,
      );
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any);
      vi.mocked(auditApproval.rejected).mockResolvedValue(undefined as any);

      const result = await respondToApproval(token, {
        action: "REJECTED",
        comments: "Needs work",
      });

      expect(result.success).toBe(true);
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "REJECTED" }),
        }),
      );
      // Document status should NOT change to READY
      expect(prisma.document.update).not.toHaveBeenCalled();
      expect(auditApproval.rejected).toHaveBeenCalledWith(
        orgId,
        "approval-1",
        "anonymous",
        "Needs work",
      );
    });

    it("should return error when token is invalid or expired", async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(null);

      const result = await respondToApproval("bad-token", {
        action: "APPROVED",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Approval request not found or expired");
    });

    it("should handle prisma errors gracefully", async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await respondToApproval(token, { action: "APPROVED" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  // ==========================================================================
  // cancelApprovalRequest
  // ==========================================================================

  describe("cancelApprovalRequest", () => {
    it("should cancel a pending request", async () => {
      vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
        id: "approval-1",
        documentId,
        status: "PENDING",
        document: { organizationId: orgId },
      } as any);
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({} as any);

      const result = await cancelApprovalRequest(orgId, "approval-1");

      expect(result.success).toBe(true);
      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: "approval-1" },
        data: { status: "REJECTED" }, // Uses REJECTED for cancelled
      });
    });

    it("should return error when approval is not found in org", async () => {
      vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(null);

      const result = await cancelApprovalRequest(orgId, "approval-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Approval request not found");
    });

    it("should return error when approval is not pending", async () => {
      vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
        id: "approval-1",
        documentId,
        status: "APPROVED",
        document: { organizationId: orgId },
      } as any);

      const result = await cancelApprovalRequest(orgId, "approval-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Approval request is not pending");
    });
  });

  // ==========================================================================
  // getApprovalsForDocument
  // ==========================================================================

  describe("getApprovalsForDocument", () => {
    it("should return approvals ordered by createdAt desc", async () => {
      const approvals = [
        { id: "approval-2", createdAt: new Date("2026-06-08") },
        { id: "approval-1", createdAt: new Date("2026-06-07") },
      ];
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(
        approvals as any,
      );

      const result = await getApprovalsForDocument(documentId);

      expect(result.length).toBe(2);
      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith({
        where: { documentId },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  // ==========================================================================
  // getApprovalsList
  // ==========================================================================

  describe("getApprovalsList", () => {
    it("should return paginated approvals for org", async () => {
      const approvals = [
        { id: "approval-1", document: { id: "doc-1", title: "Doc" } },
        { id: "approval-2", document: { id: "doc-2", title: "Doc 2" } },
      ];
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(
        approvals as any,
      );
      vi.mocked(prisma.approvalRequest.count).mockResolvedValue(5);

      const result = await getApprovalsList(orgId, { limit: 2, offset: 0 });

      expect(result.approvals.length).toBe(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.limit).toBe(2);
    });

    it("should filter by status when provided", async () => {
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.approvalRequest.count).mockResolvedValue(0);

      await getApprovalsList(orgId, { status: "PENDING" });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PENDING",
          }),
        }),
      );
    });

    it("should filter by documentId when provided", async () => {
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.approvalRequest.count).mockResolvedValue(0);

      await getApprovalsList(orgId, { documentId: "doc-1" });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: "doc-1",
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // expirePendingApprovals
  // ==========================================================================

  describe("expirePendingApprovals", () => {
    it("should update expired pending approvals", async () => {
      vi.mocked(prisma.approvalRequest.updateMany).mockResolvedValue({
        count: 3,
      } as any);

      const result = await expirePendingApprovals();

      expect(result).toBe(3);
      expect(prisma.approvalRequest.updateMany).toHaveBeenCalledWith({
        where: {
          status: "PENDING",
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: "EXPIRED" },
      });
    });

    it("should return 0 when none expired", async () => {
      vi.mocked(prisma.approvalRequest.updateMany).mockResolvedValue({
        count: 0,
      } as any);

      const result = await expirePendingApprovals();

      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // canSubmitForApproval
  // ==========================================================================

  describe("canSubmitForApproval", () => {
    it("should return canSubmit=true for a valid draft document", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        status: "DRAFT",
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(null);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(true);
    });

    it("should return error for non-existent document", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe("Document not found");
    });

    it("should return error for already published document", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        status: "PUBLISHED",
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe("Document is already published");
    });

    it("should return error for archived document", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        status: "ARCHIVED",
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe("Document is archived");
    });

    it("should return error when document lacks connectors", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        status: "DRAFT",
        sourceConnector: null,
        destConnector: null,
      } as any);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(false);
      expect(result.reason).toContain("source and destination connectors");
    });

    it("should return error when there is already a pending approval", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        status: "DRAFT",
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue({
        id: "approval-1",
        status: "PENDING",
      } as any);

      const result = await canSubmitForApproval(documentId);

      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe("There is already a pending approval request");
    });
  });
});
