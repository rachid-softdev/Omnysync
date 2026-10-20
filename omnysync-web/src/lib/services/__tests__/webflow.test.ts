import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn().mockResolvedValue({ id: 'c-1' }) },
}))
const mockEncrypt = vi.hoisted(() => vi.fn((s: string) => `ENC:${s}`))
const mockFetchWithRetry = vi.hoisted(() => vi.fn())
const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))
vi.mock('@omnysync/core/crypto', () => ({ encrypt: mockEncrypt, decrypt: vi.fn() }))
vi.mock('@omnysync/core/errors', () => ({ ERR_UPLOAD_MEDIA: 'ERR_UPLOAD_MEDIA' }))
vi.mock('@omnysync/core/http', () => ({ fetchWithRetry: mockFetchWithRetry }))

import {
  createWebflowClient,
  saveWebflowConnector,
  testWebflowConnection,
} from '@/lib/services/webflow'

describe('createWebflowClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the Webflow API for collections via fetchWithRetry', async () => {
    mockFetchWithRetry.mockResolvedValue({
      collections: [{ id: 'col-1', name: 'Posts', slug: 'posts' }],
    })

    const client = createWebflowClient('tok', 'site-1')
    const res = await client.getCollections()

    expect(mockFetchWithRetry).toHaveBeenCalledWith(
      'https://api.webflow.com/sites/site-1/collections',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    )
    expect(res.collections[0].id).toBe('col-1')
  })

  it('posts an item with draft flags when status is draft', async () => {
    mockFetchWithRetry.mockResolvedValue({ items: [{ id: 'it-1' }] })

    const client = createWebflowClient('tok', 'site-1')
    await client.createItem('col-1', {
      name: 'Hello',
      slug: 'hello',
      content: 'body',
      status: 'draft',
    })

    const callArgs = mockFetchWithRetry.mock.calls[0][1]
    const body = JSON.parse(callArgs.body as string)
    expect(body.fields._archived).toBe(true)
    expect(body.fields._draft).toBe(true)
    expect(body.fields['post-body']).toBe('body')
  })

  it('uploads media via the assets endpoint and returns the json url', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ url: 'https://cdn/x.png' }) })
    vi.stubGlobal('fetch', mockFetch)

    const client = createWebflowClient('tok', 'site-1')
    const res = await client.uploadMedia(new Blob(['x']), 'x.png')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.webflow.com/sites/site-1/assets',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer tok' } })
    )
    expect(res).toEqual({ url: 'https://cdn/x.png' })
  })

  it('throws ERR_UPLOAD_MEDIA when the asset upload is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    const client = createWebflowClient('tok', 'site-1')
    await expect(client.uploadMedia(new Blob(['x']), 'x.png')).rejects.toThrow('ERR_UPLOAD_MEDIA')
  })
})

describe('saveWebflowConnector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an ACTIVE WEBFLOW connector with encrypted credentials', async () => {
    const res = await saveWebflowConnector('u-1', 'org-1', 'site-1', 'tok')

    expect(mockEncrypt).toHaveBeenCalledWith('tok')
    expect(mockPrisma.connector.create).toHaveBeenCalledWith({
      data: {
        userId: 'u-1',
        organizationId: 'org-1',
        type: 'WEBFLOW',
        name: 'Webflow - site-1',
        status: 'ACTIVE',
        config: { siteId: 'site-1' },
        credentials: 'ENC:tok',
      },
    })
    expect(res).toEqual({ id: 'c-1' })
  })
})

describe('testWebflowConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success when collections are reachable', async () => {
    mockFetchWithRetry.mockResolvedValue({ collections: [] })
    const res = await testWebflowConnection('tok', 'site-1')
    expect(res).toEqual({ success: true })
  })

  it('returns failure with the error message on thrown error', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('network down'))
    const res = await testWebflowConnection('tok', 'site-1')
    expect(res).toEqual({ success: false, error: 'network down' })
  })
})
