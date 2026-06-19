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
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

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
      vi.mocked(fetchWithRetry).mockResolvedValue({ blogs: [{ id: "1", title: "Blog" }] } as any);

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(true);
    });

    it("should return error on connection failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Unauthorized"));

      const result = await testShopifyConnection(shopDomain, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });
});
