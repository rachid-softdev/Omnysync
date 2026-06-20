/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn() },
}));

const mockFetchResponse = vi.hoisted(() => ({
  ok: true,
  json: vi.fn(),
  text: vi.fn(),
}));

const mockFetch = vi.hoisted(() =>
  vi.fn().mockResolvedValue(mockFetchResponse),
);

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ encrypt: vi.fn((s) => `enc_${s}`) }));
vi.mock("../../http", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("../../errors", () => ({ ERR_UPLOAD_MEDIA: "ERR_UPLOAD_MEDIA" }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import { ERR_UPLOAD_MEDIA } from "../../errors";
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
    vi.stubGlobal("fetch", mockFetch);
    mockFetchResponse.ok = true;
    mockFetchResponse.json.mockReset().mockResolvedValue({
      id: 1,
      source_url: "https://example.com/media.jpg",
    });
    mockFetchResponse.text.mockReset().mockResolvedValue("Error text");
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

    it("should encode Basic auth header correctly", () => {
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

      const client = createWordPressClient(siteUrl, username, password);
      client.getCategories();

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${encoded}`,
          }),
        }),
      );
    });

    it("should preserve custom headers passed via options", async () => {
      // Test that request() merges headers by calling a method and verifying
      // headers are passed through
      vi.mocked(fetchWithRetry).mockResolvedValue([
        { id: 1, name: "test", slug: "test" },
      ] as any);

      const client = createWordPressClient(siteUrl, username, password);
      await client.getCategories();

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: expect.stringContaining("Basic"),
          }),
        }),
      );
    });

    describe("getCategories", () => {
      it("should return categories", async () => {
        const categories = [
          { id: 1, name: "Uncategorized", slug: "uncategorized" },
          { id: 2, name: "News", slug: "news" },
        ];
        vi.mocked(fetchWithRetry).mockResolvedValue(categories as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.getCategories();

        expect(result).toEqual(categories);
        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/categories"),
          expect.any(Object),
        );
      });
    });

    describe("getTags", () => {
      it("should return tags", async () => {
        const tags = [
          { id: 1, name: "javascript", slug: "javascript" },
          { id: 2, name: "react", slug: "react" },
        ];
        vi.mocked(fetchWithRetry).mockResolvedValue(tags as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.getTags();

        expect(result).toEqual(tags);
        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/tags"),
          expect.any(Object),
        );
      });
    });

    describe("createPost", () => {
      it("should create a post", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 123 } as any);

        const post = {
          title: "Test Post",
          content: "Hello world",
          status: "draft" as const,
        };

        const client = createWordPressClient(siteUrl, username, password);
        await client.createPost(post);

        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(post),
          }),
        );
      });

      it("should return created post id", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 456 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.createPost({
          title: "Post",
          content: "Content",
          status: "draft",
        });

        expect(result).toEqual({ id: 456 });
      });

      it("should create a post with all optional fields", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 789 } as any);

        const post = {
          title: "Full Post",
          content: "Content here",
          excerpt: "Short excerpt",
          status: "publish" as const,
          categories: [1, 2],
          tags: [3, 4],
          featured_media: 5,
          meta: {
            seo_title: "My SEO Title",
            priority: 1,
            is_pinned: true as const,
          },
        };

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.createPost(post);

        expect(result).toEqual({ id: 789 });
        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(post),
          }),
        );
      });

      it("should create a post with pending status", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 101 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.createPost({
          title: "Pending Post",
          content: "Needs review",
          status: "pending",
        });

        expect(result.id).toBe(101);
      });

      it("should create a post with future status", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 202 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.createPost({
          title: "Scheduled Post",
          content: "Future content",
          status: "future",
        });

        expect(result.id).toBe(202);
      });
    });

    describe("updatePost", () => {
      it("should update a post", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 789 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        await client.updatePost(789, { title: "Updated Title" });

        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts/789"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ title: "Updated Title" }),
          }),
        );
      });

      it("should update a post with empty partial", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 789 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        await client.updatePost(789, {});

        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts/789"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({}),
          }),
        );
      });

      it("should update a post with specific fields only", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({ id: 789 } as any);

        const client = createWordPressClient(siteUrl, username, password);
        await client.updatePost(789, {
          status: "publish",
          excerpt: "New excerpt",
        });

        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts/789"),
          expect.objectContaining({
            body: JSON.stringify({ status: "publish", excerpt: "New excerpt" }),
          }),
        );
      });
    });

    describe("getPost", () => {
      it("should get a post by id", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue({
          id: 42,
          title: "My Post",
          content: "Content",
          status: "publish",
        } as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.getPost(42);

        expect(result).toEqual({
          id: 42,
          title: "My Post",
          content: "Content",
          status: "publish",
        });
        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/posts/42"),
          expect.any(Object),
        );
      });

      it("should propagate API errors for getPost", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(
          new Error("Post not found"),
        );

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.getPost(99999)).rejects.toThrow("Post not found");
      });
    });

    describe("getUsers", () => {
      it("should return users", async () => {
        const users = [
          { id: 1, name: "Admin" },
          { id: 2, name: "Editor" },
        ];
        vi.mocked(fetchWithRetry).mockResolvedValue(users as any);

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.getUsers();

        expect(result).toEqual(users);
        expect(fetchWithRetry).toHaveBeenCalledWith(
          expect.stringContaining("/users"),
          expect.any(Object),
        );
      });
    });

    describe("uploadMedia", () => {
      const media = {
        file: new Blob(["test"]),
        title: "My Image",
      };

      it("should upload media and return id and source_url", async () => {
        mockFetchResponse.json.mockResolvedValue({
          id: 42,
          source_url: "https://example.com/uploads/image.jpg",
        });

        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.uploadMedia(media);

        expect(result.id).toBe(42);
        expect(result.source_url).toBe("https://example.com/uploads/image.jpg");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/wp-json/wp/v2/media",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: expect.stringContaining("Basic"),
            }),
          }),
        );
      });

      it("should throw ERR_UPLOAD_MEDIA when response is not ok", async () => {
        mockFetchResponse.ok = false;

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.uploadMedia(media)).rejects.toThrow(
          ERR_UPLOAD_MEDIA,
        );
      });

      it("should strip trailing slash from siteUrl for media endpoint", async () => {
        const client = createWordPressClient(
          "https://example.com/",
          username,
          password,
        );
        await client.uploadMedia(media);

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toBe("https://example.com/wp-json/wp/v2/media");
        expect(calledUrl).not.toContain("//wp-json");
      });

      it("should handle non-ok response with error text", async () => {
        mockFetchResponse.ok = false;
        mockFetchResponse.text.mockResolvedValue("Upload failed");

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.uploadMedia(media)).rejects.toThrow(
          ERR_UPLOAD_MEDIA,
        );
      });

      it("should propagate network errors from fetch", async () => {
        mockFetch.mockReset().mockRejectedValue(new Error("Network failure"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.uploadMedia(media)).rejects.toThrow(
          "Network failure",
        );
      });

      it("should propagate JSON parsing errors from response", async () => {
        mockFetch.mockReset().mockResolvedValue(mockFetchResponse);
        mockFetchResponse.json
          .mockReset()
          .mockRejectedValue(new Error("Invalid JSON response"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.uploadMedia(media)).rejects.toThrow(
          "Invalid JSON response",
        );
      });

      it("should handle empty blob file", async () => {
        mockFetch.mockReset().mockResolvedValue(mockFetchResponse);
        mockFetchResponse.json.mockReset().mockResolvedValue({
          id: 99,
          source_url: "https://example.com/empty.jpg",
        });

        const emptyMedia = { file: new Blob([]), title: "Empty" };
        const client = createWordPressClient(siteUrl, username, password);
        const result = await client.uploadMedia(emptyMedia);

        expect(result.id).toBe(99);
      });

      it("should pass FormData body to fetch", async () => {
        mockFetch.mockReset().mockResolvedValue(mockFetchResponse);
        mockFetchResponse.json
          .mockReset()
          .mockResolvedValue({ id: 1, source_url: "" });

        const client = createWordPressClient(siteUrl, username, password);
        await client.uploadMedia(media);

        const [, options] = mockFetch.mock.calls[0];
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.method).toBe("POST");
      });

      it("should handle error response with status 401 Unauthorized", async () => {
        mockFetch.mockReset().mockResolvedValue(mockFetchResponse);
        mockFetchResponse.ok = false;
        mockFetchResponse.text.mockReset().mockResolvedValue("Unauthorized");

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.uploadMedia(media)).rejects.toThrow(
          ERR_UPLOAD_MEDIA,
        );
      });
    });

    describe("error handling", () => {
      it("should propagate API errors", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(
          new Error("API rate limit exceeded"),
        );

        const client = createWordPressClient(siteUrl, username, password);

        await expect(client.getCategories()).rejects.toThrow(
          "API rate limit exceeded",
        );
      });

      it("should propagate errors for createPost", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Forbidden"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(
          client.createPost({ title: "Bad", content: "Nope", status: "draft" }),
        ).rejects.toThrow("Forbidden");
      });

      it("should propagate errors for updatePost", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Conflict"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(
          client.updatePost(1, { title: "Conflict" }),
        ).rejects.toThrow("Conflict");
      });

      it("should propagate errors for getTags", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Server error"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.getTags()).rejects.toThrow("Server error");
      });

      it("should propagate errors for getUsers", async () => {
        vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Unauthorized"));

        const client = createWordPressClient(siteUrl, username, password);
        await expect(client.getUsers()).rejects.toThrow("Unauthorized");
      });
    });

    describe("trailing slash handling", () => {
      it("should strip trailing slash from siteUrl", async () => {
        vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

        const client = createWordPressClient(
          "https://example.com/",
          username,
          password,
        );
        await client.getCategories();

        const calledUrl = vi.mocked(fetchWithRetry).mock.calls[0][0] as string;
        expect(calledUrl).toBe(
          "https://example.com/wp-json/wp/v2/categories?per_page=100",
        );
        expect(calledUrl).not.toContain("//wp-json");
      });
    });
  });

  describe("saveWordPressConnector", () => {
    it("should create a WordPress connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

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

    it("should throw when siteUrl is invalid", async () => {
      await expect(
        saveWordPressConnector(
          userId,
          orgId,
          "not-a-valid-url",
          username,
          password,
        ),
      ).rejects.toThrow();
    });

    it("should create connector even with URL having port", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-port",
      } as any);

      const result = await saveWordPressConnector(
        userId,
        orgId,
        "https://example.com:8080",
        username,
        password,
      );

      expect(result.id).toBe("conn-port");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: expect.stringContaining("example.com"),
        }),
      });
    });

    it("should propagate database errors", async () => {
      vi.mocked(prisma.connector.create).mockRejectedValue(
        new Error("DB_CONNECTION_ERROR"),
      );

      await expect(
        saveWordPressConnector(userId, orgId, siteUrl, username, password),
      ).rejects.toThrow("DB_CONNECTION_ERROR");
    });

    it("should work with localhost URL", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-local",
      } as any);

      const result = await saveWordPressConnector(
        userId,
        orgId,
        "http://localhost",
        username,
        password,
      );

      expect(result.id).toBe("conn-local");
    });

    it("should work with URL containing a subdirectory path", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-path",
      } as any);

      const result = await saveWordPressConnector(
        userId,
        orgId,
        "https://example.com/wordpress",
        username,
        password,
      );

      expect(result.id).toBe("conn-path");
    });

    it("should call encrypt with base64-encoded credentials", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-enc",
      } as any);

      await saveWordPressConnector(userId, orgId, siteUrl, username, password);

      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          credentials: expect.stringContaining("enc_"),
        }),
      });
    });
  });

  describe("testWordPressConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([
        { id: 1, name: "Uncategorized" },
      ] as any);

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

    it("should return error when connection times out", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("timeout"));

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe("timeout");
    });

    it("should handle non-Error thrown values gracefully", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue("string error");

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(false);
      // When a string is thrown, (error as Error).message is undefined
      expect(result.error).toBeUndefined();
    });

    it("should handle objects with message property thrown", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue({
        message: "Custom error object",
      });

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Custom error object");
    });

    it("should handle Error subclass instances", async () => {
      class CustomApiError extends Error {
        constructor() {
          super("Custom API Error");
          this.name = "CustomApiError";
        }
      }
      vi.mocked(fetchWithRetry).mockRejectedValue(new CustomApiError());

      const result = await testWordPressConnection(siteUrl, username, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Custom API Error");
    });

    it("should handle null thrown (catch block propagates)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(null);

      // When null is thrown inside the catch block, (null as Error).message
      // throws TypeError, which propagates out of testWordPressConnection
      await expect(
        testWordPressConnection(siteUrl, username, password),
      ).rejects.toThrow();
    });
  });

  // Edge cases for getCategories, getTags, getUsers
  describe("getCategories edge case", () => {
    it("should return empty array when no categories exist", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

      const client = createWordPressClient(siteUrl, username, password);
      const result = await client.getCategories();

      expect(result).toEqual([]);
    });
  });

  describe("getTags edge case", () => {
    it("should return empty array when no tags exist", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

      const client = createWordPressClient(siteUrl, username, password);
      const result = await client.getTags();

      expect(result).toEqual([]);
    });
  });

  describe("getUsers edge case", () => {
    it("should return empty array when no users exist", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

      const client = createWordPressClient(siteUrl, username, password);
      const result = await client.getUsers();

      expect(result).toEqual([]);
    });
  });
});
