import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listGoogleDocs,
  getGoogleDocContent,
  saveGoogleDocsConnector,
  updateConnectorCredentials,
} from '../services/google-docs'

// Mock dependencies — google-docs service is in @omnysync/core, imports internally
vi.mock('@omnysync/core/prisma', () => ({
  prisma: {
    connector: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@omnysync/core/crypto', () => ({
  encrypt: vi.fn((text) => `encrypted_${text}`),
}))

vi.mock('@omnysync/core/http', () => ({
  fetchWithRetry: vi.fn(),
  fetchWithTimeout: vi.fn(),
}))

vi.mock('@omnysync/core/errors', () => ({
  ERR_FETCH_CONTENT: 'ERR_FETCH_CONTENT',
}))

import { prisma } from '@omnysync/core/prisma'
import { fetchWithRetry } from '@omnysync/core/http'

describe('Google Docs Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listGoogleDocs', () => {
    it('should return list of Google Docs', async () => {
      const mockResponse = {
        files: [
          {
            id: 'doc-1',
            name: 'Document 1',
            createdTime: '2024-01-01T00:00:00Z',
            modifiedTime: '2024-01-02T00:00:00Z',
          },
          {
            id: 'doc-2',
            name: 'Document 2',
            createdTime: '2024-01-03T00:00:00Z',
            modifiedTime: '2024-01-04T00:00:00Z',
          },
        ],
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockResponse as any)

      const docs = await listGoogleDocs('test-token')

      expect(docs).toHaveLength(2)
      expect(docs[0]!.id).toBe('doc-1')
      expect(docs[0]!.title).toBe('Document 1')
      expect(docs[0]!.createdTime).toBe('2024-01-01T00:00:00Z')
      expect(docs[1]!.id).toBe('doc-2')
      expect(docs[1]!.title).toBe('Document 2')
    })

    it('should return empty content for each doc', async () => {
      const mockResponse = {
        files: [
          { id: 'doc-1', name: 'Test Doc', createdTime: '2024-01-01', modifiedTime: '2024-01-02' },
        ],
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockResponse as any)

      const docs = await listGoogleDocs('test-token')

      expect(docs[0]!.content).toBe('')
    })
  })

  describe('getGoogleDocContent', () => {
    it('should extract paragraph content', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        title: 'Test Document',
        body: {
          content: [
            {
              paragraph: {
                elements: [
                  { textRun: { content: 'Hello world' } },
                  { textRun: { content: 'Second line' } },
                ],
              },
            },
          ],
        },
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      expect(doc.id).toBe('doc-123')
      expect(doc.title).toBe('Test Document')
      expect(doc.content).toContain('Hello world')
      expect(doc.content).toContain('Second line')
    })

    it('should handle empty body', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        title: 'Empty Doc',
        body: null,
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      expect(doc.content).toBe('')
    })

    it('should handle content without body', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        title: 'No Body Doc',
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      expect(doc.content).toBe('')
    })

    it('should extract table content', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        title: 'Table Document',
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: 'Cell 1' } }],
                            },
                          },
                        ],
                      },
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: 'Cell 2' } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      expect(doc.content).toContain('Cell 1')
      expect(doc.content).toContain('Cell 2')
    })

    it('should use Untitled for doc without title', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        body: { content: [] },
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      expect(doc.title).toBe('Untitled')
    })

    it('should handle elements without textRun', async () => {
      const mockDocBody = {
        documentId: 'doc-123',
        title: 'Test Doc',
        body: {
          content: [
            {
              paragraph: {
                elements: [{}],
              },
            },
          ],
        },
      }

      vi.mocked(fetchWithRetry).mockResolvedValue(mockDocBody as any)

      const doc = await getGoogleDocContent('doc-123', 'test-token')

      // Without textRun, it adds a newline from the paragraph
      expect(doc.content).toBe('\n')
    })
  })

  describe('saveGoogleDocsConnector', () => {
    it('should create connector with encrypted credentials', async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: 'connector-1',
        userId: 'user-123',
        organizationId: 'org-456',
        type: 'GOOGLE_DOCS',
        name: 'Google Docs',
        status: 'ACTIVE',
      } as any)

      const result = await saveGoogleDocsConnector(
        'user-123',
        'org-456',
        'access-token',
        'refresh-token'
      )

      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          organizationId: 'org-456',
          type: 'GOOGLE_DOCS',
          name: 'Google Docs',
          status: 'ACTIVE',
          credentials: expect.stringContaining('encrypted_'),
        },
      })

      expect(result.id).toBe('connector-1')
    })
  })

  describe('updateConnectorCredentials', () => {
    it('should update connector with new credentials', async () => {
      vi.mocked(prisma.connector.update).mockResolvedValue({
        id: 'connector-1',
        credentials: 'encrypted_new_credentials',
      } as any)

      await updateConnectorCredentials('connector-1', 'new-access-token', 'new-refresh-token')

      expect(prisma.connector.update).toHaveBeenCalledWith({
        where: { id: 'connector-1' },
        data: {
          credentials: expect.stringContaining('encrypted_'),
        },
      })
    })
  })
})
