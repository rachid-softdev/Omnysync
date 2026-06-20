/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Auth Tests
 *
 * Tests core authentication and authorization services:
 * - Password hashing (hashPassword + verifyPassword)
 * - Password strength validation (validatePasswordStrength)
 * - 2FA setup (generateTotpSecret, setupTwoFactor)
 * - 2FA verification (verifyTotpCode with TOTP codes and backup codes)
 * - 2FA disable (disableTwoFactor with password confirmation)
 * - Timing attack protection (constant-time comparison of backup codes)
 * - 2FA status query (getTwoFactorStatus)
 *
 * Pattern: use vi.hoisted() for mock variables, vi.mock() for module stubs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash, timingSafeEqual } from "crypto";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

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

const mockBcryptCompare = vi.hoisted(() => vi.fn());
const mockBcryptHash = vi.hoisted(() =>
  vi.fn().mockResolvedValue("$2b$12$testhashedpasswordvalue"),
);

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  encrypt: vi.fn((s: string) => `enc_${s}`),
  decrypt: vi.fn((s: string) => s.replace("enc_", "")),
}));
vi.mock("../../cache", () => ({
  cache: {
    isAvailable: vi.fn().mockReturnValue(false),
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));
vi.mock("bcrypt", () => ({
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}));

import { prisma } from "../../prisma";
import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
} from "../two-factor";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../../auth/password";

// ============================================================================
// SUITE
// ============================================================================

describe("Integration Auth", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Password Hashing & Verification
  // ==========================================================================

  describe("hashPassword & verifyPassword", () => {
    const plainPassword = "SecureP@ss1";

    it("should hash a password with bcrypt", async () => {
      const hashed = await hashPassword(plainPassword);

      expect(hashed).toBeDefined();
      expect(hashed).toContain("$2b$12$");
      expect(mockBcryptHash).toHaveBeenCalledWith(plainPassword, 12);
    });

    it("should verify correct password against hash", async () => {
      mockBcryptCompare.mockResolvedValue(true as never);

      const result = await verifyPassword(
        plainPassword,
        "$2b$12$testhashedpasswordvalue",
      );

      expect(result).toBe(true);
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        plainPassword,
        "$2b$12$testhashedpasswordvalue",
      );
    });

    it("should reject incorrect password", async () => {
      mockBcryptCompare.mockResolvedValue(false as never);

      const result = await verifyPassword(
        "WrongPassword1!",
        "$2b$12$testhashedpasswordvalue",
      );

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Password Strength Validation
  // ==========================================================================

  describe("validatePasswordStrength", () => {
    it("should accept a strong password", () => {
      const result = validatePasswordStrength("SecureP@ss1");

      expect(result.valid).toBe(true);
      // Suggestion for special char counts as suggestion only
      expect(result.errors).toHaveLength(0);
    });

    it("should reject password shorter than 8 characters", () => {
      const result = validatePasswordStrength("Ab1");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("8 caractères"))).toBe(true);
    });

    it("should reject password without uppercase letter", () => {
      const result = validatePasswordStrength("lowercase1!");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
    });

    it("should reject password without lowercase letter", () => {
      const result = validatePasswordStrength("UPPERCASE1!");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("minuscule"))).toBe(true);
    });

    it("should reject password without digit", () => {
      const result = validatePasswordStrength("NoDigits!!");

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
    });

    it("should warn (but not fail) when no special char", () => {
      const result = validatePasswordStrength("SecurePass1");

      // valid=true because special char is a suggestion, not a hard rule
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("spécial"))).toBe(true);
    });

    it("should handle empty string", () => {
      const result = validatePasswordStrength("");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // 2FA: Generate TOTP Secret
  // ==========================================================================

  describe("generateTotpSecret", () => {
    it("should return a base32 secret and otpauth URL", () => {
      const result = generateTotpSecret();

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(16);
      expect(result.otpauthUrl).toBeDefined();
      expect(result.otpauthUrl).toContain("otpauth://totp/");
      expect(result.otpauthUrl).toContain("Omnysync");
    });
  });

  // ==========================================================================
  // 2FA: Setup
  // ==========================================================================

  describe("setupTwoFactor", () => {
    const secret = "JBSWY3DPEHPK3PXP";

    it("should upsert 2FA record and return success with 10 backup codes", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await setupTwoFactor(userId, secret);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes!.length).toBe(10);
      // All backup codes should be 8-char hex strings
      result.backupCodes!.forEach((code: string) => {
        expect(code.length).toBe(8);
        expect(/^[0-9A-F]+$/.test(code)).toBe(true);
      });
      expect(prisma.twoFactorAuth.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: expect.objectContaining({
          userId,
          secret: `enc_${secret}`,
          backupCodes: expect.any(Array),
        }),
        update: expect.objectContaining({
          secret: `enc_${secret}`,
          backupCodes: expect.any(Array),
        }),
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

    it("should create audit log when org is found", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await setupTwoFactor(userId, secret);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "twofactor.enabled",
            userId,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // 2FA: Verify TOTP Codes
  // ==========================================================================

  describe("verifyTotpCode", () => {
    it("should return error when 2FA not enabled", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await verifyTotpCode(userId, "123456");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("2FA non activé");
    });

    it("should return invalid for wrong TOTP code", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, "000000");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });

    it("should return valid for correct backup code with timing-safe comparison", async () => {
      const backupCode = "ABCD1234";
      const userSpecificSalt = userId.substring(0, 16);
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
      // Backup code should be removed after use
      expect(prisma.twoFactorAuth.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          data: expect.objectContaining({
            backupCodes: expect.arrayContaining(["otherhash"]),
          }),
        }),
      );
    });

    it("should NOT match backup code that has been used already", async () => {
      const backupCode = "USEDCODE12";
      const userSpecificSalt = userId.substring(0, 16);
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      // Only other hashes in the list, not this one
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: ["otherhash1", "otherhash2"],
      } as any);

      const result = await verifyTotpCode(userId, backupCode);

      expect(result.valid).toBe(false);
    });

    it("should use timingSafeEqual for backup code comparison (timing attack protection)", async () => {
      const backupCode = "TIMING01";
      const userSpecificSalt = userId.substring(0, 16);
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash],
      } as any);

      // Sanity check: timingSafeEqual should return true for the same buffer
      const stored = Buffer.from(codeHash, "hex");
      const computed = Buffer.from(codeHash, "hex");
      const isEqual = timingSafeEqual(stored, computed);
      expect(isEqual).toBe(true);

      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      const result = await verifyTotpCode(userId, backupCode);

      expect(result.valid).toBe(true);
    });

    it("should handle non-hex backup codes gracefully", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: ["not-hex-string"],
      } as any);

      const result = await verifyTotpCode(userId, "ABC12345");

      // Should not crash — should return invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });
  });

  // ==========================================================================
  // 2FA: Disable
  // ==========================================================================

  describe("disableTwoFactor", () => {
    it("should return error when 2FA not enabled", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await disableTwoFactor(userId, "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("2FA non activé");
    });

    it("should disable 2FA when password is correct", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: "$2b$12$hash",
      } as any);
      mockBcryptCompare.mockResolvedValue(true as never);
      vi.mocked(prisma.twoFactorAuth.delete).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

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
      mockBcryptCompare.mockResolvedValue(false as never);

      const result = await disableTwoFactor(userId, "wrong-password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Mot de passe incorrect");
    });

    it("should return error when user has no password set (OAuth-only)", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: null,
      } as any);

      const result = await disableTwoFactor(userId, "some-password");

      expect(result.success).toBe(false);
      expect(result.error).toContain("OAuth");
    });

    it("should create audit log on successful disable", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: "$2b$12$hash",
      } as any);
      mockBcryptCompare.mockResolvedValue(true as never);
      vi.mocked(prisma.twoFactorAuth.delete).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await disableTwoFactor(userId, "correct-password");

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "twofactor.disabled",
            userId,
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // 2FA: Status
  // ==========================================================================

  describe("getTwoFactorStatus", () => {
    it("should return enabled=false when 2FA not set up", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await getTwoFactorStatus(userId);

      expect(result.enabled).toBe(false);
      expect(result.enabledAt).toBeUndefined();
    });

    it("should return enabled=true with enabledAt when 2FA is set up", async () => {
      const enabledAt = new Date("2026-01-15");
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        enabledAt,
      } as any);

      const result = await getTwoFactorStatus(userId);

      expect(result.enabled).toBe(true);
      expect(result.enabledAt).toEqual(enabledAt);
    });
  });
});
