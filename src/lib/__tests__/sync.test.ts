import { describe, it, expect, vi, beforeEach } from "vitest"
import { performSync, detectAndSyncChanges } from "../services/sync"
import { ERR_DOC_NOT_FOUND, ERR_DOC_NOT_PUBLISHED } from "@/lib/errors"

// Mock dependencies BEFORE any imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    syncLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((val: string) => val),
}))

vi.mock("@/lib/email", () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../services/google-docs", () => ({
  getGoogleDocContent: vi.fn().mockResolvedValue({
    title: "Test Document",
    content: "Test content",
  }),
}))

vi.mock("../services/notion", () => ({
  getNotionPageContent: vi.fn().mockResolvedValue({
    id: "notion-page-123",
    title: "Test Notion Page",
    content: "Test notion content",
    createdTime: new Date().toISOString(),
    lastEditedTime: new Date().toISOString(),
  }),
}))

vi.mock("../lib/http-client", () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({}),
}))

vi.mock("../services/html-parser", () => ({
  parseMarkdownToHtml: vi.fn((content: string) => `<p>${content}</p>`),
  parseGoogleDocToHtml: vi.fn(() => ({ html: "<p>Test content</p>" })),
}))

vi.mock("../services/wordpress", () => ({
  createWordPressClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn().mockResolvedValue({ id: 123 }),
  })),
}))

vi.mock("../services/ghost", () => ({
  createGhostClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ posts: [{ id: "abc" }] }),
    updatePost: vi.fn().mockResolvedValue({ id: "abc" }),
  })),
}))

vi.mock("../services/webflow", () => ({
  createWebflowClient: vi.fn(() => ({
    createItem: vi.fn().mockResolvedValue({ items: [{ id: "wf123" }] }),
    updateItem: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock("../services/shopify", () => ({
  createShopifyClient: vi.fn(() => ({
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: 1 }] }),
    createArticle: vi.fn().mockResolvedValue({ article: { id: "shp123" } }),
    updateArticle: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock("../services/ai", () => ({
  detectContentChanges: vi.fn().mockResolvedValue({ hasChanges: true, summary: "Changes detected" }),
  generateSEO: vi.fn().mockResolvedValue({
    title: "SEO Title",
    description: "SEO Description",
    keywords: ["keyword1", "keyword2"],
  }),
  generateExcerpt: vi.fn().mockResolvedValue("Generated excerpt"),
  findInterlinkingOpportunities: vi.fn().mockResolvedValue({ links: [] }),
  generateAImage: vi.fn().mockResolvedValue("https://example.com/image.png"),
}))

vi.mock("../services/ai-usage", () => ({
  logAIUsage: vi.fn(),
}))

const { prisma } = await import("@/lib/prisma")

describe("performSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return error if document not found", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const result = await performSync("doc-123", "conn-1", "conn-2")

    expect(result.success).toBe(false)
    expect(result.error).toBe(ERR_DOC_NOT_FOUND)
  })

  it("should sync Google Docs content successfully", async () => {
    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      userId: "user-1",
      organizationId: "org-1",
      sourceConnector: {
        type: "GOOGLE_DOCS",
        credentials: "{}",
      },
      destConnector: {
        type: "WORDPRESS",
        credentials: Buffer.from("user:pass").toString("base64"),
        config: { siteUrl: "https://example.com" },
      },
      sourceId: "google-doc-123",
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    const result = await performSync("doc-123", "conn-1", "conn-2")

    expect(result.success).toBe(true)
    expect(prisma.document.update).toHaveBeenCalled()
    expect(prisma.syncLog.create).toHaveBeenCalled()
  })

  it("should sync Notion content successfully", async () => {
    const mockDocument = {
      id: "doc-456",
      title: "Test Notion",
      userId: "user-1",
      organizationId: "org-1",
      sourceConnector: {
        type: "NOTION",
        credentials: "{\"accessToken\": \"notion-token\"}",
        config: {},
      },
      destConnector: {
        type: "GHOST",
        credentials: "{\"apiKey\": \"ghost-key\"}",
        config: { siteUrl: "https://ghost.example.com" },
      },
      sourceId: "notion-page-123",
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    const result = await performSync("doc-456", "conn-3", "conn-4")

    expect(result.success).toBe(true)
  })

  it("should call AI enrichment functions", async () => {
    const mockDocument = {
      id: "doc-789",
      title: "Test with AI",
      userId: "user-1",
      organizationId: "org-1",
      sourceConnector: {
        type: "GOOGLE_DOCS",
        credentials: "{}",
      },
      destConnector: {
        type: "WORDPRESS",
        credentials: Buffer.from("user:pass").toString("base64"),
        config: { siteUrl: "https://example.com" },
      },
      sourceId: "doc-123",
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    await performSync("doc-789", "conn-1", "conn-2")

    // Verify AI functions were called
    const { generateSEO, generateExcerpt } = await import("../services/ai")
    
    expect(generateSEO).toHaveBeenCalled()
    expect(generateExcerpt).toHaveBeenCalled()
  })
})

describe("detectAndSyncChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return error if document not found", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const result = await detectAndSyncChanges("doc-missing")

    expect(result.success).toBe(false)
  })

  it("should return error if document is not published", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "doc-123",
      status: "DRAFT",
    } as any)

    const result = await detectAndSyncChanges("doc-123")

    expect(result.success).toBe(false)
    expect(result.error).toBe(ERR_DOC_NOT_PUBLISHED)
  })

  it("should detect changes and trigger sync", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "doc-123",
      status: "PUBLISHED",
      content: "Old content",
      userId: "user-1",
      organizationId: "org-1",
      sourceConnectorId: "conn-1",
      destConnectorId: "conn-2",
      sourceConnector: {
        type: "GOOGLE_DOCS",
        credentials: "{}",
      },
      destConnector: {
        type: "WORDPRESS",
        credentials: Buffer.from("user:pass").toString("base64"),
        config: { siteUrl: "https://example.com" },
      },
    } as any)

    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    await detectAndSyncChanges("doc-123")

    // Should detect changes
    const { detectContentChanges } = await import("../services/ai")
    expect(detectContentChanges).toHaveBeenCalled()
  })
})