/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Permissions Service Tests
 *
 * Comprehensive RBAC tests covering:
 * - getUserRole: role lookup and lowercasing
 * - hasPermission: RBAC matrix checks with cache
 * - requirePermission: authorization wrapper
 * - withPermission: middleware-style checker
 * - getUserPermissions: full permission set per role
 * - canAccessResource: resource-level access control
 * - checkPermission: throw-on-failure helper
 * - filterByPermission: item-level filtering
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// MOCKS
// ============================================================================

const mockPrisma = vi.hoisted(() => ({
  userOrganization: {
    findUnique: vi.fn(),
  },
  document: {
    findFirst: vi.fn(),
  },
  connector: {
    findFirst: vi.fn(),
  },
}));

const mockCache = vi.hoisted(() => ({
  getOrSet: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../cache", () => ({
  cache: mockCache,
}));

import {
  getUserRole,
  hasPermission,
  requirePermission,
  withPermission,
  getUserPermissions,
  canAccessResource,
  checkPermission,
  filterByPermission,
  type Permission,
} from "../permissions";

// ============================================================================
// HELPERS
// ============================================================================

/** Make cache.getOrSet behave as a transparent passthrough that calls the fn. */
function stubCachePassthrough() {
  mockCache.getOrSet.mockImplementation(
    (_key: string, fn: () => Promise<boolean>) => fn(),
  );
}

// ============================================================================
// getUserRole
// ============================================================================

describe("getUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the role in lowercase when membership is found", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const role = await getUserRole("user-1", "org-1");

    expect(role).toBe("owner");
  });

  it("should return null when no membership exists", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

    const role = await getUserRole("user-unknown", "org-1");

    expect(role).toBeNull();
  });
});

// ============================================================================
// hasPermission
// ============================================================================

describe("hasPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCachePassthrough();
  });

  it("should return true when the role has the requested permission (owner + document:delete)", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const result = await hasPermission("user-1", "org-1", "document:delete");

    expect(result).toBe(true);
  });

  it("should return false when the role does not have the requested permission (viewer + document:delete)", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const result = await hasPermission("user-1", "org-1", "document:delete");

    expect(result).toBe(false);
  });

  it("should return false when no role is found for the user", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

    const result = await hasPermission(
      "user-unknown",
      "org-1",
      "document:read",
    );

    expect(result).toBe(false);
  });

  it("should call cache.getOrSet with the correct cache key and TTL", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    await hasPermission("user-1", "org-1", "document:read");

    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      expect.stringContaining("perm:user-1:org-1:document:read"),
      expect.any(Function),
      30, // 30 secondes — TTL réduit
    );
  });
});

// ============================================================================
// requirePermission
// ============================================================================

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCachePassthrough();
  });

  it("should return authorized true with userId when permission is granted", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const result = await requirePermission("document:read", "org-1", "user-1");

    expect(result).toEqual({
      authorized: true,
      userId: "user-1",
    });
  });

  it("should return authorized false with error message when permission is denied", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const result = await requirePermission(
      "document:delete",
      "org-1",
      "user-1",
    );

    expect(result.authorized).toBe(false);
    expect(result.error).toContain("document:delete");
  });

  it("should return authorized false when userId is empty", async () => {
    const result = await requirePermission("document:read", "org-1", "");

    expect(result).toEqual({
      authorized: false,
      error: "Non autorisé",
    });
  });
});

// ============================================================================
// withPermission
// ============================================================================

describe("withPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCachePassthrough();
  });

  it("should return userId when permission is granted", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const check = withPermission("document:read");
    const result = await check("org-1", "user-1");

    expect(result).toBe("user-1");
  });

  it("should throw an Error when permission is denied", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const check = withPermission("document:delete");

    await expect(check("org-1", "user-1")).rejects.toThrow("document:delete");
  });
});

// ============================================================================
// getUserPermissions
// ============================================================================

