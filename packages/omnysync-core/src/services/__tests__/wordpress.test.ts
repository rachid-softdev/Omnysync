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
  });
});
