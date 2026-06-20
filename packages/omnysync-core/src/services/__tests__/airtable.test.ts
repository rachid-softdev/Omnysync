/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  encrypt: vi.fn((s) => `enc_${s}`),
  decrypt: vi.fn((s) => (s ? s.replace("enc_", "") : "")),
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
  listAirtableDocuments,
  getAirtableRecordContent,
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

    it("should throw on API error (e.g. invalid base ID)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("NOT_FOUND: Base not found"),
      );

      await expect(listAirtableTables(apiKey, "invalid-base")).rejects.toThrow(
        "Failed to fetch Airtable tables",
      );
    });

    it("should return empty array when tables field is missing", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({} as any);

      const tables = await listAirtableTables(apiKey, baseId);

      expect(tables).toEqual([]);
    });
  });

  describe("getAirtableRecords", () => {
    it("should return records with filters", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          {
            id: "rec-1",
            fields: { Title: "Record 1", Body: "Content" },
            createdTime: "2026-01-01",
            lastEditedTime: "2026-06-01",
          },
        ],
      } as any);

      const records = await getAirtableRecords(apiKey, baseId, tableId, {
        maxRecords: 10,
        view: "Grid view",
      });

      expect(records.length).toBe(1);
      expect(records[0].id).toBe("rec-1");
    });

    it("should return empty array when no records", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ records: [] } as any);

      const records = await getAirtableRecords(apiKey, baseId, tableId);

      expect(records).toEqual([]);
    });

    it("should pass maxRecords parameter in URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ records: [] } as any);

      await getAirtableRecords(apiKey, baseId, tableId, { maxRecords: 50 });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("maxRecords=50"),
        expect.any(Object),
      );
    });

    it("should pass filterByFormula parameter in URL", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ records: [] } as any);

      await getAirtableRecords(apiKey, baseId, tableId, {
        filterByFormula: "RECORD_ID() = 'rec-1'",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(
          "filterByFormula=RECORD_ID%28%29+%3D+%27rec-1%27",
        ),
        expect.any(Object),
      );
    });

    it("should throw on API error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(new Error("API error"));

      await expect(getAirtableRecords(apiKey, baseId, tableId)).rejects.toThrow(
        "Failed to fetch Airtable records",
      );
    });

    it("should handle invalid table ID (table not found)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("TABLE_NOT_FOUND: Table does not exist"),
      );

      await expect(
        getAirtableRecords(apiKey, baseId, "nonexistent-table"),
      ).rejects.toThrow("Failed to fetch Airtable records");
    });

    it("should fall back to [] when response has no records field (line 112)", async () => {
      // data.records is undefined → undefined || [] → []
      vi.mocked(fetchWithRetry).mockResolvedValue({} as any);

      const records = await getAirtableRecords(apiKey, baseId, tableId);

      expect(records).toEqual([]);
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

    it("should handle array fields in content conversion", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: { Title: "Record with Array", Tags: ["tag1", "tag2", "tag3"] },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Record with Array");
      expect(result.content).toContain("tag1");
      expect(result.content).toContain("tag2");
      expect(result.content).toContain("tag3");
    });

    it("should handle object fields in content conversion", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Title: "Record with Object",
          Metadata: { key: "value", nested: { inner: "data" } },
        },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Record with Object");
      expect(result.content).toContain("key");
      expect(result.content).toContain("nested");
    });

    it("should handle numeric fields with String() conversion", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Title: "Record with numbers",
          Count: 42,
          Score: 3.14,
        },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Record with numbers");
      expect(result.content).toContain("42");
      expect(result.content).toContain("3.14");
    });

    it("should handle boolean and null field values", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Title: "Record with mixed",
          IsActive: true,
          IsDeleted: false,
          NullField: null,
        },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Record with mixed");
      expect(result.content).toContain("true");
      expect(result.content).toContain("false");
    });

    it("should convert non-string, non-array, non-object values via String() (line 148)", () => {
      // Number and boolean values go through the String(value) fallback path
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Title: "Numeric record",
          Count: 42,
          Score: 3.14,
          Percentage: 95,
        },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Numeric record");
      expect(result.content).toContain("## Count");
      expect(result.content).toContain("42");
      expect(result.content).toContain("## Score");
      expect(result.content).toContain("3.14");
      // Each number value is converted via String() through the fallback path
    });

    it("should handle undefined field values via String() fallback (line 148)", () => {
      // undefined value matches none of the type checks (not string, not array, not object)
      // and falls through to the String() conversion on line 148
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Title: "Undefined fields",
          UndefinedField: undefined,
        },
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Undefined fields");
      expect(result.content).toContain("## UndefinedField");
      // String(undefined) returns "undefined"
      expect(result.content).toContain("undefined");
    });
  });

  describe("saveAirtableConnector", () => {
    it("should verify key and create connector", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue([] as any);
      vi.mocked(prisma.connector.create).mockResolvedValue({
        id: "conn-1",
      } as any);

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

    it("should throw on invalid fields", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Invalid field: BadField"),
      );

      await expect(
        createAirtableRecord(apiKey, baseId, tableId, {
          BadField: "value",
        }),
      ).rejects.toThrow("Failed to create Airtable record");
    });

    it("should throw on rate limit (429)", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Rate limit exceeded"),
      );

      await expect(
        createAirtableRecord(apiKey, baseId, tableId, {
          Title: "Test",
        }),
      ).rejects.toThrow("Failed to create Airtable record");
    });

    it("should throw on table full", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Table limit reached"),
      );

      await expect(
        createAirtableRecord(apiKey, baseId, tableId, {
          Title: "Test",
        }),
      ).rejects.toThrow("Failed to create Airtable record");
    });

    it("should send POST request with correct body", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ id: "rec-new" } as any);

      await createAirtableRecord(apiKey, baseId, tableId, {
        Title: "New Record",
        Status: "Active",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(`/${baseId}/${tableId}`),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            fields: { Title: "New Record", Status: "Active" },
          }),
        }),
      );
    });
  });

  describe("updateAirtableRecord", () => {
    it("should update a record", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ id: "rec-1" } as any);

      const result = await updateAirtableRecord(
        apiKey,
        baseId,
        tableId,
        "rec-1",
        {
          Title: "Updated",
        },
      );

      expect(result.id).toBe("rec-1");
    });

    it("should throw on record not found", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Record not found"),
      );

      await expect(
        updateAirtableRecord(apiKey, baseId, tableId, "nonexistent", {
          Title: "Updated",
        }),
      ).rejects.toThrow("Failed to update Airtable record");
    });

    it("should throw on field validation error", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Validation error"),
      );

      await expect(
        updateAirtableRecord(apiKey, baseId, tableId, "rec-1", {
          InvalidField: "value",
        }),
      ).rejects.toThrow("Failed to update Airtable record");
    });

    it("should send PATCH request", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue({ id: "rec-1" } as any);

      await updateAirtableRecord(apiKey, baseId, tableId, "rec-1", {
        Title: "Updated",
      });

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(`/${baseId}/${tableId}/rec-1`),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("deleteAirtableRecord", () => {
    it("should delete a record", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(undefined as any);

      const result = await deleteAirtableRecord(
        apiKey,
        baseId,
        tableId,
        "rec-1",
      );

      expect(result.id).toBe("rec-1");
    });

    it("should throw on delete failure", async () => {
      vi.mocked(fetchWithRetry).mockRejectedValue(
        new Error("Record not found"),
      );

      await expect(
        deleteAirtableRecord(apiKey, baseId, tableId, "nonexistent"),
      ).rejects.toThrow("Failed to delete Airtable record");
    });

    it("should send DELETE request", async () => {
      vi.mocked(fetchWithRetry).mockResolvedValue(undefined as any);

      await deleteAirtableRecord(apiKey, baseId, tableId, "rec-1");

      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(`/${baseId}/${tableId}/rec-1`),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("listAirtableDocuments", () => {
    const connector = {
      id: "conn-1",
      type: "AIRTABLE",
      credentials: "enc_key_abc123",
      config: JSON.stringify({ baseId: "base-1", tableId: "table-1" }),
    };

    it("should throw for invalid connector type", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "WORDPRESS",
      } as any);

      await expect(listAirtableDocuments("conn-1")).rejects.toThrow(
        "Invalid Airtable connector",
      );
    });

    it("should return empty array when no baseId", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({}),
      } as any);

      const result = await listAirtableDocuments("conn-1");

      expect(result).toEqual([]);
    });

    it("should return documents from specified table", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          {
            id: "rec-1",
            fields: { Title: "Record 1", Body: "Content 1" },
            createdTime: "",
            lastEditedTime: "",
          },
        ],
      } as any);

      const result = await listAirtableDocuments("conn-1");

      expect(result.length).toBe(1);
      expect(result[0].title).toContain("Record 1");
    });

    it("should iterate over multiple tables when no tableId is specified", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-2",
        type: "AIRTABLE",
        credentials: "enc_key_abc123",
        config: JSON.stringify({ baseId: "base-1" }),
      } as any);

      // First call: list tables
      // Second call: records from table-1
      // Third call: records from table-2
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          tables: [
            { id: "table-1", name: "Articles" },
            { id: "table-2", name: "Pages" },
          ],
        } as any)
        .mockResolvedValueOnce({
          records: [
            {
              id: "rec-1",
              fields: { Title: "Article 1", Body: "Hello" },
              createdTime: "",
              lastEditedTime: "",
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          records: [
            {
              id: "rec-2",
              fields: { Name: "Page 1", Body: "World" },
              createdTime: "",
              lastEditedTime: "",
            },
          ],
        } as any);

      const result = await listAirtableDocuments("conn-2");

      expect(result.length).toBe(2);
      expect(result[0].title).toContain("Article 1");
      expect(result[1].title).toContain("Page 1");
    });
  });

  describe("getAirtableRecordContent", () => {
    const connector = {
      id: "conn-1",
      type: "AIRTABLE",
      credentials: "enc_key_abc123",
      config: JSON.stringify({ baseId: "base-1", tableId: "table-1" }),
    };

    it("should throw for invalid connector type", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "GHOST",
      } as any);

      await expect(getAirtableRecordContent("conn-1", "rec-1")).rejects.toThrow(
        "Invalid Airtable connector",
      );
    });

    it("should return record content", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          {
            id: "rec-1",
            fields: { Title: "Record 1", Body: "Hello" },
            createdTime: "2026-01-01",
            lastEditedTime: "2026-06-01",
          },
        ],
      } as any);

      const result = await getAirtableRecordContent("conn-1", "rec-1");

      expect(result.title).toBe("Record 1");
      expect(result.content).toContain("Hello");
    });

    it("should parse compound recordId (tableId:recordId)", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key_abc123",
        config: JSON.stringify({ baseId: "base-1" }),
      } as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          {
            id: "rec-1",
            fields: { Title: "Parsed", Body: "OK" },
            createdTime: "",
            lastEditedTime: "",
          },
        ],
      } as any);

      const result = await getAirtableRecordContent("conn-1", "table-2:rec-1");

      expect(result.title).toBe("Parsed");
      // Should have called with table-2, not the default tableId
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("/base-1/table-2"),
        expect.any(Object),
      );
    });

    it("should throw when compound recordId has empty parts", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key_abc123",
        config: JSON.stringify({ baseId: "base-1", tableId: "table-1" }),
      } as any);

      await expect(
        getAirtableRecordContent("conn-1", ":rec-1"),
      ).rejects.toThrow("Invalid record ID");
    });

    it("should throw when record not found", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(
        connector as any,
      );
      vi.mocked(fetchWithRetry).mockResolvedValue({ records: [] } as any);

      await expect(
        getAirtableRecordContent("conn-1", "nonexistent"),
      ).rejects.toThrow("Record not found");
    });
  });

  describe("listAirtableDocuments — decrypt/JSON.parse edge cases", () => {
    it("should handle connector with null credentials (falls back to empty string)", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: null,
        config: JSON.stringify({ baseId: "base-1" }),
      } as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({ tables: [] } as any);

      const result = await listAirtableDocuments("conn-1");
      expect(result).toEqual([]);
    });

    it("should handle connector with null config (falls back to '{}')", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: null,
      } as any);

      const result = await listAirtableDocuments("conn-1");
      // No baseId in config — returns empty array
      expect(result).toEqual([]);
    });

    it("should handle empty tables list when iterating all tables", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({ baseId: "base-1" }),
      } as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({ tables: [] } as any);

      const result = await listAirtableDocuments("conn-1");
      expect(result).toEqual([]);
    });

    it("should handle tables with zero records each", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({ baseId: "base-1" }),
      } as any);
      vi.mocked(fetchWithRetry)
        .mockResolvedValueOnce({
          tables: [{ id: "table-1", name: "Empty Table" }],
        } as any)
        .mockResolvedValueOnce({ records: [] } as any);

      const result = await listAirtableDocuments("conn-1");
      expect(result).toEqual([]);
    });
  });

  describe("getAirtableRecordContent — decrypt/JSON.parse edge cases", () => {
    it("should handle connector with null credentials (falls back to empty string)", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: null,
        config: JSON.stringify({ baseId: "base-1", tableId: "table-1" }),
      } as any);
      vi.mocked(fetchWithRetry).mockResolvedValue({
        records: [
          {
            id: "rec-1",
            fields: { Title: "Found", Body: "OK" },
            createdTime: "",
            lastEditedTime: "",
          },
        ],
      } as any);

      const result = await getAirtableRecordContent("conn-1", "rec-1");
      expect(result.title).toBe("Found");
    });

    it("should handle connector with null config (falls back to '{}')", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: null,
      } as any);

      // baseId missing — should throw "Invalid record ID"
      await expect(getAirtableRecordContent("conn-1", "rec-1")).rejects.toThrow(
        "Invalid record ID",
      );
    });

    it("should throw when config has no baseId", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({ tableId: "table-1" }),
      } as any);

      await expect(getAirtableRecordContent("conn-1", "rec-1")).rejects.toThrow(
        "Invalid record ID",
      );
    });

    it("should throw when compound recordId has empty actualRecordId part", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({ baseId: "base-1", tableId: "table-1" }),
      } as any);

      await expect(
        getAirtableRecordContent("conn-1", "table-1:"),
      ).rejects.toThrow("Invalid record ID");
    });

    it("should throw when config has neither baseId nor tableId and no compound recordId", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue({
        id: "conn-1",
        type: "AIRTABLE",
        credentials: "enc_key",
        config: JSON.stringify({}),
      } as any);

      await expect(getAirtableRecordContent("conn-1", "rec-1")).rejects.toThrow(
        "Invalid record ID",
      );
    });
  });

  describe("airtableRecordToDocument — edge cases", () => {
    it("should return Untitled when fields object is empty", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {},
        createdTime: "",
        lastEditedTime: "",
      });

      expect(result.title).toBe("Untitled");
      expect(result.content).toBe("");
    });

    it("should return Untitled when no string value exists in fields (all non-strings)", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Count: 42,
          IsActive: true,
          Data: { key: "value" },
        },
        createdTime: "",
        lastEditedTime: "",
      });

      // title fallback: Title → title → Name → name → find string → "Untitled"
      expect(result.title).toBe("Untitled");
      expect(result.content).toContain("## Count");
      expect(result.content).toContain("## IsActive");
      expect(result.content).toContain("## Data");
    });

    it("should pick the first string when none of the title fields match", () => {
      const result = airtableRecordToDocument({
        id: "rec-1",
        fields: {
          Heading: "First string",
          Body: "Second string",
        },
        createdTime: "",
        lastEditedTime: "",
      });

      // Title, title, Name, name all missing → find string → "First string"
      expect(result.title).toBe("First string");
    });
  });
});
