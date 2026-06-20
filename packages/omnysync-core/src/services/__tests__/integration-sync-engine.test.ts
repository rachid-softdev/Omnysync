/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Sync Engine Tests
 *
 * Tests the core sync engine functions directly:
 * - performSync: full sync flow, empty content, API errors, rollback, concurrent lock, timeout watchdog
 * - detectAndSyncChanges: changes detection for published docs, no changes, not published
 * - checkRemoteChanges: remote content fetching
 *
 * Pattern: use vi.hoisted() for mock variables, vi.mock() with factory functions.
 * IMPORTANT: vi.clearAllMocks() clears call history only (not implementations),
 * so per-test module-level mock overrides must use mockResolvedValueOnce to avoid leaking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  syncLog: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  userOrganization: {
    findFirst: vi.fn().mockResolvedValue({ id: "membership-1" }),
  },
}));

const mockFetchWithRetry = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
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
  }),
);

// ── Module mocks (hoisted) ─────────────────────────────────────────────────

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  decrypt: vi.fn((s: string) => s.replace("enc_", "")),
  encrypt: vi.fn((s: string) => `enc_${s}`),
}));
vi.mock("../../email", () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../http", () => ({
  fetchWithRetry: mockFetchWithRetry,
  fetchWithTimeout: vi.fn(),
}));
vi.mock("../authz", () => ({
  requireDocumentAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sanitize", () => ({
  sanitizeErrorMessage: vi.fn((e: any) => String(e)),
}));

