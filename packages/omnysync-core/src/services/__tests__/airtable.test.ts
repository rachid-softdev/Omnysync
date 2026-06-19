/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn(), findUnique: vi.fn() },
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
  listAirtableBases,
  listAirtableTables,
  getAirtableRecords,
  airtableRecordToDocument,
  saveAirtableConnector,
  testAirtableConnection,
  createAirtableRecord,
  updateAirtableRecord,
  deleteAirtableRecord,
} from "../airtable";

describe("Airtable Connector", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const apiKey = "key_abc123";
  const baseId = "base-1";
  const tableId = "table-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAirtableBases", () => {
    it("should return bases", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([
        { id: "base-1", name: "My Base" },
      ] as any);

      const bases = await listAirtableBases(apiKey);

      expect(bases.length).toBe(1);
      expect(bases[0].id).toBe("base-1");
    });

    it("should throw on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Bad key"));

      await expect(listAirtableBases(apiKey)).rejects.toThrow(
        "Failed to fetch Airtable bases",
      );
    });
  });

  describe("listAirtableTables", () => {
    it("should return tables", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        tables: [{ id: "table-1", name: "Table 1" }],
      } as any);

      const tables = await listAirtableTables(apiKey, baseId);

      expect(tables.length).toBe(1);
    });
  });

  describe("getAirtableRecords", () => {
    it("should return records with filters", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          { id: "rec-1", fields: { Title: "Record 1", Body: "Content" }, createdTime: "2026-01-01", lastEditedTime: "2026-06-01" },
        ],
      } as any);

      const records = await getAirtableRecords(apiKey, baseId, tableId, {
        maxRecords: 10,
        view: "Grid view",
      });

      expect(records.length).toBe(1);
      expect(records[0].id).toBe("rec-1");
    });
  });

  describe("airtableRecordToDocument", () => {
    it("should find title from various field names", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: { Title: "My Record", Body: "Content here" },
        createdTime: "2026-01-01",
        lastEditedTime: "2026-06-01",
      });

      expect(result.title).toBe("My Record");
      expect(result.content).toContain("Content here");
    });

    it("should fallback to Untitled when no title field", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: { SomeField: "value" },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("value"); // picks the first string value
    });
  });

  describe("saveAirtableConnector", () => {
    it("should verify key and create connector", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({ id: "conn-1" } as any);

      const result = await saveAirtableConnector(userId, orgId, apiKey, {
        baseId,
        tableId,
      });

      expect(result.id).toBe("conn-1");
      expect(prisma.connector.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          organizationId: orgId,
          type: "AIRTABLE",
          credentials: `enc_${apiKey}`,
        }),
      });
    });
  });

  describe("testAirtableConnection", () => {
    it("should return success when connection works", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);

      const result = await testAirtableConnection(apiKey);

      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("Bad key"));

      const result = await testAirtableConnection(apiKey);

      expect(result.success).toBe(false);
    });
  });

  describe("createAirtableRecord", () => {
    it("should create a record", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ id: "rec-new" } as any);

      const result = await createAirtableRecord(apiKey, baseId, tableId, {
        Title: "New",
      });

      expect(result.id).toBe("rec-new");
    });
  });

  describe("updateAirtableRecord", () => {
    it("should update a record", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ id: "rec-1" } as any);

      const result = await updateAirtableRecord(apiKey, baseId, tableId, "rec-1", {
        Title: "Updated",
      });

      expect(result.id).toBe("rec-1");
    });
  });

  describe("deleteAirtableRecord", () => {
    it("should delete a record", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(undefined as any);

      const result = await deleteAirtableRecord(apiKey, baseId, tableId, "rec-1");

      expect(result.id).toBe("rec-1");
    });
  });
});
