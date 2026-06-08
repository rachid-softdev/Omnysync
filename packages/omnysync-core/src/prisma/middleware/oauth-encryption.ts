import { Prisma } from "@prisma/client";
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

function encryptData(data: Record<string, unknown>): void {
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

function decryptResult(result: unknown): void {
  if (!result) return;

  if (Array.isArray(result)) {
    for (const record of result) {
      decryptRecord(record as Record<string, unknown>);
    }
  } else {
    decryptRecord(result as Record<string, unknown>);
  }
}

export function createOAuthEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Intercepter uniquement les opérations sur le modèle Account
    if (params.model !== "Account") {
      return next(params);
    }

    // === ÉCRITURE : chiffrement avant envoi à la DB ===
    if (params.action === "create") {
      encryptData(params.args.data as Record<string, unknown>);
      return next(params);
    }

    if (params.action === "update") {
      encryptData(params.args.data as Record<string, unknown>);
      const result = await next(params);
      decryptResult(result);
      return result;
    }

    if (params.action === "upsert") {
      if (params.args.create) {
        encryptData(params.args.create as Record<string, unknown>);
      }
      if (params.args.update) {
        encryptData(params.args.update as Record<string, unknown>);
      }
      const result = await next(params);
      decryptResult(result);
      return result;
    }

    if (params.action === "updateMany") {
      encryptData(params.args.data as Record<string, unknown>);
      return next(params);
    }

    // === LECTURE : déchiffrement après récupération DB ===
    if (
      params.action === "findUnique" ||
      params.action === "findUniqueOrThrow" ||
      params.action === "findFirst" ||
      params.action === "findFirstOrThrow" ||
      params.action === "findMany"
    ) {
      const result = await next(params);
      decryptResult(result);
      return result;
    }

    // === SUPPRESSION : pas de manipulation nécessaire ===
    // delete / deleteMany passent directement

    return next(params);
  };
}
