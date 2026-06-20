/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Password Service Tests
 *
 * Tests for:
 * - hashPassword: bcrypt.hash wrapping
 * - verifyPassword: bcrypt.compare wrapping
 * - validatePasswordStrength: password policy validation
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("bcrypt", () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../password";

// ============================================================================
// hashPassword
// ============================================================================

describe("hashPassword", () => {
  it("should call bcrypt.hash with the password and ROUNDS=12", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$hashedvalue" as never);

    const result = await hashPassword("mySecretPassword123!");

    expect(hash).toHaveBeenCalledWith("mySecretPassword123!", 12);
    expect(result).toBe("$2b$12$hashedvalue");
  });

  it("should hash empty string password", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$emptyhash" as never);

    const result = await hashPassword("");

    expect(hash).toHaveBeenCalledWith("", 12);
    expect(result).toBe("$2b$12$emptyhash");
  });

  it("should hash unicode password", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$unicodehash" as never);

    const result = await hashPassword("Pässwörd123!");

    expect(hash).toHaveBeenCalledWith("Pässwörd123!", 12);
    expect(result).toBe("$2b$12$unicodehash");
  });

  it("should hash password with only special characters", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$specialhash" as never);

    const result = await hashPassword("!@#$%^&*()");

    expect(hash).toHaveBeenCalledWith("!@#$%^&*()", 12);
    expect(result).toBe("$2b$12$specialhash");
  });

  it("should hash password with leading/trailing whitespace", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$spacehash" as never);

    const result = await hashPassword("  Abcd1234  ");

    expect(hash).toHaveBeenCalledWith("  Abcd1234  ", 12);
    expect(result).toBe("$2b$12$spacehash");
  });

  it("should hash password with tabs and newlines", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$tabhash" as never);

    const result = await hashPassword("\t\nAbcd1234");

    expect(hash).toHaveBeenCalledWith("\t\nAbcd1234", 12);
    expect(result).toBe("$2b$12$tabhash");
  });

  it("should hash 72-character password (bcrypt max input length)", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$boundary72" as never);
    const pwd = "A1b" + "x".repeat(69); // total 72 chars
    expect(pwd.length).toBe(72);

    const result = await hashPassword(pwd);

    expect(hash).toHaveBeenCalledWith(pwd, 12);
    expect(result).toBe("$2b$12$boundary72");
  });

  it("should hash 73-character password (exceeds bcrypt max input length)", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$boundary73" as never);
    const pwd = "A1b" + "x".repeat(70); // total 73 chars
    expect(pwd.length).toBe(73);

    const result = await hashPassword(pwd);

    expect(hash).toHaveBeenCalledWith(pwd, 12);
    expect(result).toBe("$2b$12$boundary73");
  });

  it("should hash very long password (1000+ chars)", async () => {
    const { hash } = await import("bcrypt");
    vi.mocked(hash).mockResolvedValue("$2b$12$longhash" as never);
    const longPwd = "A1b" + "x".repeat(1997); // 2000 chars

    const result = await hashPassword(longPwd);

    expect(hash).toHaveBeenCalledWith(longPwd, 12);
    expect(result).toBe("$2b$12$longhash");
  });
});

// ============================================================================
// verifyPassword
// ============================================================================

