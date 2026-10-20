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
  createShopifyClient,
  saveShopifyConnector,
  testShopifyConnection,
} from '@/lib/services/shopify'

const makeFetch = (ok: boolean, body: unknown = {}) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })

describe('createShopifyClient', () => {
  it('builds a client exposing Shopify blog/article methods', () => {
    const client = createShopifyClient('shop.myshopify.com', 'token')

    expect(typeof client.getBlogs).toBe('function')
    expect(typeof client.createArticle).toBe('function')
    expect(typeof client.updateArticle).toBe('function')
    expect(typeof client.getArticle).toBe('function')
  })

  it('calls the Shopify admin API for blogs', async () => {
    const fetchMock = makeFetch(true, { blogs: [{ id: 'b1', title: 'News' }] })
    vi.stubGlobal('fetch', fetchMock)

    const client = createShopifyClient('shop.myshopify.com', 'token')
    await client.getBlogs()

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toBe('https://shop.myshopify.com/admin/api/2024-01/blogs.json')
  })
})

describe('saveShopifyConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encrypts the access token and persists a SHOPIFY connector', async () => {
    mockPrisma.connector.create.mockResolvedValue({ id: 'conn-4' })

    const result = await saveShopifyConnector('user-1', 'org-1', 'shop.myshopify.com', 'token')

    expect(mockEncrypt).toHaveBeenCalledWith('token')
    expect(mockPrisma.connector.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        organizationId: 'org-1',
        type: 'SHOPIFY',
        name: 'Shopify - shop.myshopify.com',
        status: 'ACTIVE',
        config: { shopDomain: 'shop.myshopify.com' },
        credentials: 'ENC:token',
      },
    })
    expect(result).toEqual({ id: 'conn-4' })
  })
})

describe('testShopifyConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when the API responds', async () => {
    vi.stubGlobal('fetch', makeFetch(true, { blogs: [] }))

    const result = await testShopifyConnection('shop.myshopify.com', 'token')

    expect(result).toEqual({ success: true })
  })

  it('returns failure (with error message) when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')))

    const result = await testShopifyConnection('shop.myshopify.com', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('unreachable')
  })
})
