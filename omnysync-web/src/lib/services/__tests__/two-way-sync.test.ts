import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  connector: { findUnique: vi.fn() },
}))
const mockDecrypt = vi.hoisted(() => vi.fn((s: string) => s))
const mockAuditSync = vi.hoisted(() => ({
  completed: vi.fn(),
  failed: vi.fn(),
  changesDetected: vi.fn(),
  conflictResolved: vi.fn(),
}))

vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))
vi.mock('@omnysync/core/crypto', () => ({ encrypt: vi.fn(), decrypt: mockDecrypt }))
vi.mock('crypto', () => {
  const randomBytes = vi.fn(() => ({ toString: () => '0'.repeat(64) }))
  return { randomBytes, default: { randomBytes } }
})
vi.mock('@omnysync/core/audit', () => ({ auditSync: mockAuditSync }))
vi.mock('@omnysync/core/services/authz', () => ({
  requireDocumentAccess: vi.fn(),
}))

import {
  detectConflicts,
  syncFromSource,
  syncFromDest,
  resolveConflict,
} from '@/lib/services/two-way-sync'

const makeFetch = (ok: boolean, body: unknown = {}) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })

describe('detectConflicts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports no conflict when the document does not exist', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)

    const result = await detectConflicts('doc-1')

    expect(result).toEqual({ hasConflict: false })
  })

  it('reports no conflict when there is no destination connector', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', destConnector: null })

    const result = await detectConflicts('doc-1')

    expect(result.hasConflict).toBe(false)
  })

  it('detects a dest-changed conflict when remote content differs', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      htmlContent: 'local',
      content: 'local',
      sourceConnector: null,
      destConnector: {
        type: 'WORDPRESS',
        slug: '5',
        credentials: 'ENC',
        config: { siteUrl: 'https://wp.example.com' },
      },
    })
    vi.stubGlobal(
      'fetch',
      makeFetch(true, { id: 5, title: 'T', content: 'remote', status: 'publish' })
    )

    const result = await detectConflicts('doc-1')

    expect(result.hasConflict).toBe(true)
    expect(result.conflictType).toBe('dest-changed')
    expect(result.destContent).toBe('remote')
  })
})

describe('syncFromSource', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns failure when the document or connectors are missing', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      sourceConnectorId: null,
      destConnectorId: null,
    })

    const result = await syncFromSource('doc-1', 'user-1')

    expect(result.success).toBe(false)
    expect(result.direction).toBe('none')
    expect(result.message).toBe('Document not found')
  })

  it('returns failure when source content is unavailable', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      organizationId: 'org-1',
      sourceConnectorId: 'sc',
      destConnectorId: 'dc',
      sourceConnector: { type: 'WORDPRESS' },
      destConnector: { type: 'GHOST' },
    })

    const result = await syncFromSource('doc-1', 'user-1')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Source content not available')
  })
})

describe('syncFromDest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports reverse sync unsupported for non-Notion sources', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      organizationId: 'org-1',
      sourceConnector: { type: 'WORDPRESS' },
      destConnector: { type: 'GHOST' },
    })

    const result = await syncFromDest('doc-1', 'user-1')

    expect(result.success).toBe(false)
    expect(result.message).toContain('Reverse sync not supported')
  })
})

describe('resolveConflict', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports no conflict to resolve when the document is missing', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)

    const result = await resolveConflict('doc-1', 'source-wins', 'user-1')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Document not found')
  })
})
