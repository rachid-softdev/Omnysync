import { describe, it, expect, vi } from "vitest"

// Mock prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: { connector: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock("@/lib/http-client", () => ({
  fetchWithRetry: vi.fn(),
}))

import { testAirtableConnection, listAirtableBases, airtableRecordToDocument } from "../services/airtable"

describe("airtable service", () => {
  describe("testAirtableConnection", () => {
    it("returns success when API call succeeds", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce([{ id: "base1", name: "My Base" }])
      const result = await testAirtableConnection("valid-key")
      expect(result.success).toBe(true)
    })

    it("returns failure when API call fails", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error("Unauthorized"))
      const result = await testAirtableConnection("invalid-key")
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe("listAirtableBases", () => {
    it("returns bases on success", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce([
        { id: "base1", name: "Base 1" },
        { id: "base2", name: "Base 2" },
      ])
      const bases = await listAirtableBases("valid-key")
      expect(bases).toHaveLength(2)
      expect(bases[0].name).toBe("Base 1")
    })
  })

  describe("airtableRecordToDocument", () => {
    it("converts record to document format", () => {
      const record = {
        id: "rec123",
        fields: { Title: "My Article", Content: "Article body text" },
        createdTime: "2026-05-01T00:00:00Z",
        lastEditedTime: "2026-05-15T00:00:00Z",
      }
      const doc = airtableRecordToDocument(record)
      expect(doc.title).toBe("My Article")
      expect(doc.content).toContain("My Article")
      expect(doc.metadata.airtableId).toBe("rec123")
    })

    it("uses Name field as fallback for title", () => {
      const record = {
        id: "rec456",
        fields: { Name: "Fallback Title", Description: "desc" },
        createdTime: "2026-05-01T00:00:00Z",
        lastEditedTime: "2026-05-15T00:00:00Z",
      }
      const doc = airtableRecordToDocument(record)
      expect(doc.title).toBe("Fallback Title")
    })

    it("uses 'Untitled' when no title field found", () => {
      const record = {
        id: "rec789",
        fields: { value: 42 },
        createdTime: "2026-05-01T00:00:00Z",
        lastEditedTime: "2026-05-15T00:00:00Z",
      }
      const doc = airtableRecordToDocument(record)
      expect(doc.title).toBe("Untitled")
    })
  })
})
