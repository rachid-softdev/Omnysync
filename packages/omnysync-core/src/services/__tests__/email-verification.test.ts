/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  emailVerification: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  userOrganization: { findFirst: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "../../prisma";
import { sendEmail } from "../../email";
import {
  createEmailVerification,
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
} from "../email-verification";

describe("Email Verification Service", () => {
  const userId = "user-1";
  const email = "test@example.com";
  const token = "abcdef1234567890abcdef1234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sendEmail to resolve by default
    vi.mocked(sendEmail).mockResolvedValue(undefined);
  });

  describe("createEmailVerification", () => {
    it("should create a verification token and return it", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({ token } as any);

      const result = await createEmailVerification(userId, email);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(prisma.emailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, email, token: expect.any(String) }),
        }),
      );
    });
  });

  describe("sendVerificationEmail", () => {
    it("should create token and send email", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({ token } as any);

      const result = await sendVerificationEmail(userId, email, "Test User");

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: email, subject: expect.stringContaining("Vérifiez") }),
      );
    });

    it("should handle email send failure", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({ token } as any);
      vi.mocked(sendEmail).mockRejectedValue(new Error("SMTP error"));

      const result = await sendVerificationEmail(userId, email);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Échec de l'envoi de l'email");
    });
  });

  describe("verifyEmail", () => {
    it("should verify email when token is valid", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.emailVerification.update).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      const result = await verifyEmail(token);

      expect(result.success).toBe(true);
      expect(prisma.emailVerification.update).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        }),
      );
    });

    it("should return error for invalid token", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue(null);

      const result = await verifyEmail("bad-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token invalide");
    });

    it("should return error when email already verified", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const result = await verifyEmail(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email déjà vérifié");
    });

    it("should return error for expired token", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        verifiedAt: null,
        expiresAt: new Date(Date.now() - 86400000),
      } as any);

      const result = await verifyEmail(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token expiré");
    });
  });

  describe("resendVerificationEmail", () => {
    it("should resend when user exists and not verified", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
        emailVerified: null,
        name: "Test",
      } as any);
      vi.mocked(prisma.emailVerification.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({ token } as any);

      const result = await resendVerificationEmail(userId);

      expect(result.success).toBe(true);
    });

    it("should return error if user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await resendVerificationEmail(userId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Utilisateur non trouvé");
    });

    it("should return error if email already verified", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
        emailVerified: new Date(),
      } as any);

      const result = await resendVerificationEmail(userId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Email déjà vérifié");
    });
  });
});
