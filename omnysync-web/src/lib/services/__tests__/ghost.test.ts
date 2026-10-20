import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn() },
}))
const mockEncrypt = vi.hoisted(() => vi.fn((s: string) => 'ENC:' + s))

vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))
vi.mock('@omnysync/core/crypto', () => ({
  encrypt: mockEncrypt,
  decrypt: vi.fn((s: string) => s),
}))

import { createGhostClient, saveGhostConnector, testGhostConnection } from '@/lib/services/ghost'

const makeFetch = (ok: boolean, body: unknown = {}) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })

describe('createGhostClient', () => {
  it('builds a client exposing Ghost admin API methods', () => {
    const client = createGhostClient('https://ghost.example.com', 'id:secret')

    expect(typeof client.getTags).toBe('function')
    expect(typeof client.getAuthors).toBe('function')
    expect(typeof client.createPost).toBe('function')
    expect(typeof client.getPost).toBe('function')
  })

  it('calls the Ghost admin API for tags', async () => {
    const fetchMock = makeFetch(true, { tags: [{ id: '1', name: 'News', slug: 'news' }] })
    vi.stubGlobal('fetch', fetchMock)

    const client = createGhostClient('https://ghost.example.com', 'id:secret')
    await client.getTags()

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toContain('/ghost/api/admin/api/canary/admin/tags')
  })
})

describe('saveGhostConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encrypts the admin API key and persists a GHOST connector', async () => {
    mockPrisma.connector.create.mockResolvedValue({ id: 'conn-2' })

    const result = await saveGhostConnector(
      'user-1',
      'org-1',
      'https://ghost.example.com',
      'id:secret'
    )

    expect(mockEncrypt).toHaveBeenCalledWith('id:secret')
    expect(mockPrisma.connector.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        organizationId: 'org-1',
        type: 'GHOST',
        name: 'Ghost - ghost.example.com',
        status: 'ACTIVE',
        config: { siteUrl: 'https://ghost.example.com' },
        credentials: 'ENC:id:secret',
      },
    })
    expect(result).toEqual({ id: 'conn-2' })
  })
})

describe('testGhostConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when the API responds', async () => {
    vi.stubGlobal('fetch', makeFetch(true, { tags: [] }))

    const result = await testGhostConnection('https://ghost.example.com', 'id:secret')

    expect(result).toEqual({ success: true })
  })

  it('returns failure (with error message) when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

    const result = await testGhostConnection('https://ghost.example.com', 'id:secret')

    expect(result.success).toBe(false)
    expect(result.error).toBe('timeout')
  })
})
