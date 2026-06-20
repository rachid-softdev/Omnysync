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
  listContentfulDocuments,
  getContentfulEntryContent,
  getContentfulEntry,
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

    it("should handle expired API token (401 Unauthorized)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error(
          "401 Unauthorized - The access token you sent could not be found or is expired.",
        ),
      );

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

    it("should throw on API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(
        listContentfulContentTypes(accessToken, spaceId),
      ).rejects.toThrow("Failed to fetch content types");
    });

    it("should return empty array when items is null", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({} as any);

      const types = await listContentfulContentTypes(accessToken, spaceId);

      expect(types).toEqual([]);
    });
  });

  describe("listContentfulEntries", () => {
    it("should return entries with fields", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: {
              id: "entry-1",
              createdAt: "2026-01-01",
              updatedAt: "2026-06-01",
            },
            fields: { title: "Entry 1", body: "Content here" },
          },
        ],
      } as any);

      const entries = await listContentfulEntries(
        accessToken,
        spaceId,
        contentTypeId,
      );

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe("Entry 1");
    });

    it("should throw on API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(
        listContentfulEntries(accessToken, spaceId, contentTypeId),
      ).rejects.toThrow("Failed to fetch entries");
    });

    it("should return untitled for entries without title or name", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: { id: "entry-1" },
            fields: { body: "Just content" },
          },
        ],
      } as any);

      const entries = await listContentfulEntries(
        accessToken,
        spaceId,
        contentTypeId,
      );

      expect(entries[0].title).toBe("Untitled");
    });

    it("should pass limit and skip params", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ items: [] } as any);

      await listContentfulEntries(accessToken, spaceId, contentTypeId, {
        limit: 50,
        skip: 10,
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.any(Object),
      );
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("skip=10"),
        expect.any(Object),
      );
    });

    it("should handle entry with missing sys.id and empty fields", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: {},
            fields: {},
          },
        ],
      } as any);

      const entries = await listContentfulEntries(
        accessToken,
        spaceId,
        contentTypeId,
      );

      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe("");
      expect(entries[0].title).toBe("Untitled");
      expect(entries[0].createdAt).toBe("");
      expect(entries[0].updatedAt).toBe("");
    });

    it("should handle pagination with many entries (more than default limit of 100)", async () => {
      const manyEntries = Array.from({ length: 150 }, (_, i) => ({
        sys: { id: `entry-${i + 1}`, createdAt: "", updatedAt: "" },
        fields: { title: `Entry ${i + 1}`, body: "Content" },
      }));

      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: manyEntries,
      } as any);

      const entries = await listContentfulEntries(
        accessToken,
        spaceId,
        contentTypeId,
        { limit: 150 },
      );

      expect(entries.length).toBe(150);
      expect(entries[0].title).toBe("Entry 1");
      expect(entries[149].title).toBe("Entry 150");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("limit=150"),
        expect.any(Object),
      );
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

    it("should fallback to fields JSON when no body/content/description/text found", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "Entry",
        content: "",
        createdAt: "",
        updatedAt: "",
        fields: { customField: "value", otherField: 42 },
      });

      expect(result.content).toContain("customField");
    });

    it("should use description field when body is not available", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "Entry",
        content: "",
        createdAt: "",
        updatedAt: "",
        fields: { description: "A nice description", title: "Entry" },
      });

      expect(result.content).toBe("A nice description");
    });

    it("should use content field when body is not available", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "Entry",
        content: "",
        createdAt: "",
        updatedAt: "",
        fields: { content: "Main content here", title: "Entry" },
      });

      expect(result.content).toBe("Main content here");
    });

    it("should use text field when no other content field is available", () => {
      const result = contentfulEntryToDocument({
        id: "entry-1",
        title: "Entry",
        content: "",
        createdAt: "",
        updatedAt: "",
        fields: { text: "Text content" },
      });

      expect(result.content).toBe("Text content");
    });
  });

  describe("createContentfulEntry", () => {
    it("should create entry and return id", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-new" },
      } as any);

      const result = await createContentfulEntry(
        accessToken,
        spaceId,
        contentTypeId,
        {
          title: { "en-US": "Test" },
        },
      );

      expect(result.id).toBe("entry-new");
    });

    it("should throw on API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(
        createContentfulEntry(accessToken, spaceId, contentTypeId, {
          title: { "en-US": "Test" },
        }),
      ).rejects.toThrow("Failed to create entry");
    });

    it("should send correct headers for creation", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-new" },
      } as any);

      await createContentfulEntry(accessToken, spaceId, contentTypeId, {
        title: { "en-US": "Test" },
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/entries"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Contentful-Content-Type": contentTypeId,
            "Content-Type": "application/vnd.contentful.management.v1+json",
          }),
        }),
      );
    });

    it("should reject content type mismatch error on creation", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error(
          "422 Unprocessable Entity - Content type mismatch: field 'invalidField' not found on content type 'article'",
        ),
      );

      await expect(
        createContentfulEntry(accessToken, spaceId, contentTypeId, {
          title: { "en-US": "Test" },
          invalidField: { "en-US": "value" },
        }),
      ).rejects.toThrow("Failed to create entry");
    });
  });

  describe("getContentfulEntry", () => {
    it("should return entry id and version on success", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-1", version: 3 },
      } as any);

      const result = await getContentfulEntry(accessToken, spaceId, "entry-1");

      expect(result).toEqual({ id: "entry-1", version: 3 });
    });

    it("should return null when entry is not found (404)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Not Found"));

      const result = await getContentfulEntry(
        accessToken,
        spaceId,
        "nonexistent",
      );

      expect(result).toBeNull();
    });

    it("should return null on API error (5xx)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Internal Server Error"),
      );

      const result = await getContentfulEntry(accessToken, spaceId, "entry-1");

      expect(result).toBeNull();
    });

    it("should return version even when sys has no version field", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-1" },
      } as any);

      const result = await getContentfulEntry(accessToken, spaceId, "entry-1");

      expect(result).toEqual({ id: "entry-1", version: undefined });
    });
  });

  describe("updateContentfulEntry", () => {
    it("should update an existing entry", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-1" },
      } as any);

      const result = await updateContentfulEntry(
        accessToken,
        spaceId,
        "entry-1",
        {
          title: { "en-US": "Updated" },
        },
        1,
      );

      expect(result.id).toBe("entry-1");
    });

    it("should throw on version conflict (409)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Version conflict"),
      );

      await expect(
        updateContentfulEntry(
          accessToken,
          spaceId,
          "entry-1",
          { title: { "en-US": "New" } },
          1,
        ),
      ).rejects.toThrow("Failed to update entry");
    });

    it("should throw on field validation error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Validation error"),
      );

      await expect(
        updateContentfulEntry(
          accessToken,
          spaceId,
          "entry-1",
          { invalidField: "value" },
          1,
        ),
      ).rejects.toThrow("Failed to update entry");
    });

    it("should send X-Contentful-Version header", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        sys: { id: "entry-1" },
      } as any);

      await updateContentfulEntry(
        accessToken,
        spaceId,
        "entry-1",
        { title: { "en-US": "Updated" } },
        5,
      );

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/entries/entry-1"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            "X-Contentful-Version": "5",
          }),
        }),
      );
    });
  });

  describe("saveContentfulConnector", () => {
    it("should verify token then create connector", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ items: [] } as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

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

  describe("listContentfulDocuments", () => {
    const connector = {
      id: "conn-1",
      type: "CONTENTFUL",
      credentials: "enc_cf_token_abc",
      config: JSON.stringify({ spaceId: "space-1", contentTypeId: "article" }),
    };

    it("should throw for invalid connector type", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "WEBFLOW",
      } as any);

      await expect(listContentfulDocuments("conn-1")).rejects.toThrow(
        "Invalid Contentful connector",
      );
    });

    it("should return empty array when no spaceId", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "CONTENTFUL",
        credentials: "enc_token",
        config: JSON.stringify({}),
      } as any);

      const result = await listContentfulDocuments("conn-1");

      expect(result).toEqual([]);
    });

    it("should return documents from specified content type", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: { id: "entry-1" },
            fields: { title: "Entry 1", body: "Content" },
          },
        ],
      } as any);

      const result = await listContentfulDocuments("conn-1");

      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Entry 1");
    });

    it("should iterate over content types when no contentTypeId", async () => {
      const connectorNoType = {
        id: "conn-2",
        type: "CONTENTFUL",
        credentials: "enc_cf_token_abc",
        config: JSON.stringify({ spaceId: "space-1" }),
      };
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connectorNoType as any,
      );
      // First call: listContentfulContentTypes
      // Second call: listContentfulEntries for first content type
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          items: [
            { id: "article", name: "Article" },
            { id: "page", name: "Page" },
          ],
        } as any)
        .mockResolvedValueOnce({
          items: [
            {
              sys: { id: "entry-1" },
              fields: { title: "Entry 1", body: "Content" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          items: [
            {
              sys: { id: "entry-2" },
              fields: { title: "Entry 2", body: "Content" },
            },
          ],
        } as any);

      const result = await listContentfulDocuments("conn-2");

      expect(result.length).toBe(2);
      expect(result[0].title).toContain("Entry 1");
      expect(result[1].title).toContain("Entry 2");
    });
  });

  describe("getContentfulEntryContent", () => {
    const connector = {
      id: "conn-1",
      type: "CONTENTFUL",
      credentials: "enc_cf_token_abc",
      config: JSON.stringify({ spaceId: "space-1", contentTypeId: "article" }),
    };

    it("should throw for invalid connector type", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "NOTION",
      } as any);

      await expect(
        getContentfulEntryContent("conn-1", "entry-1"),
      ).rejects.toThrow("Invalid Contentful connector");
    });

    it("should return entry content", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: {
              id: "entry-1",
              createdAt: "2026-01-01",
              updatedAt: "2026-06-01",
            },
            fields: { title: "My Entry", body: "Hello world" },
          },
        ],
      } as any);

      const result = await getContentfulEntryContent("conn-1", "entry-1");

      expect(result.title).toBe("My Entry");
      expect(result.content).toContain("Hello world");
    });

    it("should throw when spaceId is missing from config", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "CONTENTFUL",
        credentials: "enc_token",
        config: JSON.stringify({}),
      } as any);

      await expect(
        getContentfulEntryContent("conn-1", "entry-1"),
      ).rejects.toThrow("Missing space ID");
    });

    it("should throw when entryId is malformed (empty parts)", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "CONTENTFUL",
        credentials: "enc_token",
        config: JSON.stringify({
          spaceId: "space-1",
          contentTypeId: "article",
        }),
      } as any);

      await expect(
        getContentfulEntryContent("conn-1", ":onlyid"),
      ).rejects.toThrow("Invalid entry ID");
    });

    it("should throw when entry not found in results", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({
        items: [
          {
            sys: { id: "other-entry" },
            fields: { title: "Other" },
          },
        ],
      } as any);

      await expect(
        getContentfulEntryContent("conn-1", "nonexistent"),
      ).rejects.toThrow("Entry not found");
    });
  });
});
