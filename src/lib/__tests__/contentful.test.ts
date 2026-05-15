import { describe, it, expect, vi } from "vitest"

// Mock prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    connector: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

// Mock fetchWithRetry
vi.mock("@/lib/http-client", () => ({
  fetchWithRetry: vi.fn(),
}))

import { testContentfulConnection, listContentfulSpaces, contentfulEntryToDocument } from "../services/contentful"

describe("contentful service", () => {
  describe("testContentfulConnection", () => {
    it("returns success when API call succeeds", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({
        items: [{ id: "space1", name: "My Space" }],
      })

      const result = await testContentfulConnection("valid-token")
      expect(result.success).toBe(true)
    })

    it("returns failure when API call fails", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error("Unauthorized"))

      const result = await testContentfulConnection("invalid-token")
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe("listContentfulSpaces", () => {
    it("returns spaces on success", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({
        items: [
          { id: "space1", name: "Space 1" },
          { id: "space2", name: "Space 2" },
        ],
      })

      const spaces = await listContentfulSpaces("valid-token")
      expect(spaces).toHaveLength(2)
      expect(spaces[0].name).toBe("Space 1")
    })
  })

  describe("contentfulEntryToDocument", () => {
    it("converts entry with body field to document", () => {
      const entry = {
        id: "entry123",
        title: "My Article",
        content: "",
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-15T00:00:00Z",
        fields: {
          title: "My Article",
          body: "Article body content",
        },
      }

      const doc = contentfulEntryToDocument(entry)
      expect(doc.title).toBe("My Article")
      expect(doc.content).toBe("Article body content")
      expect(doc.metadata.contentfulId).toBe("entry123")
    })

    it("uses description field as fallback for content", () => {
      const entry = {
        id: "entry456",
        title: "Product",
        content: "",
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-15T00:00:00Z",
        fields: {
          title: "Product",
          description: "Product description text",
        },
      }

      const doc = contentfulEntryToDocument(entry)
      expect(doc.content).toBe("Product description text")
    })

    it("stringifies fields when no content field found", () => {
      const entry = {
        id: "entry789",
        title: "Data",
        content: "",
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-15T00:00:00Z",
        fields: {
          title: "Data",
          customField: "value",
        },
      }

      const doc = contentfulEntryToDocument(entry)
      expect(doc.content).toContain("customField")
    })
  })
})
