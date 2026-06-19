/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Org Service Tests
 *
 * Tests for getUserOrgId:
 * - Membership exists → return existing organizationId
 * - No membership → auto-create "Personal" org and return new id
 * - Prisma error propagates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// MOCKS
// ============================================================================

const mockPrisma = vi.hoisted(() => ({
  userOrganization: {
    findFirst: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({
  prisma: mockPrisma,
}));

import { getUserOrgId } from "../org";

// ============================================================================
// TESTS
// ============================================================================

describe("getUserOrgId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the existing organizationId when membership is found", async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({
      organizationId: "org-existing-123",
      organization: {
        id: "org-existing-123",
        name: "My Team",
      },
    });

    const result = await getUserOrgId("user-42");

    expect(result).toBe("org-existing-123");
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
  });

  it("should create a Personal organization when no membership exists and return its id", async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({ id: "org-new-789" });

    const result = await getUserOrgId("user-new");

    expect(mockPrisma.organization.create).toHaveBeenCalledWith({
      data: {
        name: "Personal",
        users: {
          create: {
            userId: "user-new",
            role: "OWNER",
          },
        },
      },
    });
    expect(result).toBe("org-new-789");
  });

  it("should propagate Prisma errors", async () => {
    const dbError = new Error("Database connection failed");
    mockPrisma.userOrganization.findFirst.mockRejectedValue(dbError);

    await expect(getUserOrgId("user-err")).rejects.toThrow(
      "Database connection failed",
    );
  });
});
