/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performSync, detectAndSyncChanges } from '../services/sync'
import { ERR_DOC_NOT_FOUND, ERR_DOC_NOT_PUBLISHED } from '@/lib/errors'

// Create a shared mock DB that works for BOTH @/lib/prisma AND the bundled
// @omnysync/core/services/sync (which uses its own inline prisma via PrismaClient).
// The bundled code checks globalThis.prismaGlobal to reuse an existing client.
// Shared mock prisma object. Defined inside vi.hoisted so it's available in
// both vi.hoisted callbacks and vi.mock factories (both are hoisted to the top).
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    create: vi.fn().mockResolvedValue({}),
  },
  syncLog: { create: vi.fn().mockResolvedValue({}) },
  user: { findUnique: vi.fn() },
  userOrganization: { findFirst: vi.fn().mockResolvedValue({ userId: 'user-1', organizationId: 'org-1' }) },
}))

vi.hoisted(() => {
  globalThis.prismaGlobal = mockPrisma as any
})

// Mock @prisma/client so any inline PrismaClient() returns mockPrisma
vi.mock('@prisma/client', () => {
  const MockClient = vi.fn(() => mockPrisma)
  return { PrismaClient: MockClient }
})

// Mock @/lib/prisma (used by the test to import prisma for setup)
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
// Override setup-core-mock: core's sync.ts imports from "../prisma"
// which resolves to @omnysync/core/prisma. Needs our mock, not setup's null proxy.
vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(() => mockPrisma),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((val: string) => val),
}))

vi.mock('@/lib/email', () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

// Sync source imports crypto and email directly from @omnysync/core
vi.mock('@omnysync/core/crypto', () => ({
  decrypt: vi.fn((val: string) => val),
  encrypt: vi.fn((val: string) => val),
}))

vi.mock('@omnysync/core/email', () => ({
  sendSyncCompleteEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock core package services that sync.ts imports via relative paths
vi.mock('@omnysync/core/services/google-docs', () => ({
  getGoogleDocContent: vi.fn().mockResolvedValue({
    title: 'Test Document', content: 'Test content',
  }),
}))

vi.mock('@omnysync/core/services/notion', () => ({
  getNotionPageContent: vi.fn().mockResolvedValue({
    id: 'notion-page-123', title: 'Test Notion Page',
    content: 'Test notion content',
    createdTime: new Date().toISOString(),
    lastEditedTime: new Date().toISOString(),
  }),
}))

vi.mock('@omnysync/core/services/html-parser', () => ({
  parseMarkdownToHtml: vi.fn((content: string) => `<p>${content}</p>`),
  parseGoogleDocToHtml: vi.fn(() => ({ html: '<p>Test content</p>' })),
}))

vi.mock('@omnysync/core/services/wordpress', () => ({
  createWordPressClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ id: 123 }),
    updatePost: vi.fn().mockResolvedValue({ id: 123 }),
  })),
}))

vi.mock('@omnysync/core/services/ghost', () => ({
  createGhostClient: vi.fn(() => ({
    createPost: vi.fn().mockResolvedValue({ posts: [{ id: 'abc' }] }),
    updatePost: vi.fn().mockResolvedValue({ id: 'abc' }),
  })),
}))

