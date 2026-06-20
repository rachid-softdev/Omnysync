/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn() },
  userOrganization: { findFirst: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

import { prisma } from "../../prisma";
import { requireDocumentAccess, UnauthorizedError } from "../authz";

describe("authz / requireDocumentAccess", () => {
  const documentId = "doc-1";
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve when user is a member of the document's organization", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
      id: "membership-1",
    } as any);

    await expect(
      requireDocumentAccess(documentId, userId),
    ).resolves.toBeUndefined();
    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: documentId },
      select: { organizationId: true },
    });
    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith({
      where: { userId, organizationId: "org-1" },
    });
  });

  it("should throw UnauthorizedError when document is not found", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      "Access denied",
    );
  });

  it("should throw UnauthorizedError when user is not in the organization", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("should throw on prisma error", async () => {
    vi.mocked(prisma.document.findUnique).mockRejectedValue(
      new Error("DB error"),
    );

    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      "DB error",
    );
  });

  it("should throw UnauthorizedError when document has null organizationId", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      organizationId: null,
    } as any);
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      UnauthorizedError,
    );
    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith({
      where: { userId, organizationId: null },
    });
  });

  it("should throw UnauthorizedError with empty documentId", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    await expect(requireDocumentAccess("", userId)).rejects.toThrow(
      UnauthorizedError,
    );
    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: "" },
      select: { organizationId: true },
    });
  });

  it("should throw UnauthorizedError with empty userId", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

    await expect(requireDocumentAccess(documentId, "")).rejects.toThrow(
      UnauthorizedError,
    );
    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith({
      where: { userId: "", organizationId: "org-1" },
    });
  });

  it("should propagate prisma error on userOrganization query", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.userOrganization.findFirst).mockRejectedValue(
      new Error("DB constraint violation"),
    );

    await expect(requireDocumentAccess(documentId, userId)).rejects.toThrow(
      "DB constraint violation",
    );
  });
});