describe("getUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all permissions for an owner", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const permissions = await getUserPermissions("user-1", "org-1");

    // Owner has every permission
    expect(permissions).toContain("document:read");
    expect(permissions).toContain("document:delete");
    expect(permissions).toContain("document:publish");
    expect(permissions).toContain("connector:create");
    expect(permissions).toContain("billing:manage");
    expect(permissions).toContain("team:remove");
    expect(permissions).toContain("settings:update");
    expect(permissions).toContain("webhook:create");
    expect(permissions).toContain("apikey:delete");
    expect(permissions).toContain("approval:manage");
  });

  it("should return read-only permissions for a viewer", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const permissions = await getUserPermissions("user-1", "org-1");

    expect(permissions).toContain("document:read");
    expect(permissions).toContain("connector:read");
    expect(permissions).toContain("sync:read");
    expect(permissions).toContain("team:read");
    expect(permissions).toContain("analytics:read");

    expect(permissions).not.toContain("document:create");
    expect(permissions).not.toContain("document:delete");
    expect(permissions).not.toContain("connector:create");
    expect(permissions).not.toContain("sync:create");
    expect(permissions).not.toContain("billing:read");
  });

  it("should return an empty array when no role is found", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

    const permissions = await getUserPermissions("user-unknown", "org-1");

    expect(permissions).toEqual([]);
  });
});

// ============================================================================
// canAccessResource
// ============================================================================

describe("canAccessResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true for owner regardless of resource", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const result = await canAccessResource(
      "user-1",
      "org-1",
      "document",
      "any-doc",
      "delete",
    );

    expect(result).toBe(true);
  });

  it("should return true for admin regardless of resource", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "ADMIN",
    });

    const result = await canAccessResource(
      "user-1",
      "org-1",
      "connector",
      "any-conn",
      "update",
    );

    expect(result).toBe(true);
  });

  it("should return true for member when the document belongs to the org", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "MEMBER",
    });
    mockPrisma.document.findFirst.mockResolvedValue({
      id: "doc-1",
      userId: "user-1",
    });

    const result = await canAccessResource(
      "user-1",
      "org-1",
      "document",
      "doc-1",
      "read",
    );

    expect(result).toBe(true);
    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-1", organizationId: "org-1" },
      select: { userId: true },
    });
  });

  it("should return false for member when the document is not found in the org", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "MEMBER",
    });
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const result = await canAccessResource(
      "user-1",
      "org-1",
      "document",
      "doc-unknown",
      "read",
    );

    expect(result).toBe(false);
  });

  it("should return false for member when the connector is not found in the org", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "MEMBER",
    });
    mockPrisma.connector.findFirst.mockResolvedValue(null);

    const result = await canAccessResource(
      "user-1",
      "org-1",
      "connector",
      "conn-unknown",
      "read",
    );

    expect(result).toBe(false);
  });

  it("should check sync access based on role permissions for member", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "MEMBER",
    });

    const readResult = await canAccessResource(
      "user-1",
      "org-1",
      "sync",
      "sync-1",
      "read",
    );
    expect(readResult).toBe(true);

    const deleteResult = await canAccessResource(
      "user-1",
      "org-1",
      "sync",
      "sync-1",
      "delete",
    );
    expect(deleteResult).toBe(false);
  });

  it("should return false when no role is found", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

    const result = await canAccessResource(
      "user-unknown",
      "org-1",
      "document",
      "doc-1",
      "read",
    );

    expect(result).toBe(false);
  });
});

// ============================================================================
// checkPermission
// ============================================================================

describe("checkPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCachePassthrough();
  });

  it("should return userId when permission is granted", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const result = await checkPermission("org-1", "document:read", "user-1");

    expect(result).toBe("user-1");
  });

  it("should throw an Error when permission is denied", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    await expect(
      checkPermission("org-1", "document:delete", "user-1"),
    ).rejects.toThrow("document:delete");
  });
});

// ============================================================================
// filterByPermission
// ============================================================================

describe("filterByPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCachePassthrough();
  });

  it("should return all items when the user has the permission", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "OWNER",
    });

    const items = [
      { id: "1", organizationId: "org-1", userId: "user-1" },
      { id: "2", organizationId: "org-1", userId: "user-2" },
    ];

    const result = await filterByPermission(
      "user-1",
      "org-1",
      items,
      "document:read" as Permission,
    );

    expect(result).toEqual(items);
  });

  it("should filter items by userId when the user does not have the permission", async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({
      role: "VIEWER",
    });

    const items = [
      { id: "1", organizationId: "org-1", userId: "user-1" },
      { id: "2", organizationId: "org-1", userId: "user-2" },
    ];

    const result = await filterByPermission(
      "user-1",
      "org-1",
      items,
      "document:delete" as Permission,
    );

    expect(result).toEqual([
      { id: "1", organizationId: "org-1", userId: "user-1" },
    ]);
  });
});
