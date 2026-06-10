import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getOAuthKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("OAUTH_ENCRYPTION_KEY environment variable is required");
  }
  // Dérive une clé de 32 bytes depuis la variable
  return scryptSync(key, "oauth-encryption-salt", 32);
}

// Champs à chiffrer dans le modèle Account
const OAUTH_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
  "token_type",
  "scope",
] as const;

function encryptField(plaintext: string): string {
  const key = getOAuthKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: "ENC:iv:authTag:ciphertext" — le préfixe "ENC:" sert de flag
  // indiquant que c'est chiffré (backward compat avec les tokens en clair)
  return `ENC:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptField(encryptedText: string): string {
  if (!encryptedText.startsWith("ENC:")) {
    // backward compat — pas encore chiffré
    return encryptedText;
  }

  const key = getOAuthKey();
  const parts = encryptedText.split(":");

  if (parts.length !== 4) {
    throw new Error("Invalid encrypted format");
  }

  const [, ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function encryptData(data: Record<string, unknown>): void {
  if (!data) return;

  for (const field of OAUTH_FIELDS) {
    if (data[field] && typeof data[field] === "string") {
      data[field] = encryptField(data[field] as string);
    }
  }
}

function decryptRecord(record: Record<string, unknown>): void {
  if (!record || typeof record !== "object") return;

  for (const field of OAUTH_FIELDS) {
    if (record[field] && typeof record[field] === "string") {
      record[field] = decryptField(record[field] as string);
    }
  }
}

export function decryptResult(result: unknown): void {
  if (!result) return;

  if (Array.isArray(result)) {
    for (const record of result) {
      decryptRecord(record as Record<string, unknown>);
    }
  } else {
    decryptRecord(result as Record<string, unknown>);
  }
}

/**
 * NOTE: Prisma 7.x has removed the $use middleware API (formerly used for
 * transparent OAuth encryption/decryption). The encryptData/decryptResult
 * utility functions below are kept for explicit application-level use.
 *
 * To apply OAuth encryption in Prisma 7, call these functions at the
 * service/route level when operating on the Account model:
 *
 *   import { encryptData, decryptResult } from './oauth-encryption'
 *   // Before write:
 *   encryptData(createArgs.data as any)
 *   // After read:
 *   decryptResult(result)
 */
