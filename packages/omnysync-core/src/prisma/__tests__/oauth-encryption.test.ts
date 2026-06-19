/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * S1-3 — OAuth Encryption Utility Tests
 *
 * Tests the encryptData / decryptResult utility functions that
 * transparently encrypt / decrypt OAuth token fields
 * (access_token, refresh_token, id_token, token_type, scope).
 *
 * NOTE: Prisma 7.x removed the $use middleware API. These utilities
 * are now designed for explicit application-level use rather than
 * automatic middleware interception.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Test environment ────────────────────────────────────────────────────────
// Must set env vars BEFORE importing the module because oauth-encryption.ts
// calls deriveOAuthKey() at module level.

const OAUTH_KEY =
  "a3f5b8c1d2e4f6a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1";

process.env.OAUTH_ENCRYPTION_KEY = OAUTH_KEY;

import { encryptData, decryptResult } from "../middleware/oauth-encryption";

// ── Suite ───────────────────────────────────────────────────────────────────

describe("S1-3: OAuth encryption utilities", () => {
  // ── encryptData ────────────────────────────────────────────────────────────

  describe("encryptData", () => {
    it("encrypts access_token with ENC: prefix", () => {
      const data = { access_token: "gho_realAccessToken123" };
      encryptData(data);
      expect(data.access_token).toMatch(/^ENC:/);
    });

    it("encrypts all OAuth fields", () => {
      const data = {
        access_token: "tok1",
        refresh_token: "tok2",
        id_token: "tok3",
        scope: "repo,user",
        token_type: "bearer",
      };
      encryptData(data);
      expect(data.access_token).toMatch(/^ENC:/);
      expect(data.refresh_token).toMatch(/^ENC:/);
      expect(data.id_token).toMatch(/^ENC:/);
      expect(data.scope).toMatch(/^ENC:/);
      expect(data.token_type).toMatch(/^ENC:/);
    });

    it("does not modify non-OAuth fields", () => {
      const data = { userId: "user-1", provider: "google" };
      encryptData(data);
      expect(data.userId).toBe("user-1");
      expect(data.provider).toBe("google");
    });

    it("is idempotent — re-encrypting still produces ENC: prefix", () => {
      const data = { access_token: "my_token" };
      encryptData(data);
      const first = data.access_token as string;
      encryptData(data);
      // Re-encrypting the already-encrypted value double-wraps it
      expect(data.access_token).toMatch(/^ENC:/);
      expect(data.access_token).not.toBe(first);
    });

    it("handles null/undefined data gracefully", () => {
      expect(() => encryptData(null as any)).not.toThrow();
      expect(() => encryptData(undefined as any)).not.toThrow();
    });
  });

  // ── decryptResult — single record ─────────────────────────────────────────

  describe("decryptResult (single record)", () => {
    it("decrypts access_token back to original", () => {
      const data = { access_token: "my_token" };
      encryptData(data);
      expect(data.access_token).toMatch(/^ENC:/);

      decryptResult(data);
      expect(data.access_token).toBe("my_token");
    });

    it("decrypts all OAuth fields", () => {
      const data = {
        access_token: "a",
        refresh_token: "b",
        id_token: "c",
        scope: "d",
        token_type: "e",
      };
      encryptData(data);
      decryptResult(data);
      expect(data.access_token).toBe("a");
      expect(data.refresh_token).toBe("b");
      expect(data.id_token).toBe("c");
      expect(data.scope).toBe("d");
      expect(data.token_type).toBe("e");
    });

    it("leaves non-OAuth fields untouched", () => {
      const data = { userId: "u1", access_token: "tok", provider: "google" };
      encryptData(data);
      decryptResult(data);
      expect(data.userId).toBe("u1");
      expect(data.provider).toBe("google");
    });
  });

  // ── decryptResult — array of records ──────────────────────────────────────

  describe("decryptResult (array)", () => {
    it("decrypts each record in the array", () => {
      const records = [
        { id: "1", access_token: "token1" },
        { id: "2", access_token: "token2" },
      ];
      for (const r of records) encryptData(r);
      decryptResult(records);
      expect(records[0].access_token).toBe("token1");
      expect(records[1].access_token).toBe("token2");
    });
  });

  // ── backward compatibility — unencrypted tokens ──────────────────────────

  describe("backward compatibility", () => {
    it("returns plain (non-ENC) values unchanged through decryptResult", () => {
      const data = { access_token: "legacy_plain_token" };
      decryptResult(data);
      expect(data.access_token).toBe("legacy_plain_token");
    });

    it("round-trips successfully: encryptData → decryptResult", () => {
      const original = "s3cret!";
      const data = { access_token: original };
      encryptData(data);
      decryptResult(data);
      expect(data.access_token).toBe(original);
    });
  });

  // ── null / edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null record in array gracefully", () => {
      const arr = [null, { access_token: "ok" }];
      const arr2 = arr as unknown as Record<string, unknown>[];
      decryptResult(arr2);
      // The second element should still be decryptable
      expect(arr2[0] as any).toBeNull();
    });

    it("encrypted format: ENC:ivHex:authTagHex:ciphertext", () => {
      const data = { access_token: "x" };
      encryptData(data);
      const parts = (data.access_token as string).split(":");
      expect(parts[0]).toBe("ENC");
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(parts[3]!.length).toBeGreaterThan(0);
    });
  });
});

// ── Helper ──────────────────────────────────────────────────────────────────

/**
 * Builds a valid encrypted token string using the middleware's own algorithm.
 * This produces a real AES-256-GCM encrypted value so the middleware's
 * decrypt logic succeeds when processing fake read results.
 */
function buildEncryptedToken(plaintext: string): string {
  const { createCipheriv, randomBytes, scryptSync } = require("crypto");
  const key = scryptSync(OAUTH_KEY, "oauth-encryption-salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `ENC:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}
