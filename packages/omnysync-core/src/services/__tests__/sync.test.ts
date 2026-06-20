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
  getContentfulEntry: vi.fn().mockResolvedValue({ id: "entry-1", version: 3 }),
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
import { generateSEO, findInterlinkingOpportunities } from "../ai";
import { sendSyncCompleteEmail } from "../../email";
import { createWordPressClient } from "../wordpress";
import { createWebflowClient } from "../webflow";
import { createShopifyClient } from "../shopify";
import { createGhostClient } from "../ghost";
import { createContentfulEntry } from "../contentful";
import { getGoogleDocContent } from "../google-docs";
import { getNotionPageContent } from "../notion";

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

    it("should continue sync when AI SEO enrichment fails (partial failure)", async () => {
      vi.mocked(generateSEO).mockRejectedValue(new Error("AI SEO failed"));
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
    });

    it("should continue sync when AI interlinking fails", async () => {
      vi.mocked(findInterlinkingOpportunities).mockRejectedValue(
        new Error("AI interlinking failed"),
      );
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
    });

    it("should continue sync when sendSyncCompleteEmail fails on success path", async () => {
      vi.mocked(sendSyncCompleteEmail).mockRejectedValue(
        new Error("Email failed"),
      );
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
    });

    it("should handle nested rollback failure when catch-block update throws", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        slug: "123",
      } as any);
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.document.update)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error("Status update failed"))
        .mockRejectedValueOnce(new Error("Rollback update failed"));
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
      expect(result.error).toContain("ERR_API_FAILED");
    });

    it("should sync Notion source to WordPress destination", async () => {
      const notionDoc = {
        ...baseDocument,
        sourceConnector: {
          ...baseDocument.sourceConnector,
          type: "NOTION",
          credentials: 'enc_{"accessToken":"token"}',
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
      expect(getNotionPageContent).toHaveBeenCalled();
      const htmlParserModule = await import("../html-parser");
      expect(htmlParserModule.parseMarkdownToHtml).toHaveBeenCalledWith(
        "## Hello\n\nWorld",
      );
      expect(prisma.document.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            htmlContent: "<p>## Hello\n\nWorld</p>",
          }),
        }),
      );
    });

    it("should sync Google Docs source to Webflow destination", async () => {
      const webflowDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "WEBFLOW",
          credentials: "enc_creds",
          config: { siteId: "site-1", collectionId: "coll-1" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        webflowDoc as any,
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
      expect(createWebflowClient).toHaveBeenCalled();
      const webflowClient =
        vi.mocked(createWebflowClient).mock.results[0].value;
      expect(webflowClient.createItem).toHaveBeenCalled();
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: "item-1" }),
        }),
      );
    });

    it("should sync Google Docs source to Shopify destination", async () => {
      const shopifyDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "SHOPIFY",
          credentials: "enc_creds",
          config: { shopDomain: "test.myshopify.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        shopifyDoc as any,
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
      expect(createShopifyClient).toHaveBeenCalledWith(
        "test.myshopify.com",
        "creds",
      );
      const shopifyClient =
        vi.mocked(createShopifyClient).mock.results[0].value;
      expect(shopifyClient.getBlogs).toHaveBeenCalled();
      expect(shopifyClient.createArticle).toHaveBeenCalledWith(
        "blog-1",
        expect.any(Object),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: "456" }),
        }),
      );
    });

    it("should sync Google Docs source to Contentful destination", async () => {
      const contentfulDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "CONTENTFUL",
          credentials: "enc_creds",
          config: { spaceId: "space-1", contentTypeId: "article" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        contentfulDoc as any,
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
      expect(createContentfulEntry).toHaveBeenCalledWith(
        "creds",
        "space-1",
        "article",
        expect.objectContaining({
          title: { "en-US": expect.any(String) },
          body: { "en-US": expect.any(String) },
          slug: { "en-US": expect.any(String) },
        }),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: "entry-1" }),
        }),
      );
    });

    it("should sync Google Docs source to Ghost destination", async () => {
      const ghostDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "GHOST",
          credentials: "enc_creds",
          config: { siteUrl: "https://ghost.example.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(ghostDoc as any);
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
      const ghostClient = vi.mocked(createGhostClient).mock.results[0].value;
      expect(ghostClient.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: "post-1" }),
        }),
      );
    });

    it("should generate AI image from content placeholder", async () => {
      // Override the HTML parser to return content with an AI image placeholder
      const htmlParserModule = await import("../html-parser");
      vi.mocked(htmlParserModule.parseGoogleDocToHtml).mockReturnValue({
        html: "<p>Parsed HTML [AI-Image: a cat playing piano]</p>",
        title: "Doc Title",
      });

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
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            featuredImage: "https://image.url/img.png",
          }),
        }),
      );
    });

    it("should continue sync when AI image generation fails", async () => {
      // Make generateAImage reject
      const aiModule = await import("../ai");
      vi.mocked(aiModule.generateAImage).mockRejectedValue(
        new Error("AI image failed"),
      );

      // Override HTML parser to return content with an AI image placeholder
      const htmlParserModule = await import("../html-parser");
      vi.mocked(htmlParserModule.parseGoogleDocToHtml).mockReturnValue({
        html: "<p>Parsed HTML [AI-Image: something]</p>",
        title: "Doc Title",
      });

      const docWithImage = {
        ...baseDocument,
        featuredImage: "https://existing.image/img.png",
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        docWithImage as any,
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
      // featuredImage should fall back to the existing value, not be overwritten
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            featuredImage: "https://existing.image/img.png",
          }),
        }),
      );
    });

    it("should fall back to plain text excerpt when AI generation fails", async () => {
      // Make generateExcerpt reject inside enrichContentWithAI
      const aiModule = await import("../ai");
      vi.mocked(aiModule.generateExcerpt).mockRejectedValue(
        new Error("AI excerpt failed"),
      );

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
      // Verify excerpt is a string and not the default "AI Excerpt"
      const updateCalls = vi.mocked(prisma.document.update).mock.calls;
      const firstUpdateData = updateCalls[0][0]?.data as Record<
        string,
        unknown
      >;
      expect(firstUpdateData).toBeDefined();
      expect(firstUpdateData.excerpt).toEqual(expect.any(String));
      expect(firstUpdateData.excerpt).not.toBe("AI Excerpt");
    });

    it("should auto-reset stale SYNCING status on sync start", async () => {
      const staleDoc = {
        ...baseDocument,
        syncStatus: "SYNCING",
        updatedAt: new Date("2024-01-01"),
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(staleDoc as any);
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
      // First updateMany call should have the stale SYNCING reset query
      expect(prisma.document.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            syncStatus: "SYNCING",
          }),
        }),
      );
    });

    it("should send failure email when sync fails in catch block", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      // First update call (step 4) fails, catch block update succeeds
      vi.mocked(prisma.document.update)
        .mockRejectedValueOnce(new Error("Update failed"))
        .mockResolvedValue({} as any);
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
      // Catch block should attempt to send failure email
      expect(sendSyncCompleteEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        false,
      );
      // Catch block should update syncStatus to FAILED
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            syncStatus: "FAILED",
          }),
        }),
      );
    });

    it("should handle source with no recognized type (empty content)", async () => {
      const dropboxDoc = {
        ...baseDocument,
        sourceConnector: {
          ...baseDocument.sourceConnector,
          type: "DROPBOX_PAPER",
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        dropboxDoc as any,
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
      expect(getGoogleDocContent).not.toHaveBeenCalled();
      expect(getNotionPageContent).not.toHaveBeenCalled();
    });

    it("should handle concurrent sync requests with optimistic locking (race condition)", async () => {
      let optimisticLockTaken = false;
      vi.mocked(prisma.document.updateMany).mockImplementation(async (args) => {
        const data = args.data as Record<string, unknown>;
        // Optimistic locking call: syncStatus: "SYNCING" with version increment
        if (
          data &&
          data.syncStatus === "SYNCING" &&
          (data as any).version?.increment
        ) {
          if (optimisticLockTaken) return { count: 0 } as any;
          optimisticLockTaken = true;
          return { count: 1 } as any;
        }
        return { count: 1 } as any;
      });

      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as any,
      );
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "user@test.com",
      } as any);

      const [result1, result2] = await Promise.all([
        performSync(documentId, sourceConnectorId, destConnectorId, userId),
        performSync(documentId, sourceConnectorId, destConnectorId, userId),
      ]);

      const successCount = [result1, result2].filter((r) => r.success).length;
      const failCount = [result1, result2].filter((r) => !r.success).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      const failed = [result1, result2].find((r) => !r.success);
      expect(failed?.error).toContain("currently being synced");
    });

    it("should handle null config and null credentials in destination connector", async () => {
      const nullConfigDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "WORDPRESS",
          credentials: null,
          config: null,
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        nullConfigDoc as any,
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

      // Sync should succeed (publishToDestination returns early when credentials are null/empty)
      expect(result.success).toBe(true);
    });

    it("should handle large content payload", async () => {
      const largeContent = "A".repeat(50000);
      const googleDocsModule = await import("../google-docs");
      vi.mocked(googleDocsModule.getGoogleDocContent).mockResolvedValue({
        id: "doc-large",
        title: "Large Doc",
        content: largeContent,
        modifiedTime: "2026-06-01T00:00:00Z",
      });

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
      // Verify content was stored
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: largeContent,
          }),
        }),
      );
    });

    it("should skip Shopify article publish when no blogs exist", async () => {
      const shopifyNoBlogDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "SHOPIFY",
          credentials: "enc_creds",
          config: { shopDomain: "test.myshopify.com" },
        },
      };
      const shopifyModule = await import("../shopify");
      vi.mocked(shopifyModule.createShopifyClient).mockReturnValue({
        createArticle: vi.fn().mockResolvedValue({ article: { id: 456 } }),
        updateArticle: vi.fn().mockResolvedValue({}),
        getBlogs: vi.fn().mockResolvedValue({ blogs: [] }),
      } as any);

      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        shopifyNoBlogDoc as any,
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
      const shopifyClient = vi.mocked(shopifyModule.createShopifyClient).mock
        .results[0].value;
      // getBlogs was called but no articles were created (no blogs available)
      expect(shopifyClient.getBlogs).toHaveBeenCalled();
      expect(shopifyClient.createArticle).not.toHaveBeenCalled();
    });

    it("should update existing Contentful entry when slug already exists", async () => {
      const contentfulUpdateDoc = {
        ...baseDocument,
        slug: "existing-entry-slug",
        destConnector: {
          id: destConnectorId,
          type: "CONTENTFUL",
          credentials: "enc_creds",
          config: { spaceId: "space-1", contentTypeId: "article" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        contentfulUpdateDoc as any,
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
      const contentfulModule = await import("../contentful");
      expect(contentfulModule.getContentfulEntry).toHaveBeenCalledWith(
        "creds",
        "space-1",
        "existing-entry-slug",
      );
      expect(contentfulModule.updateContentfulEntry).toHaveBeenCalled();
      // Should NOT create a new entry when slug exists
      expect(contentfulModule.createContentfulEntry).not.toHaveBeenCalled();
    });

    it("should handle Google Docs source with null sourceId (skip GOOGLE_DOCS parsing branch)", async () => {
      const googleDocNoSourceId = {
        ...baseDocument,
        sourceId: null,
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        googleDocNoSourceId as any,
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
      // Should not call parseGoogleDocToHtml when sourceId is null
      const htmlParserModule = await import("../html-parser");
      expect(htmlParserModule.parseGoogleDocToHtml).not.toHaveBeenCalled();
    });

    it("should update existing Ghost post when slug exists", async () => {
      const ghostUpdateDoc = {
        ...baseDocument,
        slug: "existing-slug",
        destConnector: {
          id: destConnectorId,
          type: "GHOST",
          credentials: "enc_creds",
          config: { siteUrl: "https://ghost.example.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        ghostUpdateDoc as any,
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
      const ghostClient = vi.mocked(createGhostClient).mock.results[0].value;
      expect(ghostClient.updatePost).toHaveBeenCalledWith(
        "existing-slug",
        expect.objectContaining({ status: "published" }),
      );
      expect(ghostClient.createPost).not.toHaveBeenCalled();
    });

    it("should update existing Webflow item when slug exists", async () => {
      const webflowUpdateDoc = {
        ...baseDocument,
        slug: "existing-slug",
        destConnector: {
          id: destConnectorId,
          type: "WEBFLOW",
          credentials: "enc_creds",
          config: { siteId: "site-1", collectionId: "coll-1" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        webflowUpdateDoc as any,
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
      const webflowClient =
        vi.mocked(createWebflowClient).mock.results[0].value;
      expect(webflowClient.updateItem).toHaveBeenCalledWith(
        "coll-1",
        "existing-slug",
        expect.objectContaining({ name: "Test Doc" }),
      );
      expect(webflowClient.createItem).not.toHaveBeenCalled();
    });

    it("should update existing Shopify article when slug exists", async () => {
      // Reset Shopify mock explicitly (previous tests may have overridden it)
      const shopifyModule = await import("../shopify");
      vi.mocked(shopifyModule.createShopifyClient).mockReturnValue({
        createArticle: vi.fn().mockResolvedValue({ article: { id: 456 } }),
        updateArticle: vi.fn().mockResolvedValue({}),
        getBlogs: vi.fn().mockResolvedValue({
          blogs: [{ id: "blog-1" }],
        }),
      } as any);

      const shopifyUpdateDoc = {
        ...baseDocument,
        slug: "article-456",
        destConnector: {
          id: destConnectorId,
          type: "SHOPIFY",
          credentials: "enc_creds",
          config: { shopDomain: "test.myshopify.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        shopifyUpdateDoc as any,
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
      const shopifyClient =
        vi.mocked(createShopifyClient).mock.results[0].value;
      expect(shopifyClient.updateArticle).toHaveBeenCalledWith(
        "blog-1",
        "article-456",
        expect.objectContaining({ title: "Test Doc" }),
      );
      expect(shopifyClient.createArticle).not.toHaveBeenCalled();
    });

    it("should handle null sourceConnector (optional chaining fallback at line 364)", async () => {
      const nullSourceDoc = {
        ...baseDocument,
        sourceConnector: null,
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        nullSourceDoc as any,
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
      // Source fetch step should be skipped (no source connector)
      // Parsing step should skip GOOGLE_DOCS branch (sourceConnector is null)
      const htmlParserModule = await import("../html-parser");
      expect(htmlParserModule.parseGoogleDocToHtml).not.toHaveBeenCalled();
    });

    it("should handle Contentful update when existing entry is not found (getContentfulEntry returns null)", async () => {
      const contentfulModule = await import("../contentful");
      vi.mocked(contentfulModule.getContentfulEntry).mockResolvedValue(null);

      const updateDoc = {
        ...baseDocument,
        slug: "missing-entry-slug",
        destConnector: {
          id: destConnectorId,
          type: "CONTENTFUL",
          credentials: "enc_creds",
          config: { spaceId: "space-1", contentTypeId: "article" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(updateDoc as any);
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

      // Sync succeeds but updateContentfulEntry is not called (entry not found)
      expect(result.success).toBe(true);
      expect(contentfulModule.updateContentfulEntry).not.toHaveBeenCalled();
    });

    it("should sync Google Docs source to Ghost destination with null credentials", async () => {
      const ghostNullCredsDoc = {
        ...baseDocument,
        destConnector: {
          id: destConnectorId,
          type: "GHOST",
          credentials: null,
          config: null,
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        ghostNullCredsDoc as any,
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
      // With null config, config.siteUrl is undefined, but mock handles it
      const ghostClient = vi.mocked(createGhostClient).mock.results[0].value;
      expect(ghostClient.createPost).toHaveBeenCalled();
    });

    it("should sync Google Docs source to Webflow destination with null credentials", async () => {
      const webflowNullCredsDoc = {
        ...baseDocument,
        slug: "wf-slug",
        destConnector: {
          id: destConnectorId,
          type: "WEBFLOW",
          credentials: null,
          config: null,
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        webflowNullCredsDoc as any,
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
      const webflowClient =
        vi.mocked(createWebflowClient).mock.results[0].value;
      expect(webflowClient.updateItem).toHaveBeenCalled();
    });

    it("should sync Google Docs source to Shopify destination with null credentials", async () => {
      const shopifyNullCredsDoc = {
        ...baseDocument,
        slug: "shopify-slug",
        destConnector: {
          id: destConnectorId,
          type: "SHOPIFY",
          credentials: null,
          config: null,
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        shopifyNullCredsDoc as any,
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
      const shopifyClient =
        vi.mocked(createShopifyClient).mock.results[0].value;
      expect(shopifyClient.updateArticle).toHaveBeenCalled();
    });

    it("should sync Google Docs source to WordPress destination with null slug in publishToDestination (update path with slug)", async () => {
      const wpWithSlugDoc = {
        ...baseDocument,
        slug: "123",
        destConnector: {
          id: destConnectorId,
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        wpWithSlugDoc as any,
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
      const wpClient = vi.mocked(createWordPressClient).mock.results[0].value;
      expect(wpClient.updatePost).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ title: "Test Doc" }),
      );
      expect(wpClient.createPost).not.toHaveBeenCalled();
    });

    it("should sync Google Docs source to Shopify destination with no blogs (blogId falsy, skips article)", async () => {
      // Reset Shopify mock to return empty blogs
      const shopifyModule = await import("../shopify");
      vi.mocked(shopifyModule.createShopifyClient).mockReturnValue({
        createArticle: vi.fn().mockResolvedValue({ article: { id: 456 } }),
        updateArticle: vi.fn().mockResolvedValue({}),
        getBlogs: vi.fn().mockResolvedValue({ blogs: [] }),
      } as any);

      const shopifyNoBlogDoc = {
        ...baseDocument,
        slug: "shopify-slug",
        destConnector: {
          id: destConnectorId,
          type: "SHOPIFY",
          credentials: "enc_creds",
          config: { shopDomain: "test.myshopify.com" },
        },
      };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        shopifyNoBlogDoc as any,
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
      const shopifyClient =
        vi.mocked(createShopifyClient).mock.results[0].value;
      expect(shopifyClient.getBlogs).toHaveBeenCalled();
      expect(shopifyClient.updateArticle).not.toHaveBeenCalled();
      expect(shopifyClient.createArticle).not.toHaveBeenCalled();
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

    it("should handle unsupported source connector type", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        status: "PUBLISHED",
        sourceConnector: {
          ...baseDocument.sourceConnector,
          type: "DROPBOX_PAPER",
        },
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

    it("should return error when sourceConnectorId is missing", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        sourceConnectorId: null,
        destConnectorId: null,
        status: "PUBLISHED",
      } as any);

      const result = await detectAndSyncChanges(documentId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing connector IDs");
    });

    it("should handle detectContentChanges throwing an error", async () => {
      const aiModule = await import("../ai");
      vi.mocked(aiModule.detectContentChanges).mockRejectedValue(
        new Error("Detection failed"),
      );

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

      expect(result.success).toBe(false);
      expect(result.error).toBe("Detection failed");
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

    it("should handle null slug for WordPress", async () => {
      const mockClient = {
        getPost: vi.fn().mockResolvedValue({} as any),
        createPost: vi.fn(),
        updatePost: vi.fn(),
        getCategories: vi.fn(),
      };
      vi.mocked(createWordPressClient).mockReturnValue(mockClient);
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        slug: null,
        destConnector: {
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeDefined();
      expect(mockClient.getPost).toHaveBeenCalledWith(0);
    });

    it("should handle unsupported connector type", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          type: "WEBFLOW",
          credentials: "enc_creds",
          config: {},
        },
      } as any);

      const result = await checkRemoteChanges(documentId, userId);

      expect(result).toBeNull();
    });

    it("should throw on authz failure", async () => {
      const authzModule = await import("../authz");
      vi.mocked(authzModule.requireDocumentAccess).mockRejectedValue(
        new Error("Access denied"),
      );

      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        slug: "123",
        destConnector: {
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(checkRemoteChanges(documentId, userId)).rejects.toThrow(
        "Access denied",
      );
    });
  });
});
