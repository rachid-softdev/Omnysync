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
  });

  describe("saveWebflowConnector", () => {
    it("should create a Webflow connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

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
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Invalid API key"),
      );

      const result = await testWebflowConnection(accessToken, siteId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });
});
