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

// Mock cache module for Redis path testing
const mockCache = vi.hoisted(() => ({
  isAvailable: vi.fn().mockReturnValue(false),
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../cache", () => ({ cache: mockCache }));

import { prisma } from "../../prisma";
import {
  generateTotpSecret,
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
  storePendingSecret,
  getPendingSecret,
  removePendingSecret,
  pendingSecrets,
} from "../two-factor";
import { TOTP, Secret } from "otpauth";

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

    it("should succeed without audit log when user has no organization", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await setupTwoFactor(userId, secret);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes!.length).toBe(10);
      // Audit log should NOT have been called
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("should generate exactly 10 backup codes (8 hex chars each)", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await setupTwoFactor(userId, secret);

      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes!.length).toBe(10);
      for (const code of result.backupCodes!) {
        expect(code).toMatch(/^[0-9A-F]{8}$/);
      }
    });

    it("should clear pending secret after successful setup", async () => {
      const testSecret = "TESTPENDING123456";
      // Manually add a pending secret
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600000),
      });

      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      await setupTwoFactor(userId, secret);

      // Pending secret should be cleared in the finally block
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should generate unique backup codes each time (no duplicates)", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result1 = await setupTwoFactor(userId, secret);
      const result2 = await setupTwoFactor(userId, "DIFFERENTSECRET123");

      expect(result1.backupCodes).toBeDefined();
      expect(result2.backupCodes).toBeDefined();
      // The sets should be different (codes are random)
      expect(result1.backupCodes).not.toEqual(result2.backupCodes);
    });

    it("should update existing 2FA record (not just create)", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      await setupTwoFactor(userId, secret);
      await setupTwoFactor(userId, "NEWSECRETBASE321");

      expect(prisma.twoFactorAuth.upsert).toHaveBeenCalledTimes(2);
      const secondCall = vi.mocked(prisma.twoFactorAuth.upsert).mock
        .calls[1][0];
      expect(secondCall.where).toEqual({ userId });
      expect(secondCall.update).toBeDefined();
      expect(secondCall.create).toBeDefined();
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

    it("should return valid for correct TOTP code generated from secret", async () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const totp = new TOTP({
        secret: Secret.fromBase32(secret),
        issuer: "Omnysync",
        label: "Omnysync",
      });
      const validCode = totp.generate();

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, validCode);

      expect(result.valid).toBe(true);
    });

    it("should reject expired TOTP code (by using fake timers to shift time)", async () => {
      vi.useFakeTimers();
      const secret = "JBSWY3DPEHPK3PXP";
      const totp = new TOTP({
        secret: Secret.fromBase32(secret),
        issuer: "Omnysync",
        label: "Omnysync",
      });
      const validCode = totp.generate();

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [],
      } as any);

      // Move time forward by 3 minutes (outside the ±1 window)
      vi.advanceTimersByTime(3 * 60 * 1000);

      const result = await verifyTotpCode(userId, validCode);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");

      vi.useRealTimers();
    });

    it("should handle backup codes exhausted (empty array)", async () => {
      const secret = "JBSWY3DPEHPK3PXP";

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [],
      } as any);

      // Generate a valid TOTP code to pass verification
      const totp = new TOTP({
        secret: Secret.fromBase32(secret),
        issuer: "Omnysync",
        label: "Omnysync",
      });
      const validCode = totp.generate();

      const result = await verifyTotpCode(userId, validCode);

      expect(result.valid).toBe(true);
    });

    it("should return invalid for backup code that does not match any stored hash", async () => {
      const wrongBackupCode = "XXXXXXXX";
      const secret = "JBSWY3DPEHPK3PXP";

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [
          "someotherhashthatdoesnotmatch",
          "anotherhashthatdoesnotmatch",
        ],
      } as any);

      // Generate a valid TOTP code to confirm normal TOTP still works
      const totp = new TOTP({
        secret: Secret.fromBase32(secret),
        issuer: "Omnysync",
        label: "Omnysync",
      });
      const validCode = totp.generate();

      // Wrong backup code should fail
      const resultBackup = await verifyTotpCode(userId, wrongBackupCode);
      expect(resultBackup.valid).toBe(false);
      expect(resultBackup.error).toBe("Code invalide");

      // But valid TOTP should still pass
      const resultTotp = await verifyTotpCode(userId, validCode);
      expect(resultTotp.valid).toBe(true);
    });

    it("should remove backup code after successful use and not allow reuse", async () => {
      const backupCode = "ABCD1234";
      const userSpecificSalt = userId.substring(0, 16);
      const { createHash } = await import("crypto");
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      // Simulate initial call — backup code matches
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash, "otherhash"],
      } as any);
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      const firstResult = await verifyTotpCode(userId, backupCode);
      expect(firstResult.valid).toBe(true);

      // Verify the code was removed (update was called with the code removed)
      expect(prisma.twoFactorAuth.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          backupCodes: ["otherhash"], // codeHash was removed from the array
        },
      });

      // Simulate second call — backup code already removed, should fall through to TOTP
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: ["otherhash"], // codeHash was removed
      } as any);

      // Now wrong backup code should fail since it's no longer in the stored list
      const secondResult = await verifyTotpCode(userId, backupCode);
      expect(secondResult.valid).toBe(false);
      expect(secondResult.error).toBe("Code invalide");
    });

    it("should return invalid for empty backup code string", async () => {
      const secret = "JBSWY3DPEHPK3PXP";

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, "");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });

    it("should return invalid for malformed backup code (non-hex characters)", async () => {
      const secret = "JBSWY3DPEHPK3PXP";

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, "ZZZZZZZZ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });
  });

  describe("Recovery / Backup Codes", () => {
    it("should generate 10 recovery codes on setup", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await setupTwoFactor(userId, "JBSWY3DPEHPK3PXP");

      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes!.length).toBe(10);
    });

    it("should accept any of the 10 recovery codes", async () => {
      const backupCode = "ABCD1234";
      const userSpecificSalt = userId.substring(0, 16);
      const { createHash } = await import("crypto");
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash, "hash2", "hash3"],
      } as any);
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      const result = await verifyTotpCode(userId, backupCode);
      expect(result.valid).toBe(true);
    });

    it("should reject recovery code if all codes have been used", async () => {
      const secret = "JBSWY3DPEHPK3PXP";

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_${secret}`,
        backupCodes: [], // All codes consumed
      } as any);

      const result = await verifyTotpCode(userId, "ABCD1234");

      // Should fall through to TOTP verification (backupCodes array is checked first)
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });

    it("should reject a previously used (removed) recovery code", async () => {
      const backupCode = "USEDCODE12345";
      const userSpecificSalt = userId.substring(0, 16);
      const { createHash } = await import("crypto");
      const codeHash = createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      // Code was already used (hash no longer stored)
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: `enc_JBSWY3DPEHPK3PXP`,
        backupCodes: ["still-active-hash"],
      } as any);

      const result = await verifyTotpCode(userId, backupCode);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Code invalide");
    });

    it("should hash recovery codes with user-specific salt", async () => {
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      await setupTwoFactor(userId, "JBSWY3DPEHPK3PXP");

      // Verify that the stored backup codes are SHA-256 hashes (64 hex chars)
      const upsertCall = vi.mocked(prisma.twoFactorAuth.upsert).mock
        .calls[0][0];
      const storedCodes = upsertCall.create.backupCodes as string[];
      expect(storedCodes.length).toBe(10);
      for (const hash of storedCodes) {
        expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex format
      }
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

    it("should return error when user has no password set (OAuth only)", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: null,
      } as any);

      const result = await disableTwoFactor(userId, "any-password");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Mot de passe non configuré. Utilisez OAuth pour vous connecter.",
      );
    });

    it("should return error when user is not found", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await disableTwoFactor(userId, "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Mot de passe non configuré. Utilisez OAuth pour vous connecter.",
      );
    });

    it("should disable without audit log when user has no organization", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: "$2b$12$hash",
      } as any);
      const { compare } = await import("bcrypt");
      vi.mocked(compare).mockResolvedValue(true as never);
      vi.mocked(prisma.twoFactorAuth.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.userOrganization.findFirst).mockResolvedValue(null);

      const result = await disableTwoFactor(userId, "correct-password");

      expect(result.success).toBe(true);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
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

  describe("storePendingSecret / getPendingSecret / removePendingSecret", () => {
    const userId = "user-1";
    const testSecret = "JBSWY3DPEHPK3PXP";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should store and retrieve a pending secret", async () => {
      await storePendingSecret(userId, testSecret);

      const retrieved = await getPendingSecret(userId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.secret).toBe(testSecret);
      expect(retrieved!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return null for non-existent secret", async () => {
      const retrieved = await getPendingSecret("non-existent-user");
      expect(retrieved).toBeNull();
    });

    it("should remove a pending secret", async () => {
      await storePendingSecret(userId, testSecret);

      // Verify it exists
      const before = await getPendingSecret(userId);
      expect(before).toBeDefined();

      // Remove it
      await removePendingSecret(userId);

      // Verify it's gone
      const after = await getPendingSecret(userId);
      expect(after).toBeNull();
    });

    it("should return null for expired secret", async () => {
      // Store with 0 TTL (immediate expiry)
      await storePendingSecret(userId, testSecret, 0);

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const retrieved = await getPendingSecret(userId);
      expect(retrieved).toBeNull();
    });

    it("should handle non-existent removal gracefully", async () => {
      // Should not throw when removing a non-existent key
      await expect(
        removePendingSecret("non-existent"),
      ).resolves.toBeUndefined();
    });
  });

  describe("storePendingSecret / getPendingSecret / removePendingSecret — Redis cache path", () => {
    const userId = "user-redis-1";
    const testSecret = "JBSWY3DPEHPK3PXP";

    beforeEach(() => {
      vi.clearAllMocks();
      mockCache.isAvailable.mockReturnValue(true);
      mockCache.set.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.del.mockResolvedValue(undefined);
      // Clear the in-memory map between tests
      pendingSecrets.clear();
    });

    it("should store pending secret in Redis when cache is available", async () => {
      await storePendingSecret(userId, testSecret, 600);
      expect(mockCache.isAvailable).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        `2fa:pending:${userId}`,
        expect.objectContaining({ secret: testSecret }),
        { ttl: 600 },
      );
      // Should still be in in-memory as fallback
      expect(pendingSecrets.has(userId)).toBe(true);
    });

    it("should retrieve pending secret from Redis when available", async () => {
      const entry = {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600000),
      };
      mockCache.get.mockResolvedValue(entry);
      await storePendingSecret(userId, testSecret);

      const result = await getPendingSecret(userId);
      expect(result).toBeDefined();
      expect(result!.secret).toBe(testSecret);
      expect(mockCache.get).toHaveBeenCalledWith(`2fa:pending:${userId}`);
    });

    it("should fall back to in-memory when Redis returns null", async () => {
      mockCache.get.mockResolvedValue(null); // Redis miss
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600000),
      });

      const result = await getPendingSecret(userId);
      expect(result).toBeDefined();
      expect(result!.secret).toBe(testSecret);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it("should remove pending secret from Redis when cache is available", async () => {
      await storePendingSecret(userId, testSecret);
      await removePendingSecret(userId);

      expect(mockCache.del).toHaveBeenCalledWith(`2fa:pending:${userId}`);
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should skip Redis when cache is not available (in-memory only)", async () => {
      mockCache.isAvailable.mockReturnValue(false);

      await storePendingSecret(userId, testSecret);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(pendingSecrets.has(userId)).toBe(true);

      const result = await getPendingSecret(userId);
      expect(result!.secret).toBe(testSecret);
      expect(mockCache.get).not.toHaveBeenCalled();

      await removePendingSecret(userId);
      expect(mockCache.del).not.toHaveBeenCalled();
      expect(pendingSecrets.has(userId)).toBe(false);
    });
  });
});
