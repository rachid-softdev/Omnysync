/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  syncLog: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  userOrganization: {
    findFirst: vi.fn().mockResolvedValue({ id: "membership-1" }),
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  decrypt: vi.fn((s) => s.replace("enc_", "")),
}));
vi.mock("../../email", () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../http", () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    // Google Docs API response shape expected by getGoogleDocContent
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
  fetchWithTimeout: vi.fn(),
}));
vi.mock("../authz", () => ({
  requireDocumentAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sanitize", () => ({
  sanitizeErrorMessage: vi.fn((e) => String(e)),
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

// Mock source connectors (needed by sync.ts for fetching source content)
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

// Mock AI services (used inside enrichContentWithAI/generateAIImages via dynamic import)
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

// Mock html-parser (used via dynamic import)
vi.mock("../html-parser", () => ({
  parseMarkdownToHtml: vi.fn((md) => `<p>${md}</p>`),
  parseGoogleDocToHtml: vi
    .fn()
    .mockReturnValue({ html: "<p>Parsed HTML</p>", title: "Doc Title" }),
}));

import { prisma } from "../../prisma";
import { performSync, detectAndSyncChanges, checkRemoteChanges } from "../sync";

describe("Sync Service", () => {
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
    syncStatus: "NOT_SYNCED",
    status: "DRAFT",
    content: "Original content",
    htmlContent: "<p>Original content</p>",
    sourceConnectorId,
    destConnectorId,
    sourceId: "source-1",
    featuredImage: null,
    sourceConnector: {
      id: sourceConnectorId,
      type: "GOOGLE_DOCS",
      credentials: 'enc_{"accessToken":"token","refreshToken":"refresh"}',
      config: {},
    },
    destConnector: {
      id: destConnectorId,
      type: "WORDPRESS",
      credentials: "enc_creds",
      config: { siteUrl: "https://example.com" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it("should return error when document is already syncing", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
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

    it("should perform full sync for Google Docs source to WordPress destination", async () => {
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
      expect(prisma.document.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: documentId }),
          data: expect.objectContaining({ syncStatus: "SYNCING" }),
        }),
      );
    });

    it("should handle sync failure and update status to FAILED", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      // First update call (saving content + AI enrichment) throws, simulating a failure.
      // Second update call (inside catch block, setting syncStatus to FAILED) must succeed.
      vi.mocked(prisma.document.update)
        .mockRejectedValueOnce(new Error("Update failed"))
        .mockResolvedValue({} as any);

      const result = await performSync(
        documentId,
        sourceConnectorId,
        destConnectorId,
        userId,
      );

      expect(result.success).toBe(false);
    });
  });

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
  });

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

    it("should fetch remote post for WordPress", async () => {
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
    });
  });
});
