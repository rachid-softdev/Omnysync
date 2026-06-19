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
  createWordPressClient,
  saveWordPressConnector,
  testWordPressConnection,
} from "../wordpress";

describe("WordPress Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const siteUrl = "https://example.com";
  const username = "admin";
  const password = "secret";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWordPressClient", () => {
    it("should return client with API methods", () => {
      const client = createWordPressClient(siteUrl, username, password);
      expect(client.getCategories).toBeDefined();
      expect(client.getTags).toBeDefined();
      expect(client.createPost).toBeDefined();
      expect(client.updatePost).toBeDefined();
      expect(client.getPost).toBeDefined();
      expect(client.uploadMedia).toBeDefined();
      expect(client.getUsers).toBeDefined();
    });
  });

  describe("saveWordPressConnector", () => {
    it("should create a WordPress connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

      const result = await saveWordPressConnector(
        userId,
        orgId,
        siteUrl,
        username,
        password,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "WORDPRESS",
          name: expect.stringContaining("WordPress"),
          config: { siteUrl },
          credentials: expect.stringContaining("enc_"),
        }),
      });
    });
  });

  describe("testWordPressConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([{ id: 1, name: "Uncategorized" }] as any);

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Invalid credentials"),
      );

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });
  });
});
