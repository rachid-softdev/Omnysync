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
  createGhostClient,
  saveGhostConnector,
  testGhostConnection,
} from "../ghost";

describe("Ghost Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const siteUrl = "https://myblog.ghost.io";
  const adminApiKey = "abc123:def456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGhostClient", () => {
    it("should return client with API methods", () => {
      const client = createGhostClient(siteUrl, adminApiKey);
      expect(client.getTags).toBeDefined();
      expect(client.getAuthors).toBeDefined();
      expect(client.createPost).toBeDefined();
      expect(client.updatePost).toBeDefined();
      expect(client.getPost).toBeDefined();
      expect(client.uploadImage).toBeDefined();
    });
  });

  describe("saveGhostConnector", () => {
    it("should create a Ghost connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

      const result = await saveGhostConnector(
        userId,
        orgId,
        siteUrl,
        adminApiKey,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "GHOST",
          name: expect.stringContaining("Ghost"),
          config: { siteUrl },
          credentials: `enc_${adminApiKey}`,
        }),
      });
    });
  });

  describe("testGhostConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ tags: [] } as any);

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Invalid API key"),
      );

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });
});
