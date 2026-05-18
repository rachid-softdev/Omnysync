import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendEmail } from "../email"

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment
    vi.stubEnv("RESEND_API_KEY", undefined)
    vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("sendEmail", () => {
    it("should log when RESEND_API_KEY is not set", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test content</p>",
      })

      // Should log a message about sending (either "Would send" or "Resend not available")
      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0][0] as string
      expect(logCall).toContain("user@example.com")
      expect(logCall).toContain("Test Subject")

      consoleLogSpy.mockRestore()
    })

    it("should handle missing required fields gracefully", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      // Empty to should still be handled
      await sendEmail({
        to: "",
        subject: "Test Subject",
        html: "<p>Test</p>",
      })

      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })
})