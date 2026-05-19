import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { fetchWithRetry } from '@/lib/http-client'

export interface ShopifyArticle {
  title: string
  body_html: string
  author?: string
  tags?: string[]
  image?: { src: string }
  handle?: string
}

export interface ShopifyBlog {
  id: string
  title: string
}

export function createShopifyClient(shopDomain: string, accessToken: string) {
  const baseUrl = `https://${shopDomain}/admin/api/2024-01`

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return fetchWithRetry<T>(`${baseUrl}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })
  }

  return {
    async getBlogs(): Promise<{ blogs: ShopifyBlog[] }> {
      return request('/blogs.json')
    },

    async createArticle(
      blogId: string,
      article: ShopifyArticle
    ): Promise<{ article: { id: string } }> {
      return request(`/blogs/${blogId}/articles.json`, {
        method: 'POST',
        body: JSON.stringify({ article }),
      })
    },

    async updateArticle(
      blogId: string,
      articleId: string,
      article: Partial<ShopifyArticle>
    ): Promise<{ article: { id: string } }> {
      return request(`/blogs/${blogId}/articles/${articleId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ article }),
      })
    },

    async getArticle(blogId: string, articleId: string): Promise<{ article: ShopifyArticle }> {
      return request(`/blogs/${blogId}/articles/${articleId}.json`)
    },

    async uploadImage(image: {
      attachment: string
      filename: string
    }): Promise<{ asset: { src: string } }> {
      return request('/assets.json', {
        method: 'POST',
        body: JSON.stringify({
          asset: {
            attachment: image.attachment,
            filename: image.filename,
          },
        }),
      })
    },
  }
}

export async function saveShopifyConnector(
  userId: string,
  organizationId: string,
  shopDomain: string,
  accessToken: string
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: 'SHOPIFY',
      name: `Shopify - ${shopDomain}`,
      status: 'ACTIVE',
      config: { shopDomain },
      credentials: encrypt(accessToken),
    },
  })
}

export async function testShopifyConnection(shopDomain: string, accessToken: string) {
  try {
    const client = createShopifyClient(shopDomain, accessToken)
    await client.getBlogs()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
