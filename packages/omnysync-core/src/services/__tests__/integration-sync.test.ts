/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Sync Engine Tests
 *
 * Tests the core sync engine function performSync for all requested scenarios:
 * - Sync simple source → destination avec succès
 * - Document non trouvé → erreur
 * - Sync avec contenu vide
 * - Lock concurrent (SYNCING déjà actif) → rejet
 * - Timeout watchdog (reset SYNCING stale après 5 min)
 * - Échec API source → sync FAILED + version decrement
 * - Échec API destination → rollback + FAILED
 *
 * NOTE: Complementary tests exist in integration-sync-engine.test.ts.
 * This file adds the missing "destination failure" scenario and provides
 * a focused set of the 7 requested test cases.
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
  getContentfulEntry: vi.fn().mockResolvedValue({ id: "entry-1", version: 3 }),
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
import { performSync } from "../sync";

// ── Test Suite ─────────────────────────────────────────────────────────────

describe("Integration Sync Engine - performSync", () => {
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
  // Test 1: Sync simple source → destination avec succès
  // ==========================================================================

  it("should perform full sync from Google Docs to WordPress successfully", async () => {
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
    expect(result.documentId).toBe(documentId);
    // Last update should set syncStatus to SYNCED
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: documentId },
        data: expect.objectContaining({ syncStatus: "SYNCED" }),
      }),
    );
  });

  // ==========================================================================
  // Test 2: Document non trouvé → erreur
  // ==========================================================================

  it("should return error ERR_DOC_NOT_FOUND when document not found", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(false);
    expect(result.documentId).toBe(documentId);
    expect(result.error).toBe("ERR_DOC_NOT_FOUND");
  });

  // ==========================================================================
  // Test 3: Sync avec contenu vide (source retourne empty content)
  // ==========================================================================

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

  // ==========================================================================
  // Test 4: Lock concurrent (SYNCING déjà actif) → rejet
  // ==========================================================================

  it("should reject concurrent sync when document is already SYNCING", async () => {
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

  // ==========================================================================
  // Test 5: Timeout watchdog (reset SYNCING stale après 5 min)
  // ==========================================================================

  it("should auto-reset stale SYNCING status (timeout watchdog > 5 min)", async () => {
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

  // ==========================================================================
  // Test 6: Échec API source → sync FAILED + version decrement
  // ==========================================================================

  it("should handle source API failure with rollback (FAILED + version decrement)", async () => {
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

  // ==========================================================================
  // Test 7: Échec API destination → rollback + FAILED
  // ==========================================================================

  it("should handle destination API failure with rollback (FAILED + version decrement)", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      baseDocument as any,
    );
    vi.mocked(prisma.document.updateMany).mockResolvedValue({
      count: 1,
    } as any);

    // All source-side operations succeed
    vi.mocked(prisma.document.update).mockResolvedValue({} as any);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@test.com",
    } as any);

    // Make the WordPress client's createPost throw (destination failure)
    const { createWordPressClient } = await import("../wordpress");
    const mockWpClient = vi.mocked(createWordPressClient).mockReturnValueOnce({
      createPost: vi.fn().mockRejectedValue(new Error("WordPress API error")),
      updatePost: vi.fn(),
      getPost: vi.fn(),
      getCategories: vi.fn(),
    });

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
    // Verify a syncLog was created with ERROR status
    expect(prisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ERROR",
        }),
      }),
    );
  });

  // ==========================================================================
  // Test 8: Notion source to Ghost destination
  // ==========================================================================

  it("should handle Notion source to Ghost destination", async () => {
    const notionGhostDoc = {
      ...baseDocument,
      sourceConnector: {
        ...baseDocument.sourceConnector,
        type: "NOTION",
        credentials: 'enc_{"accessToken":"notion-token"}',
        config: {},
      },
      destConnector: {
        ...baseDocument.destConnector,
        type: "GHOST",
        credentials: "enc_creds",
        config: { siteUrl: "https://ghost.example.com" },
      },
    };

    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      notionGhostDoc as any,
    );
    vi.mocked(prisma.document.updateMany).mockResolvedValue({
      count: 1,
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({} as any);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@test.com",
    } as any);

    const { createGhostClient } = await import("../ghost");
    const mockCreatePost = vi
      .fn()
      .mockResolvedValue({ posts: [{ id: "post-1" }] });
    vi.mocked(createGhostClient).mockReturnValue({
      createPost: mockCreatePost,
      updatePost: vi.fn().mockResolvedValue({}),
      getPost: vi.fn(),
      getTags: vi.fn(),
    });

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(true);
    expect(createGhostClient).toHaveBeenCalled();
    expect(mockCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
    );
  });

  // ==========================================================================
  // Test 9: AI image generation failure (non-fatal)
  // ==========================================================================

  it("should handle AI image generation failure as non-fatal", async () => {
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

    // Override parseGoogleDocToHtml to return content with AI-Image placeholder
    const { parseGoogleDocToHtml } = await import("../html-parser");
    vi.mocked(parseGoogleDocToHtml).mockReturnValueOnce({
      html: "<p>[AI-Image: a cat]</p>",
      title: "Doc Title",
    });

    // Make generateAImage reject (non-fatal, should be caught and handled)
    const { generateAImage } = await import("../ai");
    vi.mocked(generateAImage).mockRejectedValueOnce(
      new Error("Image gen failed"),
    );

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(true);
  });

  // ==========================================================================
  // Test 10: Unsupported source connector type
  // ==========================================================================

  it("should handle unsupported source connector type gracefully", async () => {
    const unsupportedDoc = {
      ...baseDocument,
      sourceConnector: {
        ...baseDocument.sourceConnector,
        type: "DROPBOX_PAPER",
        credentials: null,
        config: {},
      },
    };

    vi.mocked(prisma.document.findUnique).mockResolvedValue(
      unsupportedDoc as any,
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

    // Neither Google Docs nor Notion source fetchers should be called
    const { getGoogleDocContent } = await import("../google-docs");
    const { getNotionPageContent } = await import("../notion");
    expect(getGoogleDocContent).not.toHaveBeenCalled();
    expect(getNotionPageContent).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 11: Existing slug → WordPress update path
  // ==========================================================================

  it("should handle sync with existing slug (update path for WordPress)", async () => {
    const slugDoc = {
      ...baseDocument,
      slug: "123",
    };

    vi.mocked(prisma.document.findUnique).mockResolvedValue(slugDoc as any);
    vi.mocked(prisma.document.updateMany).mockResolvedValue({
      count: 1,
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({} as any);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@test.com",
    } as any);

    const { createWordPressClient } = await import("../wordpress");
    const mockUpdatePost = vi.fn().mockResolvedValue({ id: 123 });
    vi.mocked(createWordPressClient).mockReturnValue({
      createPost: vi.fn(),
      updatePost: mockUpdatePost,
      getPost: vi.fn(),
      getCategories: vi.fn(),
    });

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(true);
    expect(mockUpdatePost).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ title: "Test Doc" }),
    );
  });

  // ==========================================================================
  // Test 12: Shopify empty blog list → silent skip
  // ==========================================================================

  it("should handle Shopify getBlogs returning empty blog list (silent skip)", async () => {
    const shopifyDoc = {
      ...baseDocument,
      destConnector: {
        ...baseDocument.destConnector,
        type: "SHOPIFY",
        credentials: "enc_creds",
        config: { shopDomain: "test.myshopify.com" },
      },
    };

    vi.mocked(prisma.document.findUnique).mockResolvedValue(shopifyDoc as any);
    vi.mocked(prisma.document.updateMany).mockResolvedValue({
      count: 1,
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({} as any);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@test.com",
    } as any);

    const { createShopifyClient } = await import("../shopify");
    const mockCreateArticle = vi.fn();
    const mockUpdateArticle = vi.fn();
    vi.mocked(createShopifyClient).mockReturnValue({
      createArticle: mockCreateArticle,
      updateArticle: mockUpdateArticle,
      getBlogs: vi.fn().mockResolvedValue({ blogs: [] }),
    });

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(true);
    expect(mockCreateArticle).not.toHaveBeenCalled();
    expect(mockUpdateArticle).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 13: Contentful destination with existing slug → update path
  // ==========================================================================

  it("should handle Contentful destination with existing slug (update path)", async () => {
    const contentfulDoc = {
      ...baseDocument,
      slug: "entry-123",
      destConnector: {
        ...baseDocument.destConnector,
        type: "CONTENTFUL",
        credentials: "enc_creds",
        config: { spaceId: "space-1", contentTypeId: "article" },
      },
    };

    // First findUnique returns the document, second returns version info
    vi.mocked(prisma.document.findUnique).mockResolvedValueOnce(
      contentfulDoc as any,
    );
    vi.mocked(prisma.document.findUnique).mockResolvedValueOnce({
      version: 2,
    } as any);

    vi.mocked(prisma.document.updateMany).mockResolvedValue({
      count: 1,
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({} as any);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@test.com",
    } as any);

    const { createContentfulEntry, updateContentfulEntry } =
      await import("../contentful");

    const result = await performSync(
      documentId,
      sourceConnectorId,
      destConnectorId,
      userId,
    );

    expect(result.success).toBe(true);
    // Update path should use updateContentfulEntry, not createContentfulEntry
    expect(createContentfulEntry).not.toHaveBeenCalled();
    expect(updateContentfulEntry).toHaveBeenCalled();
  });
});
