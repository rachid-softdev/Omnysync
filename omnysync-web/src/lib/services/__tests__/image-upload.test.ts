import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))
const mockDecrypt = vi.hoisted(() => vi.fn((s: string) => s))

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
vi.mock('@omnysync/core/services/authz', () => ({
  requireDocumentAccess: vi.fn(),
}))
vi.mock('@omnysync/core/audit', () => ({ auditSync: { completed: vi.fn() } }))

import { uploadImageToDestination, uploadAllImages } from '@/lib/services/image-upload'

const makeFetch = (contentType = 'image/png') =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (key: string) =>
        key === 'content-type' ? contentType : key === 'content-length' ? '10' : null,
    },
    json: async () => ({ source_url: 'http://img.example.com/x.png' }),
    arrayBuffer: async () => new ArrayBuffer(8),
  })

describe('uploadImageToDestination', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when there is no destination connector', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', destConnector: null })

    const result = await uploadImageToDestination(
      'https://img.example.com/x.png',
      'doc-1',
      'user-1'
    )

    expect(result).toBeNull()
  })

  it('rejects (SSRF protection) for private/localhost URLs', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      destConnector: { type: 'WORDPRESS', config: { siteUrl: 'https://wp.example.com' } },
    })

    await expect(
      uploadImageToDestination('http://localhost/x.png', 'doc-1', 'user-1')
    ).rejects.toThrow('private network')
  })

  it('uploads to WordPress and returns the source URL', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      destConnector: {
        type: 'WORDPRESS',
        config: { siteUrl: 'https://wp.example.com' },
        credentials: 'ENC',
      },
    })
    vi.stubGlobal('fetch', makeFetch('image/png'))

    const result = await uploadImageToDestination(
      'https://img.example.com/x.png',
      'doc-1',
      'user-1'
    )

    expect(result).toBe('http://img.example.com/x.png')
    expect(mockDecrypt).toHaveBeenCalledWith('ENC')
  })

  it('returns null when the content type is not allowed', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      destConnector: {
        type: 'WORDPRESS',
        config: { siteUrl: 'https://wp.example.com' },
        credentials: 'ENC',
      },
    })
    vi.stubGlobal('fetch', makeFetch('text/html'))

    const result = await uploadImageToDestination(
      'https://img.example.com/x.png',
      'doc-1',
      'user-1'
    )

    expect(result).toBeNull()
  })
})

describe('uploadAllImages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty array when there is no featured image', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'doc-1', featuredImage: null })

    const result = await uploadAllImages('doc-1', 'user-1')

    expect(result).toEqual([])
    expect(mockPrisma.document.update).not.toHaveBeenCalled()
  })

  it('uploads the featured image and persists the returned URL', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      featuredImage: 'https://img.example.com/x.png',
      destConnector: {
        type: 'WORDPRESS',
        config: { siteUrl: 'https://wp.example.com' },
        credentials: 'ENC',
      },
    })
    vi.stubGlobal('fetch', makeFetch('image/png'))

    const result = await uploadAllImages('doc-1', 'user-1')

    expect(result).toEqual(['http://img.example.com/x.png'])
    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { featuredImage: 'http://img.example.com/x.png' },
    })
  })
})
