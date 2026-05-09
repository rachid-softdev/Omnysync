import { prisma } from "@/lib/prisma"
import { ERR_UPLOAD_MEDIA } from "@/lib/errors"
import { encrypt } from "@/lib/crypto"

export interface WordPressPost {
  id?: number
  title: string
  content: string
  excerpt?: string
  status: "draft" | "publish" | "pending" | "future"
  categories?: number[]
  tags?: number[]
  featured_media?: number
  meta?: Record<string, string | number | boolean | null>
}

export interface WordPressCategory {
  id: number
  name: string
  slug: string
}

export interface WordPressTag {
  id: number
  name: string
  slug: string
}

export function createWordPressClient(siteUrl: string, username: string, password: string) {
  const baseUrl = siteUrl.replace(/\/$/, "")
  
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  }

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `WordPress API error: ${response.status}`)
    }

    return response.json()
  }

  return {
    async getCategories(): Promise<WordPressCategory[]> {
      return request<WordPressCategory[]>("/categories?per_page=100")
    },

    async getTags(): Promise<WordPressTag[]> {
      return request<WordPressTag[]>("/tags?per_page=100")
    },

    async createPost(post: WordPressPost): Promise<{ id: number }> {
      return request<{ id: number }>("/posts", {
        method: "POST",
        body: JSON.stringify(post),
      })
    },

    async updatePost(postId: number, post: Partial<WordPressPost>): Promise<{ id: number }> {
      return request<{ id: number }>(`/posts/${postId}`, {
        method: "POST",
        body: JSON.stringify(post),
      })
    },

    async getPost(postId: number): Promise<WordPressPost & { id: number }> {
      return request<WordPressPost & { id: number }>(`/posts/${postId}`)
    },

    async uploadMedia(media: { file: Blob; title: string }): Promise<{ id: number; source_url: string }> {
      const formData = new FormData()
      formData.append("file", media.file)
      formData.append("title", media.title)

      const response = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(ERR_UPLOAD_MEDIA)
      }

      return response.json()
    },

    async getUsers(): Promise<{ id: number; name: string }[]> {
      return request<{ id: number; name: string }[]>("/users?per_page=100")
    },
  }
}

export async function saveWordPressConnector(
  userId: string,
  organizationId: string,
  siteUrl: string,
  username: string,
  password: string
) {
  const rawCredentials = Buffer.from(`${username}:${password}`).toString("base64")
  const encryptedCredentials = encrypt(rawCredentials)

  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "WORDPRESS",
      name: `WordPress - ${new URL(siteUrl).hostname}`,
      status: "ACTIVE",
      config: { siteUrl },
      credentials: encryptedCredentials,
    },
  })
}

export async function testWordPressConnection(siteUrl: string, username: string, password: string) {
  try {
    const client = createWordPressClient(siteUrl, username, password)
    await client.getCategories()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}