// Mock connector modules
vi.mock("../wordpress", () => ({
  createWordPressClient: vi.fn().mockReturnValue({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn().mockResolvedValue({ id: 123 }),
    getPost: vi.fn().mockResolvedValue({
      id: 123,
      content: "Remote content",
      title: "Remote Post",
    }),
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
vi.mock("../webflow", () => ({
  createWebflowClient: vi.fn().mockReturnValue({
    createItem: vi.fn().mockResolvedValue({ items: [{ id: "item-1" }] }),
    updateItem: vi.fn().mockResolvedValue({}),
  }),
}));
vi.mock("../shopify", () => ({
  createShopifyClient: vi.fn().mockReturnValue({
    createArticle: vi.fn().mockResolvedValue({ article: { id: 456 } }),
    updateArticle: vi.fn().mockResolvedValue({}),
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: "blog-1" }] }),
  }),
}));
vi.mock("../contentful", () => ({
  createContentfulEntry: vi.fn().mockResolvedValue({ id: "entry-1" }),
  updateContentfulEntry: vi.fn().mockResolvedValue({ id: "entry-1" }),
}));

// Mock source connectors
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

// Mock AI services
vi.mock("../ai", () => ({
  generateSEO: vi.fn().mockResolvedValue({
    title: "SEO Title",
    description: "SEO Desc",
    keywords: ["kw"],
  }),
  generateExcerpt: vi.fn().mockResolvedValue("AI Excerpt"),
  findInterlinkingOpportunities: vi.fn().mockResolvedValue({ links: [] }),
  generateAImage: vi.fn().mockResolvedValue("https://image.url/img.png"),
  detectContentChanges: vi
    .fn()
    .mockResolvedValue({ hasChanges: true, summary: "Content changed" }),
}));

// Mock html-parser
vi.mock("../html-parser", () => ({
  parseMarkdownToHtml: vi.fn((md: string) => `<p>${md}</p>`),
  parseGoogleDocToHtml: vi
    .fn()
    .mockReturnValue({ html: "<p>Parsed HTML</p>", title: "Doc Title" }),
}));

import { prisma } from "../../prisma";
import { performSync, detectAndSyncChanges, checkRemoteChanges } from "../sync";

// ── Test Suite ─────────────────────────────────────────────────────────────

describe("Integration Sync Engine", () => {
  const documentId = "doc-1";
  const userId = "user-1";
  const orgId = "org-1";
  const sourceConnectorId = "sc-1";
  const destConnectorId = "dc-1";

  const baseDocument = {
    id: documentId,
    title: "Test Doc",
    slug: null,
    organizationId: orgId,
    userId,
    version: 1,
    syncStatus: "NOT_SYNCED" as const,
    status: "DRAFT" as const,
    content: "Original content",
    htmlContent: "<p>Original content</p>",
    sourceConnectorId,
    destConnectorId,
    sourceId: "source-1",
    featuredImage: null,
    sourceConnector: {
      id: sourceConnectorId,
      type: "GOOGLE_DOCS" as const,
      credentials: 'enc_{"accessToken":"token","refreshToken":"refresh"}',
      config: {},
    },
    destConnector: {
      id: destConnectorId,
      type: "WORDPRESS" as const,
      credentials: "enc_creds",
      config: { siteUrl: "https://example.com" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // performSync
  // ==========================================================================

  describe("performSync", () => {
    it("should return error when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(false);
      expect(result.documentId).toBe(documentId);
    });

    it("should return error when document is already syncing (optimistic lock)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      // updateMany returns count=0 → lock not acquired
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 0,
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("currently being synced");
    });

    it("should perform full sync from Google Docs to WordPress", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(true);
      // Verify the optimistic lock was acquired (first updateMany call)
      expect(prisma.document.updateMany).toHaveBeenNthCalledWith(
        1, // stale reset (finds nothing since NOT_SYNCED != SYNCING)
        expect.objectContaining({
          where: expect.objectContaining({ id: documentId }),
          data: expect.objectContaining({ syncStatus: "FAILED" }),
        }),
      );
      expect(prisma.document.updateMany).toHaveBeenNthCalledWith(
        2, // optimistic lock
        expect.objectContaining({
          where: expect.objectContaining({ id: documentId }),
          data: expect.objectContaining({ syncStatus: "SYNCING" }),
        }),
      );
    });

    it("should handle syncing with empty source content", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);

      // Override getGoogleDocContent to return empty content (useOnce to avoid leaking)
      const { getGoogleDocContent } = await import("../google-docs");
      vi.mocked(getGoogleDocContent).mockResolvedValueOnce({
        id: "doc-empty",
        title: "",
        content: "",
        modifiedTime: "2026-06-01T00:00:00Z",
      });

      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(true);
    });

    it("should handle API error from source connector and rollback gracefully", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);

      // Make getGoogleDocContent throw (useOnce to avoid leaking between calls)
      const { getGoogleDocContent } = await import("../google-docs");
      vi.mocked(getGoogleDocContent).mockRejectedValueOnce(
        new Error("Google API timeout"),
      );

      // The rollback update must succeed
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(false);
      // Verify rollback occurred: version decremented, status set to FAILED
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: documentId },
          data: expect.objectContaining({
            syncStatus: "FAILED",
            version: { decrement: 1 },
          }),
        }),
      );
    });

    it("should auto-reset stale SYNCING status (timeout watchdog)", async () => {
      // Document stuck in SYNCING for >5 minutes
      const staleDoc = {
        ...baseDocument,
        syncStatus: "SYNCING",
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
        version: 3,
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(staleDoc as any);

      // First updateMany resets stale SYNCING → FAILED (count=1)
      // Second updateMany acquires optimistic lock (count=1)
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);

      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(true);

      // Verify stale reset was called with the right time-bounded where clause
      expect(prisma.document.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            id: documentId,
            syncStatus: "SYNCING",
            updatedAt: expect.any(Object),
          }),
          data: expect.objectContaining({ syncStatus: "FAILED" }),
        }),
      );
    });

    it("should not reset SYNCING if it was set less than 5 minutes ago", async () => {
      const recentDoc = {
        ...baseDocument,
        syncStatus: "SYNCING",
        updatedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago — still fresh
        version: 3,
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(recentDoc as any);

      // updateMany for stale reset should match 0 rows (recent SYNCING not stale)
      vi.mocked(prisma.document.updateMany)
        .mockResolvedValueOnce({ count: 0 } as any) // stale reset finds nothing
        .mockResolvedValueOnce({ count: 0 } as any); // optimistic lock fails too

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("currently being synced");
    });

    it("should sync with Notion source to Ghost destination", async () => {
      const notionDoc = {
        ...baseDocument,
        sourceConnector: {
          id: sourceConnectorId,
          type: "NOTION" as const,
          credentials: 'enc_{"accessToken":"notion-token"}',
          config: {},
        },
        destConnector: {
          id: destConnectorId,
          type: "GHOST" as const,
          credentials: "enc_ghost-creds",
          config: { siteUrl: "https://myghost.com" },
        },
      };

      vi.mocked(prisma.document.findUnique).mockResolvedValue(notionDoc as any);
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // detectAndSyncChanges
  // ==========================================================================

  describe("detectAndSyncChanges", () => {
    it("should return error when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await detectAndSyncChanges(documentId, userId);

      expect(result.success).toBe(false);
    });

    it("should return error when document is not published", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        status: "DRAFT",
      } as any);

      const result = await detectAndSyncChanges(documentId, userId);

      expect(result.success).toBe(false);
    });

    it("should sync when changes detected for published doc", async () => {
      // First call in detectAndSyncChanges, then again in performSync
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        status: "PUBLISHED",
        sourceConnectorId,
        destConnectorId,
        sourceConnector: baseDocument.sourceConnector,
        destConnector: baseDocument.destConnector,
      } as any);
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const result = await detectAndSyncChanges(documentId, userId);

      expect(result.success).toBe(true);
    });

    it("should return no changes when content has not changed", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        status: "PUBLISHED",
        content: "Same content",
        sourceConnector: baseDocument.sourceConnector,
        destConnector: baseDocument.destConnector,
      } as any);

      // Override detectContentChanges to return no changes (useOnce to avoid leaking)
      const { detectContentChanges } = await import("../ai");
      vi.mocked(detectContentChanges).mockResolvedValueOnce({
        hasChanges: false,
        summary: "No changes",
      });

      const result = await detectAndSyncChanges(documentId, userId);

      expect(result.success).toBe(true);
      expect(result.changesDetected).toBe(false);
    });
  });

  // ==========================================================================
  // checkRemoteChanges
  // ==========================================================================

  describe("checkRemoteChanges", () => {
    it("should return null when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeNull();
    });

    it("should return null when no dest connector", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: null,
      } as any);

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeNull();
    });

    it("should fetch remote post for WordPress destination", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        slug: "123",
        destConnector: {
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("title");
    });

    it("should fetch remote post for Ghost destination", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        slug: "post-slug",
        destConnector: {
          type: "GHOST",
          credentials: "enc_creds",
          config: { siteUrl: "https://myghost.com" },
        },
      } as any);

      // Override getPost to return Ghost data (useOnce to avoid leaking)
      const { createGhostClient } = await import("../ghost");
      vi.mocked(createGhostClient).mockReturnValueOnce({
        getPost: vi.fn().mockResolvedValue({
          posts: [
            {
              html: "<p>Ghost content</p>",
              title: "Ghost Post",
              updated_at: "2026-06-01",
            },
          ],
        }),
        createPost: vi.fn(),
        updatePost: vi.fn(),
        getTags: vi.fn(),
      });

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeDefined();
      expect(createGhostClient).toHaveBeenCalled();
    });
  });
});
