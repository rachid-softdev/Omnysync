/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockResendSend = vi.hoisted(() => vi.fn());
const mockResendShouldFail = vi.hoisted(() => ({ current: false }));
const MockResend = vi.hoisted(
  () =>
    class MockResend {
      emails = { send: mockResendSend };
      constructor() {
        if (mockResendShouldFail.current) {
          throw new Error("Resend init failed");
        }
      }
    },
);

vi.mock("resend", () => ({ Resend: MockResend }));

describe("Email module", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResendShouldFail.current = false;
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

    it("logs fallback when Resend constructor fails (getResend catch block)", async () => {
      mockResendShouldFail.current = true;
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "Resend Fail",
        html: "<p>Test</p>",
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Resend not available, would send to user@example.com: Resend Fail",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("handles empty subject gracefully", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "",
        html: "<p>No subject</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "" }),
      );
    });

    it("handles empty html gracefully", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "user@example.com",
        subject: "Empty HTML",
        html: "",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ html: "" }),
      );
    });

    it("logs when no API key and uses default from email", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Content</p>",
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Would send to test@example.com: Test",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("handles network error on resend.emails.send (propagates error)", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockRejectedValue(new Error("Network failure"));
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Network Error",
          html: "<p>Test</p>",
        }),
      ).rejects.toThrow("Network failure");
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it("handles null/undefined email fields gracefully", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendEmail } = await import("../index");

      await sendEmail({
        to: "recipient@example.com",
        subject: "Null test",
        html: "<p>Test</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient@example.com",
          subject: "Null test",
        }),
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

    it("logs fallback when Resend constructor fails", async () => {
      mockResendShouldFail.current = true;
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await sendWelcomeEmail("user@example.com", "Alice");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Resend not available, would send to user@example.com: Bienvenue sur Omnysync !",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("uses default from email when RESEND_FROM_EMAIL is not set", async () => {
      delete process.env.RESEND_FROM_EMAIL;
      process.env.RESEND_API_KEY = "re_abc123";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await sendWelcomeEmail("user@example.com", "John");

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "noreply@omnysync.com" }),
      );
    });

    it("propagates Resend API error from sendEmail", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockRejectedValue(new Error("API quota exceeded"));
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await expect(
        sendWelcomeEmail("user@example.com", "Jane"),
      ).rejects.toThrow("API quota exceeded");
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Bienvenue sur Omnysync !",
        }),
      );
    });

    it("handles empty name gracefully", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendWelcomeEmail } = await import("../index");

      await sendWelcomeEmail("user@example.com", "");

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Bienvenue"),
        }),
      );
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

    it("sends success email without destination URL", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "My Article", true);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Sync réussie: My Article",
          html: expect.not.stringContaining("Article publié"),
        }),
      );
    });

    it("logs fallback when Resend constructor fails", async () => {
      mockResendShouldFail.current = true;
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "My Document", true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Resend not available, would send to user@example.com: Sync réussie: My Document",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("logs when no API key (success email)", async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail(
        "user@example.com",
        "My Article",
        true,
        "https://example.com/article",
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Would send to user@example.com: Sync réussie: My Article",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("logs when no API key (failure email)", async () => {
      delete process.env.RESEND_API_KEY;
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "My Article", false);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Email] Would send to user@example.com: Sync échouée: My Article",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("uses default from email when RESEND_FROM_EMAIL is not set", async () => {
      delete process.env.RESEND_FROM_EMAIL;
      process.env.RESEND_API_KEY = "re_abc123";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "My Doc", true);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "noreply@omnysync.com" }),
      );
    });

    it("propagates Resend API error from sendEmail", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockRejectedValue(new Error("Email send failed"));
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await expect(
        sendSyncCompleteEmail("user@example.com", "Failing Doc", true),
      ).rejects.toThrow("Email send failed");
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Sync réussie: Failing Doc",
        }),
      );
    });

    it("handles special characters in document title", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      const specialTitle = "Doc <test> & 'quot;";
      await sendSyncCompleteEmail("user@example.com", specialTitle, false);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: `Sync échouée: ${specialTitle}`,
        }),
      );
    });

    it("handles empty document title", async () => {
      process.env.RESEND_API_KEY = "re_abc123";
      process.env.RESEND_FROM_EMAIL = "test@omnysync.com";
      mockResendSend.mockResolvedValue({ id: "email-1" });
      vi.resetModules();
      const { sendSyncCompleteEmail } = await import("../index");

      await sendSyncCompleteEmail("user@example.com", "", true);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Sync réussie: ",
        }),
      );
    });
  });
});
