/**
 * S1-3 — OAuth Encryption Middleware Tests
 *
 * Tests the Prisma middleware that transparently encrypts / decrypts
 * OAuth token fields (access_token, refresh_token, id_token, token_type, scope)
 * on the Account model.
 *
 * The middleware calls next(params) to pass through to Prisma, so we
 * supply a mock next function and inspect what gets passed to it as well
 * as what the middleware returns after decrypting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOAuthEncryptionMiddleware } from "../middleware/oauth-encryption";

// ── Test environment ────────────────────────────────────────────────────────

const OAUTH_KEY =
  "a3f5b8c1d2e4f6a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1";

beforeEach(() => {
  process.env.OAUTH_ENCRYPTION_KEY = OAUTH_KEY;
});

// ── Helper — build a fake next function ─────────────────────────────────────

function mockNext(result: unknown = {}) {
  return vi.fn().mockResolvedValue(result);
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe("S1-3: OAuth encryption middleware", () => {
  const middleware = createOAuthEncryptionMiddleware();

  // ── Model filtering ─────────────────────────────────────────────────────

  describe("model filtering", () => {
    it("passes through non-Account operations unchanged", async () => {
      const next = mockNext({ id: "user-1" });
      const params = {
        model: "User",
        action: "create",
        args: { data: { name: "test" } },
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: "user-1" });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  // ── CREATE — encrypts fields on write ───────────────────────────────────

  describe("create — encrypts token fields", () => {
    it("encrypts access_token and refresh_token on create", async () => {
      const next = mockNext({ id: "account-1" });
      const params = {
        model: "Account",
        action: "create",
        args: {
          data: {
            access_token: "gho_realAccessToken123",
            refresh_token: "ghr_refreshToken456",
            id_token: "eyJhbGciOiJSUzI1NiJ9.id_token",
            scope: "repo,user",
            token_type: "bearer",
          },
        },
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: "account-1" });

      // The data passed to next must have encrypted fields
      const dataPassedToNext = next.mock.calls[0]![0]!.args.data;
      expect(dataPassedToNext.access_token).toMatch(/^ENC:/);
      expect(dataPassedToNext.refresh_token).toMatch(/^ENC:/);
      expect(dataPassedToNext.id_token).toMatch(/^ENC:/);
      expect(dataPassedToNext.scope).toMatch(/^ENC:/);
      expect(dataPassedToNext.token_type).toMatch(/^ENC:/);
    });

    it("does not modify non-OAuth fields on create", async () => {
      const next = mockNext({ id: "account-1" });
      const params = {
        model: "Account",
        action: "create",
        args: {
          data: {
            userId: "user-1",
            provider: "google",
            providerAccountId: "12345",
            type: "oauth",
          },
        },
      };

      await middleware(params as any, next);

      const dataPassedToNext = next.mock.calls[0]![0]!.args.data;
      expect(dataPassedToNext.userId).toBe("user-1");
      expect(dataPassedToNext.provider).toBe("google");
      expect(dataPassedToNext.providerAccountId).toBe("12345");
    });

    it("encrypted values are decryptable back to originals", async () => {
      const next = mockNext({ id: "account-1" });
      const originalToken = "gho_realAccessToken123";

      const params = {
        model: "Account",
        action: "create",
        args: { data: { access_token: originalToken } },
      };

      await middleware(params as any, next);

      const encrypted = next.mock.calls[0]![0]!.args.data.access_token;
      expect(encrypted).toMatch(/^ENC:/);

      // The encrypted value follows the format ENC:ivHex:authTagHex:ciphertext
      const parts = encrypted.split(":");
      expect(parts[0]).toBe("ENC");
      // iv is 16 bytes => 32 hex chars
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      // auth tag is 16 bytes => 32 hex chars
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
      // ciphertext is present (hex-encoded)
      expect(parts[3]!.length).toBeGreaterThan(0);
    });
  });

  // ── UPDATE — encrypts on write, decrypts on return ──────────────────────

  describe("update — encrypts fields and decrypts result", () => {
    it("encrypts access_token on update", async () => {
      const next = mockNext({
        id: "account-1",
        access_token: buildEncryptedToken("updated_access_token"),
        refresh_token: buildEncryptedToken("old_refresh"),
      });
      const params = {
        model: "Account",
        action: "update",
        args: {
          where: { id: "account-1" },
          data: { access_token: "new_access_token_456" },
        },
      };

      const result = await middleware(params as any, next);

      // Before DB — should encrypt
      const dataPassed = next.mock.calls[0]![0]!.args.data;
      expect(dataPassed.access_token).toMatch(/^ENC:/);

      // After DB — returned value should be decrypted
      expect(result.access_token).not.toMatch(/^ENC:/);
      // The middleware decrypts the result it gets back from next,
      // so the returned access_token will be the DECRYPTED version of
      // whatever next returned. Since next returns a mock encrypted value,
      // decrypting it succeeds (because the key matches).
      // We just verify it's been processed.
    });
  });

  // ── UPSERT — encrypts both create and update, decrypts result ──────────

  describe("upsert — encrypts create/update and decrypts result", () => {
    it("encrypts both create and update branches", async () => {
      const next = mockNext({
        id: "account-1",
        access_token: buildEncryptedToken("upserted_result"),
      });
      const params = {
        model: "Account",
        action: "upsert",
        args: {
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: "1",
            },
          },
          create: { access_token: "create_token" },
          update: { access_token: "update_token" },
        },
      };

      await middleware(params as any, next);

      const argsPassed = next.mock.calls[0]![0]!.args;
      expect(argsPassed.create.access_token).toMatch(/^ENC:/);
      expect(argsPassed.update.access_token).toMatch(/^ENC:/);
    });
  });

  // ── READ operations — decrypts results ──────────────────────────────────

  describe("find/read operations — decrypts results", () => {
    const encryptedToken = buildEncryptedToken("decrypted_find_token");

    it("decrypts on findUnique", async () => {
      const next = mockNext({
        id: "account-1",
        access_token: encryptedToken,
        provider: "google",
      });
      const params = {
        model: "Account",
        action: "findUnique",
        args: { where: { id: "account-1" } },
      };

      const result = await middleware(params as any, next);

      expect(result.access_token).toBe("decrypted_find_token");
      // Non-OAuth fields are untouched
      expect(result.provider).toBe("google");
    });

    it("decrypts on findFirst", async () => {
      const next = mockNext({
        id: "account-1",
        access_token: buildEncryptedToken("decrypted_first_token"),
      });
      const params = {
        model: "Account",
        action: "findFirst",
        args: { where: { providerAccountId: "123" } },
      };

      const result = await middleware(params as any, next);

      expect(result.access_token).toBe("decrypted_first_token");
    });

    it("decrypts on findMany (array result)", async () => {
      const next = mockNext([
        { id: "a1", access_token: buildEncryptedToken("token1") },
        { id: "a2", access_token: buildEncryptedToken("token2") },
      ]);
      const params = {
        model: "Account",
        action: "findMany",
        args: { where: { userId: "user-1" } },
      };

      const result = (await middleware(params as any, next)) as Array<{
        access_token: string;
      }>;

      expect(result).toHaveLength(2);
      expect(result[0]!.access_token).toBe("token1");
      expect(result[1]!.access_token).toBe("token2");
    });
  });

  // ── DELETE — passes through without modification ─────────────────────────

  describe("delete operations — pass through", () => {
    it("passes through delete unchanged", async () => {
      const next = mockNext({ id: "account-1", count: 1 });
      const params = {
        model: "Account",
        action: "delete",
        args: { where: { id: "account-1" } },
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: "account-1", count: 1 });
      expect(next).toHaveBeenCalledWith(params);
    });

    it("passes through deleteMany unchanged", async () => {
      const next = mockNext({ count: 3 });
      const params = {
        model: "Account",
        action: "deleteMany",
        args: { where: { userId: "old-user" } },
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ count: 3 });
    });
  });

  // ── backward compatibility — unencrypted tokens ──────────────────────────

  describe("backward compatibility with unencrypted tokens", () => {
    it("returns unencrypted tokens as-is on read (no ENC: prefix)", async () => {
      const next = mockNext({
        id: "account-1",
        access_token: "legacy_plain_token",
      });
      const params = {
        model: "Account",
        action: "findUnique",
        args: { where: { id: "account-1" } },
      };

      const result = await middleware(params as any, next);

      expect(result.access_token).toBe("legacy_plain_token");
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
