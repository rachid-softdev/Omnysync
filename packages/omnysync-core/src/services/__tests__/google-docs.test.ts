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
});
