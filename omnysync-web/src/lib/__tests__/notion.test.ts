/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listNotionPages, getNotionPageContent, saveNotionConnector } from '../services/notion'

// Mock dependencies — notion service is in @omnysync/core, imports internally
vi.mock('@omnysync/core/prisma', () => ({
  prisma: {
    connector: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@omnysync/core/crypto', () => ({
  encrypt: vi.fn((text) => `encrypted_${text}`),
}))

vi.mock('@omnysync/core/http', () => ({
  fetchWithRetry: vi.fn(),
}))

vi.mock('@omnysync/core/errors', () => ({
  ERR_FETCH_CONTENT: 'ERR_FETCH_CONTENT',
}))

import { prisma } from '@omnysync/core/prisma'
import { fetchWithRetry } from '@omnysync/core/http'

describe('Notion Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listNotionPages', () => {
    it('should return list of Notion pages', async () => {
      const mockResponse = {
        results: [
          {
            id: 'page-1',
            parent: { type: 'workspace' },
            properties: {
              title: {
                title: [{ plain_text: 'Page 1' }],
              },
            },
            created_time: '2024-01-01',
            last_edited_time: '2024-01-02',
          },
          {
            id: 'page-2',
            parent: { type: 'database' },
            properties: {
              title: {
                title: [{ plain_text: 'Page 2' }],
              },
            },
            created_time: '2024-01-03',
            last_edited_time: '2024-01-04',
          },
        ],
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockResponse as any)

      const pages = await listNotionPages('test-token')

      expect(pages).toHaveLength(2)
      expect(pages[0]!.id).toBe('page-1')
      expect(pages[0]!.title).toBe('Page 1')
      expect(pages[1]!.id).toBe('page-2')
      expect(pages[1]!.title).toBe('Page 2')
    })

    it('should filter out non-page results', async () => {
      const mockResponse = {
        results: [
          {
            id: 'page-1',
            parent: { type: 'workspace' },
            properties: {
              title: {
                title: [{ plain_text: 'Page 1' }],
              },
            },
          },
          {
            id: 'not-a-page',
            parent: { type: 'other' },
            properties: {},
          },
        ],
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockResponse as any)

      const pages = await listNotionPages('test-token')

      expect(pages).toHaveLength(1)
      expect(pages[0]!.id).toBe('page-1')
    })

    it('should handle pages without title', async () => {
      const mockResponse = {
        results: [
          {
            id: 'page-1',
            parent: { type: 'workspace' },
            properties: {},
          },
        ],
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockResponse as any)

      const pages = await listNotionPages('test-token')

      expect(pages[0]!.title).toBe('Untitled')
    })
  })

  describe('getNotionPageContent', () => {
    it('should return page content with blocks', async () => {
      const mockBlocksResponse = {
        results: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ plain_text: 'Hello world' }],
            },
          },
          {
            type: 'heading_1',
            heading_1: {
              rich_text: [{ plain_text: 'Title' }],
            },
          },
          {
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ plain_text: 'Item 1' }],
            },
          },
        ],
      }

      const mockPageResponse = {
        properties: {
          title: {
            title: [{ plain_text: 'Test Page' }],
          },
        },
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.id).toBe('page-123')
      expect(page.title).toBe('Test Page')
      expect(page.content).toContain('Hello world')
      expect(page.content).toContain('# Title')
      expect(page.content).toContain('- Item 1')
    })

    it('should handle numbered list items', async () => {
      const mockBlocksResponse = {
        results: [
          {
            type: 'numbered_list_item',
            numbered_list_item: {
              rich_text: [{ plain_text: 'First item' }],
            },
          },
        ],
      }

      const mockPageResponse = {
        properties: {
          title: { title: [{ plain_text: 'List Page' }] },
        },
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.content).toContain('1. First item')
    })

    it('should handle code blocks', async () => {
      const mockBlocksResponse = {
        results: [
          {
            type: 'code',
            code: {
              language: 'javascript',
              rich_text: [{ plain_text: "console.log('test')" }],
            },
          },
        ],
      }

      const mockPageResponse = {
        properties: {
          title: { title: [{ plain_text: 'Code Page' }] },
        },
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.content).toContain('```javascript')
      expect(page.content).toContain("console.log('test')")
    })

    it('should handle quote blocks', async () => {
      const mockBlocksResponse = {
        results: [
          {
            type: 'quote',
            quote: {
              rich_text: [{ plain_text: 'Important quote' }],
            },
          },
        ],
      }

      const mockPageResponse = {
        properties: {
          title: { title: [{ plain_text: 'Quote Page' }] },
        },
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.content).toContain('> Important quote')
    })

    it('should handle heading levels', async () => {
      const mockBlocksResponse = {
        results: [
          {
            type: 'heading_2',
            heading_2: { rich_text: [{ plain_text: 'H2 Title' }] },
          },
          {
            type: 'heading_3',
            heading_3: { rich_text: [{ plain_text: 'H3 Title' }] },
          },
        ],
      }

      const mockPageResponse = {
        properties: {
          title: { title: [{ plain_text: 'Headings Page' }] },
        },
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.content).toContain('## H2 Title')
      expect(page.content).toContain('### H3 Title')
    })

    it('should use Untitled for page without title', async () => {
      const mockBlocksResponse = { results: [] }
      const mockPageResponse = {
        properties: {},
        created_time: '2024-01-01',
        last_edited_time: '2024-01-02',
      }

      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce(mockBlocksResponse as any)
        .mockResolvedValueOnce(mockPageResponse as any)

      const page = await getNotionPageContent('page-123', 'test-token')

      expect(page.title).toBe('Untitled')
    })
  })

  describe('saveNotionConnector', () => {
    it('should create a connector with encrypted credentials', async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: 'connector-1',
        userId: 'user-123',
        organizationId: 'org-456',
        type: 'NOTION',
        name: 'Notion',
        status: 'ACTIVE',
      } as any)

      const result = await saveNotionConnector('user-123', 'org-456', 'access-token')

      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          organizationId: 'org-456',
          type: 'NOTION',
          name: 'Notion',
          status: 'ACTIVE',
          credentials: 'encrypted_access-token',
          config: {},
        },
      })

      expect(result.id).toBe('connector-1')
    })
  })
})
