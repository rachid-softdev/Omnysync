/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supplementary tests for crypto/index.ts (encrypt/decrypt)
 *
 * The main encrypt/decrypt tests are in credentials.test.ts.
 * This file covers additional edge cases and internal behaviors.
 *
 * NOTE: The crypto module lazily caches the derived key. Tests that manipulate
 * ENCRYPTION_KEY / ENCRYPTION_SALT MUST run BEFORE any encrypt/decrypt call.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const TEST_KEY =
  "a3f5b8c1d2e4f6a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1";
const TEST_SALT = "test-salt-for-scrypt";

process.env.ENCRYPTION_KEY = TEST_KEY;
process.env.ENCRYPTION_SALT = TEST_SALT;

import { encrypt, decrypt } from "../index";

describe("Crypto supplementary tests", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.ENCRYPTION_SALT = TEST_SALT;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.ENCRYPTION_SALT = TEST_SALT;
  });

  describe("encrypt/decrypt with very long strings", () => {
    it("round-trips a 10KB string", () => {
      const plaintext = "A".repeat(10 * 1024);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips a 100KB string", () => {
      const plaintext = "B".repeat(100 * 1024);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("encrypt/decrypt with special content", () => {
    it("handles JSON with nested objects", () => {
      const data = {
        user: { name: "John", roles: ["admin", "editor"] },
        settings: { theme: "dark", notifications: true },
        tokens: { access: "abc", refresh: "xyz" },
      };
      const plaintext = JSON.stringify(data);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("handles strings with colons (separator character)", () => {
      const plaintext =
        "time: 12:30:00, ratio: 3:1, url: https://example.com:8080/path";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles strings with newlines and tabs", () => {
      const plaintext = "line1\nline2\t\btabbed\r\nend";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles binary-like strings", () => {
      const plaintext = "\x00\x01\x02\xFF\xFE\xFD\x00test";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decrypt with edge cases", () => {
    it("returns empty string as-is (backward compat)", () => {
      // Empty string doesn't have 3 parts, so it returns as-is
      const result = decrypt("");
      expect(result).toBe("");
    });

    it("returns legacy unencrypted string as-is (2 parts)", () => {
      const result = decrypt("just:two");
      expect(result).toBe("just:two");
    });

    it("throws on 3 parts but invalid hex", () => {
      expect(() => decrypt("zzzz:zzzz:zzzz")).toThrow();
    });

    it("throws on tampered auth tag", () => {
      const ciphertext = encrypt("sensitive");
      const parts = ciphertext.split(":");
      // Tamper with the auth tag
      const tampered = `${parts[0]}:ffffffffffffffffffffffffffffffff:${parts[2]}`;
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("key caching behavior", () => {
    it("uses cached key on subsequent calls (performance)", () => {
      const plaintext = "test-data";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  // Note: ENV var validation (missing ENCRYPTION_KEY / ENCRYPTION_SALT) is
  // already covered in credentials.test.ts (must run before any encrypt call
  // due to lazy key caching).
});
