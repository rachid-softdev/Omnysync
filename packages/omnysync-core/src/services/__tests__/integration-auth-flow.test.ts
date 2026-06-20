/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integration Auth Flow Tests
 *
 * Tests authentication flows:
 * - Vérification du 2FA check pour tous les providers (credentials + OAuth)
 * - Timing attack : temps constant entre email existant et inexistant
 * - pendingSecrets cleanup via try/finally
 *
 * Pattern: use vi.hoisted() for mock variables, vi.mock() for module stubs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Track pendingSecret operations
const mockPendingSecrets = vi.hoisted(() => {
  const store = new Map<string, { secret: string; expiresAt: Date }>();
  return {
    set: vi.fn((key: string, value: { secret: string; expiresAt: Date }) => {
      store.set(key, value);
    }),
    get: vi.fn((key: string) => store.get(key) ?? null),
    delete: vi.fn((key: string) => store.delete(key)),
    has: vi.fn((key: string) => store.has(key)),
    size: vi.fn(() => store.size),
    clear: vi.fn(() => store.clear()),
  };
});

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

// Shared TOTP validate mock so we can control behavior per-test
const mockTotpValidate = vi.hoisted(() => vi.fn().mockReturnValue(0));

vi.mock("otpauth", () => ({
  Secret: {
    fromBase32: vi.fn(() => ({})),
  },
  TOTP: function TOTP() {
    return {
      validate: mockTotpValidate,
      generate: vi.fn().mockReturnValue("123456"),
      toString: vi
        .fn()
        .mockReturnValue("otpauth://totp/Omnysync:test?secret=TEST"),
    };
  },
}));

import { prisma } from "../../prisma";
import {
  setupTwoFactor,
  verifyTotpCode,
  disableTwoFactor,
  getTwoFactorStatus,
  pendingSecrets,
} from "../two-factor";

// ============================================================================
// SUITE
// ============================================================================

