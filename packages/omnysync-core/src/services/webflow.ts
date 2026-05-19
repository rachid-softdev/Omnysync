import { prisma } from "../../prisma";
import { ERR_UPLOAD_MEDIA } from "../errors";
import { encrypt } from "../crypto";
import { fetchWithRetry } from "../http";

export interface WebflowPost {
  name: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  fields?: Record<string, string | boolean | undefined>;
}

export interface WebflowCollection {
  id: string;
  name: string;
  slug: string;
}

export function createWebflowClient(accessToken: string, siteId: string) {
  const baseUrl = "https://api.webflow.com";

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    return fetchWithRetry<T>(`${baseUrl}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
  }

  return {
    async getCollections(): Promise<{ collections: WebflowCollection[] }> {
      return request(`/sites/${siteId}/collections`);
    },

    async getCollectionItems(
      collectionId: string,
    ): Promise<{ items: Array<{ id: string; name: string; slug: string }> }> {
      return request(`/collections/${collectionId}/items`);
    },

    async createItem(
      collectionId: string,
      item: WebflowPost,
    ): Promise<{ items: Array<{ id: string }> }> {
      return request(`/collections/${collectionId}/items`, {
        method: "POST",
        body: JSON.stringify({
          fields: {
            name: item.name,
            slug: item.slug,
            _archived: item.status === "draft",
            _draft: item.status === "draft",
            "post-body": item.content,
            ...item.fields,
          },
        }),
      });
    },

    async updateItem(
      collectionId: string,
      itemId: string,
      item: Partial<WebflowPost>,
    ): Promise<{ items: Array<{ id: string }> }> {
      return request(`/collections/${collectionId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          fields: {
            ...(item.name && { name: item.name }),
            ...(item.slug && { slug: item.slug }),
            ...(item.content && { "post-body": item.content }),
            ...(item.status && {
              _archived: item.status === "draft",
              _draft: item.status === "draft",
            }),
          },
        }),
      });
    },

    async uploadMedia(file: Blob, filename: string): Promise<{ url: string }> {
      const formData = new FormData();
      formData.append("file", file, filename);

      const response = await fetch(`${baseUrl}/sites/${siteId}/assets`, {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(ERR_UPLOAD_MEDIA);
      }

      return response.json();
    },
  };
}

export async function saveWebflowConnector(
  userId: string,
  organizationId: string,
  siteId: string,
  accessToken: string,
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "WEBFLOW",
      name: `Webflow - ${siteId}`,
      status: "ACTIVE",
      config: { siteId },
      credentials: encrypt(accessToken),
    },
  });
}

export async function testWebflowConnection(
  accessToken: string,
  siteId: string,
) {
  try {
    const client = createWebflowClient(accessToken, siteId);
    await client.getCollections();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
