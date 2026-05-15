import { describe, it, expect, vi } from "vitest"

// Mock prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: { connector: { findUnique: vi.fn(), create: vi.fn() }, document: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock("@/lib/http-client", () => ({
  fetchWithRetry: vi.fn(),
}))

import { testMediumConnection, getMediumUser } from "../services/medium"

describe("medium service", () => {
  describe("testMediumConnection", () => {
    it("returns success when API call succeeds", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({
        data: { id: "123", username: "testuser", name: "Test", url: "", imageUrl: "" },
      })
      const result = await testMediumConnection("valid-token")
      expect(result.success).toBe(true)
    })

    it("returns failure when API call fails", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error("Unauthorized"))
      const result = await testMediumConnection("invalid-token")
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe("getMediumUser", () => {
    it("returns user data on success", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({
        data: { id: "123", username: "testuser", name: "Test User", url: "", imageUrl: "" },
      })
      const user = await getMediumUser("valid-token")
      expect(user.id).toBe("123")
      expect(user.username).toBe("testuser")
    })

    it("throws on failure", async () => {
      const { fetchWithRetry } = await import("@/lib/http-client")
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error("Network error"))
      await expect(getMediumUser("token")).rejects.toThrow("Failed to fetch Medium user")
    })
  })
})
