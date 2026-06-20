/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ encrypt: vi.fn((s) => `enc_${s}`) }));
vi.mock("../../http", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("../../errors", () => ({ ERR_UPLOAD_MEDIA: "ERR_UPLOAD_MEDIA" }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  createWebflowClient,
  saveWebflowConnector,
  testWebflowConnection,
} from "../webflow";

describe("Webflow Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const siteId = "site-abc123";
  const accessToken = "wf_api_abc123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWebflowClient", () => {
    it("should return client with collection methods", () => {
      const client = createWebflowClient(accessToken, siteId);
      expect(client.getCollections).toBeDefined();
      expect(client.getCollectionItems).toBeDefined();
      expect(client.createItem).toBeDefined();
      expect(client.updateItem).toBeDefined();
      expect(client.uploadMedia).toBeDefined();
    });

    it("getCollections should return collections from API", async () => {
      const collections = [{ id: "col-1", name: "Blog", slug: "blog" }];
      vi.mocked(fetchWithRetry).mockResolvedValue({ collections } as any);

      const client = createWebflowClient(accessToken, siteId);
      const result = await client.getCollections();

      expect(result.collections).toEqual(collections);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `https://api.webflow.com/sites/${siteId}/collections`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
    });

    it("getCollectionItems should return items", async () => {
      const items = [{ id: "item-1", name: "Post 1", slug: "post-1" }];
      vi.mocked(fetchWithRetry).mockResolvedValue({ items } as any);

      const client = createWebflowClient(accessToken, siteId);
      const result = await client.getCollectionItems("col-1");

      expect(result.items).toEqual(items);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `https://api.webflow.com/collections/col-1/items`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
    });

    it("createItem should create a CMS item", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "new-item-1" }],
      } as any);

      const client = createWebflowClient(accessToken, siteId);
      const result = await client.createItem("col-1", {
        name: "Test Post",
        slug: "test-post",
        content: "<p>Hello world</p>",
        status: "published",
      });

      expect(result.items[0].id).toBe("new-item-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `https://api.webflow.com/collections/col-1/items`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            fields: {
              name: "Test Post",
              slug: "test-post",
              _archived: false,
              _draft: false,
              "post-body": "<p>Hello world</p>",
            },
          }),
        }),
      );
    });

    it("updateItem should update an existing item", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "item-1" }],
      } as any);

      const client = createWebflowClient(accessToken, siteId);
      const result = await client.updateItem("col-1", "item-1", {
        name: "Updated Post",
        slug: "updated-post",
        content: "<p>Updated</p>",
        status: "published",
      });

      expect(result.items[0].id).toBe("item-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `https://api.webflow.com/collections/col-1/items/item-1`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            fields: {
              name: "Updated Post",
              slug: "updated-post",
              "post-body": "<p>Updated</p>",
              _archived: false,
              _draft: false,
            },
          }),
        }),
      );
    });

    it("createItem should set draft/archived flags based on status", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "item-draft" }],
      } as any);

      const client = createWebflowClient(accessToken, siteId);

      // Draft status — _archived and _draft should be true
      await client.createItem("col-1", {
        name: "Draft Post",
        slug: "draft-post",
        content: "<p>Draft</p>",
        status: "draft",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            fields: {
              name: "Draft Post",
              slug: "draft-post",
              _archived: true,
              _draft: true,
              "post-body": "<p>Draft</p>",
            },
          }),
        }),
      );

      // Published status — _archived and _draft should be false
      await client.createItem("col-1", {
        name: "Published Post",
        slug: "published-post",
        content: "<p>Published</p>",
        status: "published",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            fields: {
              name: "Published Post",
              slug: "published-post",
              _archived: false,
              _draft: false,
              "post-body": "<p>Published</p>",
            },
          }),
        }),
      );
    });

    it("updateItem should only include provided fields", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "item-1" }],
      } as any);

      const client = createWebflowClient(accessToken, siteId);

      // Partial update — only name provided
      await client.updateItem("col-1", "item-1", {
        name: "Just Name Update",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        `https://api.webflow.com/collections/col-1/items/item-1`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            fields: {
              name: "Just Name Update",
            },
          }),
        }),
      );
    });

    it("uploadMedia should upload a file and return the URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ url: "https://assets.webflow.com/image.png" }),
      } as any);

      const client = createWebflowClient(accessToken, siteId);
      const blob = new Blob(["dummy"], { type: "image/png" });
      const result = await client.uploadMedia(blob, "test.png");

      expect(result.url).toBe("https://assets.webflow.com/image.png");
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.webflow.com/sites/${siteId}/assets`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
    });

    it("uploadMedia should throw ERR_UPLOAD_MEDIA when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      const client = createWebflowClient(accessToken, siteId);
      const blob = new Blob(["dummy"], { type: "image/png" });

      await expect(client.uploadMedia(blob, "test.png")).rejects.toThrow(
        "ERR_UPLOAD_MEDIA",
      );
    });
  });

  describe("saveWebflowConnector", () => {
    it("should create a Webflow connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveWebflowConnector(
        userId,
        orgId,
        siteId,
        accessToken,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "WEBFLOW",
          name: `Webflow - ${siteId}`,
          config: { siteId },
          credentials: `enc_${accessToken}`,
        }),
      });
    });
  });

  describe("testWebflowConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ collections: [] } as any);

      const result = await testWebflowConnection(accessToken, siteId);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Invalid API key"));

      const result = await testWebflowConnection(accessToken, siteId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });
});
