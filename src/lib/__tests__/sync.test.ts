import { describe, it, expect, vi, beforeEach } from "vitest"
import { performSync, detectAndSyncChanges } from "../sync"

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
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
  sendSyncCompleteEmail: vi.fn(),
}))

vi.mock("./google-docs", () => ({
  getGoogleDocContent: vi.fn().mockResolvedValue({
    title: "Test Document",
    content: "Test content",
  }),
}))

vi.mock("./notion", () => ({
  getNotionPageContent: vi.fn().mockResolvedValue({
    title: "Test Notion Page",
    content: "Test notion content",
  }),
}))

vi.mock("./html-parser", () => ({
  parseMarkdownToHtml: vi.fn((content: string) => `<p>${content}</p>`),
  parseGoogleDocToHtml: vi.fn(() => ({ html: "<p>Test content</p>" })),
}))

vi.mock("./wordpress", () => ({
  createWordPressClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn(),
  })),
}))

vi.mock("./ghost", () => ({
  createGhostClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ posts: [{ id: "abc" }] }),
    updatePost: vi.fn(),
  })),
}))

vi.mock("./webflow", () => ({
  createWebflowClient: vi.fn(() => ({
    createItem: vi.fn().mockResolvedValue({ items: [{ id: "wf123" }] }),
    updateItem: vi.fn(),
  })),
}))

vi.mock("./shopify", () => ({
  createShopifyClient: vi.fn(() => ({
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: 1 }] }),
    createArticle: vi.fn().mockResolvedValue({ article: { id: "shp123" } }),
    updateArticle: vi.fn(),
  })),
}))

vi.mock("./ai", () => ({
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

const { prisma } = await import("@/lib/prisma")

describe("performSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return error if document not found", async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const result = await performSync("doc-123", "conn-1", "conn-2")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Document not found")
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
    expect(prisma.document.update).toHaveBeenCalledTimes(2) // Set SYNCING + Set SYNCED
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
        credentials: "notion-token",
        config: {},
      },
      destConnector: {
        type: "GHOST",
        credentials: "ghost-key",
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

    const result = await performSync("doc-789", "conn-1", "conn-2")

    // Verify AI functions were called
    const { generateSEO, generateExcerpt, findInterlinkingOpportunities, generateAImage } = await import("./ai")
    
    expect(generateSEO).toHaveBeenCalled()
    expect(generateExcerpt).toHaveBeenCalled()
  })

  it("should handle sync errors gracefully", async () => {
    const mockDocument = {
      id: "doc-error",
      title: "Error Doc",
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
    vi.mocked(prisma.document.update).mockRejectedValue(new Error("Database error"))
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    const result = await performSync("doc-error", "conn-1", "conn-2")

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
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
    expect(result.error).toBe("Document not published yet")
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
      destConnector: null,
    } as any)

    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as any)

    const result = await detectAndSyncChanges("doc-123")

    // Should detect changes
    const { detectContentChanges } = await import("./ai")
    expect(detectContentChanges).toHaveBeenCalled()
  })
})