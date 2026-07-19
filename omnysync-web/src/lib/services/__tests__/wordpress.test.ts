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

import {
  createWordPressClient,
  saveWordPressConnector,
  testWordPressConnection,
} from '@/lib/services/wordpress'

const makeFetch = (ok: boolean, body: unknown = {}) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })

describe('createWordPressClient', () => {
  it('builds a client exposing WordPress REST methods', () => {
    const client = createWordPressClient('https://wp.example.com/', 'user', 'pass')

    expect(typeof client.getCategories).toBe('function')
    expect(typeof client.getTags).toBe('function')
    expect(typeof client.createPost).toBe('function')
    expect(typeof client.getPost).toBe('function')
  })

  it('calls the wp-json REST endpoint for categories', async () => {
    const fetchMock = makeFetch(true, [{ id: 1, name: 'News', slug: 'news' }])
    vi.stubGlobal('fetch', fetchMock)

    const client = createWordPressClient('https://wp.example.com/', 'user', 'pass')
    await client.getCategories()

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toContain('/wp-json/wp/v2/categories')
    expect(calledUrl).toContain('per_page=100')
  })
})

describe('saveWordPressConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encrypts credentials and persists a WORDPRESS connector', async () => {
    mockPrisma.connector.create.mockResolvedValue({ id: 'conn-1' })
    const rawCreds = Buffer.from('user:pass').toString('base64')

    const result = await saveWordPressConnector(
      'user-1',
      'org-1',
      'https://wp.example.com',
      'user',
      'pass'
    )

    expect(mockEncrypt).toHaveBeenCalledWith(rawCreds)
    expect(mockPrisma.connector.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        organizationId: 'org-1',
        type: 'WORDPRESS',
        name: 'WordPress - wp.example.com',
        status: 'ACTIVE',
        config: { siteUrl: 'https://wp.example.com' },
        credentials: 'ENC:' + rawCreds,
      },
    })
    expect(result).toEqual({ id: 'conn-1' })
  })
})

describe('testWordPressConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when the API responds', async () => {
    vi.stubGlobal('fetch', makeFetch(true, [{ id: 1, name: 'News', slug: 'news' }]))

    const result = await testWordPressConnection('https://wp.example.com', 'user', 'pass')

    expect(result).toEqual({ success: true })
  })

  it('returns failure (with error) when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await testWordPressConnection('https://wp.example.com', 'user', 'pass')

    expect(result.success).toBe(false)
    expect(result.error).toBe('network down')
  })
})