describe("verifyPassword", () => {
  it("should call bcrypt.compare with password and hash and return true on match", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await verifyPassword("correctPassword", "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith(
      "correctPassword",
      "$2b$12$storedhash",
    );
    expect(result).toBe(true);
  });

  it("should return false when password does not match the hash", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await verifyPassword("wrongPassword", "$2b$12$storedhash");

    expect(result).toBe(false);
  });

  it("should verify unicode password", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await verifyPassword("Pässwörd123!", "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith("Pässwörd123!", "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify password with only special characters", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await verifyPassword("!@#$%^&*()", "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith("!@#$%^&*()", "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify password with leading/trailing whitespace", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await verifyPassword("  Abcd1234  ", "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith("  Abcd1234  ", "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify very long password (1000+ chars)", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);
    const longPwd = "A1b" + "x".repeat(1997); // 2000 chars

    const result = await verifyPassword(longPwd, "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith(longPwd, "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify 72-character password (bcrypt max input length)", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);
    const pwd = "A1b" + "x".repeat(69);
    expect(pwd.length).toBe(72);

    const result = await verifyPassword(pwd, "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith(pwd, "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify 73-character password (exceeds bcrypt max input length)", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(true as never);
    const pwd = "A1b" + "x".repeat(70);
    expect(pwd.length).toBe(73);

    const result = await verifyPassword(pwd, "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith(pwd, "$2b$12$storedhash");
    expect(result).toBe(true);
  });

  it("should verify empty string password", async () => {
    const { compare } = await import("bcrypt");
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await verifyPassword("", "$2b$12$storedhash");

    expect(compare).toHaveBeenCalledWith("", "$2b$12$storedhash");
    expect(result).toBe(false);
  });
});

// ============================================================================
// validatePasswordStrength
// ============================================================================

describe("validatePasswordStrength", () => {
  it("should return valid true with no errors for a strong password", () => {
    const result = validatePasswordStrength("Abcd1234!");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return an error when password is shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1!");

    expect(result.errors.some((e) => e.includes("8 caractères"))).toBe(true);
  });

  it("should return an error when password missing an uppercase letter", () => {
    const result = validatePasswordStrength("abcd1234!");

    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
  });

  it("should return an error when password missing a lowercase letter", () => {
    const result = validatePasswordStrength("ABCD1234!");

    expect(result.errors.some((e) => e.includes("minuscule"))).toBe(true);
  });

  it("should return an error when password missing a digit", () => {
    const result = validatePasswordStrength("Abcdefgh!");

    expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
  });

  it("should include a suggestion when password missing a special character", () => {
    const result = validatePasswordStrength("Password1");
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("caractère spécial"))).toBe(
      true,
    );
  });

  it("should accept exactly 8 characters meeting all requirements (boundary)", () => {
    const result = validatePasswordStrength("Abcd1234");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept exactly 8 characters with special char (boundary)", () => {
    const result = validatePasswordStrength("Abcd12!4");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept 72-character password (bcrypt max input length)", () => {
    const longPwd = "A1b" + "x".repeat(69);
    expect(longPwd.length).toBe(72);
    const result = validatePasswordStrength(longPwd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept 73-character password (exceeds bcrypt max input length)", () => {
    const longPwd = "A1b" + "x".repeat(70);
    expect(longPwd.length).toBe(73);
    const result = validatePasswordStrength(longPwd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept password with unicode characters", () => {
    const result = validatePasswordStrength("Pässwörd123!");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject password with only special characters (missing letters)", () => {
    // "!@#$%^&*()" has no uppercase, no lowercase
    const result = validatePasswordStrength("!@#$%^&*()");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("minuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
  });

  it("should reject password with only numbers", () => {
    const result = validatePasswordStrength("12345678");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("minuscule"))).toBe(true);
  });

  it("should reject password with only lowercase letters", () => {
    const result = validatePasswordStrength("abcdefgh");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
  });

  it("should reject password with only uppercase letters", () => {
    const result = validatePasswordStrength("ABCDEFGH");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("minuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
  });

  it("should reject password with leading/trailing whitespace when it prevents meeting requirements", () => {
    // " abcdefgh" = leading space + all lowercase → missing uppercase and digit
    const result = validatePasswordStrength(" abcdefgh");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
    expect(result.errors.some((e) => e.includes("chiffre"))).toBe(true);
  });

  it("should pass password with tabs and newlines that still meets requirements", () => {
    const result = validatePasswordStrength("\t\nAbcd1234");
    // \t and \n are not letters/digits, but "Abcd1234" meets all 4 requirements
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept very long password (1000+ chars)", () => {
    const longPwd = "A1b" + "x".repeat(1997); // 2000 chars
    expect(longPwd.length).toBe(2000);
    const result = validatePasswordStrength(longPwd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should return multiple errors for a completely invalid password", () => {
    const result = validatePasswordStrength("a");
    expect(result.valid).toBe(false);
    // Expect at least: length < 8, missing uppercase, missing digit
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("should return errors for trailing whitespace-only password that fails requirements", () => {
    const result = validatePasswordStrength("abcdefg1 "); // trailing space, 9 chars
    // Has lowercase, has digit, but no uppercase
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("majuscule"))).toBe(true);
  });
});