vi.mock('@omnysync/core/services/webflow', () => ({
  createWebflowClient: vi.fn(() => ({
    createItem: vi.fn().mockResolvedValue({ items: [{ id: 'wf123' }] }),
    updateItem: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('@omnysync/core/services/shopify', () => ({
  createShopifyClient: vi.fn(() => ({
    getBlogs: vi.fn().mockResolvedValue({ blogs: [{ id: 1 }] }),
    createArticle: vi.fn().mockResolvedValue({ article: { id: 'shp123' } }),
    updateArticle: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('@omnysync/core/services/ai', () => ({
  detectContentChanges: vi.fn().mockResolvedValue({ hasChanges: true, summary: 'Changes detected' }),
  generateSEO: vi.fn().mockResolvedValue({
    title: 'SEO Title', description: 'SEO Description', keywords: ['keyword1', 'keyword2'],
  }),
  generateExcerpt: vi.fn().mockResolvedValue('Generated excerpt'),
  findInterlinkingOpportunities: vi.fn().mockResolvedValue({ links: [] }),
  generateAImage: vi.fn().mockResolvedValue('https://example.com/image.png'),
}))

vi.mock('@omnysync/core/services/ai-usage', () => ({
  logAIUsage: vi.fn(),
}))

vi.mock('@omnysync/core/services/authz', () => ({
  requireDocumentAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@omnysync/core/services/sanitize', () => ({
  sanitizeErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Unknown error'
  ),
}))

const { prisma } = await import('@/lib/prisma')

describe('performSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if document not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const result = await performSync('doc-123', 'conn-1', 'conn-2', 'user-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe(ERR_DOC_NOT_FOUND)
  })

  it('should sync Google Docs content successfully', async () => {
    const mockDocument = {
      id: 'doc-123',
      title: 'Test Document',
      userId: 'user-1',
      organizationId: 'org-1',
      sourceConnector: {
        type: 'GOOGLE_DOCS',
        credentials: '{}',
      },
      destConnector: {
        type: 'WORDPRESS',
        credentials: Buffer.from('user:pass').toString('base64'),
        config: { siteUrl: 'https://example.com' },
      },
      sourceId: 'google-doc-123',
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    const result = await performSync('doc-123', 'conn-1', 'conn-2', 'user-1')

    expect(result.success).toBe(true)
    expect(prisma.document.update).toHaveBeenCalled()
    expect(prisma.syncLog.create).toHaveBeenCalled()
  })

  it('should sync Notion content successfully', async () => {
    const mockDocument = {
      id: 'doc-456',
      title: 'Test Notion',
      userId: 'user-1',
      organizationId: 'org-1',
      sourceConnector: {
        type: 'NOTION',
        credentials: '{"accessToken": "notion-token"}',
        config: {},
      },
      destConnector: {
        type: 'GHOST',
        credentials: '{"apiKey": "ghost-key"}',
        config: { siteUrl: 'https://ghost.example.com' },
      },
      sourceId: 'notion-page-123',
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    const result = await performSync('doc-456', 'conn-3', 'conn-4', 'user-1')

    expect(result.success).toBe(true)
  })

  it('should call AI enrichment functions', async () => {
    const mockDocument = {
      id: 'doc-789',
      title: 'Test with AI',
      userId: 'user-1',
      organizationId: 'org-1',
      sourceConnector: {
        type: 'GOOGLE_DOCS',
        credentials: '{}',
      },
      destConnector: {
        type: 'WORDPRESS',
        credentials: Buffer.from('user:pass').toString('base64'),
        config: { siteUrl: 'https://example.com' },
      },
      sourceId: 'doc-123',
    }

    vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    await performSync('doc-789', 'conn-1', 'conn-2', 'user-1')

    // Verify AI functions were called
    const { generateSEO, generateExcerpt } = await import('../services/ai')

    expect(generateSEO).toHaveBeenCalled()
    expect(generateExcerpt).toHaveBeenCalled()
  })
})

describe('detectAndSyncChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if document not found', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const result = await detectAndSyncChanges('doc-missing', 'user-1')

    expect(result.success).toBe(false)
  })

  it('should return error if document is not published', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-123',
      status: 'DRAFT',
    } as any)

    const result = await detectAndSyncChanges('doc-123', 'user-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe(ERR_DOC_NOT_PUBLISHED)
  })

  it('should detect changes and trigger sync', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-123',
      status: 'PUBLISHED',
      content: 'Old content',
      userId: 'user-1',
      organizationId: 'org-1',
      sourceConnectorId: 'conn-1',
      destConnectorId: 'conn-2',
      sourceConnector: {
        type: 'GOOGLE_DOCS',
        credentials: '{}',
      },
      destConnector: {
        type: 'WORDPRESS',
        credentials: Buffer.from('user:pass').toString('base64'),
        config: { siteUrl: 'https://example.com' },
      },
    } as any)

    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    await detectAndSyncChanges('doc-123', 'user-1')

    // Should detect changes
    const { detectContentChanges } = await import('../services/ai')
    expect(detectContentChanges).toHaveBeenCalled()
  })
})
