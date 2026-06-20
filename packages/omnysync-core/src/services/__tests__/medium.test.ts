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
  createMediumPublicationPost,
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
        data: {
          id: "user-1",
          username: "testuser",
          name: "Test",
          url: "https://medium.com/@testuser",
          imageUrl: "",
        },
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
        data: [
          {
            id: "pub-1",
            name: "My Pub",
            description: "",
            url: "",
            imageUrl: "",
          },
        ],
      } as any);

      const pubs = await listMediumPublications(accessToken, "user-1");

      expect(pubs.length).toBe(1);
      expect(pubs[0].name).toBe("My Pub");
    });

    it("should return empty array when no publications", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ data: [] } as any);

      const pubs = await listMediumPublications(accessToken, "user-1");

      expect(pubs).toEqual([]);
    });

    it("should throw on API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Failed to fetch"));

      await expect(
        listMediumPublications(accessToken, "user-1"),
      ).rejects.toThrow("Failed to fetch publications");
    });
  });

  describe("getMediumUser", () => {
    it("should throw on expired token", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Access token expired"),
      );

      await expect(getMediumUser(accessToken)).rejects.toThrow(
        "Failed to fetch Medium user",
      );
    });

    it("should throw on invalid token", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Invalid access token"),
      );

      await expect(getMediumUser(accessToken)).rejects.toThrow(
        "Failed to fetch Medium user",
      );
    });
  });

  describe("createMediumPost", () => {
    it("should create a post and return it", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-1",
          title: "My Post",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-1",
          canonicalUrl: "",
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "html",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "My Post",
        contentFormat: "html",
        content: "<p>Hello</p>",
      });

      expect(post.id).toBe("post-1");
    });

    it("should create a post with unlisted publish status", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-2",
          title: "Unlisted Post",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-2",
          canonicalUrl: "",
          publishStatus: "unlisted",
          publishedAt: "2026-06-01",
          content: "<p>Unlisted</p>",
          contentFormat: "markdown",
        },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "Unlisted Post",
        contentFormat: "markdown",
        content: "Unlisted content",
        publishStatus: "unlisted",
      });

      expect(post.publishStatus).toBe("unlisted");
    });

    it("should create a post with draft status", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-3",
          title: "Draft Post",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-3",
          canonicalUrl: "",
          publishStatus: "draft",
          publishedAt: "",
          content: "<p>Draft</p>",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "Draft Post",
        contentFormat: "html",
        content: "<p>Draft</p>",
        publishStatus: "draft",
      });

      expect(post.publishStatus).toBe("draft");
    });

    it("should create a post with canonicalUrl", async () => {
      const canonicalUrl = "https://example.com/original-post";
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-4",
          title: "Cross-posted",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-4",
          canonicalUrl,
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "<p>Content</p>",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "Cross-posted",
        contentFormat: "html",
        content: "<p>Content</p>",
        canonicalUrl,
      });

      expect(post.canonicalUrl).toBe(canonicalUrl);
    });

    it("should create a post with tags", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-5",
          title: "Tagged Post",
          authorId: "user-1",
          tags: ["tech", "javascript", "webdev"],
          url: "https://medium.com/p/post-5",
          canonicalUrl: "",
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "<p>Tags</p>",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPost(accessToken, "user-1", {
        title: "Tagged Post",
        contentFormat: "html",
        content: "<p>Tags</p>",
        tags: ["tech", "javascript", "webdev"],
      });

      expect(post.tags).toEqual(["tech", "javascript", "webdev"]);
      // Verify the tags were sent in the request body
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("tech"),
        }),
      );
    });

    it("should throw on invalid token (401)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Access token invalid"),
      );

      await expect(
        createMediumPost(accessToken, "user-1", {
          title: "Post",
          contentFormat: "html",
          content: "<p>Test</p>",
        }),
      ).rejects.toThrow("Failed to create Medium post");
    });

    it("should throw on rate limit (429)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Rate limit exceeded"),
      );

      await expect(
        createMediumPost(accessToken, "user-1", {
          title: "Post",
          contentFormat: "html",
          content: "<p>Test</p>",
        }),
      ).rejects.toThrow("Failed to create Medium post");
    });

    it("should throw on validation error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Validation error: title is required"),
      );

      await expect(
        createMediumPost(accessToken, "user-1", {
          title: "",
          contentFormat: "html",
          content: "<p>Test</p>",
        }),
      ).rejects.toThrow("Failed to create Medium post");
    });

    it("should throw on network error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Network error: connect ETIMEDOUT"),
      );

      await expect(
        createMediumPost(accessToken, "user-1", {
          title: "Post",
          contentFormat: "html",
          content: "<p>Test</p>",
        }),
      ).rejects.toThrow("Failed to create Medium post");
    });
  });

  describe("createMediumPublicationPost", () => {
    it("should create a post in a publication", async () => {
      const publicationId = "pub-1";
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-pub-1",
          title: "Publication Post",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-pub-1",
          canonicalUrl: "",
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "<p>Pub content</p>",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPublicationPost(
        accessToken,
        publicationId,
        {
          title: "Publication Post",
          contentFormat: "html",
          content: "<p>Pub content</p>",
        },
      );

      expect(post.id).toBe("post-pub-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(`/publications/${publicationId}/posts`),
        expect.any(Object),
      );
    });

    it("should create a post with unlisted status in publication", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-pub-2",
          title: "Unlisted in Pub",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-pub-2",
          canonicalUrl: "",
          publishStatus: "unlisted",
          publishedAt: "2026-06-01",
          content: "<p>Content</p>",
          contentFormat: "html",
        },
      } as any);

      const post = await createMediumPublicationPost(accessToken, "pub-2", {
        title: "Unlisted in Pub",
        contentFormat: "html",
        content: "<p>Content</p>",
        publishStatus: "unlisted",
      });

      expect(post.publishStatus).toBe("unlisted");
    });

    it("should throw on publication API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Publication not found"),
      );

      await expect(
        createMediumPublicationPost(accessToken, "nonexistent-pub", {
          title: "Post",
          contentFormat: "html",
          content: "<p>Test</p>",
        }),
      ).rejects.toThrow("Failed to create publication post");
    });
  });

  describe("testMediumConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "user-1",
          username: "test",
          name: "",
          url: "",
          imageUrl: "",
        },
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
        data: {
          id: "user-1",
          username: "testuser",
          name: "Test",
          url: "",
          imageUrl: "",
        },
      } as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

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
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(prisma.document.findUnique).mockResolvedValue(document as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-1",
          title: "Test Doc",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-1",
          canonicalUrl: "",
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "<p>Hello</p>",
          contentFormat: "html",
        },
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await publishToMedium("conn-1", "doc-1");

      expect(result.url).toBe("https://medium.com/p/post-1");
      expect(prisma.document.update).toHaveBeenCalled();
    });

    it("should publish to a publication when publicationId is set", async () => {
      const connector = {
        id: "conn-1",
        type: "MEDIUM",
        credentials: "enc_token",
        config:
          '{"userId":"user-1","username":"testuser","publicationId":"pub-1"}',
      };
      const document = {
        id: "doc-1",
        title: "Test Doc",
        htmlContent: "<p>Hello</p>",
        content: "Hello",
        tags: [],
      };
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(prisma.document.findUnique).mockResolvedValue(document as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({
        data: {
          id: "post-1",
          title: "Test Doc",
          authorId: "user-1",
          tags: [],
          url: "https://medium.com/p/post-1",
          canonicalUrl: "",
          publishStatus: "public",
          publishedAt: "2026-06-01",
          content: "<p>Hello</p>",
          contentFormat: "html",
        },
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await publishToMedium("conn-1", "doc-1");

      expect(result.url).toBe("https://medium.com/p/post-1");
      // Should call the publications endpoint, not users endpoint
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/publications/pub-1/posts"),
        expect.any(Object),
      );
    });

    it("should throw when connector is not found", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(null);

      await expect(publishToMedium("bad-id", "doc-1")).rejects.toThrow(
        "Invalid Medium connector",
      );
    });

    it("should throw when connector type is not MEDIUM", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "WORDPRESS",
      } as any);

      await expect(publishToMedium("conn-1", "doc-1")).rejects.toThrow(
        "Invalid Medium connector",
      );
    });

    it("should throw when document is not found", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "MEDIUM",
        credentials: "enc_token",
        config: "{}",
      } as any);
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      await expect(publishToMedium("conn-1", "doc-1")).rejects.toThrow(
        "Document not found",
      );
    });
  });
});
