/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockResendSend = vi.hoisted(() => vi.fn());
const MockResend = vi.hoisted(
  () =>
    class MockResend {
      emails = { send: mockResendSend };
    },
);

vi.mock("resend", () => ({ Resend: MockResend }));

describe("Email module", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  describe("sendEmail", () => {
    it("logs when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Would send to user@example.com: Test",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("sends email via Resend when API key is set", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "Welcome!",
        html: "<h1>Hello</h1>",
      });

      expect(mockResendSend).toHaveBeenCalledWith({
        from: "test@omnysync.com",
        to: "user@example.com",
        subject: "Welcome!",
        html: "<h1>Hello</h1>",
      });
    });

    it("uses default from email when RESEND_FROM_EMAIL is not set", async () => {
      delete process.env.RESEND_FROM_EMAIL;
      process.env.RESEND_API_KEY = "re_abc123";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Content</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "noreply@omnysync.com" }),
      );
    });

    it("handles Resend errors gracefully", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockRejectedValue(new Error("Resend API error"));
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Content</p>",
        }),
      ).rejects.toThrow("Resend API error");
    });

    it("handles HTML content with special characters", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      const html = "<p>Special chars: & < > \" '</p>";
      await sendEmail({
        to: "user@example.com",
        subject: "Special",
        html,
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ html }),
      );
    });
  });

  describe("sendWelcomeEmail", () => {
    it("sends welcome email with user name", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await sendWelcomeEmail("user@example.com", "John");

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Bienvenue sur Omnysync !",
          html: expect.stringContaining("John"),
        }),
      );
    });

    it("logs when no API key (no-op)", async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await sendWelcomeEmail("user@example.com", "John");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Would send to user@example.com: Bienvenue sur Omnysync !",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });
  });

  describe("sendSyncCompleteEmail", () => {
    it("sends success email with destination URL", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail(
        "user@example.com",
        "My Article",
        true,
        "https://example.com/article",
      );

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Sync réussie: My Article",
          html: expect.stringContaining("Article publié"),
        }),
      );
    });

    it("sends failure email without URL", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "My Article", false);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Sync échouée: My Article",
          html: expect.stringContaining("Une erreur est survenue"),
        }),
      );
    });

    it("does not include URL in failure email", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail(
        "user@example.com",
        "My Article",
        false,
        "https://example.com/article",
      );

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining("Article publié"),
        }),
      );
    });
  });
});
