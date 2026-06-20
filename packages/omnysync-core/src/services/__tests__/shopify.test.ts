/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ encrypt: vi.fn((s) => `enc_${s}`) }));
vi.mock("../../http", () => ({
  fetchWithRetry: vi.fn(),
}));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  createShopifyClient,
  saveShopifyConnector,
  testShopifyConnection,
} from "../shopify";

describe("Shopify Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const shopDomain = "test.myshopify.com";
  const accessToken = "shpat_abc123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createShopifyClient", () => {
    it("should return client with blog methods", () => {
      const client = createShopifyClient(shopDomain, accessToken);
      expect(client.getBlogs).toBeDefined();
      expect(client.createArticle).toBeDefined();
      expect(client.updateArticle).toBeDefined();
      expect(client.getArticle).toBeDefined();
      expect(client.uploadImage).toBeDefined();
    });
  });

  describe("saveShopifyConnector", () => {
    it("should create a Shopify connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveShopifyConnector(
        userId,
        orgId,
        shopDomain,
        accessToken,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "SHOPIFY",
          name: `Shopify - ${shopDomain}`,
          status: "ACTIVE",
          config: { shopDomain },
          credentials: `enc_${accessToken}`,
        }),
      });
    });
  });

  describe("testShopifyConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        blogs: [{ id: "1", title: "Blog" }],
      } as any);

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(true);
    });

    it("should return error on connection failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Unauthorized"));

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should handle network timeout errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("fetch failed: timeout"),
      );

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should handle missing accessToken (empty string)", async () => {
      const result = await testShopifyConnection(shopDomain, "");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle missing shopDomain (empty string)", async () => {
      const result = await testShopifyConnection("", accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle rate limit error (429 Too Many Requests)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("429 Too Many Requests - Rate limit exceeded"),
      );

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit");
    });
  });

  describe("Shopify API edge cases", () => {
    it("getBlogs should handle paginated responses", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        blogs: Array.from({ length: 50 }, (_, i) => ({
          id: String(i + 1),
          title: `Blog ${i + 1}`,
        })),
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const result = await client.getBlogs();

      expect(result.blogs).toHaveLength(50);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "https://test.myshopify.com/admin/api/2024-01/blogs.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Shopify-Access-Token": accessToken,
          }),
        }),
      );
    });

    it("createArticle should send correct payload", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        article: { id: "article-1" },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const article = {
        title: "Test Article",
        body_html: "<p>Hello</p>",
        author: "Test Author",
        tags: ["tag1", "tag2"],
      };

      const result = await client.createArticle("blog-1", article);

      expect(result.article.id).toBe("article-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "https://test.myshopify.com/admin/api/2024-01/blogs/blog-1/articles.json",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Test Article"),
        }),
      );
    });

    it("createArticle should handle empty body_html gracefully", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        article: { id: "article-empty" },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const article = { title: "Empty Body" };

      const result = await client.createArticle("blog-1", article);

      expect(result.article.id).toBe("article-empty");
    });

    it("updateArticle should send correct URL and payload", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        article: { id: "updated-1" },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const result = await client.updateArticle("blog-1", "article-123", {
        title: "Updated",
        body_html: "<p>New</p>",
      });

      expect(result.article.id).toBe("updated-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "https://test.myshopify.com/admin/api/2024-01/blogs/blog-1/articles/article-123.json",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Updated"),
        }),
      );
    });

    it("getArticle should fetch correct URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        article: {
          id: "article-1",
          title: "Test",
          body_html: "<p>Hello</p>",
        },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const result = await client.getArticle("blog-1", "article-123");

      expect(result.article.id).toBe("article-1");
      expect(result.article.title).toBe("Test");
      expect(result.article.body_html).toBe("<p>Hello</p>");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "https://test.myshopify.com/admin/api/2024-01/blogs/blog-1/articles/article-123.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Shopify-Access-Token": accessToken,
          }),
        }),
      );
    });

    it("uploadImage should send correct payload", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        asset: { src: "https://cdn.shopify.com/img.png" },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const result = await client.uploadImage({
        attachment: "base64data",
        filename: "image.png",
      });

      expect(result.asset.src).toBe("https://cdn.shopify.com/img.png");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "https://test.myshopify.com/admin/api/2024-01/assets.json",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("base64data"),
        }),
      );
    });

    it("getBlogs should handle empty blog list", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        blogs: [],
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const result = await client.getBlogs();

      expect(result.blogs).toEqual([]);
    });

    it("updateArticle should handle API errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Not found"));

      const client = createShopifyClient(shopDomain, accessToken);

      await expect(
        client.updateArticle("blog-1", "article-999", { title: "X" }),
      ).rejects.toThrow("Not found");
    });

    it("getArticle should handle API errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Article not found"),
      );

      const client = createShopifyClient(shopDomain, accessToken);

      await expect(client.getArticle("blog-1", "nonexistent")).rejects.toThrow(
        "Article not found",
      );
    });

    it("uploadImage should handle API errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Invalid image"));

      const client = createShopifyClient(shopDomain, accessToken);

      await expect(
        client.uploadImage({ attachment: "bad", filename: "bad.png" }),
      ).rejects.toThrow("Invalid image");
    });

    it("getBlogs should handle rate limit errors (429)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("429 Rate limit exceeded"),
      );

      const client = createShopifyClient(shopDomain, accessToken);

      await expect(client.getBlogs()).rejects.toThrow("Rate limit exceeded");
    });

    it("createArticle should include optional fields (author, tags, image) in payload", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        article: { id: "article-full" },
      } as any);

      const client = createShopifyClient(shopDomain, accessToken);
      const article = {
        title: "Full Article",
        body_html: "<p>Content</p>",
        author: "John Doe",
        tags: ["tech", "shopify"],
        image: { src: "https://example.com/img.jpg" },
        handle: "full-article",
      };

      const result = await client.createArticle("blog-1", article);

      expect(result.article.id).toBe("article-full");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("John Doe"),
        }),
      );
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("tech"),
        }),
      );
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("https://example.com/img.jpg"),
        }),
      );
    });

    it("createArticle should handle rate limit (429) errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("429 Too Many Requests"),
      );

      const client = createShopifyClient(shopDomain, accessToken);

      await expect(
        client.createArticle("blog-1", {
          title: "Test",
          body_html: "<p>X</p>",
        }),
      ).rejects.toThrow("429 Too Many Requests");
    });
  });
});
