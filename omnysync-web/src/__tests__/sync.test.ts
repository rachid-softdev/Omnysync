import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted before module imports) ──────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    syncLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((val: string) => val),
  encrypt: vi.fn((val: string) => val),
}))

vi.mock('@/lib/email', () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/google-docs', () => ({
  getGoogleDocContent: vi.fn().mockResolvedValue({
    title: 'Google Doc Title',
    content: 'Content from Google Docs',
  }),
}))

vi.mock('@/lib/services/notion', () => ({
  getNotionPageContent: vi.fn().mockResolvedValue({
    id: 'notion-page-1',
    title: 'Notion Page',
    content: 'Content from Notion',
    createdTime: new Date().toISOString(),
    lastEditedTime: new Date().toISOString(),
  }),
}))

vi.mock('@/lib/services/html-parser', () => ({
  parseMarkdownToHtml: vi.fn((content: string) => `<p>${content}</p>`),
  parseGoogleDocToHtml: vi.fn(() => ({ html: '<p>Parsed HTML</p>' })),
}))

vi.mock('@/lib/services/ai', () => ({
  detectContentChanges: vi.fn().mockResolvedValue({ hasChanges: true, summary: 'content updated' }),
  generateSEO: vi.fn().mockResolvedValue({
    title: 'SEO Title',
    description: 'SEO Description',
    keywords: ['kw1', 'kw2'],
  }),
  generateExcerpt: vi.fn().mockResolvedValue('AI-generated excerpt'),
  findInterlinkingOpportunities: vi.fn().mockResolvedValue({ links: [] }),
  generateAImage: vi.fn().mockResolvedValue('https://example.com/ai-img.png'),
}))

vi.mock('@/lib/services/authz', () => ({
  requireDocumentAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/wordpress', () => ({
  createWordPressClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn().mockResolvedValue(undefined),
    getPost: vi.fn().mockResolvedValue({ id: 123, title: 'WP Post' }),
  })),
}))

vi.mock('@/lib/services/ghost', () => ({
  createGhostClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ posts: [{ id: 'ghost-post-1' }] }),
    updatePost: vi.fn().mockResolvedValue(undefined),
    getPost: vi.fn().mockResolvedValue({ id: 'ghost-post-1' }),
  })),
}))

