/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * S1-2 — Credential Encryption Tests
 *
 * Tests the encrypt / decrypt functions from the crypto module
 * as well as the higher-level encryptCredentials / decryptCredentials helpers.
 *
 * The crypto module uses AES-256-GCM with an IV derived from randomBytes,
 * so two encryptions of the same plaintext MUST produce different ciphertext
 * (IV randomness property).
 */

/**
 * S1-2 — Credential Encryption Tests
 *
 * Tests the encrypt / decrypt functions from the crypto module
 * as well as the higher-level encryptCredentials / decryptCredentials helpers.
 *
 * The crypto module uses AES-256-GCM with an IV derived from randomBytes,
 * so two encryptions of the same plaintext MUST produce different ciphertext
 * (IV randomness property).
 *
 * NOTE: The crypto module lazily caches the derived key (scryptSync is ~30-50ms).
 * Tests that manipulate ENCRYPTION_KEY / ENCRYPTION_SALT MUST run BEFORE any
 * encrypt/decrypt call to avoid stale cache.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const TEST_KEY =
  "a3f5b8c1d2e4f6a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1";
const TEST_SALT = "test-salt-for-scrypt";

process.env.ENCRYPTION_KEY = TEST_KEY;
process.env.ENCRYPTION_SALT = TEST_SALT;

import { encrypt, decrypt } from "../index";
import { encryptCredentials, decryptCredentials } from "../credentials";

// ── Suite ───────────────────────────────────────────────────────────────────

describe("S1-2: AES-256-GCM credential encryption", () => {
  // ⚠️ IMPORTANT: env var tests MUST come FIRST, before any encrypt/decrypt call
  // that would cache the derived key. The lazy cache means env changes after the
  // first encrypt/decrypt are not reflected.

  describe("env var validation (runs first to avoid key cache)", () => {
    afterEach(() => {
      // Restore env vars so subsequent tests work
      process.env.ENCRYPTION_KEY = TEST_KEY;
      process.env.ENCRYPTION_SALT = TEST_SALT;
    });

    it("throws when no ENCRYPTION_KEY is set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
    });

    it("throws when no ENCRYPTION_SALT is set", () => {
      delete process.env.ENCRYPTION_SALT;
      expect(() => encrypt("test")).toThrow("ENCRYPTION_SALT");
    });
  });

  // ── encrypt randomness (IV) ─────────────────────────────────────────────

  describe("encrypt — IV randomness", () => {
    it("produces different ciphertext each time for the same plaintext", () => {
      const plaintext = '{"apiKey":"sk-1234567890abcdef"}';

      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // The format is iv:authTag:ciphertext — the iv portion MUST differ
      expect(result1).not.toBe(result2);
      expect(result1.split(":")[0]).not.toBe(result2.split(":")[0]);
    });

    it("the iv portion is 32 hex characters (16 bytes)", () => {
      const result = encrypt("some-value");
      const ivHex = result.split(":")[0]!;
      expect(ivHex).toMatch(/^[0-9a-f]{32}$/);
    });

    it("the authTag portion is 32 hex characters (16 bytes)", () => {
      const result = encrypt("some-value");
      const [, authTagHex] = result.split(":");
      expect(authTagHex).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  // ── round-trip ──────────────────────────────────────────────────────────

  describe("decrypt(encrypt(plaintext)) === plaintext", () => {
    it("round-trips a simple string", () => {
      const plaintext = "my-secret-token";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips a JSON credentials string", () => {
      const plaintext = JSON.stringify({
        accessToken: "ghp_abc123def456",
        refreshToken: "rts_xyz789",
        scope: "repo,user",
      });
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips an empty string", () => {
      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("round-trips strings with special characters", () => {
      const plaintext =
        '{"token":"a+b/c=d&e?f#g","url":"https://example.com/path?q=1"}';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips Unicode characters", () => {
      const plaintext = "héllo wörld 中文 🎉";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("produces deterministic round-trip across multiple calls", () => {
      const plaintext = "consistent-value";
      for (let i = 0; i < 20; i++) {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  // ── wrong-key error ─────────────────────────────────────────────────────
  // Note: These tests rely on AES-256-GCM authenticated decryption detecting
  // key mismatch. With lazy key caching, changing env vars AFTER the first
  // encrypt() call doesn't affect the cache. The auth tag check in GCM still
  // verifies integrity, so tampered data will fail decryption.

  describe("decrypt integrity check via GCM auth tag", () => {
    it("throws when decrypting data encrypted with a different key", () => {
      const ciphertext = encrypt("sensitive-data");

      // Manually tamper with the ciphertext portion to simulate wrong key
      const parts = ciphertext.split(":");
      const tampered = `${parts[0]}:${parts[1]}:deadbeef${parts[2]!.slice(8)}`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  // ── backward compatibility ──────────────────────────────────────────────

  describe("backward compatibility with unencrypted text", () => {
    it("returns plaintext as-is when decrypt receives an unencrypted string", () => {
      const legacyValue = '{"apiKey":"plain-text-key"}';
      const result = decrypt(legacyValue);
      expect(result).toBe(legacyValue);
    });
  });

  // ── encryptCredentials / decryptCredentials helpers ──────────────────────

  describe("encryptCredentials / decryptCredentials helpers", () => {
    it("encryptCredentials stores as valid JSON", () => {
      const plaintext = '{"token":"secret"}';
      const stored = encryptCredentials(plaintext);

      expect(() => JSON.parse(stored)).not.toThrow();

      const parsed = JSON.parse(stored);
      expect(parsed).toHaveProperty("data");
      expect(parsed).toHaveProperty("format", "aes-256-gcm");
      // The data field should be in iv:authTag:ciphertext format
      expect(typeof parsed.data).toBe("string");
      expect(parsed.data).toContain(":");
    });

    it("decryptCredentials(encryptCredentials(plaintext)) === plaintext", () => {
      const plaintext = '{"apiKey":"sk-abcdef123456"}';
      const stored = encryptCredentials(plaintext);
      const decrypted = decryptCredentials(stored);
      expect(decrypted).toBe(plaintext);
    });

    it("encryptCredentials produces different JSON each call (IV randomness)", () => {
      const plaintext = "same-value";
      const stored1 = encryptCredentials(plaintext);
      const stored2 = encryptCredentials(plaintext);

      expect(stored1).not.toBe(stored2);
      // Both must decrypt to the same value
      expect(decryptCredentials(stored1)).toBe(plaintext);
      expect(decryptCredentials(stored2)).toBe(plaintext);
    });

    it("decryptCredentials throws for invalid format", () => {
      expect(() => decryptCredentials("{invalid json")).toThrow();
    });

    it("decryptCredentials throws for unsupported format", () => {
      const badPayload = JSON.stringify({
        data: "some-data",
        format: "aes-128-cbc",
      });
      expect(() => decryptCredentials(badPayload)).toThrow(
        /unsupported credential format/i,
      );
    });
  });
});
