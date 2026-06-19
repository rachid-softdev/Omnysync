/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn(), findUnique: vi.fn() },
  document: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  encrypt: vi.fn((s) => `enc_${s}`),
  decrypt: vi.fn((s) => s.replace("enc_", "")),
}));
vi.mock("../../http", () => ({ fetchWithRetry: vi.fn() }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  getMediumUser,
  listMediumPublications,
  createMediumPost,
  testMediumConnection,
  saveMediumConnector,
  publishToMedium,
} from "../medium";

describe("Medium Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const accessToken = "mdm_abc123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMediumUser", () => {
    it("should return user profile", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: { id: "user-1", username: "testuser", name: "Test", url: "https://medium.com/@testuser", imageUrl: "" },
      } as any);

      const user = await getMediumUser(accessToken);

      expect(user.id).toBe("user-1");
      expect(user.username).toBe("testuser");
    });

    it("should throw on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Invalid token"));

      await expect(getMediumUser(accessToken)).rejects.toThrow(
        "Failed to fetch Medium user",
      );
    });
  });

  describe("listMediumPublications", () => {
    it("should return publications list", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: [{ id: "pub-1", name: "My Pub", description: "", url: "", imageUrl: "" }],
      } as any);

      const pubs = await listMediumPublications(accessToken, "user-1");

      expect(pubs.length).toBe(1);
      expect(pubs[0].name).toBe("My Pub");
    });
  });

  describe("createMediumPost", () => {
    it("should create a post and return it", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: { id: "post-1", title: "My Post", authorId: "user-1", tags: [], url: "https://medium.com/p/post-1", canonicalUrl: "", publishStatus: "public", publishedAt: "2026-06-01", content: "html", contentFormat: "html" },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "My Post",
        contentFormat: "html",
        content: "<p>Hello</p>",
      });

      expect(post.id).toBe("post-1");
    });
  });

  describe("testMediumConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: { id: "user-1", username: "test", name: "", url: "", imageUrl: "" },
      } as any);

      const result = await testMediumConnection(accessToken);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Bad token"));

      const result = await testMediumConnection(accessToken);

      expect(result.success).toBe(false);
    });
  });

  describe("saveMediumConnector", () => {
    it("should fetch user and create connector", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: { id: "user-1", username: "testuser", name: "Test", url: "", imageUrl: "" },
      } as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

      const result = await saveMediumConnector(userId, orgId, accessToken);

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "MEDIUM",
          name: "Medium (@testuser)",
          credentials: `enc_${accessToken}`,
        }),
      });
    });
  });

  describe("publishToMedium", () => {
    it("should publish a document and update it", async () => {
      const connector = {
        id: "conn-1",
        type: "MEDIUM",
        credentials: "enc_token",
        config: '{"userId":"user-1","username":"testuser"}',
      };
      const document = {
        id: "doc-1",
        title: "Test Doc",
        htmlContent: "<p>Hello</p>",
        content: "Hello",
        tags: ["tag1"],
      };
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(connector as any);
      vi.mocked(prisma.document.findUnique).mockResolvedValue(document as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: { id: "post-1", title: "Test Doc", authorId: "user-1", tags: [], url: "https://medium.com/p/post-1", canonicalUrl: "", publishStatus: "public", publishedAt: "2026-06-01", content: "<p>Hello</p>", contentFormat: "html" },
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await publishToMedium("conn-1", "doc-1");

      expect(result.url).toBe("https://medium.com/p/post-1");
      expect(prisma.document.update).toHaveBeenCalled();
    });
  });
});
