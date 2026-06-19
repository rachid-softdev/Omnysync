/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

// These need vi.hoisted because vi.mock factories are hoisted
const mockHttpResponse = vi.hoisted(() => ({
  body: {
    content: [
      {
        paragraph: {
          elements: [{ textRun: { content: "Hello World", textStyle: {} } }],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
    ],
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ decrypt: vi.fn((s) => s.replace("enc_", "")) }));
vi.mock("../../http", () => ({
  // Return valid Google Docs API response so the real getGoogleDocContent works
  fetchWithRetry: vi.fn().mockResolvedValue(mockHttpResponse),
  fetchWithTimeout: vi.fn(),
}));
vi.mock("../../audit", () => ({
  auditSync: {
    completed: vi.fn(),
    failed: vi.fn(),
    changesDetected: vi.fn(),
  },
}));
vi.mock("../authz", () => ({ requireDocumentAccess: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../sanitize", () => ({ sanitizeErrorMessage: vi.fn((e) => String(e)) }));
// Mock connector modules statically imported by two-way-sync.ts
vi.mock("../google-docs", () => ({
  getGoogleDocContent: vi.fn().mockResolvedValue({
    id: "doc-1",
    title: "Google Doc",
    content: "Hello World",
    modifiedTime: "2026-06-01T00:00:00Z",
  }),
}));
vi.mock("../notion", () => ({
  getNotionPageContent: vi.fn().mockResolvedValue({
    id: "page-1",
    title: "Notion Page",
    content: "## Hello\n\nWorld",
    createdTime: "2026-01-01",
    lastEditedTime: "2026-06-01",
  }),
}));
vi.mock("../wordpress", () => ({
  createWordPressClient: vi.fn().mockReturnValue({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn().mockResolvedValue({ id: 123 }),
    getPost: vi.fn().mockResolvedValue({ id: 123, content: "Remote content", title: "Remote Post" }),
    getCategories: vi.fn(),
  }),
}));
vi.mock("../ghost", () => ({
  createGhostClient: vi.fn().mockReturnValue({
    createPost: vi.fn().mockResolvedValue({ posts: [{ id: "post-1" }] }),
    updatePost: vi.fn().mockResolvedValue({}),
    getPost: vi.fn(),
    getTags: vi.fn(),
  }),
}));
vi.mock("../shopify", () => ({
  createShopifyClient: vi.fn().mockReturnValue({
    createArticle: vi.fn().mockResolvedValue({ article: { id: 456 } }),
    updateArticle: vi.fn().mockResolvedValue({}),
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: "blog-1" }] }),
  }),
}));
// Mock sync module (dynamically imported by syncFromSource)
vi.mock("../sync", () => ({
  performSync: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../../prisma";
import {
  detectConflicts,
  syncFromSource,
  syncFromDest,
  resolveConflict,
  checkAndAutoSync,
} from "../two-way-sync";

describe("Two-Way Sync Service", () => {
  const documentId = "doc-1";
  const userId = "user-1";
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectConflicts", () => {
    it("should return no conflict when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await detectConflicts(documentId);

      expect(result.hasConflict).toBe(false);
    });

    it("should return no conflict when no destination content exists", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        htmlContent: "Stored content",
        content: "Stored content",
        sourceUpdatedAt: new Date("2026-06-01"),
        lastSyncedAt: new Date("2026-06-01"),
        sourceConnector: null,
        sourceConnectorId: "sc-1",
        sourceId: "source-1",
        destConnector: null,
      } as any);

      const result = await detectConflicts(documentId);

      expect(result.hasConflict).toBe(false);
    });
  });

  describe("syncFromSource", () => {
    it("should return error when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await syncFromSource(documentId, userId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Document not found");
    });

    it("should sync from source to destination", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        sourceConnector: { id: "sc-1", type: "GOOGLE_DOCS", credentials: "enc_{}", config: {} },
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
        sourceId: "source-1",
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await syncFromSource(documentId, userId);

      expect(result.success).toBe(true);
      expect(result.direction).toBe("source-to-dest");
    });
  });

  describe("syncFromDest", () => {
    it("should return error for non-Notion source", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        sourceConnector: { type: "GOOGLE_DOCS" },
        destConnector: { type: "WORDPRESS" },
      } as any);

      const result = await syncFromDest(documentId, userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Reverse sync not supported");
    });

    it("should sync from dest to source for Notion", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
        sourceConnector: { id: "sc-1", type: "NOTION" },
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
        sourceId: "source-1",
        slug: "123",
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await syncFromDest(documentId, userId);

      expect(result.success).toBe(true);
      expect(result.direction).toBe("dest-to-source");
    });
  });

  describe("resolveConflict", () => {
    it("should return not found when document missing", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await resolveConflict(documentId, "source-wins", userId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Document not found");
    });
  });

  describe("checkAndAutoSync", () => {
    it("should return no changes when no conflict", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        organizationId: orgId,
      } as any);

      const result = await checkAndAutoSync(documentId, userId);

      expect(result.success).toBe(true);
      expect(result.changesDetected).toBe(false);
      expect(result.message).toBe("No changes detected");
    });
  });
});
