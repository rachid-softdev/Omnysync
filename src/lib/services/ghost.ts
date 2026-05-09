import { prisma } from "@/lib/prisma"
import { ERR_UPLOAD_MEDIA } from "@/lib/errors"
import { encrypt } from "@/lib/crypto"

export interface GhostPost {
  id?: string
  title: string
  html: string
  excerpt?: string
  status?: "draft" | "published" | "scheduled"
  tags?: string[]
  authors?: string[]
  feature_image?: string
  meta_title?: string
  meta_description?: string
}

export interface GhostTag {
  id: string
  name: string
  slug: string
}

export interface GhostAuthor {
  id: string
  name: string
  slug: string
}

export function createGhostClient(siteUrl: string, adminApiKey: string) {
  const [id, secret] = adminApiKey.split(":")
  const baseUrl = siteUrl.replace(/\/$/, "")
  
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Ghost ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
  }

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}/ghost/api/admin/api/canary/admin${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.errors?.[0]?.message || `Ghost API error: ${response.status}`)
    }

    const data = await response.json()
    return data[Object.keys(data)[0]]
  }

  return {
    async getTags(): Promise<GhostTag[]> {
      const result = await request<{ tags: GhostTag[] }>("/tags/?limit=all")
      return result.tags || []
    },

    async getAuthors(): Promise<GhostAuthor[]> {
      const result = await request<{ authors: GhostAuthor[] }>("/authors/?limit=all")
      return result.authors || []
    },

    async createPost(post: GhostPost): Promise<{ posts: Array<{ id: string }> }> {
      return request("/posts/", {
        method: "POST",
        body: JSON.stringify({ posts: [post] }),
      })
    },

    async updatePost(postId: string, post: Partial<GhostPost>): Promise<{ posts: Array<{ id: string }> }> {
      return request(`/posts/${postId}/`, {
        method: "PUT",
        body: JSON.stringify({ posts: [post] }),
      })
    },

    async getPost(postId: string): Promise<{ posts: GhostPost[] }> {
      return request(`/posts/${postId}/`)
    },

    async uploadImage(image: { file: Blob; filename: string }): Promise<{ images: Array<{ url: string }> }> {
      const formData = new FormData()
      formData.append("file", image.file, image.filename)
      formData.append("purpose", "image")

      const response = await fetch(`${baseUrl}/ghost/api/admin/api/canary/admin/images/upload`, {
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
  }
}

export async function saveGhostConnector(
  userId: string,
  organizationId: string,
  siteUrl: string,
  adminApiKey: string
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "GHOST",
      name: `Ghost - ${new URL(siteUrl).hostname}`,
      status: "ACTIVE",
      config: { siteUrl },
      credentials: encrypt(adminApiKey),
    },
  })
}

export async function testGhostConnection(siteUrl: string, adminApiKey: string) {
  try {
    const client = createGhostClient(siteUrl, adminApiKey)
    await client.getTags()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}