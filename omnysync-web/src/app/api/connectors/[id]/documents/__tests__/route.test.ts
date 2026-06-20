/* eslint-disable @typescript-eslint/no-explicit-any */

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

vi.mock('@omnysync/core/services/google-docs', () => ({
  listGoogleDocs: vi.fn(),
}))

vi.mock('@omnysync/core/services/notion', () => ({
  listNotionPages: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleDocs } from '@omnysync/core/services/google-docs'
import { listNotionPages } from '@omnysync/core/services/notion'

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

    // Default: connector exists and belongs to user
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-1',
      userId: 'user-1',
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

  // ── Connector belongs to another user ───────────────────────────────────

  it('should return 404 when connector belongs to another user', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-other',
      userId: 'user-other',
      type: 'GOOGLE_DOCS',
    } as any)

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-other' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Google Docs: returns documents ──────────────────────────────────────

  it('should call listGoogleDocs and return documents for GOOGLE_DOCS type', async () => {
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
    expect(listGoogleDocs).toHaveBeenCalledWith('google-token-123')
  })

  // ── Notion: returns pages ───────────────────────────────────────────────

  it('should call listNotionPages and return pages for NOTION type', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-notion',
      userId: 'user-1',
      type: 'NOTION',
      credentials: null,
      config: { accessToken: 'notion-token-456' },
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
    expect(listNotionPages).toHaveBeenCalledWith('notion-token-456')
  })

  // ── Notion: reads token from credentials when config has no accessToken ─

  it('should read Notion token from credentials when config has no accessToken', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-notion',
      userId: 'user-1',
      type: 'NOTION',
      credentials: JSON.stringify({ accessToken: 'creds-token' }),
      config: {},
    } as any)

    vi.mocked(listNotionPages).mockResolvedValue([])

    const { GET } = await import('@/app/api/connectors/[id]/documents/route')
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'conn-notion' }),
    })

    expect(response.status).toBe(200)
    // When config has no accessToken, it falls back to credentials
    expect(listNotionPages).toHaveBeenCalledWith('')
  })

  // ── Unsupported connector type ──────────────────────────────────────────

  it('should return 400 for unsupported connector types (e.g., WORDPRESS)', async () => {
    vi.mocked(prisma.connector.findUnique).mockResolvedValue({
      id: 'conn-wp',
      userId: 'user-1',
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
