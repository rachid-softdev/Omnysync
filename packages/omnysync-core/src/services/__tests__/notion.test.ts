/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ encrypt: vi.fn((s) => `enc_${s}`) }));
vi.mock("../../http", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("../../errors", () => ({ ERR_FETCH_CONTENT: "ERR_FETCH_CONTENT" }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  listNotionPages,
  getNotionPageContent,
  saveNotionConnector,
} from "../notion";

describe("Notion Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const accessToken = "ntn_abc123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listNotionPages", () => {
    it("should return list of Notion pages", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "page-1",
            properties: {
              title: {
                title: [{ plain_text: "Page 1" }],
              },
            },
            created_time: "2026-01-01T00:00:00Z",
            last_edited_time: "2026-06-01T00:00:00Z",
            parent: { type: "workspace" },
          },
          {
            id: "page-2",
            properties: {
              title: {
                title: [{ plain_text: "Page 2" }],
              },
            },
            created_time: "2026-02-01T00:00:00Z",
            last_edited_time: "2026-06-15T00:00:00Z",
            parent: { type: "database" },
          },
        ],
      } as any);

      const pages = await listNotionPages(accessToken);

      expect(pages.length).toBe(2);
      expect(pages[0].title).toBe("Page 1");
      expect(pages[0].id).toBe("page-1");
    });

    it("should filter out non-workspace/database pages", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "page-1",
            properties: { title: { title: [{ plain_text: "Page" }] } },
            parent: { type: "page" }, // Not workspace or database
            created_time: "",
            last_edited_time: "",
          },
        ],
      } as any);

      const pages = await listNotionPages(accessToken);

      expect(pages.length).toBe(0);
    });

    it("should return empty list when no pages found", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ results: [] } as any);
      const pages = await listNotionPages(accessToken);
      expect(pages).toEqual([]);
    });

    it("should handle mixed parent types (include some, exclude others)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "p1",
            properties: { title: { title: [{ plain_text: "Workspace" }] } },
            created_time: "",
            last_edited_time: "",
            parent: { type: "workspace" },
          },
          {
            id: "p2",
            properties: { title: { title: [{ plain_text: "Database" }] } },
            created_time: "",
            last_edited_time: "",
            parent: { type: "database" },
          },
          {
            id: "p3",
            properties: { title: { title: [{ plain_text: "Page" }] } },
            created_time: "",
            last_edited_time: "",
            parent: { type: "page" },
          },
          {
            id: "p4",
            properties: { title: { title: [{ plain_text: "Page Block" }] } },
            created_time: "",
            last_edited_time: "",
            parent: { type: "page_block" },
          },
        ],
      } as any);
      const pages = await listNotionPages(accessToken);
      expect(pages).toHaveLength(2);
      expect(pages[0].id).toBe("p1");
      expect(pages[1].id).toBe("p2");
    });

    it("should handle pages without title properties", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "p1",
            properties: {},
            created_time: "",
            last_edited_time: "",
            parent: { type: "workspace" },
          },
        ],
      } as any);
      const pages = await listNotionPages(accessToken);
      expect(pages).toHaveLength(1);
      expect(pages[0].title).toBe("Untitled");
    });

    it("should handle fetchWithRetry rejection", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Network error"));
      await expect(listNotionPages(accessToken)).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("getNotionPageContent", () => {
    it("should extract text from various block types", async () => {
      // First call for blocks, second call for page metadata
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            {
              type: "heading_1",
              heading_1: { rich_text: [{ plain_text: "Title" }] },
            },
            {
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: "Some text" }] },
            },
            {
              type: "bulleted_list_item",
              bulleted_list_item: { rich_text: [{ plain_text: "Item 1" }] },
            },
            {
              type: "code",
              code: {
                language: "ts",
                rich_text: [{ plain_text: "const x = 1;" }],
              },
            },
            { type: "quote", quote: { rich_text: [{ plain_text: "Quote" }] } },
          ],
        } as any)
        .mockResolvedValueOnce({
          properties: {
            title: {
              title: [{ plain_text: "My Page" }],
            },
          },
          created_time: "2026-01-01T00:00:00Z",
          last_edited_time: "2026-06-01T00:00:00Z",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      expect(result.title).toBe("My Page");
      expect(result.content).toContain("# Title");
      expect(result.content).toContain("Some text");
      expect(result.content).toContain("Item 1");
      expect(result.content).toContain("const x = 1;");
      expect(result.content).toContain("Quote");
    });
  });

  describe("saveNotionConnector", () => {
    it("should create a Notion connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveNotionConnector(userId, orgId, accessToken);

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "NOTION",
          credentials: `enc_${accessToken}`,
        }),
      });
    });
  });

  describe("listNotionPages — edge cases", () => {
    it("should return empty list when no pages found", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [],
      } as any);

      const pages = await listNotionPages(accessToken);

      expect(pages.length).toBe(0);
    });

    it("should handle mixed parent types", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "p1",
            properties: { title: { title: [{ plain_text: "Workspace" }] } },
            parent: { type: "workspace" },
            created_time: "",
            last_edited_time: "",
          },
          {
            id: "p2",
            properties: { title: { title: [{ plain_text: "DB Page" }] } },
            parent: { type: "database" },
            created_time: "",
            last_edited_time: "",
          },
          {
            id: "p3",
            properties: { title: { title: [{ plain_text: "Page" }] } },
            parent: { type: "page" }, // should be filtered out
            created_time: "",
            last_edited_time: "",
          },
        ],
      } as any);

      const pages = await listNotionPages(accessToken);

      expect(pages.length).toBe(2);
    });

    it("should handle pages without title properties", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        results: [
          {
            id: "p1",
            properties: {},
            parent: { type: "workspace" },
            created_time: "",
            last_edited_time: "",
          },
        ],
      } as any);

      const pages = await listNotionPages(accessToken);

      expect(pages.length).toBe(1);
      expect(pages[0].title).toBe("Untitled");
    });

    it("should propagate fetchWithRetry rejection", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Network error"));

      await expect(listNotionPages(accessToken)).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("getNotionPageContent — edge cases", () => {
    it("should extract text from heading_2, heading_3, and numbered_list_item blocks", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            {
              type: "heading_2",
              heading_2: { rich_text: [{ plain_text: "Section title" }] },
            },
            {
              type: "heading_3",
              heading_3: { rich_text: [{ plain_text: "Sub-section title" }] },
            },
            {
              type: "numbered_list_item",
              numbered_list_item: {
                rich_text: [{ plain_text: "First ordered item" }],
              },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          properties: {
            title: { title: [{ plain_text: "Structured Page" }] },
          },
          created_time: "",
          last_edited_time: "",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      expect(result.content).toContain("## Section title");
      expect(result.content).toContain("### Sub-section title");
      expect(result.content).toContain("1. First ordered item");
    });

    it("should handle empty blocks response", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({ results: [] } as any)
        .mockResolvedValueOnce({
          properties: {
            title: { title: [{ plain_text: "Empty Page" }] },
          },
          created_time: "",
          last_edited_time: "",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      expect(result.title).toBe("Empty Page");
      expect(result.content).toBe("");
    });

    it("should handle unknown block types gracefully", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            { type: "divider", divider: {} },
            { type: "to_do", to_do: { rich_text: [{ plain_text: "Todo" }] } },
            {
              type: "callout",
              callout: { rich_text: [{ plain_text: "Note" }] },
            },
            {
              type: "image",
              image: { caption: [{ plain_text: "Pic" }] },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          properties: {
            title: { title: [{ plain_text: "Unknown Blocks" }] },
          },
          created_time: "",
          last_edited_time: "",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      // Unknown block types should return empty string for content
      expect(result.title).toBe("Unknown Blocks");
      expect(result.content).toBe("");
    });

    it("should handle blocks without rich_text", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            {
              type: "paragraph",
              paragraph: { rich_text: undefined },
            },
            {
              type: "heading_1",
              heading_1: { rich_text: undefined },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          properties: {
            title: { title: [{ plain_text: "No Rich Text" }] },
          },
          created_time: "",
          last_edited_time: "",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      // Paragraph with undefined rich_text: `undefined?.map(...) || ""` → ""
      // Heading with undefined rich_text: template literal produces "# undefined\n\n"
      expect(result.content).toBe("# undefined\n\n");
    });

    it("should handle code block without language (defaults to empty string)", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            {
              type: "code",
              code: {
                // language is undefined — should fall back to ""
                rich_text: [{ plain_text: "console.log('hi');" }],
              },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          properties: {
            title: { title: [{ plain_text: "Code Block No Lang" }] },
          },
          created_time: "",
          last_edited_time: "",
        } as any);

      const result = await getNotionPageContent("page-1", accessToken);

      expect(result.content).toContain("```");
      expect(result.content).toContain("console.log('hi');");
      // language should default to empty string (no language annotation after ```)
      expect(result.content).toMatch(/```\n/);
    });

    it("should handle missing page title metadata", async () => {
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({ results: [] } as any)
        .mockResolvedValueOnce({} as any);

      const result = await getNotionPageContent("page-1", accessToken);

      expect(result.title).toBe("Untitled");
    });

    it("should propagate fetch error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(getNotionPageContent("page-1", accessToken)).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("known URL bug", () => {
    it("should document the double /v1/v1/ URL issue", async () => {
      // NOTION_API = "https://api.notion.com/v1"
      // listNotionPages calls: `${NOTION_API}/v1/search`
      // Result: https://api.notion.com/v1/v1/search (double /v1/)
      vi.mocked(fetchWithRetry).mockResolvedValue({ results: [] } as any);

      await listNotionPages(accessToken);

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/v1/v1/search"),
        expect.any(Object),
      );
    });
  });
});
