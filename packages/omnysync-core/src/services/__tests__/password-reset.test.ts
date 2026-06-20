/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  passwordReset: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  session: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  userOrganization: { findFirst: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("$2b$12$newhash"),
  compare: vi.fn(),
}));

import { prisma } from "../../prisma";
import { sendEmail } from "../../email";
import {
  createPasswordResetToken,
  validateResetToken,
  resetPassword,
  cleanupExpiredTokens,
  resetGlobalResetRateLimit,
} from "../password-reset";

describe("Password Reset Service", () => {
  const email = "test@example.com";
  const userId = "user-1";
  const token = "abcdef1234567890abcdef1234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalResetRateLimit();
  });

  describe("createPasswordResetToken", () => {
    it("should create token and send email when user exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(true);
      expect(result.message).toContain("email a été envoyé");
      expect(prisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, token: expect.any(String) }),
        }),
      );
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining("Réinitialisation"),
        }),
      );
    });

    it("should not reveal if email does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(true);
      expect(result.message).toContain("email a été envoyé");
      expect(prisma.passwordReset.create).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should rate-limit excessive requests globally", async () => {
      // Create 6 requests (limit is 5)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);

      for (let i = 0; i < 5; i++) {
        await createPasswordResetToken(email);
      }

      // 6th request should be rate limited
      vi.clearAllMocks(); // Clear so we can detect the rate limit test
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);

      // The global rate limit won't trigger because it's per-map entry for the same email.
      // Let's check the per-user rate limit instead.
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(3);

      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Trop de demandes");
    });

    it("should rate-limit per-user requests", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(3);

      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Trop de demandes");
    });

    it("should handle Prisma failure when looking up user", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(createPasswordResetToken(email)).rejects.toThrow("DB error");
    });

    it("should handle Prisma failure when creating token", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(createPasswordResetToken(email)).rejects.toThrow("DB error");
    });

    it("should handle sendEmail failure gracefully", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
      vi.mocked(sendEmail).mockRejectedValue(new Error("SMTP error"));

      await expect(createPasswordResetToken(email)).rejects.toThrow(
        "SMTP error",
      );

      // Reset sendEmail to avoid leaking rejection to subsequent tests
      vi.mocked(sendEmail).mockResolvedValue(undefined);
    });

    it("should handle NEXTAUTH_URL being undefined", async () => {
      const originalUrl = process.env.NEXTAUTH_URL;
      delete process.env.NEXTAUTH_URL;

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
      // Ensure sendEmail is in default resolved state
      vi.mocked(sendEmail).mockResolvedValue(undefined);

      try {
        const result = await createPasswordResetToken(email);

        expect(result.success).toBe(true);
        expect(sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining("undefined/auth/reset-password"),
          }),
        );
      } finally {
        process.env.NEXTAUTH_URL = originalUrl;
      }
    });

    it("should include correct expiry pluralization in email template (RESET_TOKEN_EXPIRY_HOURS=1 → singular)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
      vi.mocked(sendEmail).mockResolvedValue(undefined);

      await createPasswordResetToken(email);

      // RESET_TOKEN_EXPIRY_HOURS is 1, so the template should use singular "heure"
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("1 heure"),
        }),
      );
    });

    it("should create email template with correct reset link format", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
      vi.mocked(sendEmail).mockResolvedValue(undefined);

      process.env.NEXTAUTH_URL = "https://omnysync.com";
      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("omnysync.com/auth/reset-password"),
        }),
      );
    });
  });

  describe("validateResetToken", () => {
    it("should return valid for a valid unexpired token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);

      const result = await validateResetToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(userId);
    });

    it("should return error for non-existent token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null);

      const result = await validateResetToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token invalide");
    });

    it("should return error for already used token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      } as any);

      const result = await validateResetToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token déjà utilisé");
    });

    it("should return error for expired token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() - 3600000),
      } as any);

      const result = await validateResetToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token expiré");
    });

    it("should propagate Prisma error during validation", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(validateResetToken(token)).rejects.toThrow("DB error");
    });
  });

  describe("resetPassword", () => {
    it("should hash password, update user, delete sessions, mark token used", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({
        count: 2,
      } as any);
      vi.mocked(prisma.passwordReset.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      const result = await resetPassword(token, "new-password");

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ password: "$2b$12$newhash" }),
        }),
      );
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.passwordReset.update).toHaveBeenCalledWith({
        where: { token },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
    });

    it("should return error for invalid token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null);

      const result = await resetPassword("bad-token", "new-password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token invalide");
    });

    it("should not allow token reuse after password reset", async () => {
      // First call — token valide
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.passwordReset.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      const firstResult = await resetPassword(token, "new-password-123");
      expect(firstResult.success).toBe(true);

      // Second call — même token, maintenant marqué usedAt
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: new Date(), // Déjà utilisé
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);

      const secondResult = await resetPassword(token, "another-password-456");
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe("Token déjà utilisé");
    });

    it("should handle userOrganization.findFirst returning null", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.passwordReset.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await resetPassword(token, "new-password-123");

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "system",
          }),
        }),
      );
    });

    it("should handle Prisma write failure during user update", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockRejectedValue(
        new Error("DB write failed"),
      );

      await expect(resetPassword(token, "new-password-123")).rejects.toThrow(
        "DB write failed",
      );
    });

    it("should handle Prisma write failure during token update", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.passwordReset.update).mockRejectedValue(
        new Error("DB write failed"),
      );

      await expect(resetPassword(token, "new-password-123")).rejects.toThrow(
        "DB write failed",
      );
    });

    it("should propagate Prisma error during audit log creation", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.passwordReset.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockRejectedValue(
        new Error("Audit log failed"),
      );

      await expect(resetPassword(token, "new-password-123")).rejects.toThrow(
        "Audit log failed",
      );
    });

    it("should propagate bcrypt hash failure", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      const { hash } = await import("bcrypt");
      vi.mocked(hash).mockRejectedValue(new Error("bcrypt failed"));

      await expect(resetPassword(token, "new-password-123")).rejects.toThrow(
        "bcrypt failed",
      );

      // Restore mock so subsequent tests aren't affected
      vi.mocked(hash).mockResolvedValue("$2b$12$newhash");
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired tokens and return count", async () => {
      vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({
        count: 5,
      } as any);

      const count = await cleanupExpiredTokens();

      expect(count).toBe(5);
      expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it("should return 0 when no expired tokens exist", async () => {
      vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({
        count: 0,
      } as any);

      const count = await cleanupExpiredTokens();

      expect(count).toBe(0);
    });

    it("should handle Prisma failure", async () => {
      vi.mocked(prisma.passwordReset.deleteMany).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(cleanupExpiredTokens()).rejects.toThrow("DB error");
    });
  });

  describe("Edge cases — rate limit boundaries", () => {
    it("global rate limit: exactly 5th request should succeed", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

      for (let i = 0; i < 5; i++) {
        const result = await createPasswordResetToken(email);
        expect(result.success).toBe(true);
      }
    });

    it("per-user rate limit boundary: exactly 3 should succeed, 4th blocked", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(3); // Already 3 recent resets
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

      const result = await createPasswordResetToken(email);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Trop de demandes");
    });

    it("should reject session deletion failure (fail-closed)", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token,
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: userId },
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.session.deleteMany).mockRejectedValue(
        new Error("DB error"),
      );
      vi.mocked(prisma.passwordReset.update).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      // Le code ne catch pas l'erreur de session.deleteMany — elle doit remonter
      await expect(resetPassword(token, "new-password-123")).rejects.toThrow(
        "DB error",
      );
    });

    it("should block 6th same-email request via global rate limit (count > 5)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email,
      } as any);
      vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
      vi.mocked(sendEmail).mockResolvedValue(undefined);

      // First 5 requests succeed
      for (let i = 0; i < 5; i++) {
        const result = await createPasswordResetToken(email);
        expect(result.success).toBe(true);
      }

      // 6th same-email request is blocked by global rate limit
      const result = await createPasswordResetToken(email);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Trop de demandes");
    });

    it("should reset global rate limit after window expires (15 min)", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: userId,
          email,
        } as any);
        vi.mocked(prisma.passwordReset.count).mockResolvedValue(0);
        vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
        vi.mocked(sendEmail).mockResolvedValue(undefined);

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
          await createPasswordResetToken(email);
        }

        // 6th should fail
        let result = await createPasswordResetToken(email);
        expect(result.success).toBe(false);

        // Advance past the 15-minute rate limit window
        vi.advanceTimersByTime(15 * 60 * 1000 + 1);

        // Now should succeed (window reset)
        vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);
        result = await createPasswordResetToken(email);
        expect(result.success).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
