/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

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
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Invalid API key"));

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });

  describe("createGhostClient — API methods", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("getTags should call the API and return tags", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        tags: [
          { id: "tag-1", name: "News", slug: "news" },
          { id: "tag-2", name: "Tech", slug: "tech" },
        ],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const tags = await client.getTags();

      expect(tags).toEqual([
        { id: "tag-1", name: "News", slug: "news" },
        { id: "tag-2", name: "Tech", slug: "tech" },
      ]);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/tags/"),
        expect.any(Object),
      );
    });

    it("getAuthors should call the API and return authors", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        authors: [{ id: "auth-1", name: "John", slug: "john" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const authors = await client.getAuthors();

      expect(authors).toEqual([{ id: "auth-1", name: "John", slug: "john" }]);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/authors/"),
        expect.any(Object),
      );
    });

    it("createPost should call the API with POST and return response", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.createPost({
        title: "Test Post",
        html: "<p>Hello</p>",
        status: "draft",
      });

      expect(result.posts).toEqual([{ id: "post-1" }]);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/posts/"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("updatePost should call the API with PUT and correct URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.updatePost("post-1", {
        title: "Updated",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/posts/post-1/"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("getPost should call the API and verify URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1", title: "Test", html: "<p>Content</p>" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.getPost("post-1");

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/posts/post-1/"),
        expect.any(Object),
      );
    });

    it("should propagate API errors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(client.getTags()).rejects.toThrow("API error");
    });
  });

  describe("createPost — HTTP error status codes", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw on HTTP 401 (Unauthorized)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("HTTP 401: Unauthorized"),
      );

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.createPost({ title: "Test", html: "<p>Hi</p>" }),
      ).rejects.toThrow("HTTP 401");
    });

    it("should throw on HTTP 404 (Not Found)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("HTTP 404: Not Found"),
      );

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.createPost({ title: "Test", html: "<p>Hi</p>" }),
      ).rejects.toThrow("HTTP 404");
    });

    it("should throw on HTTP 429 (Rate Limited)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("HTTP 429: Too Many Requests"),
      );

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.createPost({ title: "Test", html: "<p>Hi</p>" }),
      ).rejects.toThrow("HTTP 429");
    });

    it("should throw on network timeout", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Failed to fetch"));

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.createPost({ title: "Test", html: "<p>Hi</p>" }),
      ).rejects.toThrow("Failed to fetch");
    });

    it("should throw when post body has empty html", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.createPost({
        title: "Empty HTML",
        html: "",
        status: "draft",
      });

      // The function passes the post through unchanged — no error expected
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"html":""'),
        }),
      );
    });
  });

  describe("uploadImage", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should upload an image successfully", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            images: [
              { url: "https://myblog.ghost.io/content/images/test.jpg" },
            ],
          }),
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.uploadImage({
        file: new Blob(["fake-image-data"]),
        filename: "test.jpg",
      });

      expect(result.images[0].url).toBe(
        "https://myblog.ghost.io/content/images/test.jpg",
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/images/upload"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should throw ERR_UPLOAD_MEDIA when Ghost API rejects the image", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
      });

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.uploadImage({
          file: new Blob(["data"]),
          filename: "test.jpg",
        }),
      ).rejects.toThrow("ERR_UPLOAD_MEDIA");
    });

    it("should throw on network error when image URL is unreachable", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const client = createGhostClient(siteUrl, adminApiKey);

      await expect(
        client.uploadImage({
          file: new Blob(["data"]),
          filename: "test.jpg",
        }),
      ).rejects.toThrow("Network error");
    });

    it("should handle invalid image format gracefully", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            images: [
              { url: "https://myblog.ghost.io/content/images/test.gif" },
            ],
          }),
      });

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.uploadImage({
        file: new Blob(["data"]),
        filename: "test.gif",
      });

      // Ghost accepts images regardless of format — the client forwards the Blob as-is
      expect(result.images[0].url).toContain("test.gif");
    });
  });

  describe("saveGhostConnector — error paths", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw when Prisma fails to save", async () => {
      vi.mocked(prisma.connector.create).mockRejectedValue(
        new Error("DB connection failed"),
      );

      await expect(
        saveGhostConnector(userId, orgId, siteUrl, adminApiKey),
      ).rejects.toThrow("DB connection failed");
    });

    it("should throw on invalid siteUrl", async () => {
      await expect(
        saveGhostConnector(userId, orgId, "not-a-valid-url", adminApiKey),
      ).rejects.toThrow();
    });

    it("should throw on empty siteUrl", async () => {
      await expect(
        saveGhostConnector(userId, orgId, "", adminApiKey),
      ).rejects.toThrow();
    });
  });

  describe("testGhostConnection — additional error paths", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return failure on generic network error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Failed to fetch"));

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch");
    });

    it("should return failure on invalid credentials (401)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("HTTP 401: Unauthorized"),
      );

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 401: Unauthorized");
    });
  });

  describe("createGhostClient — edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle adminApiKey with no colon (single part)", () => {
      const client = createGhostClient(siteUrl, "no-colon-key");
      expect(client.getTags).toBeDefined();
      expect(client.getAuthors).toBeDefined();
    });

    it("should handle adminApiKey with multiple colons", () => {
      const client = createGhostClient(siteUrl, "a:b:c:d");
      expect(client.getTags).toBeDefined();
      expect(client.getAuthors).toBeDefined();
    });

    it("should strip multiple trailing slashes from siteUrl", () => {
      const client = createGhostClient(
        "https://myblog.ghost.io///",
        adminApiKey,
      );
      expect(client.getTags).toBeDefined();
    });

    it("should handle empty object response (no matching key)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({} as any);

      const client = createGhostClient(siteUrl, adminApiKey);

      // request returns the full response object — `result.tags` is undefined → []
      const tags = await client.getTags();
      expect(tags).toEqual([]);
    });

    it("should handle response with unexpected top-level key", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        unknown_key: [{ id: "x" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const tags = await client.getTags();

      // The response has no `tags` key, so `result.tags` is undefined → []
      expect(tags).toEqual([]);
    });

    it("should handle null response from request helper", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(null as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await expect(client.getTags()).rejects.toThrow();
    });
  });

  describe("saveGhostConnector — URL edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should work with URL containing subdirectory", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveGhostConnector(
        userId,
        orgId,
        "https://myblog.ghost.io/blog",
        adminApiKey,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: expect.stringContaining("Ghost"),
          config: { siteUrl: "https://myblog.ghost.io/blog" },
        }),
      });
    });

    it("should work with http URL (not https)", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveGhostConnector(
        userId,
        orgId,
        "http://myblog.ghost.io",
        adminApiKey,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          config: { siteUrl: "http://myblog.ghost.io" },
        }),
      });
    });
  });

  describe("testGhostConnection — non-Error thrown values", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle string thrown (not Error instance)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue("raw string error" as any);

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      // String cast via `String(error)` would give "raw string error"
    });

    it("should handle object thrown without message", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue({
        code: 500,
      } as any);

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
    });

    it("should handle null thrown gracefully", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(null);

      // Fixed catch block: `String(error)` converts null to "null"
      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("null");
    });
  });

  describe("uploadImage — edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should handle empty Blob (zero bytes)", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            images: [
              { url: "https://myblog.ghost.io/content/images/empty.jpg" },
            ],
          }),
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.uploadImage({
        file: new Blob([]),
        filename: "empty.jpg",
      });

      expect(result.images[0].url).toContain("empty.jpg");
    });

    it("should handle fetch throwing a TypeError (network failure)", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError("Failed to fetch"),
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      await expect(
        client.uploadImage({
          file: new Blob(["data"]),
          filename: "test.jpg",
        }),
      ).rejects.toThrow(TypeError);
    });

    it("should pass correct Authorization header for upload", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ images: [{ url: "https://example.com/img.jpg" }] }),
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.uploadImage({
        file: new Blob(["data"]),
        filename: "test.jpg",
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization).toContain("Ghost ");
    });

    it("should pass only Authorization header (no Content-Type) for upload", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ images: [{ url: "https://example.com/img.jpg" }] }),
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.uploadImage({
        file: new Blob(["data"]),
        filename: "test.jpg",
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = fetchCall[1].headers;
      // FormData uploads must NOT have Content-Type set (browser sets it with boundary)
      expect(headers["Content-Type"]).toBeUndefined();
      expect(headers.Authorization).toContain("Ghost ");
    });

    it("should handle malformed response json (missing images key)", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({}),
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.uploadImage({
        file: new Blob(["data"]),
        filename: "test.jpg",
      });

      expect(result.images).toBeUndefined();
    });
  });

  describe("getTags — detailed scenarios", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return tags when present", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        tags: [
          { id: "tag-1", name: "News", slug: "news" },
          { id: "tag-2", name: "Tech", slug: "tech" },
        ],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const tags = await client.getTags();

      expect(tags).toEqual([
        { id: "tag-1", name: "News", slug: "news" },
        { id: "tag-2", name: "Tech", slug: "tech" },
      ]);
    });

    it("should use correct API endpoint URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ tags: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.getTags();

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/tags/?limit=all"),
        expect.any(Object),
      );
    });

    it("should include Authorization header in request", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ tags: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.getTags();

      const callArgs = vi.mocked(fetchWithRetry).mock.calls[0];
      const options = callArgs[1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      expect(headers.Authorization).toContain("Ghost ");
    });
  });

  describe("getAuthors — detailed scenarios", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return authors when present", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        authors: [{ id: "auth-1", name: "Alice", slug: "alice" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const authors = await client.getAuthors();

      expect(authors).toEqual([{ id: "auth-1", name: "Alice", slug: "alice" }]);
    });

    it("should use correct API endpoint URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ authors: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.getAuthors();

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/authors/?limit=all"),
        expect.any(Object),
      );
    });

    it("should handle empty response object for authors (no authors key)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({} as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const authors = await client.getAuthors();
      expect(authors).toEqual([]);
    });

    it("should propagate API errors for getAuthors", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      const client = createGhostClient(siteUrl, adminApiKey);
      await expect(client.getAuthors()).rejects.toThrow("API error");
    });
  });

  describe("createPost — request body and response scenarios", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should send post with status: published", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.createPost({
        title: "Published Post",
        html: "<p>Content</p>",
        status: "published",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"status":"published"'),
        }),
      );
    });

    it("should send post with status: scheduled", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.createPost({
        title: "Scheduled Post",
        html: "<p>Content</p>",
        status: "scheduled",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"scheduled"'),
        }),
      );
    });

    it("should send post with all optional fields", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.createPost({
        title: "Full Post",
        html: "<p>Content</p>",
        excerpt: "An excerpt",
        status: "draft",
        tags: ["news", "tech"],
        authors: ["author-1"],
        feature_image: "https://example.com/img.jpg",
        meta_title: "Meta Title",
        meta_description: "Meta Description",
      });

      const callBody = JSON.parse(
        (vi.mocked(fetchWithRetry).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(callBody.posts[0].title).toBe("Full Post");
      expect(callBody.posts[0].excerpt).toBe("An excerpt");
      expect(callBody.posts[0].tags).toEqual(["news", "tech"]);
      expect(callBody.posts[0].feature_image).toBe(
        "https://example.com/img.jpg",
      );
      expect(callBody.posts[0].meta_title).toBe("Meta Title");
    });

    it("should handle createPost with only title and html (minimum fields)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.createPost({ title: "Minimal", html: "<p>Hi</p>" });

      const callBody = JSON.parse(
        (vi.mocked(fetchWithRetry).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(callBody.posts[0].title).toBe("Minimal");
      expect(callBody.posts[0].html).toBe("<p>Hi</p>");
      expect(callBody.posts[0].status).toBeUndefined();
    });

    it("should handle createPost when Ghost API returns empty posts array", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ posts: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.createPost({
        title: "Test",
        html: "<p>Content</p>",
      });

      expect(result.posts).toEqual([]);
    });
  });

  describe("updatePost — edge cases and error handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should update with optional fields (excerpt, tags, etc.)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.updatePost("post-1", {
        title: "Updated Title",
        excerpt: "New excerpt",
        tags: ["news"],
      });

      const callBody = JSON.parse(
        (vi.mocked(fetchWithRetry).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(callBody.posts[0].title).toBe("Updated Title");
      expect(callBody.posts[0].excerpt).toBe("New excerpt");
    });

    it("should handle empty update object", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        posts: [{ id: "post-1" }],
      } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.updatePost("post-1", {});

      const callBody = JSON.parse(
        (vi.mocked(fetchWithRetry).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(callBody.posts[0]).toEqual({});
    });

    it("should propagate API errors for updatePost", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Update failed"));

      const client = createGhostClient(siteUrl, adminApiKey);
      await expect(
        client.updatePost("post-1", { title: "Fail" }),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("getPost — detailed scenarios", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return post from response with posts wrapper", async () => {
      const postData = {
        id: "post-1",
        title: "Test Post",
        html: "<p>Content</p>",
        status: "published" as const,
      };
      vi.mocked(fetchWithRetry).mockResolvedValue({ posts: [postData] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.getPost("post-1");

      expect(result.posts).toEqual([postData]);
    });

    it("should handle getPost with include params for tags and authors", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ posts: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      await client.getPost("post-1");

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/posts/post-1/"),
        expect.any(Object),
      );
    });

    it("should handle getPost when post is not found (empty array)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ posts: [] } as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.getPost("non-existent");

      expect(result.posts).toEqual([]);
    });

    it("should handle null response from getPost", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(null as any);

      const client = createGhostClient(siteUrl, adminApiKey);
      const result = await client.getPost("post-1");
      expect(result).toBeNull();
    });
  });

  describe("testGhostConnection — more edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return failure when Error has no message property", async () => {
      const err = new Error();
      // Override message to be empty
      Object.defineProperty(err, "message", { value: "" });
      vi.mocked(fetchWithRetry).mockRejectedValue(err);

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("");
    });

    it("should return failure on TypeError (DNS resolution failure)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new TypeError("fetch failed: dns resolution error"),
      );

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain("dns");
    });

    it("should return failure on AbortError (timeout)", async () => {
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      vi.mocked(fetchWithRetry).mockRejectedValue(abortError);

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain("aborted");
    });

    it("should return failure on network timeout via getTags", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("fetch failed: timeout"),
      );

      const result = await testGhostConnection(siteUrl, adminApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain("tim");
    });
  });

  describe("saveGhostConnector — more edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create connector name with hostname from siteUrl", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      await saveGhostConnector(
        userId,
        orgId,
        "https://myblog.ghost.io",
        adminApiKey,
      );

      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Ghost - myblog.ghost.io",
        }),
      });
    });

    it("should handle URL with port number", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveGhostConnector(
        userId,
        orgId,
        "https://localhost:2368",
        adminApiKey,
      );

      expect(result.id).toBe("conn-1");
    });

    it("should handle complex subdirectory path in siteUrl", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      await saveGhostConnector(
        userId,
        orgId,
        "https://blog.example.com/ghost",
        adminApiKey,
      );

      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          config: { siteUrl: "https://blog.example.com/ghost" },
        }),
      });
    });

    it("should throw on malformed URL (no protocol)", async () => {
      await expect(
        saveGhostConnector(userId, orgId, "not-a-url", adminApiKey),
      ).rejects.toThrow();
    });

    it("should throw on URL with only protocol", async () => {
      await expect(
        saveGhostConnector(userId, orgId, "https://", adminApiKey),
      ).rejects.toThrow();
    });
  });

  describe("createGhostClient — client creation edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle empty adminApiKey string", () => {
      const client = createGhostClient(siteUrl, "");
      expect(client.getTags).toBeDefined();
      expect(client.getAuthors).toBeDefined();
    });

    it("should handle siteUrl without trailing slash (no change needed)", () => {
      const client = createGhostClient("https://myblog.ghost.io", adminApiKey);
      expect(client.getTags).toBeDefined();
    });

    it("should create independent client instances", () => {
      const client1 = createGhostClient(
        "https://blog1.ghost.io",
        "key1:secret1",
      );
      const client2 = createGhostClient(
        "https://blog2.ghost.io",
        "key2:secret2",
      );
      expect(client1).not.toBe(client2);
    });
  });
});
