/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  document: { count: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

import {
  paginate,
  cursorPaginate,
  createPaginationParams,
  createCursorParams,
  paginatedResponse,
  cursorResponse,
  paginationSchema,
  cursorPaginationSchema,
} from "../index";

describe("Pagination module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // createPaginationParams
  // ============================================================
  describe("createPaginationParams", () => {
    it("returns skip=0 take=20 for page 1 with defaults", () => {
      const result = createPaginationParams({});
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it("calculates skip correctly for page 2", () => {
      const result = createPaginationParams({ page: 2, limit: 10 });
      expect(result.skip).toBe(10);
      expect(result.take).toBe(10);
    });

    it("caps limit at 100", () => {
      const result = createPaginationParams({ limit: 999 });
      expect(result.take).toBe(100);
    });

    it("uses page 1 when page is undefined", () => {
      const result = createPaginationParams({ limit: 50 });
      expect(result.skip).toBe(0);
    });

    it("accepts custom default limit", () => {
      const result = createPaginationParams({}, 50);
      expect(result.take).toBe(50);
    });
  });

  // ============================================================
  // createCursorParams
  // ============================================================
  describe("createCursorParams", () => {
    it("returns default take when no params", () => {
      const result = createCursorParams({});
      expect(result.take).toBe(20);
      expect(result.cursorValue).toBeUndefined();
    });

    it("passes cursor value through", () => {
      const result = createCursorParams({ cursor: "abc123", limit: 50 });
      expect(result.take).toBe(50);
      expect(result.cursorValue).toBe("abc123");
    });

    it("caps limit at 100", () => {
      const result = createCursorParams({ limit: 200 });
      expect(result.take).toBe(100);
    });
  });

  // ============================================================
  // paginatedResponse
  // ============================================================
  describe("paginatedResponse", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const pagination = {
      total: 50,
      page: 2,
      limit: 20,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    };

    it("formats response with _links", () => {
      const result = paginatedResponse(data, pagination);
      expect(result.data).toEqual(data);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination._links.next).toEqual({ page: 3 });
      expect(result.pagination._links.previous).toEqual({ page: 1 });
    });

    it("sets _links to null when no next/previous", () => {
      const result = paginatedResponse([], {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
      expect(result.pagination._links.next).toBeNull();
      expect(result.pagination._links.previous).toBeNull();
    });
  });

  // ============================================================
  // cursorResponse
  // ============================================================
  describe("cursorResponse", () => {
    it("formats cursor response with data and metadata", () => {
      const result = cursorResponse([{ id: "1" }], "cursor-abc", true);
      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe("cursor-abc");
      expect(result.hasMore).toBe(true);
    });

    it("handles undefined hasMore", () => {
      const result = cursorResponse([]);
      expect(result.hasMore).toBeUndefined();
    });
  });

  // ============================================================
  // cursorPaginate
  // ============================================================
  describe("cursorPaginate", () => {
    it("returns items with hasMore=false when fewer than limit", async () => {
      const getItems = vi.fn().mockResolvedValue({
        items: [{ id: "1" }, { id: "2" }],
      });
      const result = await cursorPaginate(getItems, 5);
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
      expect(getItems).toHaveBeenCalledWith(6, undefined); // limit + 1
    });

    it("returns hasMore=true when more items available", async () => {
      const items = Array.from({ length: 6 }, (_, i) => ({
        id: `item-${i + 1}`,
      }));
      const getItems = vi.fn().mockResolvedValue({
        items,
        nextCursor: "cursor-next",
      });
      const result = await cursorPaginate(getItems, 5);
      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("cursor-next");
    });

    it("passes cursor to getItems", async () => {
      const getItems = vi.fn().mockResolvedValue({ items: [] });
      await cursorPaginate(getItems, 20, "prev-cursor");
      expect(getItems).toHaveBeenCalledWith(21, "prev-cursor");
    });
  });

  // ============================================================
  // paginate (uses prisma)
  // ============================================================
  describe("paginate", () => {
    it("returns paginated results using prisma", async () => {
      const mockData = [{ id: "doc-1", title: "Doc 1" }];
      mockPrisma.$queryRaw.mockResolvedValue(mockData);
      mockPrisma.document.count.mockResolvedValue(25);

      const result = await paginate(
        { skip: 0, take: 20, where: { organizationId: "org-1" } },
        { organizationId: "org-1" },
      );

      expect(result.data).toEqual(mockData);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it("handles last page correctly", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "doc-21" }]);
      mockPrisma.document.count.mockResolvedValue(21);

      const result = await paginate(
        { skip: 20, take: 20, where: { organizationId: "org-1" } },
        { organizationId: "org-1" },
      );

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it("throws when prisma fails", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      await expect(
        paginate(
          { skip: 0, take: 20, where: { organizationId: "org-1" } },
          { organizationId: "org-1" },
        ),
      ).rejects.toThrow("DB error");
    });
  });

  // ============================================================
  // Zod schemas
  // ============================================================
  describe("paginationSchema (Zod)", () => {
    it("parses valid input", () => {
      const result = paginationSchema.parse({ page: "2", limit: "50" });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it("rejects page < 1", () => {
      expect(() => paginationSchema.parse({ page: "0" })).toThrow();
    });

    it("rejects limit > 100", () => {
      expect(() => paginationSchema.parse({ limit: "101" })).toThrow();
    });
  });

  describe("cursorPaginationSchema (Zod)", () => {
    it("parses valid input", () => {
      const result = cursorPaginationSchema.parse({
        cursor: "abc",
        limit: "10",
      });
      expect(result.cursor).toBe("abc");
      expect(result.limit).toBe(10);
    });

    it("cursor is optional", () => {
      const result = cursorPaginationSchema.parse({});
      expect(result.cursor).toBeUndefined();
      expect(result.limit).toBe(20);
    });
  });
});
