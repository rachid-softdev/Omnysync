/**
 * Tests for the Connector Documents API route
 * Covers GET /api/connectors/[id]/documents
 *
 * Pattern: mock auth + prisma + core services at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

// Identity crypto: the routes must decrypt before reading the stored value;
// mocking here keeps the test focused on the route logic.
vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((value: string) => value),
  encrypt: vi.fn((value: string) => value),
}))

vi.mock('@omnysync/core/services/google-docs', () => ({
  listGoogleDocs: vi.fn(),
}))

vi.mock('@omnysync/core/services/notion', () => ({
  listNotionPages: vi.fn(),
}))

vi.mock('@omnysync/core/services/airtable', () => ({
  listAirtableDocuments: vi.fn(),
}))

vi.mock('@omnysync/core/services/contentful', () => ({
  listContentfulDocuments: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { decrypt } from '@/lib/crypto'
import { listGoogleDocs } from '@omnysync/core/services/google-docs'
import { listNotionPages } from '@omnysync/core/services/notion'
import { listAirtableDocuments } from '@omnysync/core/services/airtable'
import { listContentfulDocuments } from '@omnysync/core/services/contentful'

// ============================================================================
// GET /api/connectors/[id]/documents
// ============================================================================

describe('GET /api/connectors/[id]/documents', () => {
  const makeRequest = () =>
    new NextRequest('http://localhost:3000/api/connectors/conn-1/documents', {
      method: 'GET',
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: connector exists in the caller's organization
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-1',
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'GOOGLE_DOCS',
      credentials: JSON.stringify({ accessToken: 'google-token-123' }),
      config: {},
    } as any)
  })

  // ── Unauthenticated ─────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-1' }),
    })

    expect(response.status).toBe(401)
  })

  // ── Connector not found ─────────────────────────────────────────────────

  it('should return 404 when connector does not exist', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'nonexistent-connector' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Connector of another organization ───────────────────────────────────

  it('should return 404 when connector belongs to another organization', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-other',
      userId: 'user-other',
      organizationId: 'org-other',
      type: 'GOOGLE_DOCS',
    } as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-other' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Google Docs: returns documents ──────────────────────────────────────

  it('should decrypt the credentials and call listGoogleDocs for GOOGLE_DOCS', async () => {
    const mockDocs = [
      { id: 'doc-1', name: 'Document 1', modifiedTime: '2026-06-19T10:00:00Z' },
      { id: 'doc-2', name: 'Document 2', modifiedTime: '2026-06-18T10:00:00Z' },
    ]
    vi.mocked(listGoogleDocs).mockResolvedValue(mockDocs as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockDocs)
    expect(decrypt).toHaveBeenCalled()
    expect(listGoogleDocs).toHaveBeenCalledWith('google-token-123')
  })

  // ── Notion: returns pages ───────────────────────────────────────────────

  it('should decrypt the Notion token from credentials and list pages', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-notion',
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'NOTION',
      credentials: 'notion-token-456',
      config: {},
    } as any)

    const mockPages = [
      { id: 'page-1', title: 'Notion Page 1' },
      { id: 'page-2', title: 'Notion Page 2' },
    ]
    vi.mocked(listNotionPages).mockResolvedValue(mockPages as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-notion' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockPages)
    // The token is stored encrypted in `credentials`, never in `config`.
    expect(decrypt).toHaveBeenCalledWith('notion-token-456')
    expect(listNotionPages).toHaveBeenCalledWith('notion-token-456')
  })

  // ── Airtable: returns records ───────────────────────────────────────────

  it('should call listAirtableDocuments for AIRTABLE type', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-airtable',
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'AIRTABLE',
      credentials: 'airtable-key',
      config: '{"baseId":"app123"}',
    } as any)

    const mockRecords = [{ id: 'table1:rec1', title: 'Airtable record' }]
    vi.mocked(listAirtableDocuments).mockResolvedValue(mockRecords as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-airtable' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockRecords)
    expect(listAirtableDocuments).toHaveBeenCalledWith('conn-airtable')
  })

  // ── Contentful: returns entries ─────────────────────────────────────────

  it('should call listContentfulDocuments for CONTENTFUL type', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-contentful',
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'CONTENTFUL',
      credentials: 'contentful-token',
      config: '{"spaceId":"space123"}',
    } as any)

    const mockEntries = [{ id: 'article:entry1', title: 'Contentful entry' }]
    vi.mocked(listContentfulDocuments).mockResolvedValue(mockEntries as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-contentful' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockEntries)
    expect(listContentfulDocuments).toHaveBeenCalledWith('conn-contentful')
  })

  // ── Unsupported connector type ──────────────────────────────────────────

  it('should return 400 for unsupported connector types (e.g., WORDPRESS)', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-wp',
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'WORDPRESS',
    } as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-wp' }),
    })

    expect(response.status).toBe(400)
  })

  // ── Service throws error ────────────────────────────────────────────────

  it('should return 500 when listGoogleDocs throws an error', async () => {
    vi.mocked(listGoogleDocs).mockRejectedValue(new Error('Google API rate limit exceeded'))

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Google API rate limit exceeded')
  })

  // ── Service throws non-Error ────────────────────────────────────────────

  it('should return 500 when listGoogleDocs throws a non-Error', async () => {
    vi.mocked(listGoogleDocs).mockRejectedValue('String error')

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-1' }),
    })

    expect(response.status).toBe(500)
  })
})
