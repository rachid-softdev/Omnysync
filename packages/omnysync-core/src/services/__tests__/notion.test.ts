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
  });

  describe("getNotionPageContent", () => {
    it("should extract text from various block types", async () => {
      // First call for blocks, second call for page metadata
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          results: [
            { type: "heading_1", heading_1: { rich_text: [{ plain_text: "Title" }] } },
            { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Some text" }] } },
            { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Item 1" }] } },
            { type: "code", code: { language: "ts", rich_text: [{ plain_text: "const x = 1;" }] } },
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
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

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
});