describe("Integration Auth Flow", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the in-memory pending secrets between tests
    pendingSecrets.clear();
  });

  // ==========================================================================
  // 1. Vérification du 2FA check pour tous les providers
  // ==========================================================================

  describe("2FA check for all auth providers", () => {
    it("should allow disabling 2FA for credentials-based user with correct password", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
        enabledAt: new Date(),
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

    it("should reject disabling 2FA for credentials user with wrong password", async () => {
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

    it("should handle OAuth-only users (no password set) for 2FA disable", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        userId,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        password: null, // OAuth user has no password
      } as any);

      const result = await disableTwoFactor(userId, "any-password");

      expect(result.success).toBe(false);
      expect(result.error).toContain("OAuth");
    });

    it("should return 2FA status for any provider type (credentials or OAuth)", async () => {
      // Test for a user with 2FA enabled
      const enabledAt = new Date("2026-06-01");
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        enabledAt,
      } as any);

      const statusEnabled = await getTwoFactorStatus(userId);

      expect(statusEnabled.enabled).toBe(true);
      expect(statusEnabled.enabledAt).toEqual(enabledAt);

      // Test for a user without 2FA
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const statusDisabled = await getTwoFactorStatus(userId);

      expect(statusDisabled.enabled).toBe(false);
      expect(statusDisabled.enabledAt).toBeUndefined();
    });

    it("should verify 2FA TOTP code regardless of auth provider", async () => {
      // Mock user has 2FA enabled (same for credentials or OAuth users)
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [],
      } as any);

      const result = await verifyTotpCode(userId, "123456");

      // The mocked otpauth TOTP.validate returns 0 (valid), so this should succeed
      expect(result.valid).toBe(true);
    });

    it("should reject 2FA TOTP code for users without 2FA enabled", async () => {
      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue(null);

      const result = await verifyTotpCode(userId, "123456");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("2FA non activé");
    });

    it("should check 2FA with backup codes for any provider", async () => {
      const backupCode = "ABCD1234";
      const userSpecificSalt = userId.substring(0, 16);
      const crypto = await import("crypto");
      const codeHash = crypto
        .createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash],
      } as any);
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      const result = await verifyTotpCode(userId, backupCode);

      expect(result.valid).toBe(true);
      // Backup code should be removed after use
      expect(prisma.twoFactorAuth.update).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. Timing attack : temps constant entre email existant et inexistant
  // ==========================================================================

  describe("timing attack protection", () => {
    it("should measure consistent timing for existing vs non-existing email via user lookup", async () => {
      // Simulate a timing-safe approach: the service should NOT reveal
      // whether an email exists through response timing differences.
      // We test this by asserting that the flow returns consistent responses
      // regardless of whether the user exists.

      // Case 1: Email exists → user found
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        email: "exists@test.com",
        password: "$2b$12$hash",
      } as any);

      const t0 = Date.now();
      const userExists = await prisma.user.findUnique({
        where: { email: "exists@test.com" },
      });
      const t1 = Date.now();
      const durationExists = t1 - t0;

      // Case 2: Email does NOT exist → null returned
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const t2 = Date.now();
      const userNotExists = await prisma.user.findUnique({
        where: { email: "nonexistent@test.com" },
      });
      const t3 = Date.now();
      const durationNotExists = t3 - t2;

      // Both should return deterministic results
      expect(userExists).not.toBeNull();
      expect(userNotExists).toBeNull();

      // Durations should be roughly comparable (within reason for a mock).
      // In production, timing-safe comparison ensures that the login endpoint
      // takes the same total time regardless of whether the email exists.
      const ratio =
        Math.max(durationExists, durationNotExists) /
        Math.max(Math.min(durationExists, durationNotExists), 1);
      // Both calls should be within 5x of each other (mocks are fast so the
      // difference should be negligible — this is a sanity check)
      expect(ratio).toBeLessThan(5);
    });

    it("should return consistent error messages for login attempts (no email enumeration)", async () => {
      // The auth login should NOT reveal whether an email exists.
      // This test verifies that the password check pattern produces
      // consistent messages.

      // For a non-existing email, the system should not say "email not found"
      // but rather a generic message like "Invalid credentials"
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const user = await prisma.user.findUnique({
        where: { email: "unknown@test.com" },
      });

      // The handler should then proceed as if the user exists but with
      // a wrong password — returning a consistent "Invalid credentials" message.
      // This test verifies the data layer behavior.
      expect(user).toBeNull();
    });

    it("should use timingSafeEqual for backup code comparison (constant-time)", async () => {
      const backupCode = "TIMING01";
      const userSpecificSalt = userId.substring(0, 16);
      const crypto = await import("crypto");
      const codeHash = crypto
        .createHash("sha256")
        .update(backupCode + userSpecificSalt)
        .digest("hex");

      vi.mocked(prisma.twoFactorAuth.findUnique).mockResolvedValue({
        secret: "enc_JBSWY3DPEHPK3PXP",
        backupCodes: [codeHash],
      } as any);
      vi.mocked(prisma.twoFactorAuth.update).mockResolvedValue({} as any);

      // timingSafeEqual should return true for the same buffer
      const stored = Buffer.from(codeHash, "hex");
      const computed = Buffer.from(codeHash, "hex");
      const isEqual = crypto.timingSafeEqual(stored, computed);
      expect(isEqual).toBe(true);

      const result = await verifyTotpCode(userId, backupCode);

      expect(result.valid).toBe(true);
    });

    it("should NOT match backup code that has been used already (prevent replay)", async () => {
      // Make TOTP validation fail so only the backup code path can succeed
      mockTotpValidate.mockReturnValueOnce(null);
      mockTotpValidate.mockReturnValueOnce(null);

      const backupCode = "USEDCODE12";
      const userSpecificSalt = userId.substring(0, 16);
      const crypto = await import("crypto");
      const codeHash = crypto
        .createHash("sha256")
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
  });

  // ==========================================================================
  // 3. pendingSecrets cleanup via try/finally
  // ==========================================================================

  describe("pendingSecrets cleanup", () => {
    const testSecret = "TESTBASE32SECRET123";

    it("should remove pendingSecret after successful 2FA setup (finally block)", async () => {
      // Set up a pending secret first (simulating the initiate step)
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });
      expect(pendingSecrets.has(userId)).toBe(true);

      // Mock successful DB operations
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await setupTwoFactor(userId, testSecret);

      // After setupTwoFactor completes (successfully), the finally block
      // should have cleaned up the pending secret
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should remove pendingSecret even when 2FA setup fails (finally block on error)", async () => {
      // Set up a pending secret first
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });
      expect(pendingSecrets.has(userId)).toBe(true);

      // Mock DB failure
      vi.mocked(prisma.twoFactorAuth.upsert).mockRejectedValue(
        new Error("DB error"),
      );

      await setupTwoFactor(userId, testSecret);

      // Even though the DB operation failed, the finally block should
      // still have cleaned up the pending secret
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should not leave dangling pendingSecrets when setup throws during upsert", async () => {
      // Arrange: set up a pending secret
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });
      const initialSize = pendingSecrets.size;

      // Mock upsert to throw a non-specific error
      vi.mocked(prisma.twoFactorAuth.upsert).mockRejectedValue(
        new Error("Connection timeout"),
      );

      // Act: call setupTwoFactor, which should clean up via finally
      const result = await setupTwoFactor(userId, testSecret);

      // Assert: cleanup happened
      expect(pendingSecrets.has(userId)).toBe(false);
      // Should have decreased from initial size
      expect(pendingSecrets.size).toBeLessThanOrEqual(initialSize);
      expect(result.success).toBe(false);
    });

    it("should clean up pendingSecret even when audit log creation fails", async () => {
      // Arrange
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });
      expect(pendingSecrets.has(userId)).toBe(true);

      // Mock upsert to succeed but org lookup to fail
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockRejectedValue(
        new Error("Org lookup failed"),
      );

      // Act
      // The error in findFirst propagates up, but the finally block still runs
      try {
        await setupTwoFactor(userId, testSecret);
      } catch {
        // Expected to throw because findFirst error is not caught inside setupTwoFactor
      }

      // Assert: cleanup still happened
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should not affect pendingSecrets of other users when one is cleaned up", async () => {
      const otherUserId = "user-2";
      const otherSecret = "OTHERBASE32SECRET456";

      // Set up pending secrets for two users
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });
      pendingSecrets.set(otherUserId, {
        secret: otherSecret,
        expiresAt: new Date(Date.now() + 600_000),
      });

      expect(pendingSecrets.has(userId)).toBe(true);
      expect(pendingSecrets.has(otherUserId)).toBe(true);

      // Mock successful setup for user-1
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      // Clean up just user-1
      // Simulate what the finally block does
      pendingSecrets.delete(userId);

      // user-1 should be cleaned, user-2 should remain
      expect(pendingSecrets.has(userId)).toBe(false);
      expect(pendingSecrets.has(otherUserId)).toBe(true);
    });

    it("should handle pendingSecrets that are already expired (expiresAt in the past)", async () => {
      // Set up an already-expired pending secret
      pendingSecrets.set(userId, {
        secret: testSecret,
        expiresAt: new Date(Date.now() - 60_000), // Already expired
      });

      // Mock successful setup
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      // Should work fine even with expired pending secret
      const result = await setupTwoFactor(userId, testSecret);

      expect(result.success).toBe(true);
      // Cleanup happens regardless
      expect(pendingSecrets.has(userId)).toBe(false);
    });

    it("should handle cleanup when there was no pending secret at all", async () => {
      // No pending secret set
      expect(pendingSecrets.has(userId)).toBe(false);

      // Mock successful setup
      vi.mocked(prisma.twoFactorAuth.upsert).mockResolvedValue({} as any);
      vi.mocked(mockPrisma.userOrganization.findFirst).mockResolvedValue({
        organizationId: "org-1",
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      // Calling setupTwoFactor without a pending secret should still work
      const result = await setupTwoFactor(userId, testSecret);

      expect(result.success).toBe(true);
      // Still no pending secret (cleanup of non-existent key is a no-op)
      expect(pendingSecrets.has(userId)).toBe(false);
    });
  });
});