vi.mock('@/lib/services/webflow', () => ({
  createWebflowClient: vi.fn(() => ({
    createItem: vi.fn().mockResolvedValue({ items: [{ id: 'wf-item-1' }] }),
    updateItem: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/lib/services/shopify', () => ({
  createShopifyClient: vi.fn(() => ({
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: 1 }] }),
    createArticle: vi.fn().mockResolvedValue({ article: { id: 'shopify-article-1' } }),
    updateArticle: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/lib/services/sanitize', () => ({
  sanitizeErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Unknown error'
  ),
}))

// ── Imports ─────────────────────────────────────────────────────────────────

import { performSync, detectAndSyncChanges, checkRemoteChanges } from '@/lib/services/sync'
import { prisma } from '@/lib/prisma'
import { requireDocumentAccess } from '@/lib/services/authz'
import { ERR_DOC_NOT_FOUND, ERR_DOC_NOT_PUBLISHED } from '@/lib/errors'

// ── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!process.env.TEST_DATABASE_URL)('sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Shared base document mock
  const baseDocument = {
    id: 'doc-1',
    title: 'Test Document',
    userId: 'user-1',
    organizationId: 'org-1',
    version: 1,
    syncStatus: 'NOT_SYNCED',
    content: 'Original content',
    htmlContent: null,
    sourceId: 'source-doc-1',
    sourceConnectorId: 'conn-source',
    destConnectorId: 'conn-dest',
    status: 'DRAFT',
    slug: null,
    featuredImage: null,
    sourceConnector: {
      id: 'conn-source',
      type: 'GOOGLE_DOCS',
      credentials: '{}',
      config: {},
    },
    destConnector: {
      id: 'conn-dest',
      type: 'WORDPRESS',
      credentials: Buffer.from('user:pass').toString('base64'),
      config: { siteUrl: 'https://example.com' },
    },
  }

  // ── performSync ──────────────────────────────────────────────────────────

  describe('performSync', () => {
    it('should return error when document is not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const result = await performSync('nonexistent', 'conn-source', 'conn-dest', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(ERR_DOC_NOT_FOUND)
      expect(result.documentId).toBe('nonexistent')
    })

    it('should return error when document is already syncing (optimistic lock fails)', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        ...baseDocument,
        sourceConnector: undefined,
        destConnector: undefined,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 0,
      } as unknown as Record<string, unknown>)

      const result = await performSync('doc-1', 'conn-source', 'conn-dest', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('currently being synced')
    })

    it('should sync a Google Docs source to WordPress successfully', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.document.update).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as unknown as Record<string, unknown>)

      const result = await performSync('doc-1', 'conn-source', 'conn-dest', 'user-1')

      expect(result.success).toBe(true)
      expect(result.documentId).toBe('doc-1')

      // Verify authz check was performed
      expect(requireDocumentAccess).toHaveBeenCalledWith('doc-1', 'user-1')

      // Verify doc was updated with content and AI enrichment
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            syncStatus: 'SYNCED',
            status: 'PUBLISHED',
          }),
        })
      )
    })

    it('should handle an error during sync and update status to FAILED', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        baseDocument as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)
      // Make the first document.update (content save) throw
      vi.mocked(prisma.document.update).mockRejectedValueOnce(new Error('Database timeout'))

      const result = await performSync('doc-1', 'conn-source', 'conn-dest', 'user-1')

      expect(result.success).toBe(false)
    })

    it('should sync Notion source to Ghost destination', async () => {
      const notionDoc = {
        ...baseDocument,
        sourceConnector: {
          id: 'conn-source',
          type: 'NOTION',
          credentials: JSON.stringify({ accessToken: 'notion-token' }),
          config: {},
        },
        destConnector: {
          id: 'conn-dest',
          type: 'GHOST',
          credentials: JSON.stringify({ apiKey: 'ghost-key' }),
          config: { siteUrl: 'https://ghost.example.com' },
        },
      }

      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        notionDoc as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.document.update).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as unknown as Record<string, unknown>)

      const result = await performSync('doc-1', 'conn-source', 'conn-dest', 'user-1')

      expect(result.success).toBe(true)

      // Verify Notion parser was used (parseMarkdownToHtml)
      const { parseMarkdownToHtml } = await import('@/lib/services/html-parser')
      expect(parseMarkdownToHtml).toHaveBeenCalled()
    })
  })

  // ── detectAndSyncChanges ──────────────────────────────────────────────────

  describe('detectAndSyncChanges', () => {
    it('should return error when document is not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const result = await detectAndSyncChanges('nonexistent', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(ERR_DOC_NOT_FOUND)
    })

    it('should return error when document is not published', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        status: 'DRAFT',
        sourceConnector: undefined,
        destConnector: undefined,
      } as unknown as Record<string, unknown>)

      const result = await detectAndSyncChanges('doc-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(ERR_DOC_NOT_PUBLISHED)
    })

    it('should detect changes and trigger a sync', async () => {
      const publishedDoc = {
        ...baseDocument,
        status: 'PUBLISHED',
      }

      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        publishedDoc as unknown as Record<string, unknown>
      )
      vi.mocked(prisma.document.updateMany).mockResolvedValue({
        count: 1,
      } as unknown as Record<string, unknown>)
      vi.mocked(prisma.document.update).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as unknown as Record<string, unknown>)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as unknown as Record<string, unknown>)

      const result = await detectAndSyncChanges('doc-1', 'user-1')

      expect(result.success).toBe(true)
    })

    it('should handle missing connector IDs', async () => {
      const noConnectorsDoc = {
        ...baseDocument,
        status: 'PUBLISHED',
        sourceConnectorId: null,
        destConnectorId: null,
        sourceConnector: { type: 'GOOGLE_DOCS', credentials: '{}' },
        destConnector: undefined,
      }

      vi.mocked(prisma.document.findUnique).mockResolvedValue(
        noConnectorsDoc as unknown as Record<string, unknown>
      )

      const { detectContentChanges } = await import('@/lib/services/ai')
      vi.mocked(detectContentChanges).mockResolvedValue({
        hasChanges: true,
        summary: 'Changes found',
      })

      const result = await detectAndSyncChanges('doc-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing connector IDs')
    })
  })

  // ── checkRemoteChanges ────────────────────────────────────────────────────

  describe('checkRemoteChanges', () => {
    it('should return null when document is not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

      const result = await checkRemoteChanges('nonexistent', 'user-1')

      expect(result).toBeNull()
    })

    it('should return null when document has no destConnector', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        destConnector: null,
      } as unknown as Record<string, unknown>)

      const result = await checkRemoteChanges('doc-1', 'user-1')

      expect(result).toBeNull()
    })

    it('should fetch remote state from WordPress', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        slug: '42',
        destConnector: {
          type: 'WORDPRESS',
          credentials: Buffer.from('user:pass').toString('base64'),
          config: { siteUrl: 'https://example.com' },
        },
      } as unknown as Record<string, unknown>)

      const result = await checkRemoteChanges('doc-1', 'user-1')

      expect(result).toEqual({ id: 123, title: 'WP Post' })
    })

    it('should fetch remote state from Ghost', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-2',
        slug: 'ghost-slug',
        destConnector: {
          type: 'GHOST',
          credentials: JSON.stringify({ apiKey: 'ghost-key' }),
          config: { siteUrl: 'https://ghost.example.com' },
        },
      } as unknown as Record<string, unknown>)

      const result = await checkRemoteChanges('doc-2', 'user-1')

      expect(result).toEqual({ id: 'ghost-post-1' })
    })

    it('should verify document access', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'doc-1',
        slug: '42',
        destConnector: {
          type: 'WORDPRESS',
          credentials: Buffer.from('user:pass').toString('base64'),
          config: { siteUrl: 'https://example.com' },
        },
      } as unknown as Record<string, unknown>)

      await checkRemoteChanges('doc-1', 'user-1')

      expect(requireDocumentAccess).toHaveBeenCalledWith('doc-1', 'user-1')
    })
  })
})
