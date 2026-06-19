/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn(), findUnique: vi.fn() },
  document: { findUnique: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  encrypt: vi.fn((s) => `enc_${s}`),
  decrypt: vi.fn((s) => s.replace("enc_", "")),
}));
vi.mock("../../http", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("../../errors", () => ({ ERR_FETCH_CONTENT: "ERR_FETCH_CONTENT" }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  listContentfulSpaces,
  listContentfulContentTypes,
  listContentfulEntries,
  contentfulEntryToDocument,
  createContentfulEntry,
  updateContentfulEntry,
  saveContentfulConnector,
  testContentfulConnection,
} from "../contentful";

describe("Contentful Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const accessToken = "cf_token_abc";
  const spaceId = "space-1";
  const contentTypeId = "article";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listContentfulSpaces", () => {
    it("should return spaces", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "space-1", name: "My Space" }],
      } as any);

      const spaces = await listContentfulSpaces(accessToken);

      expect(spaces.length).toBe(1);
      expect(spaces[0].id).toBe("space-1");
    });

    it("should throw on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(listContentfulSpaces(accessToken)).rejects.toThrow(
        "Failed to fetch Contentful spaces",
      );
    });
  });

  describe("listContentfulContentTypes", () => {
    it("should return content types", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [{ id: "article", name: "Article" }],
      } as any);

      const types = await listContentfulContentTypes(accessToken, spaceId);

      expect(types.length).toBe(1);
      expect(types[0].id).toBe("article");
    });
  });

  describe("listContentfulEntries", () => {
    it("should return entries with fields", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: { id: "entry-1", createdAt: "2026-01-01", updatedAt: "2026-06-01" },
            fields: { title: "Entry 1", body: "Content here" },
          },
        ],
      } as any);

      const entries = await listContentfulEntries(accessToken, spaceId, contentTypeId);

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe("Entry 1");
    });
  });

  describe("contentfulEntryToDocument", () => {
    it("should convert entry to document format", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "My Entry",
        content: "",
        createdAt: "2026-01-01",
        updatedAt: "2026-06-01",
        fields: { body: "Hello world", title: "My Entry" },
      });

      expect(result.title).toBe("My Entry");
      expect(result.content).toBe("Hello world");
      expect(result.metadata.contentfulId).toBe("entry-1");
    });

    it("should fallback to JSON stringify for object content", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "Entry",
        content: "",
        createdAt: "",
        updatedAt: "",
        fields: { richText: { nodeType: "document" } },
      });

      expect(result.content).toContain("nodeType");
    });
  });

  describe("createContentfulEntry", () => {
    it("should create entry and return id", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-new" },
      } as any);

      const result = await createContentfulEntry(accessToken, spaceId, contentTypeId, {
        title: { "en-US": "Test" },
      });

      expect(result.id).toBe("entry-new");
    });
  });

  describe("updateContentfulEntry", () => {
    it("should update an existing entry", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-1" },
      } as any);

      const result = await updateContentfulEntry(accessToken, spaceId, "entry-1", {
        title: { "en-US": "Updated" },
      }, 1);

      expect(result.id).toBe("entry-1");
    });
  });

  describe("saveContentfulConnector", () => {
    it("should verify token then create connector", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ items: [] } as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

      const result = await saveContentfulConnector(userId, orgId, accessToken, {
        spaceId,
        contentTypeId,
      });

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "CONTENTFUL",
          credentials: `enc_${accessToken}`,
          config: expect.stringContaining(spaceId),
        }),
      });
    });
  });

  describe("testContentfulConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ items: [] } as any);

      const result = await testContentfulConnection(accessToken);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Bad token"));

      const result = await testContentfulConnection(accessToken);

      expect(result.success).toBe(false);
    });
  });
});
