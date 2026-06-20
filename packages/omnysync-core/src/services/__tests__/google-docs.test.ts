/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ encrypt: vi.fn((s) => `enc_${s}`) }));
vi.mock("../../http", () => ({
  fetchWithRetry: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));
vi.mock("../../errors", () => ({ ERR_FETCH_CONTENT: "ERR_FETCH_CONTENT" }));

import { prisma } from "../../prisma";
import { fetchWithRetry } from "../../http";
import {
  listGoogleDocs,
  getGoogleDocContent,
  saveGoogleDocsConnector,
  updateConnectorCredentials,
} from "../google-docs";

describe("Google Docs Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const accessToken = "ya29.abc123";
  const refreshToken = "1//refresh-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listGoogleDocs", () => {
    it("should return list of Google Docs", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        files: [
          {
            id: "doc-1",
            name: "Doc 1",
            createdTime: "2026-01-01",
            modifiedTime: "2026-06-01",
          },
          {
            id: "doc-2",
            name: "Doc 2",
            createdTime: "2026-02-01",
            modifiedTime: "2026-06-15",
          },
        ],
      } as any);

      const docs = await listGoogleDocs(accessToken);

      expect(docs.length).toBe(2);
      expect(docs[0].title).toBe("Doc 1");
      expect(docs[0].id).toBe("doc-1");
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("www.googleapis.com/drive"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
    });
  });

  describe("getGoogleDocContent", () => {
    it("should extract content from paragraphs", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Test Doc",
        body: {
          content: [
            {
              paragraph: {
                elements: [
                  { textRun: { content: "Hello " } },
                  { textRun: { content: "World" } },
                ],
              },
            },
            {
              paragraph: {
                elements: [{ textRun: { content: "Line 2" } }],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.title).toBe("Test Doc");
      expect(result.content).toContain("Hello World");
      expect(result.content).toContain("Line 2");
    });

    it("should extract content from tables", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "A1" } }],
                            },
                          },
                        ],
                      },
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "B1" } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toContain("A1");
      expect(result.content).toContain("B1");
    });

    it("should handle table with null/undefined tableRows", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {},
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toBe("");
    });

    it("should handle table row with null/undefined tableCells", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [{}],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toBe("\n");
    });

    it("should handle table cell with null/undefined content", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [{}],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toBe(" | \n");
    });

    it("should handle table cell with content containing paragraph with null elements", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              // No elements array
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      // paragraph has no elements, so map returns undefined for the element,
      // then join produces empty string, then || "" kicks in
      expect(result.content).toBe(" | \n");
    });

    it("should handle table cell content with null paragraph", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            // No paragraph at all
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      // c.paragraph is undefined → optional chaining returns undefined for the element
      expect(result.content).toBe(" | \n");
    });

    it("should handle multiple table cells in one row", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "Cell 1" } }],
                            },
                          },
                        ],
                      },
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "Cell 2" } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toContain("Cell 1");
      expect(result.content).toContain("Cell 2");
      expect(result.content).toContain("|");
    });

    it("should handle cell with element having no textRun", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ someOtherField: "value" }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      // element has no textRun, so textRun?.content is undefined → "" via ||
      expect(result.content).toBe(" | \n");
    });

    it("should handle cell with textRun having null content", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: null } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      // null || "" = ""
      expect(result.content).toBe(" | \n");
    });

    it("should handle multiple content elements in single cell", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "Part 1" } }],
                            },
                          },
                          {
                            paragraph: {
                              elements: [{ textRun: { content: "Part 2" } }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toContain("Part 1");
      expect(result.content).toContain("Part 2");
    });

    it("should handle nested optional chaining in table cell with undefined paragraph.elements", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Table Doc",
        body: {
          content: [
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: undefined,
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      // c.paragraph?.elements is undefined → ?.map returns undefined
      // outer .map returns [undefined], .join(" ") → ""
      expect(result.content).toBe(" | \n");
    });
  });

  describe("saveGoogleDocsConnector", () => {
    it("should create a Google Docs connector", async () => {
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await saveGoogleDocsConnector(
        userId,
        orgId,
        accessToken,
        refreshToken,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "GOOGLE_DOCS",
          credentials: expect.stringContaining("enc_"),
        }),
      });
    });
  });

  describe("updateConnectorCredentials", () => {
    it("should update connector credentials", async () => {
      vi.mocked(prisma.connector.update).mockResolvedValue({
        id: "conn-1",
      } as any);

      const result = await updateConnectorCredentials(
        "conn-1",
        accessToken,
        refreshToken,
      );

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.update).toHaveBeenCalledWith({
        where: { id: "conn-1" },
        data: expect.objectContaining({
          credentials: expect.stringContaining("enc_"),
        }),
      });
    });
  });

  describe("getGoogleDocContent — edge cases", () => {
    it("should handle body with no content array (null/undefined)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Empty Doc",
        body: {},
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.id).toBe("doc-1");
      expect(result.title).toBe("Empty Doc");
      expect(result.content).toBe("");
    });

    it("should handle body.content as empty array", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Empty Doc",
        body: { content: [] },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toBe("");
    });

    it("should handle missing title (falls back to Untitled)", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        body: {
          content: [
            {
              paragraph: {
                elements: [{ textRun: { content: "Hi" } }],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.title).toBe("Untitled");
      expect(result.content).toContain("Hi");
    });

    it("should handle paragraph with no elements array", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Test",
        body: {
          content: [{ paragraph: {} }],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.title).toBe("Test");
      expect(result.content).toBe("\n");
    });

    it("should handle element with no textRun", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        documentId: "doc-1",
        title: "Test",
        body: {
          content: [
            {
              paragraph: {
                elements: [{ someOtherField: "value" }],
              },
            },
          ],
        },
      } as any);

      const result = await getGoogleDocContent("doc-1", accessToken);

      expect(result.content).toBe("\n");
    });

    it("should handle fetchWithRetry rejection (API error)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Google API error"),
      );

      await expect(getGoogleDocContent("doc-1", accessToken)).rejects.toThrow(
        "Google API error",
      );
    });
  });

  describe("listGoogleDocs — edge cases", () => {
    it("should return empty list when no files found", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ files: [] } as any);

      const docs = await listGoogleDocs(accessToken);

      expect(docs).toEqual([]);
    });

    it("should handle fetchWithRetry rejection", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Network error"));

      await expect(listGoogleDocs(accessToken)).rejects.toThrow(
        "Network error",
      );
    });
  });
});
