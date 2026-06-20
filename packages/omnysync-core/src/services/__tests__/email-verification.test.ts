/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  emailVerification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  userOrganization: { findFirst: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

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
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token,
      } as any);

      const result = await createEmailVerification(userId, email);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(prisma.emailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            email,
            token: expect.any(String),
          }),
        }),
      );
    });

    it("should handle Prisma write failure", async () => {
      vi.mocked(prisma.emailVerification.create).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(createEmailVerification(userId, email)).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("sendVerificationEmail", () => {
    it("should create token and send email", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token,
      } as any);

      const result = await sendVerificationEmail(userId, email, "Test User");

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining("Vérifiez"),
        }),
      );
    });

    it("should handle email send failure", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token,
      } as any);
      vi.mocked(sendEmail).mockRejectedValue(new Error("SMTP error"));

      const result = await sendVerificationEmail(userId, email);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Échec de l'envoi de l'email");
    });

    it("should handle NEXTAUTH_URL being undefined", async () => {
      const originalUrl = process.env.NEXTAUTH_URL;
      delete process.env.NEXTAUTH_URL;

      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token,
      } as any);

      try {
        const result = await sendVerificationEmail(userId, email, "Test User");

        expect(result.success).toBe(true);
        expect(sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining("undefined/auth/verify-email"),
          }),
        );
      } finally {
        process.env.NEXTAUTH_URL = originalUrl;
      }
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

    it("should handle Prisma write failure when updating verification record", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.emailVerification.update).mockRejectedValue(
        new Error("DB write failed"),
      );

      await expect(verifyEmail(token)).rejects.toThrow("DB write failed");
    });

    it("should handle Prisma write failure when updating user", async () => {
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
      vi.mocked(prisma.user.update).mockRejectedValue(
        new Error("DB write failed"),
      );

      await expect(verifyEmail(token)).rejects.toThrow("DB write failed");
    });

    it("should handle userOrganization.findFirst returning null for audit log", async () => {
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
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await verifyEmail(token);

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "system",
          }),
        }),
      );
    });

    it("should handle concurrent verification (race condition)", async () => {
      // First call: valid unverified token
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

      const firstResult = await verifyEmail(token);
      expect(firstResult.success).toBe(true);

      // Second call: token now marked as verified (simulating concurrent race)
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: userId },
      } as any);

      const secondResult = await verifyEmail(token);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe("Email déjà vérifié");
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
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token,
      } as any);

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

    it("should refuse resend if a recent token exists (< 1 hour)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
        emailVerified: null,
      } as any);
      // Existing token créé il y a 30 minutes (encore valide)
      vi.mocked(prisma.emailVerification.findFirst).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 86400000 * 6),
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      } as any);

      const result = await resendVerificationEmail(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("déjà envoyé récemment");
    });

    it("should allow resend if existing token is older than 1 hour", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
        emailVerified: null,
      } as any);
      // Existing token créé il y a 2 heures (expiré ou presque)
      vi.mocked(prisma.emailVerification.findFirst).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 86400000 * 5),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      } as any);
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token: "new-token-abc",
      } as any);

      const result = await resendVerificationEmail(userId);

      expect(result.success).toBe(true);
    });

    it("should handle Prisma failure when finding user", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(resendVerificationEmail(userId)).rejects.toThrow("DB error");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty token in verifyEmail", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue(null);

      const result = await verifyEmail("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token invalide");
    });

    it("should handle createEmailVerification with special chars in email", async () => {
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({
        token: "special-token",
      } as any);

      const result = await createEmailVerification(
        userId,
        "test+alias@example.com",
      );

      expect(result).toBeDefined();
      expect(prisma.emailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "test+alias@example.com",
          }),
        }),
      );
    });

    it("verifyEmail should not allow token reuse after successful verification", async () => {
      // First call: valid token
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

      const firstResult = await verifyEmail(token);
      expect(firstResult.success).toBe(true);

      // Reset mocks for second call — simulate token was already verified
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        id: "verif-1",
        userId,
        email,
        token,
        verifiedAt: new Date(), // Maintenant marqué comme vérifié
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: userId },
      } as any);

      const secondResult = await verifyEmail(token);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe("Email déjà vérifié");
    });
  });
});
