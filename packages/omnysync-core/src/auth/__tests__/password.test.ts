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
    const result = validatePasswordStrength("Abcd1234");

    expect(result.errors.some((e) => e.includes("caractère spécial"))).toBe(
      true,
    );
  });
});
