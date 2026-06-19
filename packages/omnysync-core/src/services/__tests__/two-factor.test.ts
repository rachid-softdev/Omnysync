/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  twoFactorAuth: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  userOrganization: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  encrypt: vi.fn((s) => `enc_${s}`),
  decrypt: vi.fn((s) => s.replace("enc_", "")),
}));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("$2b$12$hash"),
  compare: vi.fn(),
}));

import { prisma } from "../../prisma";
import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
} from "../two-factor";

describe("Two-Factor Authentication", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateTotpSecret", () => {
    it("should return a secret and otpauth URL", () => {
      const result = generateTotpSecret();
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpauthUrl).toContain("otpauth://totp/");
      expect(result.otpauthUrl).toContain("Omnysync");
    });
  });

  describe("setupTwoFactor", () => {
    const secret = "JBSWY3DPEHPK3PXP";

    it("should upsert 2FA record and return success with backup codes", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      const result = await setupTwoFactor(userId, secret);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes!.length).toBe(10);
      expect(prisma.twoFactorAuth.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: expect.objectContaining({ userId, secret: `enc_${secret}` }),
        update: expect.objectContaining({ secret: `enc_${secret}` }),
      });
    });

    it("should return error on upsert failure", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await setupTwoFactor(userId, secret);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("verifyTotpCode", () => {
    it("should return error when 2FA not enabled", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await verifyTotpCode(userId, "123456");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("2FA non activé");
    });

    it("should return invalid for wrong code", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_JBSWY3DPEHPK3PXP`,
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, "000000");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });

    it("should return valid for correct backup code", async () => {
      const backupCode = "ABCD1234";
      const userSpecificSalt = userId.substring(0, 16);
      const { createHash } = await import("crypto");
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash, "otherhash"],
      } as any);
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      const result = await verifyTotpCode(userId, backupCode);

      expect(result.valid).toBe(true);
      expect(prisma.twoFactorAuth.update).toHaveBeenCalled();
    });
  });

  describe("disableTwoFactor", () => {
    it("should return error when 2FA not enabled", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await disableTwoFactor(userId, "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("2FA non activé");
    });

    it("should disable when password is correct", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: "$2b$12$hash",
      } as any);
      const { compare } = await import("bcrypt");
      vi.mocked(compare).mockResolvedValue(true as never);
      vi.mocked(prisma.twoFactorAuth.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);

      const result = await disableTwoFactor(userId, "correct-password");

      expect(result.success).toBe(true);
      expect(prisma.twoFactorAuth.delete).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it("should return error for wrong password", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: "$2b$12$hash",
      } as any);
      const { compare } = await import("bcrypt");
      vi.mocked(compare).mockResolvedValue(false as never);

      const result = await disableTwoFactor(userId, "wrong-password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Mot de passe incorrect");
    });
  });

  describe("getTwoFactorStatus", () => {
    it("should return enabled=false when not set up", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await getTwoFactorStatus(userId);

      expect(result.enabled).toBe(false);
    });

    it("should return enabled=true when set up", async () => {
      const enabledAt = new Date();
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        enabledAt,
      } as any);

      const result = await getTwoFactorStatus(userId);

      expect(result.enabled).toBe(true);
      expect(result.enabledAt).toEqual(enabledAt);
    });
  });
});
